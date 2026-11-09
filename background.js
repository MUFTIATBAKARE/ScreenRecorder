// HelpMeOut Chrome Extension - Background Service Worker

const HELPMEOUT_APP_URL = "http://localhost:5173/ready";

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "RECORDING_COMPLETE") {
    const recordingData = message.data;

    // Open HelpMeOut Web App in a new tab
    chrome.tabs.create({ url: `${HELPMEOUT_APP_URL}?ext=true` }, (newTab) => {
      // Once the tab is loaded, forward the recording data to the new tab's content script
      const onTabUpdated = (tabId, changeInfo) => {
        if (tabId === newTab.id && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(onTabUpdated);

          // Small delay to ensure content script is listening
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, {
              action: "DELIVER_RECORDING_TO_PAGE",
              data: recordingData,
            });
          }, 600);
        }
      };

      chrome.tabs.onUpdated.addListener(onTabUpdated);
    });

    sendResponse({ success: true });
    return true;
  }

  if (message.action === "OPEN_APP") {
    chrome.tabs.create({ url: HELPMEOUT_APP_URL });
    sendResponse({ success: true });
    return true;
  }
});
