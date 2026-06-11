# Prompt Flood

<p align="center">
  <img src="assets/logo.png" alt="Prompt Flood logo" width="120">
</p>

**Queue, pause, and broadcast prompts across ChatGPT, Gemini, Claude, Kimi, and DeepSeek.**

A Chrome extension built for multi-step AI workflows: chain prompts, pause for review, reuse personas, send to multiple chats at once, and pick up exactly where you left off after a refresh.

![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)
![Version](https://img.shields.io/badge/version-2.5.2-blue)
![Platforms](https://img.shields.io/badge/platforms-ChatGPT%20%7C%20Gemini%20%7C%20Claude%20%7C%20Kimi%20%7C%20DeepSeek-7C3AED)

---

## Why this extension?

Most LLM chat UIs are built for one prompt at a time. When you are running a research pipeline, content workflow, or long chain of instructions, you end up:

- Pasting the next prompt manually after each response
- Losing your place when a tab reloads
- Repeating the same prefix/suffix instructions on every message
- Juggling multiple model tabs without a central control panel

**Prompt Flood** turns each supported chat tab into a reliable prompt runner with a side panel command center that stays open while you work.

---

## Supported platforms

| Platform | URLs |
|----------|------|
| **ChatGPT** | `chatgpt.com`, `chat.openai.com` |
| **Gemini** | `gemini.google.com` |
| **Claude** | `claude.ai` |
| **Kimi** | `kimi.com`, `www.kimi.com` |
| **DeepSeek** | `chat.deepseek.com` |

Each platform has a dedicated adapter in `platforms.js` that handles editor detection, send actions, and ready-state checks — so the queue only fires when the model is actually ready for the next prompt.

---

## Features

### Prompt queue

Build an ordered list of prompts and let the extension send them automatically, one after another, as each model finishes responding.

- **Add to queue** — type a prompt and queue it up
- **Reorder** — move items up, down, or to top
- **Edit** — change prompt text before it sends
- **Duplicate** — copy a queue item in one click
- **Send now** — force-send any item immediately
- **Remove** — delete individual items
- **Clear** — wipe the whole queue
- **Retry** — recover from a failed send
- **Pause / Resume** — stop or continue the runner at any time

Queue state is saved **per tab**, so each chat conversation keeps its own independent queue.

---

### Checkpoints (Pause here)

Turn any queue item into a review gate.

- Check **Pause here** on a queued prompt to pause **after** that prompt is sent and the model finishes responding
- A checkpoint banner appears in the side panel with a **Resume** button
- A short chime plays in the chat tab when a checkpoint is reached (can be toggled in Settings)
- Perfect for multi-step workflows where you want to read the answer before continuing

**Hold before sending** (on the add form) keeps the first prompt in the queue without auto-sending until you press **Resume** — useful when you want to line up work before starting.

---

### Personas

Attach reusable instruction wrappers to any prompt.

- **Before prompt** — prepended above your prompt
- **After prompt** — appended below your prompt
- Parts are joined with a blank line automatically, so instructions never stick to your prompt text
- Built-in examples: *Academic tone*, *Preserve voice*
- Enable **Use persona** on the Queue tab to pick one per prompt
- **Manage personas** — add, edit, and delete custom personas from the Settings tab

Personas are applied at send time, so your queue stores clean prompt text while the model receives the full wrapped message.

---

### Send to multiple chats

Send the same prompt to several open chat tabs at once.

1. In the connection bar, click a tab chip to target one chat
2. **Ctrl+click** (⌘ on Mac) additional chips to add more targets
3. The primary button changes to **Send to N chats**
4. Click it — each target tab adds the prompt to its own queue independently

---

### Multi-tab manager

Work across several LLM tabs without confusion.

- Connection bar shows **Sending prompts to** with site name and chat ID
- Tab chips let you pick send targets; right-click a chip to ignore that tab
- **Showing queue for** picker switches which tab's queue you are viewing
- **Go to tab** buttons jump you to the relevant chat in the browser
- **Ignored (N)** expander lists hidden tabs with per-tab **Restore**
- Checkpoint tabs are prioritized automatically so you do not miss a paused workflow

---

### Open another chat

Launch new AI chat tabs without leaving the side panel.

- Expand **Open another chat** (or **Start a chat** when no tabs are connected)
- Click a platform button to open ChatGPT, Gemini, Claude, Kimi, or DeepSeek
- New tabs open in the background by default (configurable in Settings)

---

### Settings

Configure defaults and behavior from the **Settings** tab.

**Personas** — create, edit, and delete persona wrappers.

**Queue defaults**

- Default persona — pre-selected when composing a new prompt
- Default **Hold before sending**
- Clear prompt after adding to queue
- Confirm before clearing the queue

**Behavior**

- Connection refresh interval (1s / 3s / 5s / 10s)
- Play sound at checkpoints
- Open new chats in the background

**Data**

- Reset ignored tabs

---

### Reliability and persistence

- **Per-tab persistence** — queues survive side panel close and page refresh
- **Connection relay** — side panel talks to tabs through the background worker for stable messaging
- **Auto-inject** — content scripts are re-injected when needed after extension updates
- **Reconnect** — one-click recovery when a tab cannot be reached
- **Smart polling** — side panel updates quietly without flickering the UI

---

## Installation

### From source (developer mode)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `app` folder (the directory containing `manifest.json`)
6. Pin the extension from the toolbar for quick access

### After installing or updating

Refresh any open supported chat tabs once so the latest content script is active.

---

## Quick start

1. Open a supported chat (e.g. ChatGPT)
2. Click the **Prompt Flood** extension icon to open the side panel
3. Confirm the green connection dot and site label at the top
4. Type your first prompt and click **Add to Queue**
5. The extension waits for the model to be idle, sends the prompt, then continues down the queue

### Example workflow

```
Prompt 1: "Summarize this article in 5 bullet points."
         [x] Pause here

Prompt 2: "Now expand bullet 3 into a full paragraph."
Prompt 3: "Rewrite the paragraph in a casual tone."
```

With **Pause here** on Prompt 1, the queue stops after the summary so you can review it. Hit **Resume** when ready for Prompt 2.

---

## Side panel overview

| Area | What it does |
|------|----------------|
| **Queue / Settings tabs** | Switch between queue controls and configuration |
| **Connection bar** | Shows send target, tab chips, and multi-tab hints |
| **Open another chat** | Launch new platform tabs from the side panel |
| **Use persona** | Toggle persona wrapping on the next queued prompt |
| **Hold before sending** | Add without auto-starting an empty queue |
| **Queue toolbar** | Pause, Retry, Clear |
| **Queue list** | Per-item actions: Send now, Edit, Duplicate, Top, Up, Down, Remove, Pause here |

---

## Project structure

```
app/
├── manifest.json      # Extension manifest (MV3, side panel)
├── background.js      # Personas, broadcast relay, tab messaging
├── platforms.js       # Platform adapters (ChatGPT, Gemini, Claude, Kimi, DeepSeek)
├── content.js         # Per-tab queue engine, checkpoints, persistence
├── popup.html         # Side panel UI
├── popup.js           # Side panel logic and tab manager
└── assets/            # Logo and extension icons
```

### How it fits together

```
┌─────────────┐     relay_to_tab      ┌──────────────┐     sendMessage     ┌─────────────┐
│  popup.js   │ ────────────────────► │ background.js│ ──────────────────► │  content.js │
│ (side panel)│                       │ (service     │                     │ (per tab)   │
└─────────────┘                       │  worker)     │                     └─────────────┘
                                      └──────────────┘                            │
                                                                                  ▼
                                                                         ┌─────────────┐
                                                                         │ platforms.js│
                                                                         │ (adapters)  │
                                                                         └─────────────┘
```

---

## Permissions

| Permission | Why |
|------------|-----|
| `activeTab` | Interact with the current chat tab |
| `scripting` | Inject content scripts when needed |
| `sidePanel` | Open the extension UI in Chrome's side panel |
| `tabs` | Multi-tab send and tab manager |
| `storage` | Persist queues, personas, settings, and ignored tabs |
| Host permissions | Run only on supported chat domains |

No data is sent to external servers. Everything stays in your browser via `chrome.storage.local`.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| **Not connected** | Open a supported chat tab and click **Reconnect**, or refresh the tab |
| **Controls disabled** | Refresh the managed chat tab once (F5) after an extension update |
| **Prompt did not send** | Check the queue status message and use **Retry** |
| **Wrong tab targeted** | Click the correct chip in the connection bar |
| **All tabs ignored** | Click **Reset all** in the connection bar, use **Restore** per tab, or **Reset ignored tabs** in Settings |
| **Side panel did not open** | Update Chrome — side panel requires a recent version |

---

## Version history (highlights)

| Version | Highlights |
|---------|------------|
| **2.5.2** | Removed Perplexity support |
| **2.5.1** | Removed Doubao support |
| **2.5.0** | Perplexity support |
| **2.4.0** | Kimi and DeepSeek support |
| **2.3.x** | Connection reliability, tab restore, persona edit/delete, UI polish |
| **2.2.x** | Broadcast tab picker, compact multi-tab UI, checkpoint resume fixes |
| **2.0** | Claude support, personas, checkpoints, broadcast |
| **1.x** | ChatGPT + Gemini queue with persistence and controls |

---

## Contributing

Issues and pull requests are welcome. When adding a new platform, extend `platforms.js` with editor selectors, send logic, and ready-state detection, then add the host to `manifest.json`.

---

## Author

Built for power users who treat LLM chats like a pipeline — not a single message at a time.

**Prompt Flood** — queue, pause, and broadcast across ChatGPT, Gemini, Claude, Kimi, and DeepSeek.
