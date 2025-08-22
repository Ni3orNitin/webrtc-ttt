// ==========================
// 🎥 WebRTC Video Call Setup
// ==========================
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
let localStream;
let peerConnection;
let isInitiator = false;

// FIX: Change to your server's public IP address or use a dynamic solution.
// For testing on the same network, replace 'localhost' with the server's IP.
const socket = new WebSocket("ws://localhost:8080");


const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// Start camera
async function startCamera() {
  if (!localStream) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
      console.log("✅ Camera started successfully.");
    } catch (err) {
      console.error("❌ Camera error:", err);
    }
  }
}

// Create Peer Connection
function createPeerConnection() {
  if (peerConnection) return;

  peerConnection = new RTCPeerConnection(config);

  // Add local tracks
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Remote video
  peerConnection.ontrack = (event) => {
    console.log("✅ Remote track received.");
    remoteVideo.srcObject = event.streams[0];
  };

  // ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("➡️ Sending ICE candidate.");
      socket.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
    }
  };
}

// Initialize call
async function initCall(initiator) {
  isInitiator = initiator; // Store initiator status
  await startCamera();
  createPeerConnection();

  if (isInitiator) {
    console.log("➡️ Creating WebRTC offer.");
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.send(JSON.stringify({ type: "offer", offer }));
  }
}

// ==========================
// WebSocket Signaling
// ==========================
socket.onopen = () => {
  console.log("✅ Connected to server, waiting for another player...");
  // Automatically initiate a call when the socket opens
  // A simple server-side handshake could be used for a more robust solution.
  initCall(true);
};

socket.onmessage = async (msg) => {
  const data = JSON.parse(msg.data);
  
  // FIX: The second client to connect will receive the offer and initialize its side.
  if (!peerConnection) {
    await initCall(false);
  }

  switch (data.type) {
    case "offer":
      console.log("⬅️ Received offer.");
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log("➡️ Sending answer.");
      socket.send(JSON.stringify({ type: "answer", answer }));
      break;

    case "answer":
      console.log("⬅️ Received answer.");
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      break;

    case "candidate":
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log("⬅️ Added ICE candidate.");
      } catch (err) {
        console.error("❌ Error adding candidate:", err);
      }
      break;

    case "move":
      console.log("⬅️ Received move:", data.cell);
      updateBoard(data.cell, data.player);
      break;
    
    case "restart":
      console.log("⬅️ Received restart signal.");
      resetGame();
      break;

    case "chat":
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

  // FIX: Use 'isInitiator' to determine player's symbol
  const playerSymbol = isInitiator ? "X" : "O";

  if (gameState[index] !== "" || !gameActive || currentPlayer !== playerSymbol) {
    return;
  }

  gameState[index] = currentPlayer;
  cell.textContent = currentPlayer;
  cell.classList.add("taken");

  socket.send(JSON.stringify({ type: "move", cell: index, player: currentPlayer }));
  
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
    // Switch turns
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    statusText.textContent = `Player ${currentPlayer}'s Turn`;
  }
}

function restartGame() {
  // FIX: Send a message to the other client to sync the restart
  socket.send(JSON.stringify({ type: "restart" }));
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
  p.textContent = "You: " + msg;
  chatMessages.appendChild(p);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  socket.send(JSON.stringify({ type: "chat", message: msg }));
  chatInput.value = "";
});