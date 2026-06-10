# Prompt Orchestrator

**Queue, pause, and broadcast prompts across ChatGPT, Gemini, Claude, Kimi, DeepSeek, Doubao, and Perplexity.**

A Chrome extension built for multi-step AI workflows: chain prompts, pause for review, reuse personas, broadcast to multiple chats, and pick up exactly where you left off after a refresh.

![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)
![Version](https://img.shields.io/badge/version-2.5.0-blue)
![Platforms](https://img.shields.io/badge/platforms-ChatGPT%20%7C%20Gemini%20%7C%20Claude%20%7C%20Kimi%20%7C%20DeepSeek%20%7C%20Doubao%20%7C%20Perplexity-7C3AED)

---

## Why this extension?

Most LLM chat UIs are built for one prompt at a time. When you are running a research pipeline, content workflow, or long chain of instructions, you end up:

- Pasting the next prompt manually after each response
- Losing your place when a tab reloads
- Repeating the same prefix/suffix instructions on every message
- Juggling multiple model tabs without a central control panel

**Prompt Orchestrator** turns each supported chat tab into a reliable prompt runner with a compact popup command center.

---

## Supported platforms

| Platform | URLs |
|----------|------|
| **ChatGPT** | `chatgpt.com`, `chat.openai.com` |
| **Gemini** | `gemini.google.com` |
| **Claude** | `claude.ai` |
| **Kimi** | `kimi.com` |
| **DeepSeek** | `chat.deepseek.com` |
| **Doubao** | `doubao.com` |
| **Perplexity** | `perplexity.ai` |

Each platform has a dedicated adapter in `platforms.js` that handles editor detection, send actions, and ready-state checks — so the queue only fires when the model is actually ready for the next prompt.

---

## Features

### Prompt queue

Build a ordered list of prompts and let the extension send them automatically, one after another, as each model finishes responding.

- **Add to queue** — type a prompt and queue it up
- **Reorder** — move items up, down, or jump to top
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
- A checkpoint banner appears in the popup with a **Resume** button
- A short chime plays when a checkpoint is reached
- Perfect for multi-step workflows where you want to read the answer before continuing

**Hold before sending** (on the add form) keeps the first prompt in the queue without auto-sending until you press **Resume** — useful when you want to line up work before starting.

---

### Personas

Attach reusable instruction wrappers to any prompt.

- **Before text** — prepended above your prompt
- **After text** — appended below your prompt
- Parts are joined with a blank line automatically, so instructions never stick to your prompt text
- Built-in examples: *Academic tone*, *Preserve voice*
- **Manage personas** — add, edit, and delete custom personas from the popup

Personas are applied at send time, so your queue stores clean prompt text while the model receives the full wrapped message.

---

### Broadcast

Send the same prompt to multiple chat tabs at once.

1. Enable **Broadcast**
2. Pick which open supported chat tabs should receive it
3. Use **All** / **None** for quick selection
4. Click **Broadcast to selected**

Each target tab adds the prompt to its own queue independently.

---

### Multi-tab manager

Work across several LLM tabs without confusion.

- Connection bar shows which chat tab you are managing, with site name and chat ID
- **+N tabs** expander lists other connected tabs — click to switch control to a different tab
- **x** — stop managing a tab (ignore it from the extension UI)
- **Restore** — bring ignored tabs back from the ignored list
- Checkpoint tabs are prioritized automatically so you do not miss a paused workflow

---

### Prompt history

Every successfully sent prompt is logged in the **History** tab.

- See site, preview, and timestamp
- **Re-queue** any past prompt back into the active tab's queue
- Up to 500 entries stored locally

---

### Reliability and persistence

- **Per-tab persistence** — queues survive popup close and page refresh
- **Connection relay** — popup talks to tabs through the background worker for stable messaging
- **Auto-inject** — content scripts are re-injected when needed after extension updates
- **Reconnect** — one-click recovery when a tab cannot be reached
- **Smart polling** — popup updates quietly without flickering the UI

---

## Installation

### From source (developer mode)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `LLM queue` folder
6. Pin the extension from the toolbar for quick access

### After installing or updating

Refresh any open supported chat tabs once so the latest content script is active.

---

## Quick start

1. Open a supported chat (e.g. ChatGPT)
2. Click the **Prompt Orchestrator** extension icon
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

## Popup overview

| Area | What it does |
|------|----------------|
| **Queue / History tabs** | Switch between active queue controls and sent-prompt log |
| **Connection bar** | Shows managed tab, chat ID, and multi-tab switcher |
| **Persona dropdown** | Apply a persona to the next queued prompt |
| **Hold before sending** | Add without auto-starting an empty queue |
| **Broadcast** | Send the same prompt to multiple selected tabs |
| **Queue toolbar** | Pause, Retry, Clear |
| **Queue list** | Per-item actions: Send now, Edit, Duplicate, reorder, Remove |

---

## Project structure

```
LLM queue/
├── manifest.json      # Extension manifest (MV3)
├── background.js      # History, personas, broadcast relay, tab messaging
├── platforms.js       # Platform adapters (ChatGPT, Gemini, Claude, Kimi, DeepSeek, Doubao, Perplexity)
├── content.js         # Per-tab queue engine, checkpoints, persistence
├── popup.html         # Popup UI
└── popup.js           # Popup logic and tab manager
```

### How it fits together

```
┌─────────────┐     relay_to_tab      ┌──────────────┐     sendMessage     ┌─────────────┐
│  popup.js   │ ────────────────────► │ background.js│ ──────────────────► │  content.js │
│  (UI)       │                       │ (service     │                     │ (per tab)   │
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
| `tabs` | Multi-tab broadcast and tab manager |
| `storage` | Persist queues, history, personas, and ignored tabs |
| Host permissions | Run only on supported chat domains |

No data is sent to external servers. Everything stays in your browser via `chrome.storage.local`.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| **Not connected** | Open a supported chat tab and click **Reconnect**, or refresh the tab |
| **Controls disabled** | Refresh the managed chat tab once (F5) after an extension update |
| **Prompt did not send** | Check the queue status message and use **Retry** |
| **Wrong tab is managed** | Expand **+N tabs** and select the correct chat |
| **All tabs ignored** | Click **Reset all** in the connection bar, or **Restore** per tab |
| **Persona text stuck together** | Update to the latest version — blank lines are added automatically |

---

## Version history (highlights)

| Version | Highlights |
|---------|------------|
| **2.5.0** | Perplexity support |
| **2.4.0** | Kimi, DeepSeek, and Doubao support |
| **2.3.x** | Connection reliability, tab restore, persona edit/delete, UI polish |
| **2.2.x** | Broadcast tab picker, compact multi-tab UI, checkpoint resume fixes |
| **2.0** | Claude support, personas, history, checkpoints, broadcast |
| **1.x** | ChatGPT + Gemini queue with persistence and controls |

---

## Contributing

Issues and pull requests are welcome. When adding a new platform, extend `platforms.js` with editor selectors, send logic, and ready-state detection, then add the host to `manifest.json`.

---

## Author

Built for power users who treat LLM chats like a pipeline — not a single message at a time.

**Prompt Orchestrator** — queue, pause, and broadcast across ChatGPT, Gemini, Claude, Kimi, DeepSeek, Doubao, and Perplexity.
