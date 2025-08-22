// ==========================
// 🎥 WebRTC Video Call Setup
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

// Start the local camera and get the stream
async function startLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        console.log("✅ Local camera started.");
    } catch (err) {
        console.error("❌ Failed to get local media stream:", err);
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

// Handle signaling messages
signalingSocket.onopen = async () => {
    console.log("✅ Connected to signaling server.");
    await startLocalStream();
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