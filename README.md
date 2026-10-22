## Focus Mode

A lightweight Chrome extension for the study platform that hides distracting UI elements so you can focus on the content. Designed to reduce timer anxiety and visual clutter during study sessions.

### Features

**Focus Mode Toggle**: Hide or restore all targeted elements instantly using the badge button or keyboard shortcut. Everything comes back exactly as it was when you toggle off.

**Keyboard Shortcut**: Press **Option + H (⌥H)** from anywhere on the page — works whether your focus is in the main page or the reading iframe.

**Article Heading**: When Focus Mode turns on, the text of `.course-title` is copied once into an H1 immediately before the first ATI article component (`.component[data-component-type]`) in the reader document. The heading is removed when Focus Mode turns off. The original title stays intact. This uses the content script already running inside the reader iframe; the frame messaging protocol is unchanged.

**Sidebar Switch**: Turning Focus Mode on closes the left navigation if open. Turning it off opens the navigation if closed. The extension uses ATI's menu button once per transition; it does not lock the sidebar or override later manual changes.

**Persistent State**: Focus mode stays on as you navigate between pages within the same session.

**Zero Interference**: Nothing is stopped, broken, or modified on the backend. Only the visual display is affected. The timer still runs; you just can't see it.

**Always Hidden**: The live "Time spent" timer counter is hidden at all times, even when Focus Mode is off. I hate the timer so much I took it away from everyone.

### What Gets Hidden in Focus Mode

- In-text quiz questions
- Embedded Videos
- Embedded Interactive Components aka Biodigital Elements and related instruction accordion
- Top white header (ATI logo, book title, AI search, Close button)
- Blue sub-header (hamburger menu, module title)
- Main navigation bar (course title, Search, My Annotations, Settings & Help)
- Page tools toolbar (Audio Tools, annotation controls)
- TTS read-along overlay
- Bottom pagination footer
- Prev/Next navigation footer
- Back-to-top button
- Pendo help badge

### How to Use

| Action | Result |
|---|---|
| Press **⌥H** (Option + H) | Toggle Focus Mode on/off |
| Click the **badge button** (bottom right) | Toggle Focus Mode on/off |

The badge reads **Focus OFF** when elements are visible and **Focus ON** when they are hidden.

### Installation

Since this extension is not yet on the Chrome Web Store, you must sideload it:

1. Download or clone this repository to your computer (click **Code** → **Download ZIP**)
2. Unzip the downloaded file
3. Open Chrome and go to `chrome://extensions/`
4. Enable **Developer mode** using the toggle in the top-right corner
5. Click **Load unpacked**
6. Select the unzipped folder containing the extension files
7. Navigate to ATI — the extension is now active

To update after making changes to the files, return to `chrome://extensions/` and click the refresh icon on the extension card, then hard-refresh the ATI page with **⌘ + Shift + R**.

### Adding or Removing Hidden Elements

Open `content.js` and find the `SELECTORS` array near the top of the file. Each line is a CSS selector for one targeted element. Add a new line to hide something additional, or delete a line to stop hiding it. See the comments in the file for guidance on finding selectors using Chrome DevTools.

After any edit, reload the extension at `chrome://extensions/` and hard-refresh the ATI page.
