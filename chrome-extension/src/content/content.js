// Content Pipeline - X Inspiration Saver & Reply Generator
// Content script for injecting inspiration save and reply buttons on X posts

const REPLY_BUTTON_CLASS = 'cp-reply-button';
const REPLY_PICKER_CLASS = 'cp-reply-picker';
const SAVED_CLASS = 'cp-saved';
const SAVING_CLASS = 'cp-saving';
const GENERATING_CLASS = 'cp-generating';

// Inspiration post save button class
const NICHE_SAVE_BUTTON_CLASS = 'cp-niche-save-button';

// Opportunity scoring classes
const OPP_PILL_CLASS = 'xgo-opp-pill';
const OPP_BORDER_CLASS = 'xgo-opp-border';

// Track which posts we've already processed
const processedPosts = new Set();
// Track saved inspiration post IDs
let savedNichePostIds = new Set();

// Cache for opportunity scores (tweet_id -> score data)
const scoreCache = new Map();

// Rolling min/max for score normalization
let scoreStats = { min: Infinity, max: -Infinity, samples: [] };

// Default opportunity settings
let oppSettings = {
  enabled: true,
  greenThreshold: 75,
  yellowThreshold: 60,
  maxReplies: 200,
  maxAgeHours: 24,
  showExplanation: false,
  useProxyScore: true, // Use engagement-based scoring when views unavailable
};

// Check if extension context is still valid
function isExtensionContextValid() {
  try {
    return chrome.runtime && !!chrome.runtime.id;
  } catch {
    return false;
  }
}

// Load opportunity settings from storage
if (isExtensionContextValid()) {
  chrome.storage.local.get(['oppSettings'], (result) => {
    if (result.oppSettings) {
      oppSettings = { ...oppSettings, ...result.oppSettings };
    }
  });
}

// ===========================================
// OPPORTUNITY SCORING UTILITIES
// ===========================================

/**
 * Parse count text with locale and abbreviations (K, M, B)
 * Accepts: "1", "12", "1.2K", "3K", "4.7M", "1,234"
 * Returns integer or null if unparseable
 */
function parseCount(text) {
  if (!text || typeof text !== 'string') return null;

  // Clean the text
  let cleaned = text.trim().replace(/,/g, '').toUpperCase();

  // Extract the numeric part with optional suffix
  const match = cleaned.match(/^([\d.]+)([KMB])?$/);
  if (!match) return null;

  let num = parseFloat(match[1]);
  if (isNaN(num)) return null;

  const suffix = match[2];
  if (suffix === 'K') num *= 1000;
  else if (suffix === 'M') num *= 1000000;
  else if (suffix === 'B') num *= 1000000000;

  return Math.round(num);
}

/**
 * Extract tweet ID from a post URL
 * e.g., "https://x.com/user/status/1234567890" -> "1234567890"
 */
function extractTweetId(postUrl) {
  if (!postUrl) return null;
  const match = postUrl.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Calculate post age in minutes from timestamp
 */
function calculatePostAgeMinutes(timestamp) {
  if (!timestamp) return null;

  const postDate = new Date(timestamp);
  if (isNaN(postDate.getTime())) return null;

  const now = new Date();
  const diffMs = now - postDate;
  return Math.max(0, Math.floor(diffMs / 60000)); // Convert to minutes
}

/**
 * Calculate opportunity score for a post
 * Returns { score, rawScore, reasons } or null if scoring not possible
 */
function calculateOpportunityScore(metrics, ageMinutes) {
  const ageHours = Math.max(0.1, ageMinutes / 60);

  // Hard filters (apply regardless of scoring mode)
  if (metrics.replies > oppSettings.maxReplies) {
    return { score: 0, rawScore: 0, reasons: ['Too many replies'], filtered: true };
  }
  if (ageHours > oppSettings.maxAgeHours) {
    return { score: 0, rawScore: 0, reasons: ['Post too old'], filtered: true };
  }

  const hasViews = metrics.views != null && metrics.views > 0;
  const quotes = metrics.quotes || 0;
  const eng = (metrics.likes || 0) + (2 * (metrics.retweets || 0)) + (2 * quotes);
  const competition = (metrics.replies || 0) + 1;

  let scoreRaw;
  let reasons = [];
  let isProxy = false;

  if (hasViews) {
    // Primary scoring: use views
    const velocity = metrics.views / ageHours;
    const vpr = metrics.views / competition;

    scoreRaw =
      0.50 * Math.log1p(velocity) +
      0.35 * Math.log1p(vpr) +
      0.15 * Math.log1p((eng + 1) / competition);

    // Build reasons
    if (velocity > 1000) reasons.push('High views per hour');
    else if (velocity > 500) reasons.push('Good view velocity');

    if (vpr > 100) reasons.push('Low replies vs views');
    else if (vpr > 50) reasons.push('Moderate competition');
  } else if (oppSettings.useProxyScore) {
    // Proxy scoring: use engagement when views unavailable
    // Estimate "attention" from likes/retweets velocity
    const engVelocity = eng / ageHours;
    const engPerReply = eng / competition;

    scoreRaw =
      0.60 * Math.log1p(engVelocity) +
      0.40 * Math.log1p(engPerReply);

    isProxy = true;

    // Build reasons
    if (engVelocity > 50) reasons.push('High engagement rate');
    else if (engVelocity > 20) reasons.push('Good engagement');

    if (engPerReply > 10) reasons.push('Low competition');
  } else {
    // No views and proxy scoring disabled
    return null;
  }

  // Freshness multiplier
  let multiplier = 1.0;
  if (ageMinutes < 10) {
    multiplier = 0.8; // Too early, little signal
  } else if (ageMinutes > 720) {
    multiplier = 0.4; // > 12h
  } else if (ageMinutes > 360) {
    multiplier = 0.7; // 6-12h
  }

  // Apply slight penalty to proxy scores (less reliable)
  if (isProxy) {
    multiplier *= 0.85;
  }

  const finalScore = scoreRaw * multiplier;

  if (ageMinutes >= 10 && ageMinutes <= 360) reasons.push('Fresh post');
  if (isProxy) reasons.push('Est. from engagement');

  return {
    score: finalScore,
    rawScore: scoreRaw,
    reasons,
    filtered: false,
    isProxy,
    metrics: { eng, ageHours, competition },
  };
}

/**
 * Normalize score to 0-100 using rolling min/max
 */
function normalizeScore(rawScore) {
  // Update rolling stats
  scoreStats.samples.push(rawScore);
  if (scoreStats.samples.length > 100) {
    scoreStats.samples.shift();
  }

  // Calculate min/max from samples
  if (scoreStats.samples.length > 0) {
    scoreStats.min = Math.min(...scoreStats.samples);
    scoreStats.max = Math.max(...scoreStats.samples);
  }

  // Avoid division by zero
  if (scoreStats.max === scoreStats.min) {
    return 50; // Default to middle if no range
  }

  // Normalize to 0-100
  const normalized = ((rawScore - scoreStats.min) / (scoreStats.max - scoreStats.min)) * 100;
  return Math.round(Math.max(0, Math.min(100, normalized)));
}

// Safe wrapper for chrome.runtime.sendMessage
async function sendMessage(message) {
  if (!isExtensionContextValid()) {
    throw new Error('EXTENSION_RELOADED');
  }
  return chrome.runtime.sendMessage(message);
}

// Show a notice when extension needs page refresh
let refreshNoticeShown = false;
function showRefreshNotice() {
  if (refreshNoticeShown) return;
  refreshNoticeShown = true;

  const notice = document.createElement('div');
  notice.className = 'cp-refresh-notice';

  const messageSpan = document.createElement('span');
  messageSpan.textContent = 'Agents For X was updated. Please refresh the page.';
  notice.appendChild(messageSpan);

  const refreshBtn = document.createElement('button');
  refreshBtn.textContent = 'Refresh';
  refreshBtn.addEventListener('click', () => location.reload());
  notice.appendChild(refreshBtn);

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'cp-dismiss';
  dismissBtn.textContent = '\u2715';
  dismissBtn.addEventListener('click', () => notice.remove());
  notice.appendChild(dismissBtn);

  document.body.appendChild(notice);
}

// Load saved inspiration post IDs from storage on init
if (isExtensionContextValid()) {
  chrome.storage.local.get(['savedNichePostIds'], (result) => {
    if (result.savedNichePostIds) {
      savedNichePostIds = new Set(result.savedNichePostIds);
    }
  });
}

// Listen for updates to saved inspiration posts
if (isExtensionContextValid()) {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.savedNichePostIds) {
        savedNichePostIds = new Set(changes.savedNichePostIds.newValue || []);
        updateAllNicheSaveButtons();
      }
    }
  });
}

