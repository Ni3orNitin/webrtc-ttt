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
  if (peerConnection) return;

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
  initCall(true);
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
      // FIX: Apply the remote move directly and update the turn.
      updateBoard(data.cell, data.player, data.nextPlayer);
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

  // Only allow a move if it is the current player's turn locally.
  if (gameState[index] !== "" || !gameActive || currentPlayer !== (isInitiator() ? "X" : "O")) {
      return;
  }

  gameState[index] = currentPlayer;
  cell.textContent = currentPlayer;
  cell.classList.add("taken");

  let nextPlayer = currentPlayer === "X" ? "O" : "X";

  // Check for win/draw after the local move
  if (checkWinner()) {
    nextPlayer = null; // Game is over
  } else if (!gameState.includes("")) {
    nextPlayer = null; // Draw
  }

  // Broadcast the move and the next player
  socket.send(JSON.stringify({ type: "move", cell: index, player: currentPlayer, nextPlayer: nextPlayer }));

  // Update local turn state
  if (nextPlayer) {
    currentPlayer = nextPlayer;
    statusText.textContent = `Player ${currentPlayer}'s Turn`;
  }
}

function updateBoard(index, player, nextPlayer) {
  // Apply the remote move
  gameState[index] = player;
  board[index].textContent = player;
  board[index].classList.add("taken");
  
  // Update local turn state based on the remote player's broadcast
  if (nextPlayer) {
    currentPlayer = nextPlayer;
    statusText.textContent = `Player ${currentPlayer}'s Turn`;
  } else {
    // Game is over
    if (checkWinner()) {
      statusText.textContent = `🎉 Player ${player} Wins!`;
    } else {
      statusText.textContent = "😮 It's a Draw!";
    }
    gameActive = false;
  }
}

function checkWinner() {
  for (let condition of winningConditions) {
    const [a, b, c] = condition;
    if (gameState[a] && gameState[a] === gameState[b] && gameState[a] === gameState[c]) {
      return true;
    }
  }
  return false;
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

function isInitiator() {
  // This is a simple way to determine which player is X or O.
  // The first player to connect is the initiator (X).
  // A more robust solution might use a server-assigned ID.
  return localVideo.srcObject && remoteVideo.srcObject;
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