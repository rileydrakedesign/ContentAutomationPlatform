// Agents For X - Popup Script

// DOM elements
const loadingSection = document.getElementById('loading');
const welcomeSection = document.getElementById('welcome-section');
const loginSection = document.getElementById('login-section');
const loggedInSection = document.getElementById('logged-in-section');
const settingsSection = document.getElementById('settings-section');

const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBackBtn = document.getElementById('login-back-btn');

const welcomeCreateAccountBtn = document.getElementById('welcome-create-account');
const welcomeShowLoginBtn = document.getElementById('welcome-show-login');

const openDashboardBtn = document.getElementById('open-dashboard');
const logoutBtn = document.getElementById('logout-btn');

const headerStatusDot = document.getElementById('header-status-dot');
const headerGearBtn = document.getElementById('header-gear-btn');

const settingsForm = document.getElementById('settings-form');
const apiUrlInput = document.getElementById('api-url');
const cancelSettingsBtn = document.getElementById('cancel-settings-btn');

const advancedToggle = document.getElementById('advanced-toggle');
const advancedArrow = document.getElementById('advanced-arrow');
const advancedSection = document.getElementById('advanced-section');

const xcomBanner = document.getElementById('xcom-banner');
const xcomBannerText = document.getElementById('xcom-banner-text');

// Stats elements
const statInspired = document.getElementById('stat-inspired');
const statReplies = document.getElementById('stat-replies');
const statScored = document.getElementById('stat-scored');

// Usage elements
const usageSection = document.getElementById('usage-section');
const usagePlanBadge = document.getElementById('usage-plan-badge');
const usageCount = document.getElementById('usage-count');
const usageBarFill = document.getElementById('usage-bar-fill');
const usageUpgradeHint = document.getElementById('usage-upgrade-hint');
const usageUpgradeLink = document.getElementById('usage-upgrade-link');
const unlimitedSection = document.getElementById('unlimited-section');
const unlimitedBadge = document.getElementById('unlimited-badge');

// Limit banner
const limitBanner = document.getElementById('limit-banner');
const limitUpgradeBtn = document.getElementById('limit-upgrade-btn');

// Setup checklist
const setupChecklist = document.getElementById('setup-checklist');
const setupProgressText = document.getElementById('setup-progress-text');
const setupVoiceCheck = document.getElementById('setup-voice-check');
const setupXCheck = document.getElementById('setup-x-check');
const setupVoiceAction = document.getElementById('setup-voice-action');
const setupXAction = document.getElementById('setup-x-action');

// Track where settings was opened from so cancel returns to the right view
let settingsOpenedFrom = 'login';

// Opportunity settings elements
const oppEnabledInput = document.getElementById('opp-enabled');
const oppShowExplanationInput = document.getElementById('opp-show-explanation');
const oppUseProxyInput = document.getElementById('opp-use-proxy');
const oppGreenThresholdInput = document.getElementById('opp-green-threshold');
const oppYellowThresholdInput = document.getElementById('opp-yellow-threshold');
const oppMaxRepliesInput = document.getElementById('opp-max-replies');
const oppMaxAgeInput = document.getElementById('opp-max-age');

let currentApiUrl = 'https://app.agentsforx.com';

// Default opportunity settings
let currentOppSettings = {
  enabled: true,
  greenThreshold: 75,
  yellowThreshold: 60,
  maxReplies: 200,
  maxAgeHours: 24,
  showExplanation: false,
  useProxyScore: true,
};

// Check if this is likely a first-time user (no stored tokens or prior login)
async function isFirstTimeUser() {
  const result = await chrome.storage.local.get(['hasLoggedInBefore']);
  return !result.hasLoggedInBefore;
}

