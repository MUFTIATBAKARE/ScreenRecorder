# ScreenRecorder - HelpMeOut Chrome Extension 🎙️

[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-blue?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![WebRTC](https://img.shields.io/badge/API-getDisplayMedia%20%2F%20MediaRecorder-red)](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Capture_API)
[![Companion Web App](https://img.shields.io/badge/WebApp-HelpMeOut-120b48)](https://github.com/MUFTIATBAKARE/HelpMeOut)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> The official Chrome Extension companion for [HelpMeOut](https://github.com/MUFTIATBAKARE/HelpMeOut). Easily record your screen, microphone, and webcam with floating in-page controls and instant handoff to the HelpMeOut video management platform.

---

## ✨ Features

- 🖥️ **Dual Recording Modes:** Choose between recording the **Full screen** or just the **Current Tab**.
- 🎤 **Audio & Webcam Overlays:**
  - Microphone audio toggle for voiceover commentary
  - Circular floating webcam video bubble displayed in the corner of your screen during recording
- ⏱️ **In-Page Floating Controller:**
  - Injected directly into your active page
  - Live elapsed recording timer (`00:00`)
  - Red pulsing recording indicator
  - Pause / Resume toggle button
  - Finish & Stop button
  - Discard / Cancel button
- 🔁 **Instant Web App Handoff:** Upon stopping, automatically launches the HelpMeOut Web App (`/ready`), transfers the recorded video, and presents it with custom playback controls, transcripts, and shareable links.
- 💾 **Direct Local Download Safeguard:** Provides an immediate 1-click `.webm` download link directly from the extension popup.
- 🛡️ **Modern Chrome Manifest V3:** Fully compliant with Chrome's latest extension manifest standards using service workers and isolated content scripts.

---

## 🛠️ Installation Guide (Load Unpacked)

Because this extension is open-source and under active development, you can run it directly in Google Chrome without the Chrome Web Store:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/MUFTIATBAKARE/ScreenRecorder.git
   ```
   *(Or download and extract the ZIP file)*

2. **Open Chrome Extension Settings:**
   - In Google Chrome, navigate to `chrome://extensions/`
   - Or click **Menu (⋮)** ➔ **Extensions** ➔ **Manage Extensions**.

3. **Enable Developer Mode:**
   - In the top-right corner of the Extensions page, toggle the **Developer mode** switch **ON**.

4. **Load the Extension:**
   - Click the **"Load unpacked"** button in the top-left corner.
   - Select the `ScreenRecorder` folder on your machine (e.g., `C:\Users\...\Desktop\dev\ScreenRecorder`).

5. **Pin to Toolbar:**
   - Click the puzzle icon (Extensions) in your Chrome toolbar and pin **HelpMeOut** for quick access.

---

## 🎯 How to Record

1. Navigate to any website you wish to demonstrate or record (e.g., [https://wikipedia.org](https://wikipedia.org)).
2. Click the **HelpMeOut** extension icon in your Chrome toolbar.
3. Select your preferred mode (**Full screen** or **Current Tab**).
4. Toggle **Audio** (microphone) and **Camera** (webcam) as needed.
5. Click **Start**:
   - Grant screen sharing permission when prompted by Chrome.
   - The popup will automatically close, and a floating pill with live timer, pause, and stop controls will appear at the bottom-left of your page.
6. When done, click **Stop** on the floating pill:
   - Your recording is finalized and opened directly in the HelpMeOut web app (`http://localhost:5173/ready` or your deployed URL).
   - Alternatively, open the extension popup to click **"Download Video (.webm)"**.

---

## 📁 Extension Architecture

```
ScreenRecorder/
├── images/             # Extension icons, logos, and UI graphics
├── manifest.json       # Chrome Manifest V3 configuration & permissions
├── popup.html          # Extension popup UI
├── popup.css           # Popup styling and animations
├── popup.js            # Mode selection, permission handling, and capture logic
├── content.js          # In-page floating recording bar & camera bubble overlay
├── background.js       # Background service worker & tab navigation bridge
└── README.md           # Documentation
```

---

## 🤝 Companion Web Application

This extension is built to pair directly with the **HelpMeOut** React web application for video playback, automatic transcripts, repository search, and email/social sharing:
👉 [HelpMeOut Web Application Repository](https://github.com/MUFTIATBAKARE/HelpMeOut)

---

## 📄 License

This project is licensed under the MIT License.
