## Focus Mode

A lightweight Chrome extension for the study platform that hides distracting UI elements so you can focus on the content. Designed to reduce timer anxiety and visual clutter during study sessions.

### Version 1.10.2

The Chrome toolbar and Extensions page show the new violet open-book icon.

### Version 1.10.1

Toolbar clicks are handled before the page's document-level click handlers, so
those handlers cannot swallow clicks on NavSet, Focus Toggle or ♥. Only the
extension's own button clicks are intercepted; normal page buttons retain their
handling. Refreshing NavSet preserves focus on a button that remains available.

When Focus Mode is ON, ♥ performs its single check and shows **Check requested
at <time>** beside the controls. The timestamp confirms the local pass and reader
command were requested; it does not claim that ATI has rendered new content or
acknowledged the command. Toggling Focus Mode clears it. ♥ remains disabled while
Focus Mode is OFF. NavSet works through user/load/layout events without a
heartbeat, polling, recurring timers or DOM observers.

The manual Check button now shows **♥** and retains its accessible name and
one-check behavior. It and the Focus Toggle use the same 40px minimum height,
14px text and padding as NavSet's **⬆ Top** button.

**NavSet** floats on the right above the Focus controls. It includes Top and
heading navigation: **Previous ꜛ** / **Next ꜜ** for H1, and
**Previous ꜛꜛ** / **Next ꜜꜜ** for H2. Each heading button appears only when
there is a rendered heading to navigate to in that direction. H1 navigation
requires at least two rendered H1s. The H1 buttons navigate to H1s.
Hover or keyboard-focus a button for 0.1 second to see its target's heading text.
Top appears after scrolling and returns the article's scroll area to the start.
Navigation respects reduced-motion preferences and supports a nested reader
scroll area. ATI's native Top is replaced to keep one matching set of controls.

The popup's new **NavSet [ON]/[OFF]** row defaults to ON. OFF hides the entire
NavSet, including Top, while keeping the Focus controls available. This saved
setting works independently of Focus Mode and applies to open ATI documents and
reader frames. Navigation updates on scroll, resize, page loads, clicks and Focus
checks; it adds no polling or DOM observers. Use **♥** after late content changes
while Focus Mode is ON if the heading controls need refreshing.

Focus Mode also hides the AI avatar matching `.asc-vm-avatar-image` during its
normal ON/Check pass and restores it on OFF.

Reader requests target the identified ATI parent origin once, avoiding duplicate
wrong-origin messages. A one-time state handshake at reader load also supports
hidden referrers. Messaging listeners start when the DOM is complete, before
frame load events; there are no polling timers or continuous observers.

Holding Option+H toggles Focus Mode only on the initial keypress. Repeated
keydowns are ignored in both the main page and reader frames; releasing and
pressing the shortcut again toggles normally.

After prefilling an empty textarea with `SHOW ANSWER`, the extension sends one
bubbling `input` notification so ATI's form model and validation can update its
Submit button. It does not remove the button's disabled state itself or click it.
Existing drafts and manually cleared/edited fields are preserved; repeated checks
do not resend this notification for a textarea already initialized.

Focus Mode runs a single page check when switched ON and when you click
**♥ (Check)**, immediately to the left of the toggle. Check keeps Focus Mode ON and
is disabled while it is OFF. There is no continuous DOM observer, polling loop,
heartbeat, or delayed sidebar watcher. If ATI renders more content after a check,
click ♥ again to apply the rules to that content.

The existing saved ON state is restored with one initial pass on page/reader
load. Popup preference changes still apply that category's visibility directly;
click ♥ for a new freetext prefill after changing Practice Questions to Visible.
CSS-only question compaction continues to follow disabled textareas normally.

The former MutationObserver used browser-pushed local DOM notifications, not
server traffic. Its registration did not send requests. However, DOM changes,
textarea values and page-level frame messages can be observed by site scripts.
Manual checks control when work happens; they do not make the extension invisible.
The extension has no direct ATI network/API calls or automatic question submissions.
ATI may itself react to sidebar clicks, layout changes or other shared-page changes;
its resulting traffic was not measured or guaranteed to match manual use exactly.

Questions use conditional display rules and an empty-field prefill. Automatic
question submission, submission delays, attempt records, and the background worker
remain removed. Submit answers yourself using ATI's normal controls.

| Focus Mode | Practice Questions | Result |
| --- | --- | --- |
| OFF | Either setting | Normal question display |
| ON | Hidden | Hide all question types |
| ON | Visible | Compact disabled freetext widgets; prefill empty editable freetext with `SHOW ANSWER` |

For submitted freetext questions (`app-freetext` containing a disabled textarea):

- Hide the textarea's `.question-body` container.
- Remove `.question-header`'s bottom border and set its bottom padding to zero.
- Remove `.question-footer`'s top border and set its top padding to zero.
- Keep the question and any expert response visible.