// Initialize popup
async function init() {
  try {
    // Get config
    const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
    currentApiUrl = response.apiUrl || 'https://app.agentsforx.com';
    apiUrlInput.value = currentApiUrl;

    // Load opportunity settings
    const storageResult = await chrome.storage.local.get(['oppSettings']);
    if (storageResult.oppSettings) {
      currentOppSettings = { ...currentOppSettings, ...storageResult.oppSettings };
    }
    loadOppSettingsToForm();

    // Check auth status
    const authResponse = await chrome.runtime.sendMessage({ type: 'CHECK_AUTH' });

    loadingSection.classList.add('hidden');

    if (authResponse.loggedIn) {
      showLoggedIn();
      await detectXcomTab();
      // Load stats and extension status in parallel
      await Promise.all([loadStats(), loadExtensionStatus()]);
    } else {
      // Check if first time user — show welcome vs login
      const firstTime = await isFirstTimeUser();
      if (firstTime) {
        showWelcome();
      } else {
        showLogin();
      }
    }
  } catch (error) {
    console.error('Init failed:', error);
    loadingSection.classList.add('hidden');
    showLogin();
  }
}

// Load opportunity settings into form inputs
function loadOppSettingsToForm() {
  oppEnabledInput.checked = currentOppSettings.enabled;
  oppShowExplanationInput.checked = currentOppSettings.showExplanation;
  oppUseProxyInput.checked = currentOppSettings.useProxyScore;
  oppGreenThresholdInput.value = currentOppSettings.greenThreshold;
  oppYellowThresholdInput.value = currentOppSettings.yellowThreshold;
  oppMaxRepliesInput.value = currentOppSettings.maxReplies;
  oppMaxAgeInput.value = currentOppSettings.maxAgeHours;
}

// Get opportunity settings from form inputs
function getOppSettingsFromForm() {
  return {
    enabled: oppEnabledInput.checked,
    showExplanation: oppShowExplanationInput.checked,
    useProxyScore: oppUseProxyInput.checked,
    greenThreshold: parseInt(oppGreenThresholdInput.value, 10) || 75,
    yellowThreshold: parseInt(oppYellowThresholdInput.value, 10) || 60,
    maxReplies: parseInt(oppMaxRepliesInput.value, 10) || 200,
    maxAgeHours: parseInt(oppMaxAgeInput.value, 10) || 24,
  };
}

// Detect if the active tab is on x.com
async function detectXcomTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || '';
    const isOnX = url.includes('x.com') || url.includes('twitter.com');

    if (isOnX) {
      xcomBanner.className = 'xcom-banner active';
      xcomBannerText.textContent = 'Active on x.com';
    } else {
      xcomBanner.className = 'xcom-banner inactive';
      xcomBannerText.innerHTML = '';
      const link = document.createElement('a');
      link.textContent = 'Navigate to x.com \u2192';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://x.com' });
      });
      xcomBannerText.appendChild(link);
    }
  } catch {
    xcomBanner.className = 'xcom-banner inactive';
    xcomBannerText.innerHTML = '';
    const link = document.createElement('a');
    link.textContent = 'Navigate to x.com \u2192';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://x.com' });
    });
    xcomBannerText.appendChild(link);
  }
}

