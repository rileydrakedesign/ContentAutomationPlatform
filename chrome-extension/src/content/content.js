// Content Pipeline - X Post Saver & Reply Generator
// Content script for injecting save and reply buttons on X posts

const SAVE_BUTTON_CLASS = 'cp-save-button';
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
// Track saved post URLs
let savedPostUrls = new Set();
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
  notice.innerHTML = `
    <span>Content Pipeline was updated. Please refresh the page.</span>
    <button onclick="location.reload()">Refresh</button>
    <button class="cp-dismiss" onclick="this.parentElement.remove()">✕</button>
  `;
  document.body.appendChild(notice);
}

// Load saved posts and watched accounts from storage on init
if (isExtensionContextValid()) {
  chrome.storage.local.get(['savedPostUrls', 'savedNichePostIds'], (result) => {
    if (result.savedPostUrls) {
      savedPostUrls = new Set(result.savedPostUrls);
    }
    if (result.savedNichePostIds) {
      savedNichePostIds = new Set(result.savedNichePostIds);
    }
  });
}

// Listen for updates to saved posts and watched accounts
if (isExtensionContextValid()) {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.savedPostUrls) {
        savedPostUrls = new Set(changes.savedPostUrls.newValue || []);
        updateAllSaveButtons();
      }
      if (changes.savedNichePostIds) {
        savedNichePostIds = new Set(changes.savedNichePostIds.newValue || []);
        updateAllNicheSaveButtons();
      }
    }
  });
}

function updateAllSaveButtons() {
  document.querySelectorAll(`.${SAVE_BUTTON_CLASS}`).forEach(button => {
    const postUrl = button.dataset.postUrl;
    if (postUrl && savedPostUrls.has(postUrl)) {
      button.classList.add(SAVED_CLASS);
      button.classList.remove(SAVING_CLASS);
      button.querySelector('.cp-icon').innerHTML = getCheckIcon();
      button.title = 'Saved to Content Pipeline';
    }
  });
}

function getPlusCircleIcon() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="16"></line>
    <line x1="8" y1="12" x2="16" y2="12"></line>
  </svg>`;
}

function getCheckIcon() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>`;
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

// Bookmark icon for saving inspiration posts
function getBookmarkIcon() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
  </svg>`;
}

// Bookmark filled icon
function getBookmarkFilledIcon() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="2">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
  </svg>`;
}

