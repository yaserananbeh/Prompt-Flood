# Agent guide — Prompt Flood

Chrome MV3 extension. **Read this before searching the repo.**

<!-- AUTO:GENERATED_AT --> 2026-06-12

## File map (start here)

<!-- AUTO:FILE_MAP_START -->
| File | Responsibility |
|------|----------------|
| `popup.html` | Side panel markup + all CSS |
| `popup/01-constants.js` | Extension constants, `DEFAULT_SETTINGS`, `CONTENT_VERSION` |
| `popup/02-dom-state.js` | DOM element refs + mutable UI state variables |
| `popup/03-ui-settings.js` | Info tips, settings cards, LLM launcher, tab navigation helpers |
| `popup/04-compose.js` | Queue preview formatting helpers |
| `popup/05-status-modals.js` | Status banner, confirm/edit/persona modals |
| `popup/06-url-utils.js` | URL parsing, site labels, LLM lookup |
| `popup/07-connection.js` | Connection bar, linked tabs, refresh/poll, send targets |
| `popup/08-personas.js` | Personas UI, `setConnectionStatus`, `renderQueueStatus` banner |
| `popup/09-queue.js` | Queue list render, filter-by-chat, toolbar controls |
| `popup/10-messaging.js` | Tab messaging, `sendQueueAction`, queue item edit/remove |
| `popup/11-init.js` | Event listeners, `submitPrompt`, startup |
| `content.js` | Per-tab queue state, message actions, `processQueue` / `runQueueLoop` |
| `src/platforms/constants.js` | Timing constants for send waits |
| `src/platforms/config.js` | `PLATFORMS` selector configs (ChatGPT, Gemini, Claude, …) |
| `src/platforms/dom.js` | Shadow-DOM queries (`queryAllDeep`, visibility) |
| `src/platforms/editor.js` | `getEditor`, `getStopButton`, `isReady`, `detectPlatform` |
| `src/platforms/inject.js` | Generic text injection (Lexical, ProseMirror, textarea) |
| `src/platforms/send-button.js` | Send button discovery and send confirmation waits |
| `src/platforms/prompt-inject.js` | Gemini-specific text inject + pre-send guards |
| `src/platforms/send.js` | `sendPrompt` — inject text and click send |
| `src/platforms/api.js` | Public `LLM_PLATFORMS` export object |
| `platforms.js` | Built bundle — LLM DOM automation (`sendPrompt`, text injection) (run `node scripts/build.mjs`) |
| `background.js` | Message relay tab↔panel, personas storage |
| `manifest.json` | Permissions, content script injection order |
<!-- AUTO:FILE_MAP_END -->

## Script load order

<!-- AUTO:LOAD_ORDER_START -->
### Content scripts (per chat tab)

```
platforms.js → content.js
```

Edit `src/platforms/*` then run `node scripts/build.mjs` to regenerate `platforms.js`.

### Side panel scripts

```
popup/01-constants.js → popup/02-dom-state.js → popup/03-ui-settings.js → popup/04-compose.js → popup/05-status-modals.js → popup/06-url-utils.js → popup/07-connection.js → popup/08-personas.js → popup/09-queue.js → popup/10-messaging.js → popup/11-init.js
```
<!-- AUTO:LOAD_ORDER_END -->

## Data flow

```
popup/*  --relay_to_tab-->  background.js  --tabs.sendMessage-->  content.js
                                                                    |
                                                                    v
                                                              platforms.js
                                                              (DOM on chat page)
```

- Queue state is stored **per tab** in `chrome.storage.local` (`content.js` → `persistState`).
- `CONTENT_VERSION` must stay in sync in `content.js` and `popup/01-constants.js` when content-script behavior changes.

## “Where do I change X?”

| User-facing feature | Primary file | Key symbols |
|---------------------|--------------|-------------|
| Queue list UI, filter-by-chat, “Active queue” | `popup/09-queue.js` | `renderQueue`, `collectQueueEntries` (in `07-connection.js`), `selectQueueViewFilter` |
| Add prompt form, personas toggle | `popup.html` + `popup/11-init.js` | `submitPrompt`, `usePersonaToggle` |
| Pause / Clear / Retry toolbar | `popup/09-queue.js` + `popup/10-messaging.js` | `sendQueueAction`, `updateControls`, `renderQueueStatus` |
| Multi-tab send targets, connection bar | `popup/07-connection.js` | `renderConnectionBar`, `renderConnectionTabPicker`, `getEffectiveTargetTabIds` |
| Queue runner, stuck send, errors after clear | `content.js` | `runQueueLoop`, `processQueue`, `queueGeneration`, `clear_queue` handler |
| Queue actions (add, remove, move, edit…) | `content.js` | `handleMessage` switch cases |
| Gemini / ChatGPT / Claude DOM selectors | `src/platforms/config.js` | `PLATFORMS` object |
| Text injection and send | `src/platforms/send.js`, `prompt-inject.js` | `sendPrompt`, `injectGeminiText`, `ensurePromptTextBeforeSend` |
| “Model not ready” / waiting for response | `src/platforms/editor.js`, `send-button.js` | `isReady`, `waitForSendConfirmation`; `waitForReadyState` in `content.js` |
| Personas CRUD | `background.js` + `popup/08-personas.js` | `get_personas`, `save_persona`, `renderPersonaList` |

## Platform-specific work

All LLM differences live in **`src/platforms/`** (built into `platforms.js`):

- `config.js` → `PLATFORMS.<id>` selectors
- `prompt-inject.js` → Gemini-specific text injection
- Do **not** scatter platform checks in popup or `content.js`

## Common bugs & where to look

| Symptom | Likely cause | Look at |
|---------|--------------|---------|
| Error after clearing stuck prompt | Race: `runQueueLoop` sets `lastError` after clear | `content.js` → `queueGeneration`, `shouldReportQueueError` |
| `[Site] Failed to send prompt` banner | `lastError` in tab state | `content.js` `runQueueLoop`; `popup/08-personas.js` `getQueueStatusState` |
| Controls disabled / stale script | `CONTENT_VERSION` mismatch | Bump in `content.js` + `popup/01-constants.js` |
| Wrong tab’s queue shown | Filter vs managed tab | `popup/07-connection.js` → `queueViewTabId` vs `managedTabId` |

## Conventions

- Popup talks to tabs via `sendMessageToTab` (`popup/10-messaging.js`) → `background.js` `relay_to_tab`
- `content.js` exports state via `buildStateResponse()` (polled by `popup/07-connection.js`)
- After editing `src/platforms/*`: `node scripts/build.mjs`
- After adding/moving files: `node scripts/sync-agents-map.mjs` (also runs on agent `stop` hook)
- UI strings and CSS: `popup.html`

## Do not

- Edit `platforms.js` directly — change `src/platforms/*` and rebuild
- Add tests or docs files unless asked
- Commit `.cursor/`, `.promptrecorder/`, or hook state
