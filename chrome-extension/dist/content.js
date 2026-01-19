// Content Pipeline - X Post Saver & Reply Generator
// Content script for injecting save and reply buttons on X posts

const SAVE_BUTTON_CLASS = 'cp-save-button';
const REPLY_BUTTON_CLASS = 'cp-reply-button';
const REPLY_PICKER_CLASS = 'cp-reply-picker';
const SAVED_CLASS = 'cp-saved';
const SAVING_CLASS = 'cp-saving';
const GENERATING_CLASS = 'cp-generating';

// Track which posts we've already processed
const processedPosts = new Set();
// Track saved post URLs
let savedPostUrls = new Set();

// Check if extension context is still valid
function isExtensionContextValid() {
  try {
    return chrome.runtime && !!chrome.runtime.id;
  } catch {
    return false;
  }
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

// Load saved posts from storage on init
if (isExtensionContextValid()) {
  chrome.storage.local.get(['savedPostUrls'], (result) => {
    if (result.savedPostUrls) {
      savedPostUrls = new Set(result.savedPostUrls);
    }
  });
}

// Listen for updates to saved posts
if (isExtensionContextValid()) {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.savedPostUrls) {
      savedPostUrls = new Set(changes.savedPostUrls.newValue || []);
      // Update UI for all visible posts
      updateAllSaveButtons();
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

// AI Reply icon - sparkle/magic wand
function getReplyIcon() {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 3L14.5 8.5L20 9L16 13.5L17 19L12 16L7 19L8 13.5L4 9L9.5 8.5L12 3Z"></path>
  </svg>`;
}

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

    // Extract metrics
    const metrics = {};

    // Likes
    const likeButton = articleElement.querySelector('[data-testid="like"]');
    const likeCount = likeButton?.getAttribute('aria-label')?.match(/(\d+)/)?.[1];
    if (likeCount) metrics.likes = parseInt(likeCount, 10);

    // Retweets
    const retweetButton = articleElement.querySelector('[data-testid="retweet"]');
    const retweetCount = retweetButton?.getAttribute('aria-label')?.match(/(\d+)/)?.[1];
    if (retweetCount) metrics.retweets = parseInt(retweetCount, 10);

    // Replies
    const replyButton = articleElement.querySelector('[data-testid="reply"]');
    const replyCount = replyButton?.getAttribute('aria-label')?.match(/(\d+)/)?.[1];
    if (replyCount) metrics.replies = parseInt(replyCount, 10);

    // Views (analytics link or view count element)
    const analyticsLink = articleElement.querySelector('a[href*="/analytics"]');
    let viewsText = analyticsLink?.getAttribute('aria-label') || '';
    if (!viewsText) {
      // Try alternate view count location
      const viewsElement = articleElement.querySelector('[data-testid="app-text-transition-container"]');
      viewsText = viewsElement?.textContent || '';
    }
    const viewsMatch = viewsText.match(/([\d,]+)\s*view/i) || viewsText.match(/([\d,.]+[KMB]?)/i);
    if (viewsMatch) {
      let viewCount = viewsMatch[1].replace(/,/g, '');
      // Handle K, M, B suffixes
      if (viewCount.endsWith('K')) {
        viewCount = parseFloat(viewCount) * 1000;
      } else if (viewCount.endsWith('M')) {
        viewCount = parseFloat(viewCount) * 1000000;
      } else if (viewCount.endsWith('B')) {
        viewCount = parseFloat(viewCount) * 1000000000;
      }
      metrics.views = parseInt(viewCount, 10);
    }

    // Bookmarks
    const bookmarkButton = articleElement.querySelector('[data-testid="bookmark"]');
    const bookmarkCount = bookmarkButton?.getAttribute('aria-label')?.match(/(\d+)/)?.[1];
    if (bookmarkCount) metrics.bookmarks = parseInt(bookmarkCount, 10);

    // Extract timestamp
    const postTimestamp = timeElement?.getAttribute('datetime') || null;

    const result = {
      post_url: postUrl,
      author_handle: authorHandle,
      author_name: authorName,
      text_content: textContent,
      metrics,
      post_timestamp: postTimestamp,
    };

    // Debug logging
    console.log('[Content Pipeline] Extracted post data:', result);

    return result;
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

async function handleSaveClick(event, articleElement, button) {
  event.preventDefault();
  event.stopPropagation();

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

// Create reply button
function createReplyButton() {
  const button = document.createElement('button');
  button.className = REPLY_BUTTON_CLASS;
  button.title = 'Generate AI Reply';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'cp-icon';
  iconSpan.innerHTML = getReplyIcon();
  button.appendChild(iconSpan);

  return button;
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

    // Click X's native reply button to open composer
    const xReplyButton = articleElement.querySelector('[data-testid="reply"]');
    if (xReplyButton) {
      xReplyButton.click();
      await injectReplyText(selectedReply);
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
async function handleReplyClick(event, articleElement, replyButton, replyPicker) {
  event.preventDefault();
  event.stopPropagation();

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
  replyButton.title = 'Generating replies...';

  try {
    const postData = extractPostData(articleElement);

    if (!postData || !postData.text_content) {
      throw new Error('Could not extract post data');
    }

    // Send to background script for API call
    const response = await sendMessage({
      type: 'GENERATE_REPLY',
      payload: {
        post_text: postData.text_content,
        author_handle: postData.author_handle,
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

// Wait for composer and inject reply text
async function injectReplyText(text) {
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
          return;
        }

        // Fallback: direct text manipulation
        console.log('[Content Pipeline] execCommand failed, trying direct manipulation');
        editableDiv.textContent = text;
        editableDiv.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));

        console.log('[Content Pipeline] Reply injected via direct manipulation');
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

  // Create save button
  const saveButton = createSaveButton(postUrl);
  saveButton.addEventListener('click', (e) => handleSaveClick(e, articleElement, saveButton));

  // Create reply button and picker
  const replyButton = createReplyButton();
  const replyPicker = createReplyPicker();
  replyButton.addEventListener('click', (e) => handleReplyClick(e, articleElement, replyButton, replyPicker));

  // Insert buttons before the last item (usually the share button)
  const lastChild = actionBar.lastElementChild;
  if (lastChild) {
    actionBar.insertBefore(saveButton, lastChild);
    actionBar.insertBefore(replyButton, lastChild);
  } else {
    actionBar.appendChild(saveButton);
    actionBar.appendChild(replyButton);
  }

  // Append reply picker to body (for proper positioning)
  document.body.appendChild(replyPicker);
}

function processVisiblePosts() {
  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  articles.forEach(injectButtons);
}

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
