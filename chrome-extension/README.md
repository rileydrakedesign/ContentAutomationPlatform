# Content Pipeline Chrome Extension

Save X posts directly to your Content Pipeline dashboard while browsing.

## Installation

1. Build the extension:
   ```bash
   cd chrome-extension
   npm run build
   ```

2. Load in Chrome:
   - Go to `chrome://extensions`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked"
   - Select the `dist` folder

3. Configure:
   - Click the extension icon in Chrome
   - Enter your dashboard URL (default: `http://localhost:3000`)
   - Log in with your Content Pipeline account

## Usage

1. Browse X (twitter.com or x.com)
2. You'll see a save button (bookmark icon) on each post
3. Click to save the post to your inbox
4. The button turns green when saved

## Features

- **One-click save**: Save any X post with a single click
- **Auto-detect your posts**: Posts from your configured handles are automatically marked as "your post"
- **Metrics capture**: Captures likes, retweets, replies, views, and bookmarks
- **Duplicate prevention**: Won't save the same post twice
- **Offline indicator**: Shows when you're not logged in

## Development

The extension consists of:
- `content.js` - Injected into X pages, adds save buttons
- `background.js` - Service worker for API communication
- `popup.html/js/css` - Extension popup for login/settings

To modify:
1. Edit files in `src/`
2. Run `npm run build`
3. Reload the extension in Chrome

## Icons

Add your own icons to `public/icons/`:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)
