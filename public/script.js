// ==========================
// 🎥 WebRTC Video Call Setup
// ==========================
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const joinBtn = document.getElementById("joinBtn"); // Get the new button

// NOTE: You MUST replace this URL with the one from your Render deployment.
// It should look like "wss://your-app-name.onrender.com".
const signalingServerUrl = "wss://webrtc-ttt.onrender.com";

let localStream;
let peerConnection;
let isInitiator = false;

let signalingSocket;
const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

// Start the local camera and get the stream
async function startLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        console.log("✅ Local camera started.");
        return localStream; // Return the stream for use in other functions
    } catch (err) {
        console.error("❌ Failed to get local media stream:", err);
        throw err; // Rethrow the error to stop execution
    }
}

// Set up the WebRTC Peer Connection
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

// Main function to start the call
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
        // FIX: Start local stream and wait for it to be ready before connecting
        await startLocalStream();
        
        // Connect to the signaling server only when the user joins
        signalingSocket = new WebSocket(signalingServerUrl);
        
        signalingSocket.onopen = () => {
             console.log("✅ Connected to signaling server.");
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

                case 'move':
                    updateBoard(data.cell, data.player);
                    break;
                
                case 'restart':
                    resetGame();
                    break;

                case 'chat':
                    const p = document.createElement("p");
                    p.textContent = `Friend: ${data.message}`;
                    chatMessages.appendChild(p);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                    break;
            }
        };

        // Disable the button after click to prevent multiple connections
        joinBtn.disabled = true;
        joinBtn.textContent = 'Connecting...';
    } catch (err) {
        // Handle the error from startLocalStream, which means no camera access
        console.error("❌ Could not join call:", err);
    }
}

// Add event listener to the new button
joinBtn.addEventListener('click', joinCall);

// The rest of the game and chat logic remains the same
// ...

// ==========================
// 🎮 Tic Tac Toe Game Logic
// ==========================
const board = document.querySelectorAll(".cell");
const statusText = document.getElementById("status");
const restartBtn = document.getElementById("restartBtn");

let currentPlayer = "X";
let gameActive = true;
let gameState = Array(9).fill("");

const winningConditions = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function handleCellClick(e) {
  const cell = e.target;
  const index = cell.getAttribute("data-index");

  if (gameState[index] !== "" || !gameActive || currentPlayer !== (isInitiator ? "X" : "O")) {
    return;
  }

  gameState[index] = currentPlayer;
  cell.textContent = currentPlayer;
  cell.classList.add("taken");

  signalingSocket.send(JSON.stringify({ type: "move", cell: index, player: currentPlayer }));
  checkWinnerAndSwitchTurn();
}

function updateBoard(index, player) {
  gameState[index] = player;
  board[index].textContent = player;
  board[index].classList.add("taken");
  checkWinnerAndSwitchTurn();
}

function checkWinnerAndSwitchTurn() {
  let roundWon = false;
  for (let condition of winningConditions) {
    const [a, b, c] = condition;
    if (gameState[a] && gameState[a] === gameState[b] && gameState[a] === gameState[c]) {
      roundWon = true;
      break;
    }
  }

  if (roundWon) {
    statusText.textContent = `🎉 Player ${currentPlayer} Wins!`;
    gameActive = false;
  } else if (!gameState.includes("")) {
    statusText.textContent = "😮 It's a Draw!";
    gameActive = false;
  } else {
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    statusText.textContent = `Player ${currentPlayer}'s Turn`;
  }
}

function restartGame() {
    signalingSocket.send(JSON.stringify({ type: "restart" }));
    resetGame();
}

function resetGame() {
  currentPlayer = "X";
  gameActive = true;
  gameState.fill("");
  statusText.textContent = "Player X's Turn";
  board.forEach(cell => {
    cell.textContent = "";
    cell.classList.remove("taken");
  });
}

board.forEach(cell => cell.addEventListener("click", handleCellClick));
restartBtn.addEventListener("click", restartGame);

// ==========================
// 💬 Simple Chat
// ==========================
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const chatMessages = document.getElementById("chatMessages");

sendBtn.addEventListener("click", () => {
  const msg = chatInput.value.trim();
  if (!msg) return;

  const p = document.createElement("p");
  p.textContent = `You: ${msg}`;
  chatMessages.appendChild(p);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  signalingSocket.send(JSON.stringify({ type: "chat", message: msg }));
  chatInput.value = "";
});


// Add this code block to the end of your script.js file.

// ==========================
// 🎵 YouTube Music Player
// ==========================
let player;
const youtubeInput = document.getElementById("youtubeInput");
const loadBtn = document.getElementById("loadBtn");

// 1. Asynchronously load the YouTube IFrame Player API code.
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// 2. The API will call this function when the API code downloads.
window.onYouTubeIframeAPIReady = function() {
    // Create the video player after the API is ready
    player = new YT.Player('youtube-player', {
        height: '390',
        width: '640',
        videoId: 'dQw4w9WgXcQ', // Default video ID
        playerVars: {
            'playsinline': 1
        },
    });
};

// 3. Function to extract the YouTube video ID from a URL
function getYouTubeVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// 4. Load video when the button is clicked
loadBtn.addEventListener('click', () => {
    const url = youtubeInput.value;
    const videoId = getYouTubeVideoId(url);
    if (videoId && player) {
        player.loadVideoById(videoId);
    } else {
        alert("Please enter a valid YouTube URL.");
    }
});


// Add these lines near the top of your script.js file, along with your other const declarations
const muteMicBtn = document.getElementById("muteMicBtn");
const muteSpeakerBtn = document.getElementById("muteSpeakerBtn");

// Add these event listeners after your other button listeners, for example, after joinBtn.addEventListener('click', joinCall);

// Mic Mute Button Logic
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

// Speaker Mute Button Logic
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