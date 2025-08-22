// ==========================
// 🎥 WebRTC Video Call Logic
// ==========================
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

// NOTE: You MUST replace this URL with the one from your Render deployment.
// It should look like "wss://your-app-name.onrender.com".
const signalingServerUrl = "wss://your-render-app-name.onrender.com";

let localStream;
let peerConnection;
let isInitiator = false;

const signalingSocket = new WebSocket(signalingServerUrl);
const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

// 1. Get local camera stream
async function startLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        console.log("✅ Local camera started.");
    } catch (err) {
        console.error("❌ Failed to get local media stream:", err);
    }
}

// 2. Create the RTCPeerConnection and handle events
async function createPeerConnection() {
    if (peerConnection) return;
    peerConnection = new RTCPeerConnection(iceServers);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            console.log("✅ Remote stream received.");
        }
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("➡️ Sending ICE candidate.");
            signalingSocket.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
        }
    };
}

// 3. Main function to start the call
async function startCall(initiator) {
    isInitiator = initiator;
    await createPeerConnection();

    if (isInitiator) {
        console.log("➡️ Creating WebRTC offer.");
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        signalingSocket.send(JSON.stringify({ type: 'offer', offer: offer }));
    }
}

// 4. WebSocket signaling logic
signalingSocket.onopen = async () => {
    console.log("✅ Connected to signaling server.");
    await startLocalStream();
    // Signal readiness to the server to begin the handshake
    signalingSocket.send(JSON.stringify({ type: 'client_ready' }));
};

signalingSocket.onmessage = async (message) => {
    const data = JSON.parse(message.data);
    
    switch (data.type) {
        case 'peer_connected':
            console.log("➡️ Another peer is available, starting call.");
            startCall(true);
            break;

        case 'offer':
            console.log("⬅️ Received offer.");
            startCall(false);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            signalingSocket.send(JSON.stringify({ type: 'answer', answer: answer }));
            break;

        case 'answer':
            console.log("⬅️ Received answer.");
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            break;
            
        case 'candidate':
            if (data.candidate) {
                try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                    console.log("⬅️ Added ICE candidate.");
                } catch (err) {
                    console.error("❌ Error adding received ICE candidate:", err);
                }
            }
            break;
    }
};