function getSpinnerIcon() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" class="cp-spinner">
    <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle>
  </svg>`;
}

// AI Reply icon - robot emoji with dropdown arrow
function getReplyIcon() {
  return `<span style="font-size: 16px; line-height: 1;">🤖</span>`;
}

// Dropdown arrow icon
function getDropdownArrow() {
  return `<span style="font-size: 10px; line-height: 1; opacity: 0.7;">▾</span>`;
}

// Lightbulb icon for saving inspiration posts
function getInspirationIcon() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 18h6"></path>
    <path d="M10 22h4"></path>
    <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"></path>
  </svg>`;
}

// Lightbulb filled icon
function getInspirationFilledIcon() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 18h6"></path>
    <path d="M10 22h4"></path>
    <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"></path>
  </svg>`;
}

// Update all niche save buttons
function updateAllNicheSaveButtons() {
  document.querySelectorAll(`.${NICHE_SAVE_BUTTON_CLASS}`).forEach(button => {
    const postId = button.dataset.postId;
    if (postId && savedNichePostIds.has(postId)) {
      button.classList.add(SAVED_CLASS);
      button.querySelector('.cp-icon').innerHTML = getInspirationFilledIcon();
      button.title = 'Saved as niche post';
    }
  });
}

// ===========================================
// OPPORTUNITY UI COMPONENTS
// ===========================================

/**
 * Create opportunity pill element
 */
function createOpportunityPill(score, reasons, isProxy = false) {
  const pill = document.createElement('button');
  pill.className = OPP_PILL_CLASS;
  pill.setAttribute('data-xgo-opp-pill', 'true');

  // Determine color class based on thresholds
  let colorClass = '';
  if (score >= oppSettings.greenThreshold) {
    colorClass = 'xgo-opp-high';
  } else if (score >= oppSettings.yellowThreshold) {
    colorClass = 'xgo-opp-medium';
  }
  pill.classList.add(colorClass);

  // Add proxy class if score is estimated
  if (isProxy) {
    pill.classList.add('xgo-opp-proxy');
  }

  // Create pill content - show ~ prefix for proxy scores
  const scoreDisplay = isProxy ? `~${score}` : score;
  pill.innerHTML = `<span class="xgo-opp-score">Opp ${scoreDisplay}</span>`;

  // Add tooltip with reasons if enabled
  if (oppSettings.showExplanation && reasons.length > 0) {
    pill.title = reasons.join(' • ');
  } else {
    const proxyNote = isProxy ? ' (estimated from engagement)' : '';
    pill.title = `Opportunity score: ${score}${proxyNote}`;
  }

  return pill;
}

/**
 * Apply opportunity border styling to an article
 */
function applyOpportunityBorder(articleElement, score) {
  // Remove any existing border class
  articleElement.classList.remove('xgo-opp-border-high', 'xgo-opp-border-medium');

  if (score >= oppSettings.greenThreshold) {
    articleElement.classList.add(OPP_BORDER_CLASS, 'xgo-opp-border-high');
  } else if (score >= oppSettings.yellowThreshold) {
    articleElement.classList.add(OPP_BORDER_CLASS, 'xgo-opp-border-medium');
  }
}

/**
 * Score a post and update its UI
 */
function scoreAndDisplayOpportunity(articleElement) {
  if (!oppSettings.enabled) return;

  // Extract post data for scoring
  const postData = extractPostData(articleElement);
  if (!postData || !postData.post_url) return;

  const tweetId = extractTweetId(postData.post_url);
  if (!tweetId) return;

  // Check cache first
  if (scoreCache.has(tweetId)) {
    const cached = scoreCache.get(tweetId);
    displayOpportunityUI(articleElement, cached.normalizedScore, cached.reasons, cached.isProxy);
    return;
  }

  // Calculate age
  const ageMinutes = calculatePostAgeMinutes(postData.post_timestamp);
  if (ageMinutes === null) return;

  // Calculate score
  const result = calculateOpportunityScore(postData.metrics, ageMinutes);
  if (!result || result.filtered) return;

  // Normalize score to 0-100
  const normalizedScore = normalizeScore(result.score);

  // Cache the result
  scoreCache.set(tweetId, {
    normalizedScore,
    reasons: result.reasons,
    isProxy: result.isProxy || false,
    timestamp: Date.now(),
  });

  // Display UI
  displayOpportunityUI(articleElement, normalizedScore, result.reasons, result.isProxy);
}

/**
 * Display opportunity UI on an article
 */
function displayOpportunityUI(articleElement, score, reasons, isProxy = false) {
  // Skip if below threshold
  if (score < oppSettings.yellowThreshold) return;

  // Check if pill already exists
  if (articleElement.querySelector(`.${OPP_PILL_CLASS}`)) return;

  // Find the action bar
  const actionBar = articleElement.querySelector('[role="group"]');
  if (!actionBar) return;

  // Create and insert pill
  const pill = createOpportunityPill(score, reasons, isProxy);

  // When clicked, trigger the reply button
  pill.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Find article element dynamically to handle DOM recycling
    const article = pill.closest('article[data-testid="tweet"]');
    if (article) {
      const replyButton = article.querySelector(`.${REPLY_BUTTON_CLASS}`);
      if (replyButton) {
        replyButton.click();
      }
    }
  });

  // Insert at the beginning of action bar
  actionBar.insertBefore(pill, actionBar.firstChild);

  // Apply border styling
  applyOpportunityBorder(articleElement, score);
}

// ===========================================
// RICH CONTEXT EXTRACTION
// ===========================================

/**
 * Extract parent post if this is a reply
 * Looks for the post immediately above in thread view
 */
function extractParentPost(articleElement) {
  try {
    // Method 1: Look for "Replying to" indicator and find parent in thread
    // In thread view, parent posts are previous siblings or in a thread container

    // Check if this tweet has a "Replying to" section
    const replyingTo = articleElement.querySelector('[data-testid="reply"]')?.closest('article');

    // Method 2: Walk up to find thread container and get previous tweet
    // X renders threads in cellInnerDiv containers
    const cellContainer = articleElement.closest('[data-testid="cellInnerDiv"]');
    if (cellContainer) {
      // Get previous sibling cell which may contain parent tweet
      let prevCell = cellContainer.previousElementSibling;

      // Skip non-tweet cells (ads, suggestions, etc.)
      while (prevCell) {
        const parentArticle = prevCell.querySelector('article[data-testid="tweet"]');
        if (parentArticle) {
          // Check if connected by thread line (vertical connector)
          // Thread lines connect related tweets
          const hasThreadLine = prevCell.querySelector('[data-testid="Tweet-User-Avatar"]')?.closest('div')?.querySelector('div[style*="border"]') ||
                               cellContainer.querySelector('[style*="border-left"]');

          // Extract parent post data
          const parentText = parentArticle.querySelector('[data-testid="tweetText"]')?.textContent || '';
          const parentUserElement = parentArticle.querySelector('[data-testid="User-Name"]');
          let parentHandle = '';

          if (parentUserElement) {
            const spans = parentUserElement.querySelectorAll('span');
            for (const span of spans) {
              const text = span.textContent?.trim() || '';
              if (text.startsWith('@')) {
                parentHandle = text.replace('@', '');
                break;
              }
            }
          }

          if (parentText || parentHandle) {
            return {
              text: parentText,
              author: parentHandle,
              isThreaded: !!hasThreadLine,
            };
          }
        }
        prevCell = prevCell.previousElementSibling;

        // Only look one level up
        break;
      }
    }

    // Method 3: Check for "Replying to @handle" text
    const socialContext = articleElement.querySelector('[data-testid="socialContext"]');
    if (socialContext) {
      const replyText = socialContext.textContent || '';
      const replyMatch = replyText.match(/Replying to @(\w+)/i);
      if (replyMatch) {
        return {
          text: '', // We don't have the parent text in this case
          author: replyMatch[1],
          isThreaded: false,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('[Content Pipeline] Failed to extract parent post:', error);
    return null;
  }
}

/**
 * Extract quoted tweet if this post is a quote tweet
 */
function extractQuotedTweet(articleElement) {
  try {
    // Quoted tweets appear as a card inside the main tweet
    // Look for the quote tweet container
    const quoteTweetCard = articleElement.querySelector('[data-testid="quoteTweet"]') ||
                          articleElement.querySelector('[role="link"][href*="/status/"]')?.closest('[data-testid="card.wrapper"]');

    // Alternative: Look for embedded tweet structure
    // Quote tweets have a nested structure with border
    const cardWrappers = articleElement.querySelectorAll('[data-testid="card.wrapper"]');

    for (const card of cardWrappers) {
      // Check if this card contains tweet-like content (not a link preview)
      const cardLink = card.querySelector('a[href*="/status/"]');
      if (cardLink) {
        const quotedText = card.querySelector('[data-testid="tweetText"]')?.textContent ||
                          card.querySelector('[dir="auto"]')?.textContent || '';

        // Try to get author from the card
        let quotedAuthor = '';
        const authorLink = card.querySelector('a[href*="twitter.com/"], a[href*="x.com/"]');
        if (authorLink) {
          const match = authorLink.href.match(/(?:x|twitter)\.com\/([^/?]+)/);
          if (match && !['status', 'i'].includes(match[1])) {
            quotedAuthor = match[1];
          }
        }

        // Also check for @handle in text
        const spans = card.querySelectorAll('span');
        for (const span of spans) {
          const text = span.textContent?.trim() || '';
          if (text.startsWith('@') && !quotedAuthor) {
            quotedAuthor = text.replace('@', '');
            break;
          }
        }

        if (quotedText || quotedAuthor) {
          return {
            text: quotedText,
            author: quotedAuthor,
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('[Content Pipeline] Failed to extract quoted tweet:', error);
    return null;
  }
}

/**
 * Extract link card/preview if post contains a link
 */
function extractLinkCard(articleElement) {
  try {
    // Link cards show preview with title, description, domain
    const cardWrapper = articleElement.querySelector('[data-testid="card.wrapper"]');
    if (!cardWrapper) return null;

    // Skip if this is a quote tweet (has /status/ link)
    if (cardWrapper.querySelector('a[href*="/status/"]')) return null;

    // Extract link URL
    const linkElement = cardWrapper.querySelector('a[href]');
    const url = linkElement?.href || '';

    // Skip internal X links
    if (url.includes('x.com/') || url.includes('twitter.com/')) return null;

    // Extract title - usually in a prominent text element
    let title = '';
    let description = '';

    // Look for card content
    const cardTexts = cardWrapper.querySelectorAll('[dir="auto"], span');
    const textContents = [];

    for (const el of cardTexts) {
      const text = el.textContent?.trim();
      if (text && text.length > 5 && !text.startsWith('http')) {
        textContents.push(text);
      }
    }

    // Usually first substantial text is title, second is description
    if (textContents.length > 0) title = textContents[0];
    if (textContents.length > 1) description = textContents[1];

    // Extract domain
    let domain = '';
    try {
      domain = new URL(url).hostname.replace('www.', '');
    } catch {}

    if (url || title) {
      return {
        url,
        title,
        description,
        domain,
      };
    }

    return null;
  } catch (error) {
    console.error('[Content Pipeline] Failed to extract link card:', error);
    return null;
  }
}

/**
 * Extract media context (images, videos, GIFs)
 */
function extractMediaContext(articleElement) {
  try {
    const media = [];

    // Find all images in the tweet (not profile pics or quoted tweet images)
    const tweetPhotos = articleElement.querySelectorAll('[data-testid="tweetPhoto"]');

    for (const photoContainer of tweetPhotos) {
      const img = photoContainer.querySelector('img');
      if (img) {
        const alt = img.getAttribute('alt') || '';
        const src = img.getAttribute('src') || '';

        // Determine if alt text is meaningful or generic
        const isGenericAlt = !alt ||
                            alt === 'Image' ||
                            alt === 'Photo' ||
                            alt === 'GIF' ||
                            alt.length < 5;

        media.push({
          type: src.includes('.gif') || alt === 'GIF' ? 'gif' : 'image',
          alt: isGenericAlt ? null : alt,
          hasAlt: !isGenericAlt,
        });
      }
    }

    // Check for video
    const videoPlayer = articleElement.querySelector('[data-testid="videoPlayer"]');
    if (videoPlayer) {
      media.push({
        type: 'video',
        alt: null,
        hasAlt: false,
      });
    }

    // Check for GIF (sometimes separate from images)
    const gifPlayer = articleElement.querySelector('[data-testid="gifPlayer"]');
    if (gifPlayer && !media.some(m => m.type === 'gif')) {
      media.push({
        type: 'gif',
        alt: null,
        hasAlt: false,
      });
    }

    return media.length > 0 ? media : null;
  } catch (error) {
    console.error('[Content Pipeline] Failed to extract media context:', error);
    return null;
  }
}

// ===========================================
// POST DATA EXTRACTION
// ===========================================

function extractPostData(articleElement) {
  try {
    // Find the tweet link to get the URL
    const timeElement = articleElement.querySelector('time');
    const linkElement = timeElement?.closest('a');
    let postUrl = linkElement?.href || '';

    // Extract author info - try multiple methods
    let authorHandle = '';
    let authorName = '';

    // Method 1: Look for user-name test id
    const userNameElement = articleElement.querySelector('[data-testid="User-Name"]');
    if (userNameElement) {
      const links = userNameElement.querySelectorAll('a');
      for (const link of links) {
        const href = link.href || '';
        // Match profile URLs like x.com/username or twitter.com/username
        const profileMatch = href.match(/(?:x|twitter)\.com\/([^/?]+)/);
        if (profileMatch && profileMatch[1] && !['home', 'explore', 'notifications', 'messages', 'i'].includes(profileMatch[1])) {
          if (!authorHandle) {
            authorHandle = profileMatch[1];
          }
        }
        // Get display name from the link text
        const linkText = link.textContent?.trim() || '';
        if (linkText && !linkText.startsWith('@') && !authorName) {
          authorName = linkText;
        }
      }
      // Also look for @handle in spans
      const spans = userNameElement.querySelectorAll('span');
      for (const span of spans) {
        const text = span.textContent?.trim() || '';
        if (text.startsWith('@')) {
          authorHandle = text.replace('@', '');
          break;
        }
      }
    }

    // Method 2: Fallback - look for any profile link
    if (!authorHandle) {
      const allLinks = articleElement.querySelectorAll('a[role="link"]');
      for (const link of allLinks) {
        const href = link.href || '';
        const profileMatch = href.match(/(?:x|twitter)\.com\/([^/?]+)$/);
        if (profileMatch && profileMatch[1]) {
          authorHandle = profileMatch[1];
          const spans = link.querySelectorAll('span');
          for (const span of spans) {
            const text = span.textContent?.trim() || '';
            if (text && !text.startsWith('@') && !authorName) {
              authorName = text;
              break;
            }
          }
          break;
        }
      }
    }

    // Extract tweet text
    const tweetTextElement = articleElement.querySelector('[data-testid="tweetText"]');
    const textContent = tweetTextElement?.textContent || '';

    // If we still don't have a post URL, try to construct it
    if (!postUrl && authorHandle) {
      // Look for status link in the article
      const statusLinks = articleElement.querySelectorAll('a[href*="/status/"]');
      for (const link of statusLinks) {
        if (link.href) {
          postUrl = link.href;
          break;
        }
      }
    }

    // Extract metrics using robust extraction with fallbacks
    const metrics = {};

    // Helper to extract count from aria-label (handles "1.2K likes", "500 Retweets", etc.)
    function extractFromAriaLabel(element) {
      if (!element) return null;
      const label = element.getAttribute('aria-label') || '';
      // Match numbers with optional K/M/B suffix
      const match = label.match(/([\d,.]+[KMB]?)/i);
      return match ? parseCount(match[1]) : null;
    }

    // Helper to extract count from visible text inside element
    function extractFromVisibleText(element) {
      if (!element) return null;
      // Look for span with count text
      const spans = element.querySelectorAll('span');
      for (const span of spans) {
        const text = span.textContent?.trim();
        if (text && /^[\d,.]+[KMB]?$/i.test(text)) {
          return parseCount(text);
        }
      }
      return null;
    }

    // Likes - try aria-label first, then visible text
    const likeButton = articleElement.querySelector('[data-testid="like"]');
    metrics.likes = extractFromAriaLabel(likeButton) ?? extractFromVisibleText(likeButton) ?? 0;

    // Retweets
    const retweetButton = articleElement.querySelector('[data-testid="retweet"]');
    metrics.retweets = extractFromAriaLabel(retweetButton) ?? extractFromVisibleText(retweetButton) ?? 0;

    // Replies
    const replyButton = articleElement.querySelector('[data-testid="reply"]');
    metrics.replies = extractFromAriaLabel(replyButton) ?? extractFromVisibleText(replyButton) ?? 0;

    // Quotes (if shown - usually near retweet button or in a quote indicator)
    // X doesn't always show quote count separately, default to 0
    metrics.quotes = 0;

    // Views - multiple fallback strategies
    let views = null;

    // Strategy 1: Analytics link aria-label
    const analyticsLink = articleElement.querySelector('a[href*="/analytics"]');
    if (analyticsLink) {
      const label = analyticsLink.getAttribute('aria-label') || '';
      const match = label.match(/([\d,.]+[KMB]?)\s*view/i);
      if (match) views = parseCount(match[1]);
    }

    // Strategy 2: Views element with data-testid
    if (views === null) {
      const viewsElement = articleElement.querySelector('[data-testid="app-text-transition-container"]');
      if (viewsElement) {
        views = parseCount(viewsElement.textContent?.trim());
      }
    }

    // Strategy 3: Look for any element near analytics link with view count
    if (views === null && analyticsLink) {
      const parent = analyticsLink.parentElement;
      if (parent) {
        const spans = parent.querySelectorAll('span');
        for (const span of spans) {
          const text = span.textContent?.trim();
          if (text && /^[\d,.]+[KMB]?$/i.test(text)) {
            views = parseCount(text);
            break;
          }
        }
      }
    }

    if (views !== null) metrics.views = views;

    // Bookmarks
    const bookmarkButton = articleElement.querySelector('[data-testid="bookmark"]');
    metrics.bookmarks = extractFromAriaLabel(bookmarkButton) ?? extractFromVisibleText(bookmarkButton) ?? 0;

    // Extract timestamp
    const postTimestamp = timeElement?.getAttribute('datetime') || null;

    // Extract rich context for reply generation
    const parentPost = extractParentPost(articleElement);
    const quotedTweet = extractQuotedTweet(articleElement);
    const linkCard = extractLinkCard(articleElement);
    const media = extractMediaContext(articleElement);

    return {
      post_url: postUrl,
      author_handle: authorHandle,
      author_name: authorName,
      text_content: textContent,
      metrics,
      post_timestamp: postTimestamp,
      // Rich context
      context: {
        parent: parentPost,
        quoted: quotedTweet,
        link: linkCard,
        media: media,
      },
    };
  } catch (error) {
    console.error('[Content Pipeline] Failed to extract post data:', error);
    return null;
  }
}

// Create save niche post button
function createNicheSaveButton(postUrl, postId) {
  const button = document.createElement('button');
  button.className = NICHE_SAVE_BUTTON_CLASS;
  button.dataset.postUrl = postUrl;
  button.dataset.postId = postId;
  button.title = 'Save as pattern reference';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'cp-icon';
  iconSpan.innerHTML = getInspirationIcon();
  button.appendChild(iconSpan);

  // Check if already saved
  if (savedNichePostIds.has(postId)) {
    button.classList.add(SAVED_CLASS);
    iconSpan.innerHTML = getInspirationFilledIcon();
    button.title = 'Saved as niche post';
  }

  return button;
}

// Handle save niche post button click
async function handleNicheSaveClick(event, button) {
  event.preventDefault();
  event.stopPropagation();

  // Find the article element dynamically by traversing up from the button
  const articleElement = button.closest('article[data-testid="tweet"]');
  if (!articleElement) {
    console.error('[Content Pipeline] Could not find article element for niche save button');
    return;
  }

  if (button.classList.contains(SAVED_CLASS) || button.classList.contains(SAVING_CLASS)) {
    return;
  }

  const iconSpan = button.querySelector('.cp-icon');

  button.classList.add(SAVING_CLASS);
  iconSpan.innerHTML = getSpinnerIcon();
  button.title = 'Saving...';

  try {
    const postData = extractPostData(articleElement);

    if (!postData || !postData.post_url || !postData.text_content) {
      throw new Error('Could not extract post data');
    }

    // Extract post ID from URL
    const postId = extractTweetId(postData.post_url);

    const response = await sendMessage({
      type: 'SAVE_NICHE_POST',
      payload: {
        x_username: postData.author_handle,
        display_name: postData.author_name,
        x_post_id: postId,
        text_content: postData.text_content,
        metrics: postData.metrics,
        post_timestamp: postData.post_timestamp,
      },
    });

    if (response.success) {
      button.classList.remove(SAVING_CLASS);
      button.classList.add(SAVED_CLASS);
      iconSpan.innerHTML = getInspirationFilledIcon();
      button.title = 'Saved as niche post';

      savedNichePostIds.add(postId);
      chrome.storage.local.set({ savedNichePostIds: Array.from(savedNichePostIds) });
    } else {
      throw new Error(response.error || 'Failed to save');
    }
  } catch (error) {
    console.error('Save niche post failed:', error);
    button.classList.remove(SAVING_CLASS);
    iconSpan.innerHTML = getInspirationIcon();

    if (error.message === 'DUPLICATE') {
      button.classList.add(SAVED_CLASS);
      iconSpan.innerHTML = getInspirationFilledIcon();
      button.title = 'Already saved';
    } else if (error.message === 'NOT_LOGGED_IN') {
      button.title = 'Click extension icon to log in';
    } else if (error.message === 'EXTENSION_RELOADED') {
      button.title = 'Extension updated - please refresh page';
      showRefreshNotice();
    } else {
      button.title = 'Failed to save - try again';
    }
  }
}

// Tone options for reply generation
const TONE_OPTIONS = [
  { id: 'controversial', label: 'Controversial' },
  { id: 'sarcastic', label: 'Sarcastic' },
  { id: 'helpful', label: 'Helpful' },
  { id: 'insight', label: 'Insight' },
  { id: 'enthusiastic', label: 'Enthusiastic' },
];

// Create reply button with split design (robot emoji + dropdown)
function createReplyButton() {
  // Container for the split button
  const container = document.createElement('div');
  container.className = REPLY_BUTTON_CLASS;
  container.title = 'Generate AI Reply';

  // Main button area (robot emoji) - triggers default generation
  const mainButton = document.createElement('button');
  mainButton.className = 'cp-reply-button-main';
  mainButton.type = 'button';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'cp-icon';
  iconSpan.innerHTML = getReplyIcon();
  mainButton.appendChild(iconSpan);

  // Dropdown arrow button - opens tone menu
  const dropdownButton = document.createElement('button');
  dropdownButton.className = 'cp-reply-button-dropdown';
  dropdownButton.type = 'button';
  dropdownButton.title = 'Choose tone';

  const arrowSpan = document.createElement('span');
  arrowSpan.className = 'cp-dropdown-arrow';
  arrowSpan.innerHTML = getDropdownArrow();
  dropdownButton.appendChild(arrowSpan);

  container.appendChild(mainButton);
  container.appendChild(dropdownButton);

  return container;
}

// Create tone dropdown menu
function createToneDropdown() {
  const dropdown = document.createElement('div');
  dropdown.className = 'cp-tone-dropdown';

  TONE_OPTIONS.forEach(tone => {
    const option = document.createElement('button');
    option.className = 'cp-tone-option';
    option.type = 'button';
    option.dataset.tone = tone.id;
    option.textContent = tone.label;
    dropdown.appendChild(option);
  });

  return dropdown;
}

// Create reply picker to show generated options
function createReplyPicker() {
  const picker = document.createElement('div');
  picker.className = REPLY_PICKER_CLASS;
  picker.innerHTML = `
    <div class="cp-picker-header">
      <span class="cp-picker-title">Choose a reply</span>
      <button class="cp-picker-close">&times;</button>
    </div>
    <div class="cp-picker-options"></div>
    <div class="cp-picker-nav">
      <button class="cp-nav-prev" disabled>&larr;</button>
      <span class="cp-nav-indicator">1 / 3</span>
      <button class="cp-nav-next">&rarr;</button>
    </div>
    <button class="cp-picker-use">Use this reply</button>
  `;
  return picker;
}

// Submit feedback for a generated reply
function submitReplyFeedback(reply, feedbackType, articleElement) {
  const postData = extractPostData(articleElement);
  sendMessage({
    type: 'SUBMIT_FEEDBACK',
    payload: {
      feedback_type: feedbackType,
      generation_type: 'reply',
      content_text: reply.text,
      context_prompt: postData?.text_content || '',
      metadata: {
        approach: reply.approach,
        parent_post: {
          text: postData?.text_content || '',
          author_handle: postData?.author_handle || '',
          url: postData?.post_url || '',
        },
      },
    },
  }).catch((err) => {
    console.error('[Content Pipeline] Feedback submission failed:', err);
  });
}

// Show reply picker with generated options
function showReplyPicker(picker, replyButton, replies, articleElement) {
  let currentIndex = 0;

  const optionsContainer = picker.querySelector('.cp-picker-options');
  const indicator = picker.querySelector('.cp-nav-indicator');
  const prevBtn = picker.querySelector('.cp-nav-prev');
  const nextBtn = picker.querySelector('.cp-nav-next');
  const useBtn = picker.querySelector('.cp-picker-use');
  const closeBtn = picker.querySelector('.cp-picker-close');

  // Track feedback state per reply
  const feedbackState = {};

  // SVG markup for feedback icons (static, no user data)
  const thumbsUpSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>';
  const thumbsDownSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/></svg>';

  // Render current option
  function renderOption() {
    const reply = replies[currentIndex];
    const fb = feedbackState[currentIndex] || null;

    // Build DOM safely — reply.approach and reply.text come from API
    optionsContainer.textContent = '';

    const optionDiv = document.createElement('div');
    optionDiv.className = 'cp-reply-option';

    const approachSpan = document.createElement('span');
    approachSpan.className = 'cp-reply-approach';
    approachSpan.textContent = reply.approach;
    optionDiv.appendChild(approachSpan);

    const textP = document.createElement('p');
    textP.className = 'cp-reply-text';
    textP.textContent = reply.text;
    optionDiv.appendChild(textP);

    const feedbackRow = document.createElement('div');
    feedbackRow.className = 'cp-feedback-row';

    const likeBtn = document.createElement('button');
    likeBtn.className = 'cp-feedback-btn cp-feedback-like' + (fb === 'like' ? ' cp-feedback-active' : '');
    likeBtn.title = 'Like this generation';
    likeBtn.innerHTML = thumbsUpSVG;
    feedbackRow.appendChild(likeBtn);

    const dislikeBtn = document.createElement('button');
    dislikeBtn.className = 'cp-feedback-btn cp-feedback-dislike' + (fb === 'dislike' ? ' cp-feedback-active' : '');
    dislikeBtn.title = 'Dislike this generation';
    dislikeBtn.innerHTML = thumbsDownSVG;
    feedbackRow.appendChild(dislikeBtn);

    optionDiv.appendChild(feedbackRow);
    optionsContainer.appendChild(optionDiv);

    likeBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const newVal = feedbackState[currentIndex] === 'like' ? null : 'like';
      feedbackState[currentIndex] = newVal;
      renderOption();
      if (newVal) {
        submitReplyFeedback(reply, newVal, articleElement);
      }
    };

    dislikeBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const newVal = feedbackState[currentIndex] === 'dislike' ? null : 'dislike';
      feedbackState[currentIndex] = newVal;
      renderOption();
      if (newVal) {
        submitReplyFeedback(reply, newVal, articleElement);
      }
    };

    indicator.textContent = `${currentIndex + 1} / ${replies.length}`;
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === replies.length - 1;
  }

  // Navigation handlers
  prevBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentIndex > 0) {
      currentIndex--;
      renderOption();
    }
  };

  nextBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentIndex < replies.length - 1) {
      currentIndex++;
      renderOption();
    }
  };

  // Use reply handler
  useBtn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const selectedReply = replies[currentIndex].text;
    hideReplyPicker(picker);

    // Capture context so we can log the reply when user clicks Post
    const timeElement = articleElement.querySelector('time');
    const linkElement = timeElement?.closest('a');
    const repliedToUrl = linkElement?.href || '';
    const repliedToId = extractTweetId(repliedToUrl);

    // Click X's native reply button to open composer
    const xReplyButton = articleElement.querySelector('[data-testid="reply"]');
    if (xReplyButton) {
      xReplyButton.click();
      await injectReplyText(selectedReply, { repliedToUrl, repliedToId });
    } else {
      alert('Generated reply copied to clipboard:\n\n' + selectedReply);
      navigator.clipboard.writeText(selectedReply);
    }
  };

  // Close handler
  closeBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideReplyPicker(picker);
  };

  // Position picker anchored to the reply button, tracking on scroll
  picker.style.position = 'fixed';
  picker.style.zIndex = '10000';

  function updatePickerPosition() {
    const rect = replyButton.getBoundingClientRect();
    picker.style.top = `${rect.bottom + 10}px`;
    picker.style.left = `${Math.max(10, rect.left + rect.width / 2 - 150)}px`;
  }
  updatePickerPosition();

  renderOption();
  picker.classList.add('cp-visible');

  // Track button on scroll
  const scrollHandler = () => {
    if (picker.classList.contains('cp-visible')) {
      updatePickerPosition();
    }
  };
  window.addEventListener('scroll', scrollHandler, { passive: true });

  // Close when clicking outside
  const closeHandler = (e) => {
    if (!picker.contains(e.target) && !replyButton.contains(e.target)) {
      hideReplyPicker(picker);
      document.removeEventListener('click', closeHandler);
      window.removeEventListener('scroll', scrollHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

// Hide reply picker
function hideReplyPicker(picker) {
  picker.classList.remove('cp-visible');
}

// Show limit-reached upgrade prompt inside the reply picker
function showLimitReachedPicker(picker, replyButton) {
  const optionsContainer = picker.querySelector('.cp-picker-options');
  const indicator = picker.querySelector('.cp-nav-indicator');
  const prevBtn = picker.querySelector('.cp-nav-prev');
  const nextBtn = picker.querySelector('.cp-nav-next');
  const useBtn = picker.querySelector('.cp-picker-use');
  const closeBtn = picker.querySelector('.cp-picker-close');

  // Hide navigation elements
  prevBtn.style.display = 'none';
  nextBtn.style.display = 'none';
  indicator.textContent = '';

  // Build limit-reached content
  optionsContainer.textContent = '';

  const limitDiv = document.createElement('div');
  limitDiv.className = 'cp-reply-option';
  limitDiv.style.textAlign = 'center';

  const title = document.createElement('span');
  title.className = 'cp-reply-approach';
  title.textContent = 'Daily Limit Reached';
  title.style.color = '#EF4444';
  limitDiv.appendChild(title);

  const desc = document.createElement('p');
  desc.className = 'cp-reply-text';
  desc.textContent = 'You\'ve used all 5 free AI generations for today. Upgrade to Pro for unlimited replies.';
  desc.style.color = '#94A3B8';
  limitDiv.appendChild(desc);

  const upgradeLink = document.createElement('a');
  upgradeLink.textContent = 'Upgrade to Pro - $19/mo';
  upgradeLink.style.cssText = 'display:inline-block;margin-top:10px;padding:8px 20px;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;cursor:pointer;';
  upgradeLink.addEventListener('click', (e) => {
    e.preventDefault();
    // Get the dashboard URL from storage and open pricing page
    if (isExtensionContextValid()) {
      chrome.storage.local.get(['apiUrl'], (result) => {
        const baseUrl = result.apiUrl || 'https://app.agentsforx.com';
        window.open(`${baseUrl}/pricing`, '_blank');
      });
    } else {
      window.open('https://app.agentsforx.com/pricing', '_blank');
    }
  });
  limitDiv.appendChild(upgradeLink);

  optionsContainer.appendChild(limitDiv);

  // Update "Use" button to just close
  useBtn.textContent = 'Close';
  useBtn.onclick = () => {
    hideReplyPicker(picker);
    // Restore button defaults
    prevBtn.style.display = '';
    nextBtn.style.display = '';
    useBtn.textContent = 'Use this reply';
    useBtn.onclick = null;
  };

  closeBtn.onclick = () => {
    hideReplyPicker(picker);
    prevBtn.style.display = '';
    nextBtn.style.display = '';
    useBtn.textContent = 'Use this reply';
    useBtn.onclick = null;
  };

  // Position and show picker
  picker.style.position = 'fixed';
  picker.style.zIndex = '10001';

  const rect = replyButton.getBoundingClientRect();
  picker.style.top = `${rect.bottom + 8}px`;
  picker.style.left = `${Math.max(10, rect.left - 120)}px`;
  picker.classList.add('cp-visible');
}

// Handle reply button click - generate replies and show picker
// Optional tone parameter for tone-specific generation
async function handleReplyClick(event, replyButton, replyPicker, toneDropdown, tone = null) {
  event.preventDefault();
  event.stopPropagation();

  // Hide tone dropdown if visible
  if (toneDropdown && toneDropdown.classList.contains('cp-visible')) {
    toneDropdown.classList.remove('cp-visible');
  }

  // Find the article element dynamically by traversing up from the button
  // This ensures we always get the correct post even if DOM has been recycled
  const articleElement = replyButton.closest('article[data-testid="tweet"]');
  if (!articleElement) {
    console.error('[Content Pipeline] Could not find article element for reply button');
    return;
  }

  // Check if already generating
  if (replyButton.classList.contains(GENERATING_CLASS)) {
    return;
  }

  // If picker is visible, hide it
  if (replyPicker.classList.contains('cp-visible')) {
    hideReplyPicker(replyPicker);
    return;
  }

  const iconSpan = replyButton.querySelector('.cp-icon');

  // Set generating state
  replyButton.classList.add(GENERATING_CLASS);
  iconSpan.innerHTML = getSpinnerIcon();
  replyButton.title = tone ? `Generating ${tone} reply...` : 'Generating replies...';

  try {
    const postData = extractPostData(articleElement);

    if (!postData || !postData.text_content) {
      throw new Error('Could not extract post data');
    }

    // Send to background script for API call with rich context
    const response = await sendMessage({
      type: 'GENERATE_REPLY',
      payload: {
        post_text: postData.text_content,
        author_handle: postData.author_handle,
        context: postData.context,
        tone: tone || null,  // Pass tone to API
      },
    });

    if (response.success && response.replies && response.replies.length > 0) {
      replyButton.classList.remove(GENERATING_CLASS);
      iconSpan.innerHTML = getReplyIcon();
      replyButton.title = 'Generate AI Reply';

      // Show the picker with options
      showReplyPicker(replyPicker, replyButton, response.replies, articleElement);
    } else if (response.code === 'AI_LIMIT') {
      // Rate limited — show upgrade prompt in picker
      replyButton.classList.remove(GENERATING_CLASS);
      iconSpan.innerHTML = getReplyIcon();
      replyButton.title = 'Daily limit reached';
      showLimitReachedPicker(replyPicker, replyButton);
    } else {
      throw new Error(response.error || 'No replies generated');
    }
  } catch (error) {
    console.error('[Content Pipeline] Generate reply failed:', error);
    replyButton.classList.remove(GENERATING_CLASS);
    iconSpan.innerHTML = getReplyIcon();

    if (error.message === 'NOT_LOGGED_IN') {
      replyButton.title = 'Click extension icon to log in';
    } else if (error.message === 'EXTENSION_RELOADED' || error.message?.includes('Extension context invalidated')) {
      replyButton.title = 'Extension updated - please refresh page';
      showRefreshNotice();
    } else {
      replyButton.title = 'Failed to generate - try again';
    }
  }
}

// Show tone dropdown menu
// Track tone dropdown position on scroll
let _toneScrollHandler = null;

function showToneDropdown(dropdown, replyButton) {
  dropdown.style.position = 'fixed';
  dropdown.style.zIndex = '10000';

  function updatePos() {
    const rect = replyButton.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.left = `${Math.max(10, rect.left + rect.width / 2 - 60)}px`;
  }
  updatePos();

  // Clean up previous scroll listener if any
  if (_toneScrollHandler) {
    window.removeEventListener('scroll', _toneScrollHandler);
  }
  _toneScrollHandler = () => {
    if (dropdown.classList.contains('cp-visible')) {
      updatePos();
    }
  };
  window.addEventListener('scroll', _toneScrollHandler, { passive: true });

  dropdown.classList.add('cp-visible');
}

// Hide tone dropdown menu
function hideToneDropdown(dropdown) {
  dropdown.classList.remove('cp-visible');
  if (_toneScrollHandler) {
    window.removeEventListener('scroll', _toneScrollHandler);
    _toneScrollHandler = null;
  }
}

// Wait for composer and inject reply text
async function injectReplyText(text, replyMeta = null) {
  // Wait for the reply modal to appear (max 3 seconds)
  let attempts = 0;
  const maxAttempts = 30;

  // Count composers before clicking (to detect the new one)
  const composersBefore = document.querySelectorAll('[data-testid="tweetTextarea_0"]').length;
  console.log('[Content Pipeline] Composers before:', composersBefore);

  while (attempts < maxAttempts) {
    // Look specifically for the reply modal - it has layers structure
    // X uses a layered modal system with specific structure
    const layers = document.querySelector('#layers');
    let replyComposer = null;

    if (layers) {
      // The reply modal is inside #layers
      // Look for the contenteditable inside the layers (this is the reply box)
      const layerComposers = layers.querySelectorAll('[data-testid="tweetTextarea_0"]');
      if (layerComposers.length > 0) {
        // Use the first composer in layers (that's the reply modal)
        replyComposer = layerComposers[0];
        console.log('[Content Pipeline] Found composer in #layers');
      }
    }

    // Fallback: look for newly added composers
    if (!replyComposer) {
      const allComposers = document.querySelectorAll('[data-testid="tweetTextarea_0"]');
      if (allComposers.length > composersBefore) {
        // A new composer appeared - it's likely the reply box
        replyComposer = allComposers[allComposers.length - 1];
        console.log('[Content Pipeline] Found new composer (count increased)');
      }
    }

    if (replyComposer) {
      // Find the contenteditable element
      // The structure is: tweetTextarea_0 > div > div[contenteditable]
      let editableDiv = replyComposer.querySelector('[contenteditable="true"]');

      // If not found directly, the composer itself might have a different structure
      if (!editableDiv) {
        // Try finding it as a child or sibling
        const parent = replyComposer.closest('[data-testid="tweetTextarea_0RichTextInputContainer"]') ||
                       replyComposer.parentElement;
        if (parent) {
          editableDiv = parent.querySelector('[contenteditable="true"]');
        }
      }

      if (!editableDiv) {
        // Last resort - look anywhere in the reply area
        const replyArea = replyComposer.closest('[data-viewportview="true"]') ||
                          replyComposer.closest('[role="dialog"]') ||
                          replyComposer.parentElement?.parentElement;
        if (replyArea) {
          editableDiv = replyArea.querySelector('[contenteditable="true"]');
        }
      }

      if (editableDiv) {
        console.log('[Content Pipeline] Found editable div, injecting text');

        // Focus the element
        editableDiv.focus();
        await new Promise(resolve => setTimeout(resolve, 100));

        // Clear and insert text using execCommand
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editableDiv);
        selection.removeAllRanges();
        selection.addRange(range);

        // Insert the text
        document.execCommand('insertText', false, text);

        // Verify insertion
        await new Promise(resolve => setTimeout(resolve, 50));
        if (editableDiv.textContent.includes(text.substring(0, Math.min(20, text.length)))) {
          console.log('[Content Pipeline] Reply injected successfully');
          attachReplySendLogger(text, replyMeta);
          return;
        }

        // Fallback: direct text manipulation
        console.log('[Content Pipeline] execCommand failed, trying direct manipulation');
        editableDiv.textContent = text;
        editableDiv.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));

        console.log('[Content Pipeline] Reply injected via direct manipulation');
        attachReplySendLogger(text, replyMeta);
        return;
      }
    }

    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  console.error('[Content Pipeline] Could not find reply composer after waiting');
  // Show alert to user as fallback
  alert('Generated reply copied to clipboard:\n\n' + text);
  navigator.clipboard.writeText(text);
}

function attachReplySendLogger(replyText, meta) {
  // One-shot: when user clicks the reply "Post" button in the modal, log to backend.
  const startedAt = Date.now();
  const maxMs = 15_000;
  const poll = () => {
    if (Date.now() - startedAt > maxMs) {
      console.warn('[Content Pipeline] Reply send logger timed out — Post button not found');
      return;
    }

    // X's reply modal lives in #layers; fall back to [role="dialog"]
    const container = document.querySelector('#layers') || document.querySelector('[role="dialog"]');
    const tweetButton = container?.querySelector('[data-testid="tweetButton"]');
    if (tweetButton && !tweetButton.dataset.cpLoggedListener) {
      console.log('[Content Pipeline] Attached reply send logger to Post button');
      tweetButton.dataset.cpLoggedListener = 'true';
      tweetButton.addEventListener('click', async () => {
        try {
          console.log('[Content Pipeline] Post button clicked — logging reply');
          await sendMessage({
            type: 'LOG_REPLY_SENT',
            payload: {
              reply_text: replyText,
              replied_to_post_id: meta?.repliedToId || null,
              replied_to_post_url: meta?.repliedToUrl || null,
              sent_at: new Date().toISOString(),
            },
          });
          console.log('[Content Pipeline] Reply logged successfully');
        } catch (e) {
          console.warn('[Content Pipeline] Failed to log reply sent:', e);
        }
      }, { once: true });
      return;
    }

    setTimeout(poll, 250);
  };

  poll();
}

function injectButtons(articleElement) {
  // Check if we've already processed this element
  if (articleElement.dataset.cpProcessed) {
    return;
  }
  articleElement.dataset.cpProcessed = 'true';

  // Find the action bar (where like, retweet, etc. buttons are)
  const actionBar = articleElement.querySelector('[role="group"]');
  if (!actionBar) return;

  // Check if buttons already exist
  if (actionBar.querySelector(`.${NICHE_SAVE_BUTTON_CLASS}`)) {
    return;
  }

  // Extract post URL for tracking
  const timeElement = articleElement.querySelector('time');
  const linkElement = timeElement?.closest('a');
  const postUrl = linkElement?.href || '';

  if (!postUrl) return;

  // Extract post ID
  const postId = extractTweetId(postUrl);

  // Create inspiration save button
  const nicheSaveButton = createNicheSaveButton(postUrl, postId);
  nicheSaveButton.addEventListener('click', (e) => handleNicheSaveClick(e, nicheSaveButton));

  // Create reply button (split design), picker, and tone dropdown
  const replyButton = createReplyButton();
  const replyPicker = createReplyPicker();
  const toneDropdown = createToneDropdown();

  // Get the main button and dropdown arrow button from the container
  const mainButton = replyButton.querySelector('.cp-reply-button-main');
  const dropdownArrow = replyButton.querySelector('.cp-reply-button-dropdown');

  // Main button click - generate without tone
  mainButton.addEventListener('click', (e) => handleReplyClick(e, replyButton, replyPicker, toneDropdown, null));

  // Dropdown arrow click - show tone menu
  dropdownArrow.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Toggle dropdown visibility
    if (toneDropdown.classList.contains('cp-visible')) {
      hideToneDropdown(toneDropdown);
    } else {
      // Hide reply picker if visible
      hideReplyPicker(replyPicker);
      showToneDropdown(toneDropdown, replyButton);
    }
  });

  // Tone option click handlers
  toneDropdown.querySelectorAll('.cp-tone-option').forEach(option => {
    option.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const selectedTone = option.dataset.tone;
      hideToneDropdown(toneDropdown);
      handleReplyClick(e, replyButton, replyPicker, toneDropdown, selectedTone);
    });
  });

  // Close dropdown when clicking outside
  const closeDropdownHandler = (e) => {
    if (!toneDropdown.contains(e.target) && !dropdownArrow.contains(e.target)) {
      hideToneDropdown(toneDropdown);
    }
  };
  document.addEventListener('click', closeDropdownHandler);

  // Insert buttons before the last item (usually the share button)
  const lastChild = actionBar.lastElementChild;
  if (lastChild) {
    actionBar.insertBefore(nicheSaveButton, lastChild);
    actionBar.insertBefore(replyButton, lastChild);
  } else {
    actionBar.appendChild(nicheSaveButton);
    actionBar.appendChild(replyButton);
  }

  // Append to body for z-index/overflow reasons; position is updated dynamically
  document.body.appendChild(replyPicker);
  document.body.appendChild(toneDropdown);

  // Add to intersection observer for opportunity scoring
  if (opportunityObserver) {
    opportunityObserver.observe(articleElement);
  }
}

function processVisiblePosts() {
  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  articles.forEach(injectButtons);
}

// ===========================================
// INTERSECTION OBSERVER FOR OPPORTUNITY SCORING
// ===========================================

// Throttle opportunity scoring updates
let lastScoreUpdate = 0;
const SCORE_THROTTLE_MS = 500;

// IntersectionObserver for viewport-based scoring
let opportunityObserver = null;

function initOpportunityObserver() {
  if (opportunityObserver) return;

  opportunityObserver = new IntersectionObserver(
    (entries) => {
      const now = Date.now();
      if (now - lastScoreUpdate < SCORE_THROTTLE_MS) return;
      lastScoreUpdate = now;

      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const article = entry.target;
          // Only score if not already scored
          if (!article.querySelector(`.${OPP_PILL_CLASS}`)) {
            scoreAndDisplayOpportunity(article);
          }
        }
      });
    },
    {
      root: null, // viewport
      rootMargin: '100px', // Start scoring slightly before entering viewport
      threshold: 0.1, // Trigger when 10% visible
    }
  );
}

// Initialize the opportunity observer
initOpportunityObserver();

// ===========================================
// MUTATION OBSERVER FOR DYNAMIC CONTENT
// ===========================================

// Set up mutation observer to catch dynamically loaded posts
const observer = new MutationObserver((mutations) => {
  let shouldProcess = false;

  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      shouldProcess = true;
      break;
    }
  }

  if (shouldProcess) {
    // Debounce processing
    clearTimeout(window.cpProcessTimeout);
    window.cpProcessTimeout = setTimeout(processVisiblePosts, 100);
  }
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Initial processing
processVisiblePosts();

// Also process on scroll (for infinite scroll)
let scrollTimeout;
window.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(processVisiblePosts, 200);
}, { passive: true });

// ===========================================
// GET_STATS MESSAGE HANDLER
// ===========================================

if (isExtensionContextValid()) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_STATS') {
      sendResponse({ postsScored: scoreCache.size });
      return false;
    }
  });
}

// ===========================================
// SETTINGS LISTENER
// ===========================================

// Listen for settings changes
if (isExtensionContextValid()) {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.oppSettings) {
      oppSettings = { ...oppSettings, ...changes.oppSettings.newValue };
      // Re-score visible posts with new settings
      document.querySelectorAll('article[data-testid="tweet"]').forEach((article) => {
        // Remove existing pills and borders for re-scoring
        const existingPill = article.querySelector(`.${OPP_PILL_CLASS}`);
        if (existingPill) existingPill.remove();
        article.classList.remove(OPP_BORDER_CLASS, 'xgo-opp-border-high', 'xgo-opp-border-medium');
        // Clear cache for this tweet
        const postUrl = article.querySelector('a[href*="/status/"]')?.href;
        if (postUrl) {
          const tweetId = extractTweetId(postUrl);
          if (tweetId) scoreCache.delete(tweetId);
        }
        // Re-score
        scoreAndDisplayOpportunity(article);
      });
    }
  });
}
