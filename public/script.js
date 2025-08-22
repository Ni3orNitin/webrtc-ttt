// ==========================
// 🎥 WebRTC Video Call Setup
// ==========================
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
let localStream;
let peerConnection;

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
    } catch (err) {
      console.error("Camera error:", err);
    }
  }
}

// Create Peer Connection
function createPeerConnection() {
  if (peerConnection) return; // already exists

  peerConnection = new RTCPeerConnection(config);

  // Add local tracks
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Remote video
  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  // ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
    }
  };
}

// Initialize call
async function initCall(isInitiator) {
  await startCamera();
  createPeerConnection();

  if (isInitiator) {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.send(JSON.stringify({ type: "offer", offer }));
  }
}

// ==========================
// WebSocket Signaling
// ==========================
socket.onopen = () => {
  console.log("Connected to server, initializing call...");
  // Changed port to 8080 to match server.js
  initCall(true); // initiator by default
};

socket.onmessage = async (msg) => {
  const data = JSON.parse(msg.data);

  if (!peerConnection) await initCall(false);

  switch (data.type) {
    case "offer":
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.send(JSON.stringify({ type: "answer", answer }));
      break;

    case "answer":
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      break;

    case "candidate":
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error("Error adding candidate:", err);
      }
      break;

    case "move":
      // FIX: The remote client receives the move and updates the board, but does not check for a winner or change the turn.
      updateBoard(data.cell, data.player);
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

  if (gameState[index] !== "" || !gameActive) return;

  // The move is valid, so update the local state and broadcast
  gameState[index] = currentPlayer;
  cell.textContent = currentPlayer;
  cell.classList.add("taken");

  // Broadcast the move to the other player
  socket.send(JSON.stringify({ type: "move", cell: index, player: currentPlayer }));
  
  // Check for a winner and update the turn *only* on the player who made the move
  checkWinnerAndSwitchTurn();
}

function updateBoard(index, player) {
  // Update the board with the remote player's move
  gameState[index] = player;
  board[index].textContent = player;
  board[index].classList.add("taken");

  // Check for a winner and update the turn *after* the remote move is applied
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
    return;
  }

  if (!gameState.includes("")) {
    statusText.textContent = "😮 It's a Draw!";
    gameActive = false;
    return;
  }

  // Only flip the current player's turn if no winner or draw has occurred
  currentPlayer = currentPlayer === "X" ? "O" : "X";
  statusText.textContent = `Player ${currentPlayer}'s Turn`;
}


function restartGame() {
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