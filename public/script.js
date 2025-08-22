// ==========================
// 🎥 WebRTC Video Call Setup
// ==========================
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let localStream;
let peerConnection;

const socket = new WebSocket(
  (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host
);


const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// Start camera automatically when page loads
async function startCamera() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (err) {
    console.error("Camera error:", err);
  }
}

function createPeerConnection() {
  peerConnection = new RTCPeerConnection(config);

  // Add local tracks
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Show remote video
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

// Handle signaling
socket.onmessage = async (message) => {
  const data = JSON.parse(message.data);

  switch (data.type) {
    case "offer":
      createPeerConnection();
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.send(JSON.stringify({ type: "answer", answer: answer }));
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
  }
};

// When connected to server, make an offer
socket.onopen = async () => {
  await startCamera();
  createPeerConnection();

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.send(JSON.stringify({ type: "offer", offer: offer }));
};

// ==========================
// 😀 Reaction System
// ==========================
document.querySelectorAll(".emoji").forEach(btn => {
  btn.addEventListener("click", () => {
    const display = document.getElementById("reactionDisplay");
    display.textContent = btn.textContent;
    setTimeout(() => display.textContent = "", 2000); // fade after 2s
  });
});

// ==========================
// 🎮 Tic Tac Toe Game Logic
// ==========================
const board = document.querySelectorAll(".cell");
const statusText = document.getElementById("status");
const restartBtn = document.getElementById("restartBtn");

let currentPlayer = "X";
let gameActive = true;
let gameState = ["", "", "", "", "", "", "", "", ""];

const winningConditions = [
  [0,1,2], [3,4,5], [6,7,8],
  [0,3,6], [1,4,7], [2,5,8],
  [0,4,8], [2,4,6]
];

function handleCellClick(e) {
  const cell = e.target;
  const index = cell.getAttribute("data-index");

  if (gameState[index] !== "" || !gameActive) return;

  gameState[index] = currentPlayer;
  cell.textContent = currentPlayer;
  cell.classList.add("taken");

  checkWinner();
}

function checkWinner() {
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

  currentPlayer = currentPlayer === "X" ? "O" : "X";
  statusText.textContent = `Player ${currentPlayer}'s Turn`;
}

function restartGame() {
  currentPlayer = "X";
  gameActive = true;
  gameState = ["", "", "", "", "", "", "", "", ""];
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
  if (msg) {
    const p = document.createElement("p");
    p.textContent = "You: " + msg;
    chatMessages.appendChild(p);
    chatInput.value = "";
  }
});
