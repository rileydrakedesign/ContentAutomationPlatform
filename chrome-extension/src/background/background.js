// Content Pipeline - Background Service Worker
// Handles API communication and auth state

// Default API URL - can be configured in extension settings
const DEFAULT_API_URL = 'https://app.agentsforx.com';
const OLD_API_URL = 'https://contentautomationplatform-production.up.railway.app';

// Get stored configuration
async function getConfig() {
  const result = await chrome.storage.local.get(['apiUrl', 'authToken', 'refreshToken', 'tokenExpiresAt']);
  // Migrate cached old URL to new domain
  let apiUrl = result.apiUrl || DEFAULT_API_URL;
  if (apiUrl === OLD_API_URL) {
    apiUrl = DEFAULT_API_URL;
    chrome.storage.local.set({ apiUrl });
  }
  return {
    apiUrl,
    authToken: result.authToken || null,
    refreshToken: result.refreshToken || null,
    tokenExpiresAt: result.tokenExpiresAt || null,
  };
}

// Parse JWT to extract expiry time
function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null; // Convert to ms
  } catch {
    return null;
  }
}

// Save auth tokens with expiry tracking
async function saveTokens(accessToken, refreshToken) {
  const expiresAt = getTokenExpiry(accessToken);
  await chrome.storage.local.set({
    authToken: accessToken,
    refreshToken: refreshToken,
    tokenExpiresAt: expiresAt,
  });
  // Schedule proactive refresh
  if (expiresAt) {
    scheduleTokenRefresh(expiresAt);
  }
}

// Clear auth tokens
async function clearTokens() {
  await chrome.storage.local.remove(['authToken', 'refreshToken', 'tokenExpiresAt']);
}

// Proactive token refresh - refresh 5 minutes before expiry
let refreshTimer = null;
function scheduleTokenRefresh(expiresAt) {
  if (refreshTimer) clearTimeout(refreshTimer);
  const now = Date.now();
  const refreshAt = expiresAt - 5 * 60 * 1000; // 5 min before expiry
  const delay = Math.max(0, refreshAt - now);

  if (delay > 0) {
    refreshTimer = setTimeout(async () => {
      console.log('[Content Pipeline] Proactively refreshing token');
      await refreshAccessToken();
    }, delay);
  }
}

// On startup, check if token needs refresh soon
async function initTokenRefresh() {
  const config = await getConfig();
  if (config.tokenExpiresAt && config.refreshToken) {
    const now = Date.now();
    if (now >= config.tokenExpiresAt - 5 * 60 * 1000) {
      // Token expired or about to — refresh now
      console.log('[Content Pipeline] Token expired or expiring soon, refreshing');
      await refreshAccessToken();
    } else {
      scheduleTokenRefresh(config.tokenExpiresAt);
    }
  }
}

initTokenRefresh();

// Check if we're logged in
async function isLoggedIn() {
  const config = await getConfig();
  return !!config.authToken;
}