// Load extension status (plan, usage, setup)
async function loadExtensionStatus() {
  try {
    const result = await chrome.runtime.sendMessage({ type: 'GET_EXTENSION_STATUS' });

    if (!result.success || !result.data) return;

    const { plan, usage, setup } = result.data;

    // --- Usage / Plan display ---
    if (usage.unlimited) {
      // Pro or Business — show unlimited badge
      usageSection.classList.add('hidden');
      unlimitedSection.classList.remove('hidden');
      limitBanner.classList.add('hidden');
      unlimitedBadge.textContent = plan.name;
    } else {
      // Free plan — show usage bar
      unlimitedSection.classList.add('hidden');
      usageSection.classList.remove('hidden');
      usagePlanBadge.textContent = plan.name;

      const used = usage.used || 0;
      const limit = usage.limit || 5;
      const remaining = usage.remaining || 0;
      const pct = Math.min(100, (used / limit) * 100);

      usageCount.textContent = `${used} / ${limit}`;
      usageBarFill.style.width = `${pct}%`;

      // Color the bar based on usage
      if (pct >= 100) {
        usageBarFill.className = 'usage-bar-fill depleted';
      } else if (pct >= 80) {
        usageBarFill.className = 'usage-bar-fill warning';
      } else {
        usageBarFill.className = 'usage-bar-fill';
      }

      // Show upgrade hint when 60%+ used
      if (pct >= 60) {
        usageUpgradeHint.classList.remove('hidden');
      } else {
        usageUpgradeHint.classList.add('hidden');
      }

      // Show limit reached banner when depleted
      if (remaining <= 0) {
        limitBanner.classList.remove('hidden');
      } else {
        limitBanner.classList.add('hidden');
      }
    }

    // --- Setup checklist ---
    const setupComplete = setup.voice_configured && setup.x_connected;
    if (setupComplete) {
      setupChecklist.classList.add('hidden');
    } else {
      setupChecklist.classList.remove('hidden');
      let completed = 1; // Extension is always done

      if (setup.voice_configured) {
        setupVoiceCheck.classList.add('done');
        setupVoiceAction.textContent = 'Done';
        setupVoiceAction.classList.add('setup-done-label');
        completed++;
      } else {
        setupVoiceCheck.classList.remove('done');
        setupVoiceAction.textContent = 'Set up';
        setupVoiceAction.classList.remove('setup-done-label');
      }

      if (setup.x_connected) {
        setupXCheck.classList.add('done');
        setupXAction.textContent = 'Done';
        setupXAction.classList.add('setup-done-label');
        completed++;
      } else {
        setupXCheck.classList.remove('done');
        setupXAction.textContent = 'Connect';
        setupXAction.classList.remove('setup-done-label');
      }

      setupProgressText.textContent = `${completed}/3`;
    }
  } catch (error) {
    console.error('Failed to load extension status:', error);
    // Silently fail — features still work without status
  }
}

// Load stats from storage and content script
async function loadStats() {
  try {
    // Load persistent stats from storage
    const result = await chrome.storage.local.get(['stats']);
    const stats = result.stats || {};
    statInspired.textContent = stats.postsInspired || 0;
    statReplies.textContent = stats.repliesGenerated || 0;

    // Get session-based postsScored from the active tab's content script
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tab?.url || '';
      const isOnX = url.includes('x.com') || url.includes('twitter.com');

      if (isOnX && tab?.id) {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATS' });
        statScored.textContent = response?.postsScored || 0;
      } else {
        statScored.textContent = 0;
      }
    } catch {
      statScored.textContent = 0;
    }
  } catch {
    statInspired.textContent = 0;
    statReplies.textContent = 0;
    statScored.textContent = 0;
  }
}

// View state management
function hideAllSections() {
  loadingSection.classList.add('hidden');
  welcomeSection.classList.add('hidden');
  loginSection.classList.add('hidden');
  loggedInSection.classList.add('hidden');
  settingsSection.classList.add('hidden');
}

function showWelcome() {
  hideAllSections();
  welcomeSection.classList.remove('hidden');
  headerStatusDot.classList.add('hidden');
  headerGearBtn.classList.add('hidden');
}

function showLogin() {
  hideAllSections();
  loginSection.classList.remove('hidden');
  headerStatusDot.classList.add('hidden');
  headerGearBtn.classList.add('hidden');
}

function showLoggedIn() {
  hideAllSections();
  loggedInSection.classList.remove('hidden');
  headerStatusDot.classList.remove('hidden');
  headerGearBtn.classList.remove('hidden');
}

function showSettings() {
  hideAllSections();
  settingsSection.classList.remove('hidden');
}

function showError(message) {
  loginError.textContent = message;
  loginError.classList.remove('hidden');
}

function hideError() {
  loginError.classList.add('hidden');
}

// Open dashboard to a specific path
function openDashboard(path) {
  const url = path ? `${currentApiUrl}${path}` : currentApiUrl;
  chrome.tabs.create({ url });
}

