// DOM Elements
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const joinBtn = document.getElementById("joinBtn");
const muteMicBtn = document.getElementById("muteMicBtn");
const muteSpeakerBtn = document.getElementById("muteSpeakerBtn");
const endCallBtn = document.getElementById("endCallBtn");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const ticTacToeBtn = document.getElementById("ticTacToeBtn");
const guessGameBtn = document.getElementById("guessGameBtn");
const gameContainer = document.getElementById("gameContainer");
const gameTitle = document.getElementById("gameTitle");
const gameContent = document.getElementById("gameContent");

// --- Global State ---
let localStream;
let peerConnection;
let isInitiator = false;
let signalingSocket;
let username = "User" + Math.floor(Math.random() * 1000); // Simple unique name

// --- WebRTC Constants ---
const signalingServerUrl = "wss://webrtc-ttt.onrender.com";
const iceServers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" }
    ]
};

// --- WebRTC Functions ---
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
            signalingSocket.send(JSON.stringify({ type: 'client_ready', username: username }));
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
                        try { await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)); console.log("⬅️ Added ICE candidate."); } catch (err) { console.error("❌ Error adding received ICE candidate:", err); }
                    }
                    break;
                case 'chat_message':
                    displayChatMessage(data.username, data.message);
                    break;
                case 'tic_tac_toe_state':
                    updateTicTacToeState(data);
                    break;
                case 'guess_game_state':
                    updateGuessingGameState(data);
                    break;
                case 'end_call':
                    console.log("❌ Remote peer ended the call.");
                    endCall();
                    break;
                case 'game_ready':
                    // This is the key change: Listen for the server's "game ready" message.
                    // When received, initialize the games.
                    loadTicTacToe();
                    loadGuessingGame();
                    break;
            }
        };
        joinBtn.classList.add('hidden');
        muteMicBtn.classList.remove('hidden');
        muteSpeakerBtn.classList.remove('hidden');
        endCallBtn.classList.remove('hidden');
        console.log('Joined the call. Streams are active.');
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
    joinBtn.classList.remove('hidden');
    muteMicBtn.classList.add('hidden');
    muteSpeakerBtn.classList.add('hidden');
    endCallBtn.classList.add('hidden');
    isInitiator = false;
    console.log("❌ Call ended.");
    if (signalingSocket) {
        signalingSocket.send(JSON.stringify({ type: 'end_call' }));
        signalingSocket.close();
        signalingSocket = null;
    }
}

function toggleAudio() {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        muteMicBtn.textContent = audioTrack.enabled ? 'Mute Mic' : 'Unmute Mic';
        muteMicBtn.classList.toggle('active', !audioTrack.enabled);
    }
}

function toggleVideo() {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        toggleVideoBtn.textContent = videoTrack.enabled ? 'Stop Video' : 'Start Video';
    }
}

joinBtn.addEventListener('click', joinCall);
muteMicBtn.addEventListener('click', toggleAudio);
endCallBtn.addEventListener('click', endCall);
muteSpeakerBtn.addEventListener('click', () => {
    if (!remoteVideo || !remoteVideo.srcObject) return;
    const remoteStream = remoteVideo.srcObject;
    const audioTrack = remoteStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        muteSpeakerBtn.textContent = audioTrack.enabled ? 'Mute Speaker' : 'Unmute Speaker';
    }
});

// --- Chat Logic ---
function displayChatMessage(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.textContent = `${sender}: ${message}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendBtn.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message && signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        signalingSocket.send(JSON.stringify({
            type: 'chat_message',
            username: username,
            message: message
        }));
        chatInput.value = '';
    }
});

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        sendBtn.click();
    }
});

// --- Games Logic ---
let gameData = {};

// Tic-Tac-Toe
function handleTicTacToeClick(e) {
    // Game logic for a synchronized two-player experience
    if (!gameData.gameActive || gameData.currentPlayer !== username) return;
    const clickedCellIndex = parseInt(e.target.getAttribute('data-index'));
    if (gameData.gameState[clickedCellIndex] !== '') return;
    
    signalingSocket.send(JSON.stringify({
        type: 'tic_tac_toe_move',
        index: clickedCellIndex
    }));
}

function updateTicTacToeState(data) {
    gameData = data;
    const cells = gameContent.querySelectorAll('.cell');
    const status = gameContent.querySelector('.game-status-section');
    
    cells.forEach((cell, index) => {
        cell.textContent = gameData.gameState[index];
        cell.classList.toggle('taken', gameData.gameState[index] !== '');
    });
    
    if (gameData.winner) {
        status.textContent = `Player ${gameData.winner} has won! 🎉`;
    } else if (gameData.draw) {
        status.textContent = 'Game ended in a draw! 😔';
    } else {
        status.textContent = `Player ${gameData.currentPlayer}'s Turn`;
    }
}

