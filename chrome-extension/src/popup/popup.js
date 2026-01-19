// Content Pipeline - Popup Script

const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // Will be configured via settings
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Will be configured via settings

// DOM elements
const loadingSection = document.getElementById('loading');
const loginSection = document.getElementById('login-section');
const loggedInSection = document.getElementById('logged-in-section');
const settingsSection = document.getElementById('settings-section');

const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

const userEmailSpan = document.getElementById('user-email');
const openDashboardBtn = document.getElementById('open-dashboard');
const logoutBtn = document.getElementById('logout-btn');

const showSettingsBtn = document.getElementById('show-settings-btn');
const settingsForm = document.getElementById('settings-form');
const apiUrlInput = document.getElementById('api-url');
const cancelSettingsBtn = document.getElementById('cancel-settings-btn');

let currentApiUrl = 'http://localhost:3000';

// Initialize popup
async function init() {
  try {
    // Get config
    const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' });
    currentApiUrl = response.apiUrl || 'http://localhost:3000';
    apiUrlInput.value = currentApiUrl;

    // Check auth status
    const authResponse = await chrome.runtime.sendMessage({ type: 'CHECK_AUTH' });

    loadingSection.classList.add('hidden');

    if (authResponse.loggedIn) {
      showLoggedIn();
    } else {
      showLogin();
    }
  } catch (error) {
    console.error('Init failed:', error);
    loadingSection.classList.add('hidden');
    showLogin();
  }
}

function showLogin() {
  loginSection.classList.remove('hidden');
  loggedInSection.classList.add('hidden');
  settingsSection.classList.add('hidden');
}

function showLoggedIn(email = 'Connected') {
  loginSection.classList.add('hidden');
  loggedInSection.classList.remove('hidden');
  settingsSection.classList.add('hidden');
  userEmailSpan.textContent = email;
}

function showSettings() {
  loginSection.classList.add('hidden');
  loggedInSection.classList.add('hidden');
  settingsSection.classList.remove('hidden');
}

function showError(message) {
  loginError.textContent = message;
  loginError.classList.remove('hidden');
}

function hideError() {
  loginError.classList.add('hidden');
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

    return { success: true, email: data.user?.email };
  } catch (error) {
    console.error('Login failed:', error);
    return { success: false, error: error.message };
  }
}

// Event handlers
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
  loginBtn.textContent = 'Logging in...';

  const result = await login(email, password);

  loginBtn.disabled = false;
  loginBtn.textContent = 'Log in';

  if (result.success) {
    showLoggedIn(result.email || email);
  } else {
    showError(result.error || 'Login failed');
  }
});

logoutBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'LOGOUT' });
  showLogin();
  emailInput.value = '';
  passwordInput.value = '';
});

openDashboardBtn.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: currentApiUrl });
});

showSettingsBtn.addEventListener('click', () => {
  showSettings();
});

cancelSettingsBtn.addEventListener('click', () => {
  apiUrlInput.value = currentApiUrl;
  showLogin();
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

  currentApiUrl = newApiUrl;
  showLogin();
});

// Initialize on load
init();