// Update all niche save buttons
function updateAllNicheSaveButtons() {
  document.querySelectorAll(`.${NICHE_SAVE_BUTTON_CLASS}`).forEach(button => {
    const postId = button.dataset.postId;
    if (postId && savedNichePostIds.has(postId)) {
      button.classList.add(SAVED_CLASS);
      button.querySelector('.cp-icon').innerHTML = getBookmarkFilledIcon();
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

function createSaveButton(postUrl) {
  const button = document.createElement('button');
  button.className = SAVE_BUTTON_CLASS;
  button.dataset.postUrl = postUrl;
  button.title = 'Save to Content Pipeline';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'cp-icon';
  iconSpan.innerHTML = getPlusCircleIcon();
  button.appendChild(iconSpan);

  // Check if already saved
  if (savedPostUrls.has(postUrl)) {
    button.classList.add(SAVED_CLASS);
    iconSpan.innerHTML = getCheckIcon();
    button.title = 'Saved to Content Pipeline';
  }

  return button;
}

async function handleSaveClick(event, button) {
  event.preventDefault();
  event.stopPropagation();

  // Find the article element dynamically by traversing up from the button
  const articleElement = button.closest('article[data-testid="tweet"]');
  if (!articleElement) {
    console.error('[Content Pipeline] Could not find article element for save button');
    return;
  }

  // Check if already saved or saving
  if (button.classList.contains(SAVED_CLASS) || button.classList.contains(SAVING_CLASS)) {
    return;
  }

  const iconSpan = button.querySelector('.cp-icon');

  // Set saving state
  button.classList.add(SAVING_CLASS);
  iconSpan.innerHTML = getSpinnerIcon();
  button.title = 'Saving...';

  try {
    const postData = extractPostData(articleElement);

    if (!postData || !postData.post_url || !postData.text_content) {
      throw new Error('Could not extract post data');
    }

    // Send to background script
    const response = await sendMessage({
      type: 'SAVE_POST',
      payload: postData,
    });

    if (response.success) {
      button.classList.remove(SAVING_CLASS);
      button.classList.add(SAVED_CLASS);
      iconSpan.innerHTML = getCheckIcon();
      button.title = 'Saved to Content Pipeline';

      // Update local storage
      savedPostUrls.add(postData.post_url);
      chrome.storage.local.set({ savedPostUrls: Array.from(savedPostUrls) });
    } else {
      throw new Error(response.error || 'Failed to save');
    }
  } catch (error) {
    console.error('Save failed:', error);
    button.classList.remove(SAVING_CLASS);
    iconSpan.innerHTML = getPlusCircleIcon();

    if (error.message === 'DUPLICATE') {
      button.classList.add(SAVED_CLASS);
      iconSpan.innerHTML = getCheckIcon();
      button.title = 'Already saved';
    } else if (error.message === 'NOT_LOGGED_IN') {
      button.title = 'Click extension icon to log in';
    } else if (error.message === 'EXTENSION_RELOADED' || error.message?.includes('Extension context invalidated')) {
      button.title = 'Extension updated - please refresh page';
      showRefreshNotice();
    } else {
      button.title = 'Failed to save - try again';
    }
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
  iconSpan.innerHTML = getBookmarkIcon();
  button.appendChild(iconSpan);

  // Check if already saved
  if (savedNichePostIds.has(postId)) {
    button.classList.add(SAVED_CLASS);
    iconSpan.innerHTML = getBookmarkFilledIcon();
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
      iconSpan.innerHTML = getBookmarkFilledIcon();
      button.title = 'Saved as niche post';

      savedNichePostIds.add(postId);
      chrome.storage.local.set({ savedNichePostIds: Array.from(savedNichePostIds) });
    } else {
      throw new Error(response.error || 'Failed to save');
    }
  } catch (error) {
    console.error('Save niche post failed:', error);
    button.classList.remove(SAVING_CLASS);
    iconSpan.innerHTML = getBookmarkIcon();

    if (error.message === 'DUPLICATE') {
      button.classList.add(SAVED_CLASS);
      iconSpan.innerHTML = getBookmarkFilledIcon();
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

// Show reply picker with generated options
function showReplyPicker(picker, replyButton, replies, articleElement) {
  let currentIndex = 0;

  const optionsContainer = picker.querySelector('.cp-picker-options');
  const indicator = picker.querySelector('.cp-nav-indicator');
  const prevBtn = picker.querySelector('.cp-nav-prev');
  const nextBtn = picker.querySelector('.cp-nav-next');
  const useBtn = picker.querySelector('.cp-picker-use');
  const closeBtn = picker.querySelector('.cp-picker-close');

  // Render current option
  function renderOption() {
    const reply = replies[currentIndex];
    optionsContainer.innerHTML = `
      <div class="cp-reply-option">
        <span class="cp-reply-approach">${reply.approach}</span>
        <p class="cp-reply-text">${reply.text}</p>
      </div>
    `;
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

  // Position and show
  const buttonRect = replyButton.getBoundingClientRect();
  picker.style.position = 'fixed';
  picker.style.top = `${buttonRect.bottom + 10}px`;
  picker.style.left = `${Math.max(10, buttonRect.left - 150)}px`;

  renderOption();
  picker.classList.add('cp-visible');

  // Close when clicking outside
  const closeHandler = (e) => {
    if (!picker.contains(e.target) && !replyButton.contains(e.target)) {
      hideReplyPicker(picker);
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

// Hide reply picker
function hideReplyPicker(picker) {
  picker.classList.remove('cp-visible');
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
function showToneDropdown(dropdown, replyButton) {
  const buttonRect = replyButton.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.top = `${buttonRect.bottom + 4}px`;
  dropdown.style.left = `${Math.max(10, buttonRect.left - 50)}px`;
  dropdown.classList.add('cp-visible');
}

// Hide tone dropdown menu
function hideToneDropdown(dropdown) {
  dropdown.classList.remove('cp-visible');
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
          if (replyMeta && replyMeta.repliedToUrl) {
            attachReplySendLogger(text, replyMeta);
          }
          return;
        }

        // Fallback: direct text manipulation
        console.log('[Content Pipeline] execCommand failed, trying direct manipulation');
        editableDiv.textContent = text;
        editableDiv.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));

        console.log('[Content Pipeline] Reply injected via direct manipulation');
        if (replyMeta && replyMeta.repliedToUrl) {
          attachReplySendLogger(text, replyMeta);
        }
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
    if (Date.now() - startedAt > maxMs) return;

    const dialog = document.querySelector('[role="dialog"]');
    const tweetButton = dialog?.querySelector('[data-testid="tweetButton"]');
    if (tweetButton && !tweetButton.dataset.cpLoggedListener) {
      tweetButton.dataset.cpLoggedListener = 'true';
      tweetButton.addEventListener('click', async () => {
        try {
          await sendMessage({
            type: 'LOG_REPLY_SENT',
            payload: {
              reply_text: replyText,
              replied_to_post_id: meta?.repliedToId || null,
              replied_to_post_url: meta?.repliedToUrl || null,
              sent_at: new Date().toISOString(),
            },
          });
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
  if (actionBar.querySelector(`.${SAVE_BUTTON_CLASS}`)) {
    return;
  }

  // Extract post URL for tracking
  const timeElement = articleElement.querySelector('time');
  const linkElement = timeElement?.closest('a');
  const postUrl = linkElement?.href || '';

  if (!postUrl) return;

  // Extract post ID
  const postId = extractTweetId(postUrl);

  // Create save button (for own posts inbox)
  const saveButton = createSaveButton(postUrl);
  saveButton.addEventListener('click', (e) => handleSaveClick(e, saveButton));

  // Create niche save button (for pattern reference)
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
      // Create a synthetic event for handleReplyClick
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
    actionBar.insertBefore(saveButton, lastChild);
    actionBar.insertBefore(nicheSaveButton, lastChild);
    actionBar.insertBefore(replyButton, lastChild);
  } else {
    actionBar.appendChild(saveButton);
    actionBar.appendChild(nicheSaveButton);
    actionBar.appendChild(replyButton);
  }

  // Append reply picker and tone dropdown to body (for proper positioning)
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

// ===========================================
// ANALYTICS SCRAPING (X Premium Feature)
// ===========================================

/**
 * Check if we're on the X analytics page
 */
function isAnalyticsPage() {
  return window.location.pathname.includes('/i/account_analytics') ||
         window.location.pathname.includes('/analytics');
}

/**
 * Send progress update to popup
 */
function sendScrapeProgress(status) {
  if (isExtensionContextValid()) {
    chrome.runtime.sendMessage({
      type: 'ANALYTICS_SCRAPE_PROGRESS',
      status
    }).catch(() => {});
  }
}

/**
 * Wait for an element to appear in the DOM
 */
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      const el = document.querySelector(selector);
      if (el) {
        obs.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for ${selector}`));
    }, timeout);
  });
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Scroll to load more content
 */
async function scrollToLoadMore(maxScrolls = 10) {
  for (let i = 0; i < maxScrolls; i++) {
    const prevHeight = document.body.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(1500);

    if (document.body.scrollHeight === prevHeight) {
      break; // No more content to load
    }
  }
  // Scroll back to top
  window.scrollTo(0, 0);
  await sleep(500);
}

/**
 * Extract impressions from various possible DOM locations
 */
function extractImpressions(element) {
  // Try to find impressions in different formats
  const impressionPatterns = [
    /(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)\s*(?:impressions?|views?)/i,
    /(?:impressions?|views?):\s*(\d+(?:,\d+)*(?:\.\d+)?[KMB]?)/i
  ];

  // Look in aria-labels, text content, and data attributes
  const textSources = [
    element.getAttribute('aria-label'),
    element.textContent,
    ...Array.from(element.querySelectorAll('[aria-label]')).map(el => el.getAttribute('aria-label'))
  ].filter(Boolean);

  for (const text of textSources) {
    for (const pattern of impressionPatterns) {
      const match = text.match(pattern);
      if (match) {
        return parseCount(match[1]);
      }
    }
  }

  // Try finding numeric value near "impressions" text
  const impressionEl = element.querySelector('[data-testid*="impression"], [data-testid*="view"]');
  if (impressionEl) {
    const countText = impressionEl.textContent?.trim();
    if (countText) return parseCount(countText);
  }

  return null;
}

/**
 * Scrape posts from the analytics page
 * Returns array of { post, impressions, isReply, parentPost }
 */
async function scrapeAnalyticsPosts() {
  const results = {
    posts: [],
    replies: []
  };

  sendScrapeProgress('Scanning for posts...');

  // Wait for content to load
  await sleep(2000);

  // Scroll to load more content
  sendScrapeProgress('Loading more content...');
  await scrollToLoadMore(5);

  // Find all tweet/post elements on the page
  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  console.log(`[Analytics Scraper] Found ${articles.length} articles`);

  sendScrapeProgress(`Processing ${articles.length} posts...`);

  for (const article of articles) {
    try {
      const postData = extractPostData(article);
      if (!postData || !postData.post_url) continue;

      // Try to extract impressions from the article or nearby analytics elements
      let impressions = postData.metrics?.views || null;

      // If views not in metrics, try to find impressions elsewhere
      if (impressions === null) {
        // Look for analytics link and its label
        const analyticsLink = article.querySelector('a[href*="/analytics"]');
        if (analyticsLink) {
          impressions = extractImpressions(analyticsLink.parentElement || analyticsLink);
        }
      }

      // Check if this is a reply by looking for "Replying to" indicator
      const isReply = !!article.querySelector('[data-testid="socialContext"]')?.textContent?.includes('Replying to') ||
                      !!postData.context?.parent;

      const entry = {
        post_url: postData.post_url,
        text_content: postData.text_content,
        author_handle: postData.author_handle,
        metrics: {
          ...postData.metrics,
          impressions: impressions
        },
        post_timestamp: postData.post_timestamp,
        x_post_id: extractTweetId(postData.post_url)
      };

      if (isReply) {
        entry.parent_post = postData.context?.parent || null;
        results.replies.push(entry);
      } else {
        results.posts.push(entry);
      }

    } catch (err) {
      console.error('[Analytics Scraper] Error processing article:', err);
    }
  }

  // Sort by impressions (descending)
  const sortByImpressions = (a, b) => {
    const aImp = a.metrics?.impressions || a.metrics?.views || 0;
    const bImp = b.metrics?.impressions || b.metrics?.views || 0;
    return bImp - aImp;
  };

  results.posts.sort(sortByImpressions);
  results.replies.sort(sortByImpressions);

  // Take top 20 of each
  results.posts = results.posts.slice(0, 20);
  results.replies = results.replies.slice(0, 20);

  console.log(`[Analytics Scraper] Found ${results.posts.length} posts, ${results.replies.length} replies`);

  return results;
}

/**
 * Navigate to user's profile and scrape posts/replies separately
 * This is more reliable for separating posts from replies
 */
async function scrapeFromProfile() {
  const results = {
    posts: [],
    replies: []
  };

  // Get current user's handle from the page
  let userHandle = null;

  // Try to find the user's handle from various sources
  const profileLink = document.querySelector('a[href*="/home"] + a[role="link"]');
  if (profileLink) {
    const match = profileLink.href.match(/x\.com\/([^/?]+)/);
    if (match) userHandle = match[1];
  }

  if (!userHandle) {
    // Try the avatar menu
    const avatarButton = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
    if (avatarButton) {
      const handleEl = avatarButton.querySelector('span');
      if (handleEl?.textContent?.startsWith('@')) {
        userHandle = handleEl.textContent.replace('@', '');
      }
    }
  }

  if (!userHandle) {
    throw new Error('Could not determine your X username');
  }

  sendScrapeProgress(`Found user: @${userHandle}`);

  // Navigate to user's posts page
  sendScrapeProgress('Navigating to your posts...');
  window.location.href = `https://x.com/${userHandle}`;
  await sleep(3000);
  await waitForElement('article[data-testid="tweet"]', 15000);

  // Scrape posts
  sendScrapeProgress('Scraping your posts...');
  await scrollToLoadMore(8);

  const postArticles = document.querySelectorAll('article[data-testid="tweet"]');
  for (const article of postArticles) {
    try {
      const postData = extractPostData(article);
      if (!postData?.post_url) continue;

      // Skip if it's a reply (has "Replying to")
      const socialContext = article.querySelector('[data-testid="socialContext"]');
      if (socialContext?.textContent?.includes('Replying to')) continue;

      let impressions = postData.metrics?.views || null;
      const analyticsLink = article.querySelector('a[href*="/analytics"]');
      if (analyticsLink && impressions === null) {
        impressions = extractImpressions(analyticsLink.parentElement || analyticsLink);
      }

      results.posts.push({
        post_url: postData.post_url,
        text_content: postData.text_content,
        author_handle: postData.author_handle,
        metrics: { ...postData.metrics, impressions },
        post_timestamp: postData.post_timestamp,
        x_post_id: extractTweetId(postData.post_url)
      });
    } catch (err) {
      console.error('[Analytics Scraper] Error processing post:', err);
    }
  }

  // Navigate to replies tab
  sendScrapeProgress('Navigating to your replies...');
  window.location.href = `https://x.com/${userHandle}/with_replies`;
  await sleep(3000);
  await waitForElement('article[data-testid="tweet"]', 15000);

  // Scrape replies
  sendScrapeProgress('Scraping your replies...');
  await scrollToLoadMore(8);

  const replyArticles = document.querySelectorAll('article[data-testid="tweet"]');
  for (const article of replyArticles) {
    try {
      const postData = extractPostData(article);
      if (!postData?.post_url) continue;

      // Only include actual replies
      const socialContext = article.querySelector('[data-testid="socialContext"]');
      const isReply = socialContext?.textContent?.includes('Replying to') || !!postData.context?.parent;
      if (!isReply) continue;

      let impressions = postData.metrics?.views || null;
      const analyticsLink = article.querySelector('a[href*="/analytics"]');
      if (analyticsLink && impressions === null) {
        impressions = extractImpressions(analyticsLink.parentElement || analyticsLink);
      }

      results.replies.push({
        post_url: postData.post_url,
        text_content: postData.text_content,
        author_handle: postData.author_handle,
        metrics: { ...postData.metrics, impressions },
        post_timestamp: postData.post_timestamp,
        x_post_id: extractTweetId(postData.post_url),
        parent_post: postData.context?.parent || null
      });
    } catch (err) {
      console.error('[Analytics Scraper] Error processing reply:', err);
    }
  }

  // Sort by impressions and take top 20
  const sortByImpressions = (a, b) => {
    const aImp = a.metrics?.impressions || a.metrics?.views || a.metrics?.likes || 0;
    const bImp = b.metrics?.impressions || b.metrics?.views || b.metrics?.likes || 0;
    return bImp - aImp;
  };

  results.posts.sort(sortByImpressions);
  results.replies.sort(sortByImpressions);
  results.posts = results.posts.slice(0, 20);
  results.replies = results.replies.slice(0, 20);

  return results;
}

/**
 * Fetch parent post details for a reply
 */
async function fetchParentPost(replyUrl) {
  try {
    // Navigate to the reply to see the thread context
    const response = await fetch(replyUrl);
    const html = await response.text();

    // Parse the HTML to extract parent tweet info
    // This is a simplified approach - in practice, you might need
    // to navigate to the page and scrape the DOM
    const parentMatch = html.match(/Replying to @(\w+)/);
    if (parentMatch) {
      return { author: parentMatch[1] };
    }
  } catch (err) {
    console.error('[Analytics Scraper] Failed to fetch parent post:', err);
  }
  return null;
}

/**
 * Main analytics sync function
 * Called when the user initiates sync from the popup
 */
async function runAnalyticsSync() {
  if (!isExtensionContextValid()) {
    console.error('[Analytics Scraper] Extension context invalid');
    return;
  }

  try {
    sendScrapeProgress('Starting analytics sync...');

    let results;

    if (isAnalyticsPage()) {
      // If we're already on analytics page, scrape from here
      results = await scrapeAnalyticsPosts();
    } else {
      // Otherwise, scrape from profile pages
      results = await scrapeFromProfile();
    }

    sendScrapeProgress('Sending data to server...');

    // Send to background script for API submission
    const response = await chrome.runtime.sendMessage({
      type: 'SYNC_ANALYTICS_DATA',
      payload: results
    });

    if (response.success) {
      chrome.runtime.sendMessage({
        type: 'ANALYTICS_SCRAPE_COMPLETE',
        success: true,
        postsCount: results.posts.length,
        repliesCount: results.replies.length
      });
    } else {
      throw new Error(response.error || 'Failed to save analytics data');
    }

  } catch (error) {
    console.error('[Analytics Scraper] Sync failed:', error);
    chrome.runtime.sendMessage({
      type: 'ANALYTICS_SCRAPE_COMPLETE',
      success: false,
      error: error.message
    });
  }
}

// Listen for analytics sync trigger from popup/background
if (isExtensionContextValid()) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_ANALYTICS_SCRAPE') {
      runAnalyticsSync();
      sendResponse({ started: true });
    }
    return true;
  });

  // Auto-start scraping if we're on the analytics page and were opened for sync
  if (isAnalyticsPage()) {
    // Check if we were opened for analytics sync
    chrome.storage.local.get(['pendingAnalyticsSync'], (result) => {
      if (result.pendingAnalyticsSync) {
        chrome.storage.local.remove(['pendingAnalyticsSync']);
        // Wait for page to fully load
        setTimeout(runAnalyticsSync, 3000);
      }
    });
  }
}
