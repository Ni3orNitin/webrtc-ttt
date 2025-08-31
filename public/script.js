// ==========================
// ➡️ Final Consolidated script.js
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

const ticTacToeBtn = document.getElementById("ticTacToeBtn");
const board = document.querySelectorAll(".cell");
const statusText = document.getElementById("status");
const restartBtn = document.getElementById("restartBtn");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const chatMessages = document.getElementById("chatMessages");
const youtubeInput = document.getElementById("youtubeInput");
const loadBtn = document.getElementById("loadBtn");
const playerXScoreDisplay = document.getElementById("playerXScore");
const playerOScoreDisplay = document.getElementById("playerOScore");

// NOTE: You MUST replace this URL with the one from your Render deployment.
const signalingServerUrl = "wss://webrtc-ttt.onrender.com";

let localStream;
let peerConnection;
let isInitiator = false;
let signalingSocket;

// WebRTC and Game State
let currentPlayer = "X";
let gameActive = false;
let ticTacToeState = Array(9).fill("");
let player;
let isSyncing = false;
let scoreX = 0;
let scoreO = 0;

const ticTacToeWinningConditions = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

// FIX: Added more reliable STUN servers for a robust connection
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
            remoteVideo.srcObject = event.streams [0];
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
                case 'move': updateTicTacToeBoard(data.cell, data.player); break;
                case 'restart': resetGame(data.game); break;
                case 'chat':
                    const p = document.createElement("p");
                    p.textContent = `Friend: ${data.message}`;
                    chatMessages.appendChild(p);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                    break;
                case 'youtube_state':
                    isSyncing = true;
                    handleYouTubeState(data.state, data.currentTime);
                    break;
                case 'youtube_video':
                    isSyncing = true;
                    handleYouTubeVideo(data.videoId);
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

// ==========================
// 🎮 Tic-Tac-Toe Logic
// ==========================
function handleTicTacToeClick(e) {
    const cell = e.target;
    const index = cell.getAttribute("data-index");
    if (ticTacToeState [index] !== "" || !gameActive || currentPlayer !== (isInitiator ? "X" : "O")) return;
    ticTacToeState [index] = currentPlayer;
    cell.textContent = currentPlayer;
    cell.classList.add("taken");
    signalingSocket.send(JSON.stringify({ type: "move", cell: index, player: currentPlayer }));
    checkTicTacToeWinner();
}

function updateTicTacToeBoard(index, player) {
    ticTacToeState [index] = player;
    ticTacToeBoard [index].textContent = player;
    ticTacToeBoard [index].classList.add("taken");
    checkTicTacToeWinner();
}

function checkTicTacToeWinner() {
    let roundWon = false;
    for (let condition of ticTacToeWinningConditions) {
        const [a, b, c] = condition;
        if (ticTacToeState [a] && ticTacToeState [a] === ticTacToeState [b] && ticTacToeState [a] === ticTacToeState [c]) {
            roundWon = true;
            break;
        }
    }
    if (roundWon) {
        statusText.textContent = `🎉 Player ${currentPlayer} Wins!`;
        gameActive = false;
        if (currentPlayer === "X") {
            scoreX++;
        } else {
            scoreO++;
        }
        updateScoreDisplay();
    } else if (!ticTacToeState.includes("")) {
        statusText.textContent = "😮 It's a Draw!";
        gameActive = false;
    } else {
        currentPlayer = currentPlayer === "X" ? "O" : "X";
        statusText.textContent = `Player ${currentPlayer}'s Turn`;
    }
}

function resetGame() {
    currentPlayer = "X";
    gameActive = true;
    ticTacToeState.fill("");
    statusText.textContent = "Player X's Turn";
    ticTacToeBoard.forEach(cell => {
        cell.textContent = "";
        cell.classList.remove("taken");
    });
}

function updateScoreDisplay() {
    playerXScoreDisplay.textContent = `You: ${scoreX}`;
    playerOScoreDisplay.textContent = `Your Friend: ${scoreO}`;
}

// ==========================
// 💬 Simple Chat
// ==========================
function handleChatSend() {
    const msg = chatInput.value.trim();
    if (!msg) return;
    const p = document.createElement("p");
    p.textContent = `You: ${msg}`;
    chatMessages.appendChild(p);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        signalingSocket.send(JSON.stringify({ type: "chat", message: msg }));
    }
    chatInput.value = "";
}

// ==========================
// 🎵 YouTube Music Player
// ==========================
function getYouTubeVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match [2].length === 11) ? match [2] : null;
}

const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script') [0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

window.onYouTubeIframeAPIReady = function() {
    player = new YT.Player('youtube-player', {
        height: '390',
        width: '640',
        videoId: '',
        playerVars: { 'playsinline': 1 },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
};

function onPlayerReady(event) {
    event.target.loadPlaylist({
        list: 'PLIlng4MI3pW-5OQE84UnfPGJLf_of-91Y',
        listType: 'playlist',
        index: 0,
        startSeconds: 0
    });
}

function onPlayerStateChange(event) {
    if (!isSyncing && signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        if (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.PAUSED) {
            signalingSocket.send(JSON.stringify({
                type: 'youtube_state',
                state: event.data,
                currentTime: player.getCurrentTime()
            }));
        }
    }
    if (isSyncing) {
        setTimeout(() => isSyncing = false, 500);
    }
}

function handleYouTubeState(state, currentTime) {
    isSyncing = true;
    switch (state) {
        case YT.PlayerState.PLAYING:
            player.seekTo(currentTime);
            player.playVideo();
            break;
        case YT.PlayerState.PAUSED:
        case YT.PlayerState.BUFFERING:
            player.pauseVideo();
            break;
    }
}

function handleYouTubeVideo(videoId) {
    isSyncing = true;
    if (player) {
        player.loadVideoById(videoId);
    }
}

function handleYouTubeLoad() {
    const url = youtubeInput.value;
    const videoId = getYouTubeVideoId(url);
    if (videoId && player) {
        player.loadVideoById(videoId);
        if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
            signalingSocket.send(JSON.stringify({
                type: 'youtube_video',
                videoId: videoId
            }));
        }
    } else {
        alert("Please enter a valid YouTube URL.");
    }
}

// ==========================
// ⚙️ Event Listeners
// ==========================
joinBtn.addEventListener('click', joinCall);
muteMicBtn.addEventListener('click', () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks() [0];
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
    const audioTrack = remoteStream.getAudioTracks() [0];
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
restartBtn.addEventListener('click', () => {
    signalingSocket.send(JSON.stringify({ type: 'restart', game: 'tic-tac-toe' }));
    resetGame();
});
sendBtn.addEventListener("click", handleChatSend);
loadBtn.addEventListener('click', handleYouTubeLoad);

board.forEach(cell => cell.addEventListener("click", handleTicTacToeClick));
updateScoreDisplay();