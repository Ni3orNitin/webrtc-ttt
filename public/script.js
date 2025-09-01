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

// --- Video Call Logic ---
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
                        try { await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)); console.log("⬅️ Added ICE candidate."); } catch (err) { console.error("❌ Error adding received ICE candidate:", err); }
                    }
                    break;
                case 'end_call':
                    console.log("❌ Remote peer ended the call.");
                    endCall();
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

// --- Game Logic Integration ---
function loadTicTacToe() {
    gameTitle.textContent = "Tic Tac Toe";
    gameContent.innerHTML = `
        <div class="board" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 300px; margin: 15px auto;">
            <div class="cell" data-index="0" style="width: 100px; height: 100px; background: #333; display: flex; align-items: center; justify-content: center; font-size: 3rem; font-weight: bold; cursor: pointer; border-radius: 8px;"></div>
            <div class="cell" data-index="1" style="width: 100px; height: 100px; background: #333;"></div>
            <div class="cell" data-index="2" style="width: 100px; height: 100px; background: #333;"></div>
            <div class="cell" data-index="3" style="width: 100px; height: 100px; background: #333;"></div>
            <div class="cell" data-index="4" style="width: 100px; height: 100px; background: #333;"></div>
            <div class="cell" data-index="5" style="width: 100px; height: 100px; background: #333;"></div>
            <div class="cell" data-index="6" style="width: 100px; height: 100px; background: #333;"></div>
            <div class="cell" data-index="7" style="width: 100px; height: 100px; background: #333;"></div>
            <div class="cell" data-index="8" style="width: 100px; height: 100px; background: #333;"></div>
        </div>
        <div class="status" style="font-size: 1.2rem; font-weight: bold; margin: 10px 0;">Player X's Turn</div>
        <button class="restart-btn" style="margin-top: 15px;">Restart Game</button>
    `;
    // Add Tic Tac Toe game logic here
}

let currentWord, displayWord, turnsLeft, guessedLetters;
const defaultWordList = ["PYTHON", "PROGRAMMING", "COMPUTER", "KEYBOARD", "DEVELOPER", "ALGORITHM", "VARIABLE"];
const apiKey = ""; // You need to set your API key here.

function loadGuessingGame() {
    gameTitle.textContent = "Word Guessing Game";
    gameContent.innerHTML = `
        <p class="message-display" id="message">Loading a new word...</p>
        <div class="word-display" id="wordDisplay"></div>
        <div class="turns-display" id="turnsDisplay"></div>
        <div class="game-input-group">
            <input type="text" id="guessInput" maxlength="1" placeholder="Guess a letter">
            <button id="guessBtn" class="game-btn">Guess</button>
        </div>
        <div id="hintDisplay" class="mt-4 text-sm text-gray-700"></div>
        <button id="getHintBtn" class="game-btn" style="background-color: #ff5722;">Get a Hint</button>
        <p class="used-letters" id="usedLetters"></p>
        <button class="restart-btn" id="restartBtn">Restart Game</button>
    `;
    
    const wordDisplay = document.getElementById('wordDisplay');
    const messageDisplay = document.getElementById('message');
    const turnsDisplay = document.getElementById('turnsDisplay');
    const usedLettersDisplay = document.getElementById('usedLetters');
    const guessInput = document.getElementById('guessInput');
    const guessBtn = document.getElementById('guessBtn');
    const restartBtn = document.getElementById('restartBtn');
    const getHintBtn = document.getElementById('getHintBtn');
    const hintDisplay = document.getElementById('hintDisplay');
    
    // Guessing Game Functions
    async function generateWord() {
        wordDisplay.innerHTML = '<div class="loading-spinner"></div>';
        messageDisplay.textContent = 'Generating a new word...';
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: "Generate a single, common English word for a word guessing game. The word should be between 5 and 10 letters long." }] }], generationConfig: { responseMimeType: "text/plain" } })
            });
            const result = await response.json();
            const newWord = result.candidates[0].content.parts[0].text.trim().replace(/[^a-zA-Z]/g, '').toUpperCase();
            currentWord = newWord.length > 0 ? newWord : defaultWordList[Math.floor(Math.random() * defaultWordList.length)];
            initializeGame();
        } catch (error) {
            console.error("Error generating word, using fallback:", error);
            currentWord = defaultWordList[Math.floor(Math.random() * defaultWordList.length)];
            initializeGame();
        }
    }

    async function getHint() {
        if (!currentWord) { hintDisplay.textContent = "Please start a game first."; return; }
        getHintBtn.disabled = true;
        hintDisplay.textContent = 'Generating hint...';
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: `Provide a one-sentence, non-obvious hint for the word "${currentWord.toLowerCase()}". Do not use the word itself in the hint.` }] }], generationConfig: { responseMimeType: "text/plain" } })
            });
            const result = await response.json();
            const hintText = result.candidates[0].content.parts[0].text;
            hintDisplay.textContent = `Hint: ${hintText.trim()}`;
        } catch (error) {
            hintDisplay.textContent = "Error getting hint. Please try again.";
            console.error("Error getting hint:", error);
        } finally { getHintBtn.disabled = false; }
    }

    function initializeGame() {
        displayWord = new Array(currentWord.length).fill('_');
        turnsLeft = 6;
        guessedLetters = new Set();
        updateUI();
        messageDisplay.textContent = `The word has ${currentWord.length} letters.`;
        guessInput.value = '';
        guessInput.disabled = false;
        guessBtn.disabled = false;
        hintDisplay.textContent = '';
    }

    function updateUI() {
        wordDisplay.textContent = displayWord.join(' ');
        turnsDisplay.textContent = `Turns left: ${turnsLeft}`;
        usedLettersDisplay.textContent = `Used letters: ${Array.from(guessedLetters).join(', ')}`;
    }

    function handleGuess() {
        const guess = guessInput.value.toUpperCase();
        guessInput.value = '';
        if (!guess || guess.length !== 1 || !/^[A-Z]$/.test(guess)) {
            messageDisplay.textContent = "Please enter a single, valid letter.";
            return;
        }
        if (guessedLetters.has(guess)) {
            messageDisplay.textContent = "You already guessed that letter. Try a new one.";
            return;
        }
        guessedLetters.add(guess);
        if (currentWord.includes(guess)) {
            messageDisplay.textContent = "Good guess!";
            for (let i = 0; i < currentWord.length; i++) {
                if (currentWord[i] === guess) {
                    displayWord[i] = guess;
                }
            }
        } else {
            messageDisplay.textContent = `Sorry, '${guess}' is not in the word.`;
            turnsLeft--;
        }
        updateUI();
        checkGameState();
    }

    function checkGameState() {
        if (!displayWord.includes('_')) {
            messageDisplay.textContent = `Congratulations! You guessed the word: ${currentWord} 🎉`;
            endGame();
        } else if (turnsLeft <= 0) {
            messageDisplay.textContent = `You ran out of turns. The word was: ${currentWord} 😔`;
            endGame();
        }
    }
    
    function endGame() {
        guessInput.disabled = true;
        guessBtn.disabled = true;
    }
    
    guessBtn.addEventListener('click', handleGuess);
    guessInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            handleGuess();
        }
    });
    restartBtn.addEventListener('click', () => {
        endGame();
        generateWord();
    });
    getHintBtn.addEventListener('click', getHint);

    // Initial call to start the game
    generateWord();
}

ticTacToeBtn.addEventListener('click', loadTicTacToe);
guessGameBtn.addEventListener('click', loadGuessingGame);