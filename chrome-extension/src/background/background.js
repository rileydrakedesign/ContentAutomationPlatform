// Content Pipeline - Background Service Worker
// Handles API communication and auth state

// Default API URL - can be configured in extension settings
const DEFAULT_API_URL = 'https://app.agentsforx.com';
const OLD_API_URL = 'https://contentautomationplatform-production.up.railway.app';

// Get stored configuration
async function getConfig() {
  const result = await chrome.storage.local.get(['apiUrl', 'authToken', 'refreshToken']);
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
  };
}

// Save auth tokens
async function saveTokens(accessToken, refreshToken) {
  await chrome.storage.local.set({
    authToken: accessToken,
    refreshToken: refreshToken,
  });
}

// Clear auth tokens
async function clearTokens() {
  await chrome.storage.local.remove(['authToken', 'refreshToken']);
}

// Check if we're logged in
async function isLoggedIn() {
  const config = await getConfig();
  return !!config.authToken;
}

// Make authenticated API request
async function apiRequest(endpoint, options = {}) {
  const config = await getConfig();

  if (!config.authToken) {
    throw new Error('NOT_LOGGED_IN');
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
async function refreshAccessToken() {
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
    } else {
      await clearTokens();
      return false;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
    await clearTokens();
    return false;
  }
}

// Save a post to the API
async function savePost(postData) {
  try {
    const response = await apiRequest('/api/capture', {
      method: 'POST',
      body: JSON.stringify(postData),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, data };
    } else if (response.status === 409) {
      // Duplicate post
      return { success: false, error: 'DUPLICATE' };
    } else {
      return { success: false, error: data.error || 'Failed to save' };
    }
  } catch (error) {
    console.error('Save post failed:', error);
    return { success: false, error: error.message };
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
      return { success: true, replies: data.replies };
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

// Sync analytics data (top posts and replies by impressions)
async function syncAnalyticsData(analyticsData) {
  try {
    const response = await apiRequest('/api/x/analytics-sync', {
      method: 'POST',
      body: JSON.stringify(analyticsData),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, data };
    } else {
      return { success: false, error: data.error || 'Failed to sync analytics data' };
    }
  } catch (error) {
    console.error('Sync analytics data failed:', error);
    return { success: false, error: error.message };
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_POST') {
    savePost(message.payload)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  if (message.type === 'GENERATE_REPLY') {
    generateReply(message.payload)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'SAVE_NICHE_POST') {
    saveInspirationPost(message.payload)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'SYNC_ANALYTICS_DATA') {
    syncAnalyticsData(message.payload)
      .then(sendResponse)
      .catch((error) => {
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

  if (message.type === 'CHECK_AUTH') {
    isLoggedIn()
      .then((loggedIn) => {
        sendResponse({ loggedIn });
      })
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
        // Clear saved posts cache
        chrome.storage.local.remove(['savedPostUrls']);
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

// Log when service worker starts
console.log('Content Pipeline extension loaded');
