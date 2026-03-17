// BullMQ publish worker
// Runs alongside the Next.js app.
//
// Required env:
// - REDIS_URL
// - NEXT_PUBLIC_SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - X_CLIENT_ID
// - X_CLIENT_SECRET
//
// NOTE: This worker intentionally does not run inside Next.js runtime.

import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { createClient } from '@supabase/supabase-js';

const X_API_BASE = 'https://api.twitter.com';

async function postTweet(accessToken, status, options = {}) {
  const url = `${X_API_BASE}/2/tweets`;

  const body = { text: status };
  if (options.inReplyToStatusId) {
    body.reply = { in_reply_to_tweet_id: options.inReplyToStatusId };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to post tweet (${response.status}): ${text}`);
  }

  const data = await response.json();
  return { id_str: data.data.id };
}

async function refreshAccessToken(refreshToken) {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;

  const body = {
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
  };
  if (clientSecret) {
    body.client_secret = clientSecret;
  }

  const response = await fetch(`${X_API_BASE}/2/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh access token: ${text}`);
  }

  return response.json();
}

async function getValidAccessToken(supabase, userId) {
  const { data: conn, error } = await supabase
    .from('x_connections')
    .select('access_token, refresh_token, access_token_expires_at, x_username')
    .eq('user_id', userId)
    .single();

  if (error || !conn?.access_token) {
    throw new Error('X account not connected');
  }

  const expiresAt = conn.access_token_expires_at
    ? new Date(conn.access_token_expires_at).getTime()
    : Infinity;
  const bufferMs = 5 * 60 * 1000;

  // Token still valid
  if (Date.now() < expiresAt - bufferMs) {
    return { accessToken: conn.access_token, connection: conn };
  }

  // Need to refresh
  if (!conn.refresh_token) {
    throw new Error('No refresh token available — reconnect X account');
  }

  const tokens = await refreshAccessToken(conn.refresh_token);
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Race-safe update
  const { data: updated, error: updateErr } = await supabase
    .from('x_connections')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      access_token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('refresh_token', conn.refresh_token)
    .select('access_token, x_username')
    .single();

  if (updateErr || !updated) {
    // Another process already refreshed — re-read
    const { data: reread } = await supabase
      .from('x_connections')
      .select('access_token, x_username')
      .eq('user_id', userId)
      .single();

    if (!reread?.access_token) {
      throw new Error('Failed to get valid access token after refresh race');
    }

    return { accessToken: reread.access_token, connection: reread };
  }

  return { accessToken: updated.access_token, connection: updated };
}

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!process.env.X_CLIENT_ID || !process.env.X_CLIENT_SECRET) {
  console.error('Missing X_CLIENT_ID or X_CLIENT_SECRET');
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

  // Get valid access token (auto-refreshes if needed)
  const { accessToken, connection: conn } = await getValidAccessToken(supabase, userId);

  const payload = post.payload || {};

  let postedIds = [];

  if (post.content_type === 'X_POST') {
    const text = String(payload.text || '').trim();
    assert(text, 'missing text');

    const posted = await postTweet(accessToken, text);

    postedIds = [posted.id_str];
  } else if (post.content_type === 'X_THREAD') {
    const tweets = Array.isArray(payload.tweets)
      ? payload.tweets
      : Array.isArray(payload.posts)
        ? payload.posts
        : [];
    const cleaned = tweets.map((t) => String(t || '').trim()).filter(Boolean);
    assert(cleaned.length > 0, 'missing tweets');

    const first = await postTweet(accessToken, cleaned[0]);
    postedIds.push(first.id_str);

    let replyTo = first.id_str;
    for (let i = 1; i < cleaned.length; i++) {
      const next = await postTweet(accessToken, cleaned[i], {
        inReplyToStatusId: replyTo,
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
