const queueBtn = document.getElementById("queueBtn");
const promptText = document.getElementById("promptText");
const statusDiv = document.getElementById("status");

const connectionDot = document.getElementById("connectionDot");
const connectionText = document.getElementById("connectionText");
const queueList = document.getElementById("queueList");

let activeTabId = null;
let isConnected = false;

function setConnectionStatus(status, site = "") {
  connectionDot.classList.remove("connected", "disconnected", "checking");

  if (status === "connected") {
    connectionDot.classList.add("connected");
    connectionText.innerText = `Connected to ${site}`;
    isConnected = true;
  } else if (status === "disconnected") {
    connectionDot.classList.add("disconnected");
    connectionText.innerText = "Not connected to chat";
    isConnected = false;
    renderQueue([]); // Clear visual queue if disconnected
  } else {
    connectionDot.classList.add("checking");
    connectionText.innerText = "Checking connection...";
    isConnected = false;
  }
}

// Function to draw the queue items in the popup
function renderQueue(queueArray) {
  queueList.innerHTML = ''; 

  if (!queueArray || queueArray.length === 0) {
      queueList.innerHTML = '<li><em>Queue is empty</em></li>';
      return;
  }

  queueArray.forEach((prompt) => {
      const li = document.createElement('li');
      // Truncate long prompts so they don't break the UI
      const previewText = prompt.length > 55 ? prompt.substring(0, 55) + '...' : prompt;
      li.innerText = previewText;
      queueList.appendChild(li);
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tab;
}

async function checkConnection() {
  setConnectionStatus("checking");

  const tab = await getActiveTab();

  if (!tab || !tab.id || !tab.url) {
    setConnectionStatus("disconnected");
    return;
  }

  activeTabId = tab.id;

  const isSupportedSite =
    tab.url.includes("chatgpt.com") ||
    tab.url.includes("gemini.google.com");

  if (!isSupportedSite) {
    setConnectionStatus("disconnected");
    return;
  }

  chrome.tabs.sendMessage(
    tab.id,
    { action: "ping_connection" },
    (response) => {
      if (chrome.runtime.lastError || !response || !response.connected) {
        setConnectionStatus("disconnected");
        return;
      }

      setConnectionStatus("connected", response.site);
      renderQueue(response.queue); // Load the existing queue on popup open
    }
  );
}

queueBtn.addEventListener("click", async () => {
  const text = promptText.value;

  if (!text.trim()) return;

  const tab = await getActiveTab();

  if (!tab || !tab.id || !tab.url) {
    statusDiv.innerText = "No active tab found.";
    statusDiv.style.color = "red";
    return;
  }

  const isSupportedSite =
    tab.url.includes("chatgpt.com") ||
    tab.url.includes("gemini.google.com");

  if (!isSupportedSite) {
    statusDiv.innerText = "Open ChatGPT or Gemini first!";
    statusDiv.style.color = "red";
    setConnectionStatus("disconnected");
    return;
  }

  chrome.tabs.sendMessage(
    tab.id,
    {
      action: "add_to_queue",
      prompt: text
    },
    (response) => {
      if (chrome.runtime.lastError || !response) {
        statusDiv.innerText = "Connection failed. Please refresh the chat page!";
        statusDiv.style.color = "red";
        setConnectionStatus("disconnected");
        return;
      }

      promptText.value = "";

      statusDiv.innerText = `Added! Queue size: ${response.queueLength}`;
      statusDiv.style.color = "green";

      setConnectionStatus("connected", tab.url.includes("chatgpt.com") ? "ChatGPT" : "Gemini");
      renderQueue(response.queue); // Update the visual list with the new prompt

      setTimeout(() => {
        statusDiv.innerText = "";
      }, 2000);
    }
  );
});

// Check connection when popup opens
checkConnection();