// Login with Supabase
async function login(email, password) {
  try {
    const response = await fetch(`${currentApiUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Login failed');
    }

    const data = await response.json();

    // Save tokens to extension storage
    await chrome.runtime.sendMessage({
      type: 'LOGIN',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    });

    // Mark that user has logged in before (for welcome vs login screen)
    await chrome.storage.local.set({ hasLoggedInBefore: true });

    return { success: true, email: data.user?.email };
  } catch (error) {
    console.error('Login failed:', error);
    return { success: false, error: error.message };
  }
}

// --- Event handlers ---

// Welcome screen
welcomeCreateAccountBtn.addEventListener('click', (e) => {
  e.preventDefault();
  openDashboard('/signup');
});

welcomeShowLoginBtn.addEventListener('click', () => {
  showLogin();
});

// Login back button
loginBackBtn.addEventListener('click', () => {
  showWelcome();
});

// Login form
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError('Please enter email and password');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';

  const result = await login(email, password);

  loginBtn.disabled = false;
  loginBtn.textContent = 'Sign in';

  if (result.success) {
    showLoggedIn();
    await detectXcomTab();
    await Promise.all([loadStats(), loadExtensionStatus()]);
  } else {
    showError(result.error || 'Login failed');
  }
});

logoutBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'LOGOUT' });
  // Clear cached status
  await chrome.storage.local.remove(['extensionStatus', 'statusFetchedAt']);
  showLogin();
  emailInput.value = '';
  passwordInput.value = '';
});

openDashboardBtn.addEventListener('click', (e) => {
  e.preventDefault();
  openDashboard();
});

// Setup checklist actions
setupVoiceAction.addEventListener('click', (e) => {
  e.preventDefault();
  openDashboard('/voice');
});

setupXAction.addEventListener('click', (e) => {
  e.preventDefault();
  openDashboard('/settings');
});

// Upgrade links
usageUpgradeLink.addEventListener('click', (e) => {
  e.preventDefault();
  openDashboard('/pricing');
});

limitUpgradeBtn.addEventListener('click', (e) => {
  e.preventDefault();
  openDashboard('/pricing');
});

// Gear icon opens settings
headerGearBtn.addEventListener('click', () => {
  settingsOpenedFrom = 'loggedIn';
  showSettings();
});

// Advanced toggle
advancedToggle.addEventListener('click', () => {
  const isHidden = advancedSection.classList.contains('hidden');
  if (isHidden) {
    advancedSection.classList.remove('hidden');
    advancedArrow.classList.add('expanded');
  } else {
    advancedSection.classList.add('hidden');
    advancedArrow.classList.remove('expanded');
  }
});

cancelSettingsBtn.addEventListener('click', () => {
  apiUrlInput.value = currentApiUrl;
  loadOppSettingsToForm(); // Reset opportunity settings form
  // Collapse advanced section
  advancedSection.classList.add('hidden');
  advancedArrow.classList.remove('expanded');
  if (settingsOpenedFrom === 'loggedIn') {
    showLoggedIn();
  } else {
    showLogin();
  }
});

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const newApiUrl = apiUrlInput.value.trim().replace(/\/$/, ''); // Remove trailing slash

  if (!newApiUrl) {
    return;
  }

  await chrome.runtime.sendMessage({
    type: 'SET_API_URL',
    apiUrl: newApiUrl,
  });

  // Save opportunity settings
  const newOppSettings = getOppSettingsFromForm();
  await chrome.storage.local.set({ oppSettings: newOppSettings });
  currentOppSettings = newOppSettings;

  currentApiUrl = newApiUrl;
  // Collapse advanced section
  advancedSection.classList.add('hidden');
  advancedArrow.classList.remove('expanded');
  if (settingsOpenedFrom === 'loggedIn') {
    showLoggedIn();
  } else {
    showLogin();
  }
});

// Footer links — open in new tab
document.getElementById('footer-privacy').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://agentsforx.com/privacy' });
});

document.getElementById('footer-terms').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://agentsforx.com/terms' });
});

// Initialize on load
init();
