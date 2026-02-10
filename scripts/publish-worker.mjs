// BullMQ publish worker
// Runs alongside the Next.js app.
//
// Required env:
// - REDIS_URL
// - NEXT_PUBLIC_SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
//
// NOTE: This worker intentionally does not run inside Next.js runtime.

import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const X_API_BASE = 'https://api.twitter.com';

function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret = '') {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  return crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');
}

function buildOAuthHeader(oauthParams) {
  const headerParams = Object.keys(oauthParams)
    .filter((k) => k.startsWith('oauth_'))
    .sort()
    .map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${headerParams}`;
}

async function postTweet(accessToken, accessTokenSecret, status, options) {
  const url = `${X_API_BASE}/1.1/statuses/update.json`;

  const apiKey = options.apiKey;
  const apiSecret = options.apiSecret;

  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_token: accessToken,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: generateNonce(),
    oauth_version: '1.0',
  };

  const queryParams = { status };
  if (options.inReplyToStatusId) {
    queryParams.in_reply_to_status_id = options.inReplyToStatusId;
    queryParams.auto_populate_reply_metadata = 'true';
  }

  const allParams = { ...oauthParams, ...queryParams };
  oauthParams.oauth_signature = generateOAuthSignature('POST', url, allParams, apiSecret, accessTokenSecret);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: buildOAuthHeader(oauthParams),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(queryParams),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to post tweet: ${text}`);
  }

  return response.json();
}

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function publishScheduledPost(scheduledPostId, userId) {
  // Load scheduled post
  const { data: post, error: postErr } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('id', scheduledPostId)
    .eq('user_id', userId)
    .single();

  if (postErr) throw postErr;
  assert(post, 'scheduled post not found');

  if (post.status === 'cancelled') {
    return { skipped: true, reason: 'cancelled' };
  }

  // Mark publishing
  await supabase
    .from('scheduled_posts')
    .update({ status: 'publishing', updated_at: new Date().toISOString(), error: null })
    .eq('id', scheduledPostId)
    .eq('user_id', userId);

  // Load BYO creds + x connection
  const { data: byo } = await supabase
    .from('x_byo_apps')
    .select('consumer_key, consumer_secret')
    .eq('user_id', userId)
    .single();

  assert(byo?.consumer_key && byo?.consumer_secret, 'missing BYO X API credentials');

  const { data: conn } = await supabase
    .from('x_connections')
    .select('access_token, access_token_secret, x_username')
    .eq('user_id', userId)
    .single();

  assert(conn?.access_token && conn?.access_token_secret, 'missing X connection');

  const payload = post.payload || {};

  let postedIds = [];

  if (post.content_type === 'X_POST') {
    const text = String(payload.text || '').trim();
    assert(text, 'missing text');

    const posted = await postTweet(conn.access_token, conn.access_token_secret, text, {
      apiKey: byo.consumer_key,
      apiSecret: byo.consumer_secret,
    });

    postedIds = [posted.id_str];
  } else if (post.content_type === 'X_THREAD') {
    const tweets = Array.isArray(payload.tweets)
      ? payload.tweets
      : Array.isArray(payload.posts)
        ? payload.posts
        : [];
    const cleaned = tweets.map((t) => String(t || '').trim()).filter(Boolean);
    assert(cleaned.length > 0, 'missing tweets');

    const first = await postTweet(conn.access_token, conn.access_token_secret, cleaned[0], {
      apiKey: byo.consumer_key,
      apiSecret: byo.consumer_secret,
    });
    postedIds.push(first.id_str);

    let replyTo = first.id_str;
    for (let i = 1; i < cleaned.length; i++) {
      const next = await postTweet(conn.access_token, conn.access_token_secret, cleaned[i], {
        inReplyToStatusId: replyTo,
        apiKey: byo.consumer_key,
        apiSecret: byo.consumer_secret,
      });
      postedIds.push(next.id_str);
      replyTo = next.id_str;
    }
  } else {
    throw new Error(`unsupported content_type: ${post.content_type}`);
  }

  // Backfill captured_posts so the rest of the app stays consistent.
  try {
    const username = conn?.x_username ? String(conn.x_username) : null;
    const nowIso = new Date().toISOString();

    const items = [];
    if (post.content_type === 'X_POST') {
      items.push({ id: postedIds[0], text: String(payload.text || '').trim() });
    } else if (post.content_type === 'X_THREAD') {
      const tweets = Array.isArray(payload.tweets)
        ? payload.tweets
        : Array.isArray(payload.posts)
          ? payload.posts
          : [];
      const cleaned = tweets.map((t) => String(t || '').trim()).filter(Boolean);
      for (let i = 0; i < postedIds.length; i++) {
        items.push({ id: postedIds[i], text: cleaned[i] || '' });
      }
    }

    const rows = items
      .filter((it) => it.id)
      .map((it) => ({
        user_id: userId,
        x_post_id: it.id,
        post_url: username ? `https://x.com/${username}/status/${it.id}` : null,
        author_handle: username,
        text_content: it.text,
        is_own_post: true,
        inbox_status: 'triaged',
        triaged_as: 'my_post',
        post_timestamp: nowIso,
        metrics: {},
      }));

    if (rows.length > 0) {
      await supabase.from('captured_posts').insert(rows);
    }
  } catch (e) {
    console.warn('[publish-worker] failed to backfill captured_posts', e?.message || e);
  }

  await supabase
    .from('scheduled_posts')
    .update({
      status: 'posted',
      posted_post_ids: postedIds,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduledPostId)
    .eq('user_id', userId);

  return { success: true, postedIds };
}

const worker = new Worker(
  'publish',
  async (job) => {
    const { scheduledPostId, userId } = job.data || {};
    assert(scheduledPostId && userId, 'missing job data');

    try {
      return await publishScheduledPost(scheduledPostId, userId);
    } catch (err) {
      // Mark failed
      try {
        await supabase
          .from('scheduled_posts')
          .update({
            status: 'failed',
            error: String(err?.message || err),
            updated_at: new Date().toISOString(),
          })
          .eq('id', scheduledPostId)
          .eq('user_id', userId);
      } catch {}

      throw err;
    }
  },
  { connection }
);

worker.on('ready', () => console.log('[publish-worker] ready'));
worker.on('failed', (job, err) => console.error('[publish-worker] failed', job?.id, err?.message));
worker.on('error', (err) => console.error('[publish-worker] error', err?.message));
