let mediaRecorder;
let chunks = [];

document
  .getElementById("startRecord")
  .addEventListener("click", startRecording);
document.getElementById("stopRecord").addEventListener("click", stopRecording);

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
    });
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      chunks = [];
      sendDataToServer(blob);
    };

    mediaRecorder.start();
  } catch (error) {
    console.error("Error starting recording:", error);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}

function sendDataToServer(blob) {
  const url = "YOUR_SERVER_ENDPOINT_URL";

  const formData = new FormData();
  formData.append("screenRecording", blob);

  fetch(url, {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (response.ok) {
        console.log("Screen recording sent to the server successfully.");
      } else {
        console.error("Failed to send screen recording to the server.");
      }
    })
    .catch((error) => {
      console.error("Error sending screen recording:", error);
    });
}