Empty editable freetext textareas get the value property `SHOW ANSWER` during a
check while Focus Mode is ON and Practice Questions are Visible. Existing drafts and readonly
fields are preserved. Each editable textarea is initialized once; later edits or
clears are respected. Each new prefill sets the value and sends one `input` event.
ATI decides whether Submit is valid; no `change`, blur, or keyboard events are sent
and nothing submits automatically. Prefilled text remains editable
when Focus Mode is turned off.

Editable freetext questions and other question types retain their normal layout
when Practice Questions are Visible. The disabled textarea is the submitted-state
indicator; no question ID, exact feedback text, or rendered expert heading is
required. CSS responds to manual submissions, re-enabled textareas, and newly
rendered questions. Focus Mode OFF restores normal layout.

### Version 1.7 behavior retained

Accordions with an exact header title of **Legal** or **Credits** are hidden automatically while Focus Mode is ON and restored when it is OFF. Matching uses the accordion header title (with whitespace normalized) and its linked panel, rather than generated IDs, icon classes, or body text. No extra popup setting is required.

If a component contains both matching and unrelated accordion sections, only the Legal/Credits cards are hidden. The whole wrapper is hidden only when all its sections match. Newly inserted accordions or changed titles are handled by the next Check or ON pass. The Images toggle and all v1.6 preferences and popup colors are preserved.

### Features

**Focus Mode Toggle**: Hide or restore all targeted elements instantly using the badge button or keyboard shortcut. Everything comes back exactly as it was when you toggle off.

**Keyboard Shortcut**: Press **Option + H (⌥H)** from anywhere on the page — works whether your focus is in the main page or the reading iframe.

**Article Heading**: Each check copies `.course-title` into an H1 immediately before the first ATI article component (`.component[data-component-type]`) in the reader document. The heading is removed when Focus Mode turns off. The original title stays intact. Reader commands are restricted to ATI origins.

**Sidebar Switch**: Turning Focus Mode on closes the left navigation if open. Turning it off opens the navigation if closed. The extension uses ATI's menu button once per transition; it does not lock the sidebar or override later manual changes. If controls were not ready, the next Check can retry that pending transition once. No observer waits for them.

**Persistent State**: Focus mode stays on as you navigate between pages within the same session.

**Page Interactions**: Focus Mode changes the page display and existing sidebar/accordion controls. Under ON + Practice Questions Visible, each new empty-field `SHOW ANSWER` prefill sends one input notification to update ATI's form state. It never activates question Submit buttons. The timer still runs; you just can't see it.

**Always Hidden**: The live "Time spent" timer counter is hidden at all times, even when Focus Mode is off. I hate the timer so much I took it away from everyone.

### What Gets Hidden in Focus Mode

- Legal and Credits accordion sections
- In-text quiz questions
- Images (`.content-image`)
- Embedded Videos
- Embedded Interactive Components aka Biodigital Elements and related instruction accordion
- Top white header (ATI logo, book title, AI search, Close button)
- Blue sub-header (hamburger menu, module title)
- Main navigation bar (course title, Search, My Annotations, Settings & Help)
- Page tools toolbar (Audio Tools, annotation controls)
- TTS read-along overlay
- Bottom pagination footer
- Prev/Next navigation footer
- AI avatar (`.asc-vm-avatar-image`)
- Pendo help badge

### How to Use

| Action | Result |
|---|---|
| Press **⌥H** (Option + H) | Toggle Focus Mode on/off |
| Click the **badge button** (bottom right) | Toggle Focus Mode on/off |
| Click **♥ (Check)** to its left while ON | Run one check on the page and ATI reader frames |
| Click a **NavSet** button on the right | Scroll to the displayed heading target or Top |
| Click the **browser extension icon** | Open the four component settings and NavSet toggle |

The badge reads **Focus OFF** when elements are visible and **Focus ON** when they are hidden.

### Component Targeting Settings

Click the extension icon to show these four component rows plus NavSet. Click a component row to switch its stored choice between **[Hidden]** and **[Visible]**:

| Name | Target | Default |
|---|---|---|
| Video | `.component[data-component-type="video"]` | HIDDEN |
| 3D Visualizations | `.component[data-component-type="biodigital"]` | HIDDEN |
| Practice Questions | `.content-question` | HIDDEN |
| Images | `.content-image` | HIDDEN |

The separate NavSet row switches between **[ON]** and **[OFF]** (default ON).

Hidden labels use Forest Green (`#228B22`); Visible labels use Blood Moon Red (`#A52A2A`).

These choices control hiding while Focus Mode is ON. Focus Mode remains the master control and retains its existing session behavior. VISIBLE removes this category's hiding; ATI or another hidden ancestor may still hide the content.

3D Visualizations also controls the existing adjacent instruction accordion. Its existing adjacency and title-matching rules are preserved.

Preferences save immediately in `chrome.storage.local`, apply to existing ATI tabs and reader frames, and persist across navigation and browser restarts in the same browser profile. Removing the extension or clearing its storage resets these choices. The new `storage` permission supports this local persistence.

Video, 3D Visualizations, and Images retain their existing hiding behavior.
Practice Questions additionally controls the freetext layout and prefill described
above while Focus Mode is on. Existing sidebar and accordion behavior remains in
place. The extension makes no direct ATI network requests or question submissions.

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
