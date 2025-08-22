// ==========================
// 🎥 Local Webcam Logic Only
// ==========================
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

// Start the local camera and get the stream
async function startLocalStream() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = stream;
        // The line below is removed so the remote video remains black
        // remoteVideo.srcObject = stream; 
        console.log("✅ Local camera started and displayed on the local video element.");
    } catch (err) {
        console.error("❌ Failed to get local media stream:", err);
    }
}

// Automatically start the stream when the page loads
window.addEventListener('load', startLocalStream);