function loadTicTacToe() {
    gameTitle.textContent = "Tic Tac Toe";
    gameContent.innerHTML = `
        <div class="board">
            <div class="cell" data-index="0"></div>
            <div class="cell" data-index="1"></div>
            <div class="cell" data-index="2"></div>
            <div class="cell" data-index="3"></div>
            <div class="cell" data-index="4"></div>
            <div class="cell" data-index="5"></div>
            <div class="cell" data-index="6"></div>
            <div class="cell" data-index="7"></div>
            <div class="cell" data-index="8"></div>
        </div>
        <div class="game-status-section">Waiting for opponent...</div>
        <button class="restart-btn">Restart Game</button>
    `;
    const cells = gameContent.querySelectorAll('.cell');
    cells.forEach(cell => cell.addEventListener('click', handleTicTacToeClick));
    gameContent.querySelector('.restart-btn').addEventListener('click', () => {
        if (signalingSocket) {
            signalingSocket.send(JSON.stringify({ type: 'tic_tac_toe_restart' }));
        }
    });
}

// Word Guessing Game
let wordGuessingState = {};
const defaultWordList = ["PYTHON", "PROGRAMMING", "COMPUTER", "KEYBOARD", "DEVELOPER", "ALGORITHM", "VARIABLE"];
const API_KEY = "YOUR_GEMINI_API_KEY";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;


function handleGuessClick() {
    if (signalingSocket && wordGuessingState.gameStatus !== 'over') {
        const guessInput = gameContent.querySelector('#guessInput');
        const guess = guessInput.value.toUpperCase();
        signalingSocket.send(JSON.stringify({
            type: 'guess_game_move',
            guess: guess
        }));
        guessInput.value = '';
    }
}

function handleHintClick() {
    if (signalingSocket && wordGuessingState.gameStatus === 'playing') {
        signalingSocket.send(JSON.stringify({ type: 'guess_game_hint' }));
    }
}

function updateGuessingGameState(data) {
    wordGuessingState = data;
    const wordDisplay = gameContent.querySelector('#wordDisplay');
    const turnsDisplay = gameContent.querySelector('#turnsDisplay');
    const messageDisplay = gameContent.querySelector('#message');
    const usedLettersDisplay = gameContent.querySelector('#usedLetters');
    const hintDisplay = gameContent.querySelector('#hintDisplay');
    const guessInput = gameContent.querySelector('#guessInput');
    const guessBtn = gameContent.querySelector('#guessBtn');

    wordDisplay.textContent = wordGuessingState.displayWord.join(' ');
    turnsDisplay.textContent = `Turns left: ${wordGuessingState.turnsLeft}`;
    messageDisplay.textContent = wordGuessingState.message;
    usedLettersDisplay.textContent = `Used letters: ${Array.from(wordGuessingState.guessedLetters).join(', ')}`;
    hintDisplay.textContent = `Hint: ${wordGuessingState.hint}`;
    
    if (wordGuessingState.gameStatus === 'over') {
        guessInput.disabled = true;
        guessBtn.disabled = true;
    } else {
        guessInput.disabled = false;
        guessBtn.disabled = false;
    }
}

function loadGuessingGame() {
    gameTitle.textContent = "Word Guessing Game";
    gameContent.innerHTML = `
        <p class="message-display" id="message">Waiting for opponent...</p>
        <div class="word-display" id="wordDisplay"></div>
        <div class="turns-display" id="turnsDisplay"></div>
        <div class="game-input-group">
            <input type="text" id="guessInput" maxlength="1" placeholder="Guess a letter">
            <button id="guessBtn" class="game-btn">Guess</button>
        </div>
        <div id="hintDisplay"></div>
        <button id="getHintBtn" class="game-btn" style="background-color: #ff5722;">Get a Hint</button>
        <p class="used-letters" id="usedLetters"></p>
        <button class="restart-btn" id="restartBtn">Restart Game</button>
    `;
    gameContent.querySelector('#guessBtn').addEventListener('click', handleGuessClick);
    gameContent.querySelector('#getHintBtn').addEventListener('click', handleHintClick);
    gameContent.querySelector('#restartBtn').addEventListener('click', () => {
        if (signalingSocket) {
            signalingSocket.send(JSON.stringify({ type: 'guess_game_restart' }));
        }
    });
}

// Button listeners to load games
ticTacToeBtn.addEventListener('click', loadTicTacToe);
guessGameBtn.addEventListener('click', loadGuessingGame);