// Make authenticated API request
async function apiRequest(endpoint, options = {}) {
  let config = await getConfig();

  if (!config.authToken) {
    throw new Error('NOT_LOGGED_IN');
  }

  // Proactively refresh if token expires within 2 minutes
  if (config.tokenExpiresAt && Date.now() >= config.tokenExpiresAt - 2 * 60 * 1000) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      config = await getConfig();
    }
  }

  const url = `${config.apiUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.authToken}`,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // Token expired - try to refresh
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry the request with new token
      const newConfig = await getConfig();
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newConfig.authToken}`,
          ...options.headers,
        },
      });
      return retryResponse;
    } else {
      throw new Error('NOT_LOGGED_IN');
    }
  }

  return response;
}

// Refresh access token using refresh token
let isRefreshing = false;
let refreshPromise = null;

async function refreshAccessToken() {
  // Deduplicate concurrent refresh attempts
  if (isRefreshing) return refreshPromise;

  isRefreshing = true;
  refreshPromise = (async () => {
    const config = await getConfig();

    if (!config.refreshToken) {
      await clearTokens();
      return false;
    }

    try {
      const response = await fetch(`${config.apiUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: config.refreshToken,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        await saveTokens(data.access_token, data.refresh_token);
        return true;
      } else if (response.status === 401 || response.status === 403) {
        // Refresh token is invalid/revoked — clear and require re-login
        console.error('Refresh token rejected by server, clearing auth');
        await clearTokens();
        return false;
      } else {
        // Server error (500, 503, etc.) — keep tokens, retry later
        console.warn('Token refresh server error:', response.status);
        return false;
      }
    } catch (error) {
      // Network error — do NOT clear tokens, user might just be offline
      console.warn('Token refresh network error (keeping tokens):', error.message);
      return false;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

// Log a reply the user actually sent via extension
async function logReplySent(payload) {
  try {
    const response = await apiRequest('/api/extension/replies', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return { success: true };
    }
    const data = await response.json().catch(() => ({}));
    return { success: false, error: data.error || 'Failed to log reply' };
  } catch (error) {
    console.error('Log reply sent failed:', error);
    return { success: false, error: error.message };
  }
}

// Fetch extension status (plan, usage, setup) from dashboard API
async function fetchExtensionStatus() {
  try {
    const response = await apiRequest('/api/extension/status', {
      method: 'GET',
    });

    const data = await response.json();

    if (response.ok) {
      // Cache status locally for content script access
      await chrome.storage.local.set({ extensionStatus: data, statusFetchedAt: Date.now() });
      return { success: true, data };
    } else {
      return { success: false, error: data.error || 'Failed to fetch status' };
    }
  } catch (error) {
    console.error('Fetch extension status failed:', error);
    return { success: false, error: error.message };
  }
}

// Generate reply options using AI
async function generateReply(payload) {
  try {
    const response = await apiRequest('/api/generate-reply', {
      method: 'POST',
      body: JSON.stringify({
        post_text: payload.post_text,
        author_handle: payload.author_handle,
        context: payload.context,
        tone: payload.tone || null,  // Pass tone through to API
      }),
    });

    const data = await response.json();

    if (response.ok) {
      // Refresh status after successful generation (usage changed)
      fetchExtensionStatus().catch(() => {});
      return { success: true, replies: data.replies };
    } else if (response.status === 429 && data.code === 'AI_LIMIT') {
      // Rate limited - return structured limit info
      return {
        success: false,
        error: data.error,
        code: 'AI_LIMIT',
        remaining: 0,
        limit: data.limit,
        upgrade_url: data.upgrade_url,
      };
    } else {
      return { success: false, error: data.error || 'Failed to generate replies' };
    }
  } catch (error) {
    console.error('Generate reply failed:', error);
    return { success: false, error: error.message };
  }
}

// Save an inspiration post (from Chrome extension)
async function saveInspirationPost(postData) {
  try {
    const url = `https://x.com/${postData.x_username}/status/${postData.x_post_id}`;
    const response = await apiRequest('/api/inspiration', {
      method: 'POST',
      body: JSON.stringify({
        content: postData.text_content,
        url,
        authorHandle: `@${postData.x_username}`,
        metrics: postData.metrics || {},
        post_timestamp: postData.post_timestamp || null,
        source: 'chrome_extension',
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, data };
    } else if (response.status === 409) {
      return { success: false, error: 'DUPLICATE' };
    } else {
      return { success: false, error: data.error || 'Failed to save inspiration post' };
    }
  } catch (error) {
    console.error('Save inspiration post failed:', error);
    return { success: false, error: error.message };
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GENERATE_REPLY') {
    generateReply(message.payload)
      .then(async (result) => {
        if (result.success) {
          await incrementStat('repliesGenerated');
        }
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'SAVE_NICHE_POST') {
    saveInspirationPost(message.payload)
      .then(async (result) => {
        if (result.success) {
          await incrementStat('postsInspired');
        }
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'SUBMIT_FEEDBACK') {
    apiRequest('/api/generation-feedback', {
      method: 'POST',
      body: JSON.stringify(message.payload),
    })
      .then((res) => res.json())
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) => {
        console.error('Submit feedback failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'LOG_REPLY_SENT') {
    logReplySent(message.payload)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'GET_EXTENSION_STATUS') {
    fetchExtensionStatus()
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'CHECK_AUTH') {
    (async () => {
      const config = await getConfig();
      if (!config.authToken) {
        return { loggedIn: false };
      }
      // If token is expired but we have a refresh token, try refreshing
      if (config.tokenExpiresAt && Date.now() >= config.tokenExpiresAt && config.refreshToken) {
        const refreshed = await refreshAccessToken();
        return { loggedIn: refreshed };
      }
      return { loggedIn: true };
    })()
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ loggedIn: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'LOGIN') {
    saveTokens(message.accessToken, message.refreshToken)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'LOGOUT') {
    clearTokens()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'GET_CONFIG') {
    getConfig()
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ error: error.message });
      });
    return true;
  }

  if (message.type === 'SET_API_URL') {
    chrome.storage.local.set({ apiUrl: message.apiUrl })
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Increment a stat counter in chrome.storage.local
async function incrementStat(key) {
  const result = await chrome.storage.local.get(['stats']);
  const stats = result.stats || {};
  stats[key] = (stats[key] || 0) + 1;
  await chrome.storage.local.set({ stats });
}

// Log when service worker starts
console.log('Content Pipeline extension loaded');
