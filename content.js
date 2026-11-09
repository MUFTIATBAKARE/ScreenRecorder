// HelpMeOut Chrome Extension - Content Script
// Handles floating in-page recording controls, camera overlay, and web app bridge

let mediaRecorder = null;
let recordedChunks = [];
let recordingStream = null;
let cameraStream = null;
let floatingBar = null;
let cameraBubble = null;
let timerInterval = null;
let startTime = 0;
let isPaused = false;
let pausedTime = 0;

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_PAGE_RECORDING") {
    startPageRecording(request.options)
      .then((res) => sendResponse({ success: true, ...res }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  } else if (request.action === "STOP_PAGE_RECORDING") {
    stopPageRecording()
      .then((res) => sendResponse({ success: true, ...res }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  } else if (request.action === "GET_RECORDING_STATUS") {
    sendResponse({
      isRecording: !!mediaRecorder && mediaRecorder.state !== "inactive",
      isPaused: isPaused,
    });
  }
});

// Start recording from the page
async function startPageRecording(options = {}) {
  try {
    const { audio = true, camera = false } = options;

    // Get screen capture stream
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "always" },
      audio: audio,
    });

    let combinedTracks = [...displayStream.getVideoTracks()];

    // Get microphone audio if requested
    if (audio) {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        combinedTracks.push(...micStream.getAudioTracks());
      } catch (micErr) {
        console.warn("Microphone access denied or not available, continuing with system audio only:", micErr);
      }
    }

    // Get camera if requested and create camera bubble
    if (camera) {
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 320 },
        });
        createCameraBubble(cameraStream);
      } catch (camErr) {
        console.warn("Camera access denied or not available:", camErr);
      }
    }

    recordingStream = new MediaStream(combinedTracks);
    recordedChunks = [];

    // Support standard webm codecs
    const mimeType = MediaRecorder.isTypeSupported("video/webm; codecs=vp9,opus")
      ? "video/webm; codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm; codecs=vp8,opus")
      ? "video/webm; codecs=vp8,opus"
      : "video/webm";

    mediaRecorder = new MediaRecorder(recordingStream, { mimeType });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunks, { type: mimeType });
      const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      cleanupRecordingUI();

      // Stop all tracks
      if (recordingStream) {
        recordingStream.getTracks().forEach((t) => t.stop());
      }
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }

      await handleRecordingFinished(blob, durationSeconds);
    };

    // When user clicks the browser native "Stop sharing" bar
    displayStream.getVideoTracks()[0].onended = () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    };

    mediaRecorder.start(1000); // chunk every 1s
    startTime = Date.now();

    // Create floating controls pill
    createFloatingBar();

    return { status: "recording" };
  } catch (error) {
    cleanupRecordingUI();
    console.error("Failed to start page recording:", error);
    throw error;
  }
}

// Stop recording
function stopPageRecording() {
  return new Promise((resolve) => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || "video/webm";
        const blob = new Blob(recordedChunks, { type: mimeType });
        const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
        cleanupRecordingUI();

        if (recordingStream) {
          recordingStream.getTracks().forEach((t) => t.stop());
        }
        if (cameraStream) {
          cameraStream.getTracks().forEach((t) => t.stop());
        }

        await handleRecordingFinished(blob, durationSeconds);
        resolve({ durationSeconds });
      };
      mediaRecorder.stop();
    } else {
      cleanupRecordingUI();
      resolve({ status: "already_stopped" });
    }
  });
}

