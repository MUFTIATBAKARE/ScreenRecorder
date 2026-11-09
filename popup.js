// HelpMeOut Chrome Extension - Popup Controller

let currentMode = "full_screen"; // "full_screen" or "current_tab"
let isRecording = false;
let localMediaRecorder = null;
let localChunks = [];
let localStream = null;
let localStartTime = 0;
let lastBlobUrl = null;

// DOM Elements
const tabFullScreen = document.getElementById("tabFullScreen");
const tabCurrentTab = document.getElementById("tabCurrentTab");
const cameraCheckbox = document.getElementById("cameraCheckbox");
const audioCheckbox = document.getElementById("audioCheckbox");
const startRecordBtn = document.getElementById("startRecord");
const stopRecordBtn = document.getElementById("stopRecord");
const statusIndicator = document.getElementById("statusIndicator");
const completedActions = document.getElementById("completedActions");
const openAppBtn = document.getElementById("openAppBtn");
const downloadLink = document.getElementById("downloadLink");
const closeBtn = document.getElementById("closeBtn");
const settingsBtn = document.getElementById("settingsBtn");

// Tab Selection
tabFullScreen.addEventListener("click", () => {
  currentMode = "full_screen";
  tabFullScreen.classList.add("active");
  tabCurrentTab.classList.remove("active");
});

tabCurrentTab.addEventListener("click", () => {
  currentMode = "current_tab";
  tabCurrentTab.classList.add("active");
  tabFullScreen.classList.remove("active");
});

// Window Close & Settings
if (closeBtn) closeBtn.addEventListener("click", () => window.close());
if (settingsBtn) {
  settingsBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "http://localhost:5173/repository" });
  });
}

// Start Recording
startRecordBtn.addEventListener("click", async () => {
  const audio = audioCheckbox.checked;
  const camera = cameraCheckbox.checked;

  setStatus("Starting recording...", false);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if the tab can run content scripts (cannot run on chrome:// or webstore)
    const isSpecialUrl =
      !tab ||
      !tab.url ||
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://") ||
      tab.url.startsWith("https://chrome.google.com/webstore");

    if (!isSpecialUrl && tab.id) {
      // Send message to content script on active tab
      chrome.tabs.sendMessage(
        tab.id,
        {
          action: "START_PAGE_RECORDING",
          options: { audio, camera, mode: currentMode },
        },
        (response) => {
          if (chrome.runtime.lastError || !response || !response.success) {
            console.log("Content script not responding or blocked, falling back to direct capture:", chrome.runtime.lastError);
            startDirectCapture(audio);
          } else {
            setRecordingActiveUI();
            // Automatically close popup so user sees the floating recording widget on the page!
            setTimeout(() => window.close(), 1000);
          }
        }
      );
    } else {
      // Fallback for chrome:// tabs or desktop
      await startDirectCapture(audio);
    }
  } catch (err) {
    console.error("Error starting recording:", err);
    await startDirectCapture(audio);
  }
});

// Fallback: Direct capture in popup
async function startDirectCapture(audio) {
  try {
    localStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: audio,
    });

    if (audio) {
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        mic.getAudioTracks().forEach((track) => localStream.addTrack(track));
      } catch (e) {
        console.warn("Mic not available for direct capture");
      }
    }

    localChunks = [];
    localMediaRecorder = new MediaRecorder(localStream);

    localMediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) localChunks.push(e.data);
    };

    localMediaRecorder.onstop = () => {
      const blob = new Blob(localChunks, { type: "video/webm" });
      const durationSeconds = Math.max(1, Math.round((Date.now() - localStartTime) / 1000));
      onLocalRecordingFinished(blob, durationSeconds);
    };

    localStream.getVideoTracks()[0].onended = () => {
      stopLocalCapture();
    };

    localStartTime = Date.now();
    localMediaRecorder.start(1000);
    setRecordingActiveUI();
  } catch (e) {
    setStatus("Recording cancelled or blocked.", false);
    resetUI();
  }
}

// Stop Recording
stopRecordBtn.addEventListener("click", async () => {
  setStatus("Finishing recording...", false);

  if (localMediaRecorder && localMediaRecorder.state !== "inactive") {
    stopLocalCapture();
    return;
  }

  // Attempt stopping content script on active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: "STOP_PAGE_RECORDING" }, (resp) => {
        setRecordingStoppedUI();
      });
    } else {
      setRecordingStoppedUI();
    }
  } catch (e) {
    setRecordingStoppedUI();
  }
});

function stopLocalCapture() {
  if (localMediaRecorder && localMediaRecorder.state !== "inactive") {
    localMediaRecorder.stop();
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
  }
  setRecordingStoppedUI();
}

function onLocalRecordingFinished(blob, durationSeconds) {
  if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
  lastBlobUrl = URL.createObjectURL(blob);

  // Setup download link
  downloadLink.href = lastBlobUrl;
  downloadLink.download = `HelpMeOut_Recording_${new Date().toISOString().slice(11, 19).replace(/:/g, "")}.webm`;

  // Read as Data URL to store and send to HelpMeOut
  const reader = new FileReader();
  reader.onloadend = () => {
    const dataUrl = reader.result;
    const minutes = Math.floor(durationSeconds / 60);
    const secs = durationSeconds % 60;
    const durationStr = `${minutes < 10 ? "0" : ""}${minutes}:${secs < 10 ? "0" : ""}${secs}`;
    const payload = {
      title: `Screen_Recording_${new Date().toISOString().slice(11, 19).replace(/:/g, "")}`,
      dataUrl,
      duration: durationStr,
      durationSeconds,
      timestamp: Date.now(),
    };

    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ latestRecording: payload });
    }

    openAppBtn.onclick = () => {
      chrome.runtime.sendMessage({ action: "RECORDING_COMPLETE", data: payload });
    };
  };
  reader.readAsDataURL(blob);

  setStatus("✓ Recording saved successfully!", false);
  completedActions.style.display = "flex";
}

openAppBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: "http://localhost:5173/ready?ext=true" });
});

function setRecordingActiveUI() {
  isRecording = true;
  startRecordBtn.disabled = true;
  startRecordBtn.style.opacity = "0.5";
  stopRecordBtn.disabled = false;
  stopRecordBtn.style.opacity = "1";
  completedActions.style.display = "none";
  setStatus("🔴 Recording in progress...", true);
}

function setRecordingStoppedUI() {
  isRecording = false;
  startRecordBtn.disabled = false;
  startRecordBtn.style.opacity = "1";
  stopRecordBtn.disabled = true;
  stopRecordBtn.style.opacity = "0.5";
  setStatus("✓ Recording complete!", false);
  completedActions.style.display = "flex";
}

function resetUI() {
  startRecordBtn.disabled = false;
  startRecordBtn.style.opacity = "1";
  stopRecordBtn.disabled = true;
  stopRecordBtn.style.opacity = "0.5";
  completedActions.style.display = "none";
}

function setStatus(text, isRed) {
  statusIndicator.style.display = "block";
  statusIndicator.innerText = text;
  if (isRed) {
    statusIndicator.classList.add("status_recording");
  } else {
    statusIndicator.classList.remove("status_recording");
  }
}
