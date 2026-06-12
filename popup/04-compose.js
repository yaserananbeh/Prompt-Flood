// @module popup/04-compose.js — see AGENTS.md
function formatQueuePreview(item) {
  if (item.text) {
    return truncate(item.text);
  }

  return "(empty)";
}