// Create floating pill controller at bottom left
function createFloatingBar() {
  if (floatingBar) floatingBar.remove();

  floatingBar = document.createElement("div");
  floatingBar.id = "helpmeout-floating-bar";
  floatingBar.style.cssText = `
    position: fixed !important;
    bottom: 28px !important;
    left: 28px !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: center !important;
    gap: 14px !important;
    background-color: #120b48 !important;
    color: #ffffff !important;
    padding: 10px 20px !important;
    border-radius: 40px !important;
    box-shadow: 0 8px 32px rgba(18, 11, 72, 0.45) !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    user-select: none !important;
    transition: all 0.2s ease !important;
  `;

  // Recording indicator & timer
  const timerSpan = document.createElement("span");
  timerSpan.id = "helpmeout-timer";
  timerSpan.style.cssText = `
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    font-weight: 700 !important;
    font-variant-numeric: tabular-nums !important;
  `;
  timerSpan.innerHTML = `
    <span style="display:inline-block;width:10px;height:10px;background-color:#ef4444;border-radius:50%;animation:helpmeoutPulse 1.2s infinite;"></span>
    <span id="helpmeout-timer-text">00:00</span>
  `;

  // Pause / Resume button
  const pauseBtn = document.createElement("button");
  pauseBtn.innerText = "⏸ Pause";
  pauseBtn.style.cssText = `
    background: rgba(255, 255, 255, 0.15) !important;
    color: white !important;
    border: none !important;
    padding: 6px 12px !important;
    border-radius: 20px !important;
    cursor: pointer !important;
    font-size: 13px !important;
    font-weight: 600 !important;
  `;
  pauseBtn.onclick = () => {
    if (!mediaRecorder) return;
    if (!isPaused) {
      mediaRecorder.pause();
      isPaused = true;
      pauseBtn.innerText = "▶ Resume";
      pauseBtn.style.background = "#10b981";
    } else {
      mediaRecorder.resume();
      isPaused = false;
      pauseBtn.innerText = "⏸ Pause";
      pauseBtn.style.background = "rgba(255, 255, 255, 0.15)";
    }
  };

  // Stop button
  const stopBtn = document.createElement("button");
  stopBtn.innerText = "⏹ Stop";
  stopBtn.style.cssText = `
    background: #ef4444 !important;
    color: white !important;
    border: none !important;
    padding: 6px 14px !important;
    border-radius: 20px !important;
    cursor: pointer !important;
    font-size: 13px !important;
    font-weight: 700 !important;
  `;
  stopBtn.onclick = () => {
    stopPageRecording();
  };

  // Cancel / Close button
  const cancelBtn = document.createElement("button");
  cancelBtn.innerText = "✕";
  cancelBtn.title = "Discard Recording";
  cancelBtn.style.cssText = `
    background: transparent !important;
    color: #cbd5e1 !important;
    border: none !important;
    cursor: pointer !important;
    font-size: 16px !important;
    padding: 4px 6px !important;
  `;
  cancelBtn.onclick = () => {
    if (confirm("Discard this recording?")) {
      cleanupRecordingUI();
      if (recordingStream) recordingStream.getTracks().forEach((t) => t.stop());
      if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop());
      mediaRecorder = null;
      recordedChunks = [];
    }
  };

  // Add keyframe animation for red pulse
  if (!document.getElementById("helpmeout-style-anim")) {
    const style = document.createElement("style");
    style.id = "helpmeout-style-anim";
    style.innerHTML = `
      @keyframes helpmeoutPulse {
        0% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(1.15); }
        100% { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  floatingBar.appendChild(timerSpan);
  floatingBar.appendChild(pauseBtn);
  floatingBar.appendChild(stopBtn);
  floatingBar.appendChild(cancelBtn);
  document.body.appendChild(floatingBar);

  // Start timer interval
  timerInterval = setInterval(() => {
    if (!isPaused) {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const textEl = document.getElementById("helpmeout-timer-text");
      if (textEl) {
        textEl.innerText = `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
      }
    }
  }, 1000);
}

// Create draggable circular camera bubble
function createCameraBubble(stream) {
  if (cameraBubble) cameraBubble.remove();

  cameraBubble = document.createElement("div");
  cameraBubble.id = "helpmeout-camera-bubble";
  cameraBubble.style.cssText = `
    position: fixed !important;
    bottom: 96px !important;
    left: 28px !important;
    width: 140px !important;
    height: 140px !important;
    border-radius: 50% !important;
    border: 3px solid #120b48 !important;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4) !important;
    overflow: hidden !important;
    z-index: 2147483646 !important;
    background: #000 !important;
  `;

  const video = document.createElement("video");
  video.srcObject = stream;
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.style.cssText = `
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    transform: scaleX(-1) !important;
  `;

  cameraBubble.appendChild(video);
  document.body.appendChild(cameraBubble);
}

// Clean up floating UI
function cleanupRecordingUI() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (floatingBar) {
    floatingBar.remove();
    floatingBar = null;
  }
  if (cameraBubble) {
    cameraBubble.remove();
    cameraBubble = null;
  }
}

// Handle recording complete: save, download, and open HelpMeOut
async function handleRecordingFinished(blob, durationSeconds) {
  const timestamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");
  const title = `Screen_Recording_${timestamp}`;
  const minutes = Math.floor(durationSeconds / 60);
  const remainingSecs = durationSeconds % 60;
  const durationStr = `${minutes < 10 ? "0" : ""}${minutes}:${remainingSecs < 10 ? "0" : ""}${remainingSecs}`;

  // Read blob as Data URL for storage transfer
  const reader = new FileReader();
  reader.onloadend = () => {
    const dataUrl = reader.result;

    // Save in chrome.storage.local for cross-tab transfer
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        latestRecording: {
          title,
          dataUrl,
          duration: durationStr,
          durationSeconds,
          timestamp: Date.now(),
        },
      });
    }

    // Auto-open HelpMeOut ready page (or notify background to open it)
    chrome.runtime.sendMessage({
      action: "RECORDING_COMPLETE",
      data: {
        title,
        dataUrl,
        duration: durationStr,
        durationSeconds,
      },
    });
  };
  reader.readAsDataURL(blob);
}

// Web App Bridge: If this content script is running on HelpMeOut (localhost:5173 or deployed app)
if (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.includes("helpmeout")
) {
  // Check if there is a pending recording in chrome.storage.local to inject
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["latestRecording"], (result) => {
      if (result && result.latestRecording) {
        const item = result.latestRecording;
        // Only deliver if within the last 5 minutes
        if (Date.now() - item.timestamp < 300000) {
          window.postMessage(
            {
              source: "HELPMEOUT_EXTENSION",
              type: "NEW_RECORDING",
              payload: item,
            },
            "*"
          );
        }
      }
    });
  }

  // Also listen for extension messages forwarded to this tab
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "DELIVER_RECORDING_TO_PAGE") {
      window.postMessage(
        {
          source: "HELPMEOUT_EXTENSION",
          type: "NEW_RECORDING",
          payload: msg.data,
        },
        "*"
      );
    }
  });
}
