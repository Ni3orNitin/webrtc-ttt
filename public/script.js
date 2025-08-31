// ==========================
// ➡️ Final Consolidated script.js (Video Only)
// ==========================

// ==========================
// DOM Elements and Constants
// ==========================
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const joinBtn = document.getElementById("joinBtn");
const muteMicBtn = document.getElementById("muteMicBtn");
const muteSpeakerBtn = document.getElementById("muteSpeakerBtn");
const endCallBtn = document.getElementById("endCallBtn");

// NOTE: You MUST replace this URL with the one from your Render deployment.
const signalingServerUrl = "wss://webrtc-ttt.onrender.com";

let localStream;
let peerConnection;
let isInitiator = false;
let signalingSocket;

const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" }
  ]
};

// ==========================
// 🎥 WebRTC Video Call Logic
// ==========================
async function startLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        console.log("✅ Local camera started.");
        return localStream;
    } catch (err) {
        console.error("❌ Failed to get local media stream:", err);
        throw err;
    }
}

async function createPeerConnection() {
    if (peerConnection) return;
    peerConnection = new RTCPeerConnection(iceServers);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        if (event.streams && event.streams.length > 0) {
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

async function joinCall() {
    try {
        await startLocalStream();
        signalingSocket = new WebSocket(signalingServerUrl);

        signalingSocket.onopen = () => {
            console.log("✅ Connected to signaling server.");
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
                        } catch (err) { console.error("❌ Error adding received ICE candidate:", err); }
                    }
                    break;
                case 'end_call':
                    console.log("❌ Remote peer ended the call.");
                    endCall();
                    break;
            }
        };

        joinBtn.disabled = true;
        joinBtn.textContent = 'Connecting...';
    } catch (err) {
        console.error("❌ Could not join call:", err);
    }
}

async function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localVideo.srcObject = null;
        localStream = null;
    }

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    remoteVideo.srcObject = null;

    joinBtn.disabled = false;
    joinBtn.textContent = 'Join Call';
    isInitiator = false;
    console.log("❌ Call ended.");

    if (signalingSocket) {
        signalingSocket.send(JSON.stringify({ type: 'end_call' }));
        signalingSocket.close();
        signalingSocket = null;
    }
}

joinBtn.addEventListener('click', joinCall);
muteMicBtn.addEventListener('click', () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        if (!audioTrack.enabled) {
            muteMicBtn.textContent = 'Unmute Mic';
            muteMicBtn.classList.add('active');
        } else {
            muteMicBtn.textContent = 'Mute Mic';
            muteMicBtn.classList.remove('active');
        }
    }
});

muteSpeakerBtn.addEventListener('click', () => {
    if (!remoteVideo || !remoteVideo.srcObject) return;
    const remoteStream = remoteVideo.srcObject;
    const audioTrack = remoteStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        if (!audioTrack.enabled) {
            muteSpeakerBtn.textContent = 'Unmute Speaker';
            muteSpeakerBtn.classList.add('active');
        } else {
            muteSpeakerBtn.textContent = 'Mute Speaker';
            muteSpeakerBtn.classList.remove('active');
        }
    }
});
endCallBtn.addEventListener('click', endCall);