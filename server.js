const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let connectedClients = [];
let gameRoom = [];
let ticTacToeState = {};
let guessGameState = {};
const defaultWordList = ["PYTHON", "PROGRAMMING", "COMPUTER", "KEYBOARD", "DEVELOPER", "ALGORITHM", "VARIABLE"];

// Function to initialize a new Tic-Tac-Toe game
function initializeTicTacToeGame() {
    ticTacToeState = {
        gameState: ['', '', '', '', '', '', '', '', ''],
        currentPlayer: 'X',
        gameActive: true,
        winner: null,
        draw: false,
    };
    if (gameRoom.length === 2) {
        // Assign players 'X' and 'O'
        gameRoom[0].player = 'X';
        gameRoom[1].player = 'O';
    }
}

// Function to initialize a new Word Guessing Game
function initializeGuessingGame() {
    const word = defaultWordList[Math.floor(Math.random() * defaultWordList.length)];
    guessGameState = {
        currentWord: word,
        displayWord: Array(word.length).fill('_'),
        turnsLeft: 6,
        guessedLetters: [],
        gameStatus: 'playing',
        message: `The word has ${word.length} letters.`,
        hint: '',
    };
}

wss.on("connection", (ws) => {
    console.log("✅ New client connected.");
    ws.id = Math.random().toString(36).substring(7);
    gameRoom.push(ws);
    
    // Notify clients about the connection
    ws.send(JSON.stringify({ type: 'client_joined', message: 'Connected to the server.' }));

    // Start video and game when there are two clients
    if (gameRoom.length === 2) {
        console.log("➡️ Two clients connected. Starting peer connections and games.");
        gameRoom[0].send(JSON.stringify({ type: 'peer_connected' }));
        initializeTicTacToeGame();
        initializeGuessingGame();
        // Broadcast initial game states to both players
        gameRoom.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'tic_tac_toe_state', ...ticTacToeState }));
                client.send(JSON.stringify({ type: 'guess_game_state', ...guessGameState }));
            }
        });
    }

    ws.on("message", (message) => {
        let data;
        try {
            data = JSON.parse(message.toString());
        } catch (err) {
            console.error("❌ Invalid JSON:", message.toString());
            return;
        }

        // Handle WebRTC messages (offers, answers, candidates)
        if (['offer', 'answer', 'candidate', 'end_call'].includes(data.type)) {
            const otherClient = gameRoom.find(client => client !== ws);
            if (otherClient && otherClient.readyState === WebSocket.OPEN) {
                otherClient.send(JSON.stringify(data));
            }
            return;
        }
        
        // Handle chat messages
        if (data.type === 'chat_message') {
            gameRoom.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
            return;
        }

        // Handle Tic-Tac-Toe moves
        if (data.type === 'tic_tac_toe_move' && ticTacToeState.gameActive) {
            const player = gameRoom.find(client => client === ws).player;
            if (ticTacToeState.currentPlayer !== player) return; // Not their turn
            if (ticTacToeState.gameState[data.index] !== '') return; // Cell already taken

            ticTacToeState.gameState[data.index] = player;
            
            // Check for win or draw
            let roundWon = false;
            const winningConditions = [
                [0, 1, 2], [3, 4, 5], [6, 7, 8],
                [0, 3, 6], [1, 4, 7], [2, 5, 8],
                [0, 4, 8], [2, 4, 6]
            ];
            for (let i = 0; i < winningConditions.length; i++) {
                const [a, b, c] = winningConditions[i];
                if (ticTacToeState.gameState[a] && ticTacToeState.gameState[a] === ticTacToeState.gameState[b] && ticTacToeState.gameState[a] === ticTacToeState.gameState[c]) {
                    roundWon = true;
                    break;
                }
            }
            if (roundWon) {
                ticTacToeState.winner = player;
                ticTacToeState.gameActive = false;
            } else if (!ticTacToeState.gameState.includes('')) {
                ticTacToeState.draw = true;
                ticTacToeState.gameActive = false;
            } else {
                ticTacToeState.currentPlayer = (player === 'X') ? 'O' : 'X';
            }

            gameRoom.forEach(client => client.send(JSON.stringify({ type: 'tic_tac_toe_state', ...ticTacToeState })));
            return;
        }

        // Handle Tic-Tac-Toe restart
        if (data.type === 'tic_tac_toe_restart') {
            initializeTicTacToeGame();
            gameRoom.forEach(client => client.send(JSON.stringify({ type: 'tic_tac_toe_state', ...ticTacToeState })));
            return;
        }

        // Handle Word Guessing moves (simplified for example)
        if (data.type === 'guess_game_move' && guessGameState.gameStatus === 'playing') {
            const guess = data.guess.toUpperCase();
            if (guess.length !== 1 || !/^[A-Z]$/.test(guess) || guessGameState.guessedLetters.includes(guess)) {
                return;
            }

            let found = false;
            for (let i = 0; i < guessGameState.currentWord.length; i++) {
                if (guessGameState.currentWord[i] === guess) {
                    guessGameState.displayWord[i] = guess;
                    found = true;
                }
            }
            
            if (found) {
                guessGameState.message = "Good guess!";
            } else {
                guessGameState.turnsLeft--;
                guessGameState.message = `Sorry, '${guess}' is not in the word.`;
            }

            guessGameState.guessedLetters.push(guess);

            if (!guessGameState.displayWord.includes('_')) {
                guessGameState.message = `Congratulations! The word was: ${guessGameState.currentWord} 🎉`;
                guessGameState.gameStatus = 'over';
            } else if (guessGameState.turnsLeft <= 0) {
                guessGameState.message = `You ran out of turns. The word was: ${guessGameState.currentWord} 😔`;
                guessGameState.gameStatus = 'over';
            }

            gameRoom.forEach(client => client.send(JSON.stringify({ type: 'guess_game_state', ...guessGameState })));
            return;
        }

        // Handle Guessing Game restart
        if (data.type === 'guess_game_restart') {
            initializeGuessingGame();
            gameRoom.forEach(client => client.send(JSON.stringify({ type: 'guess_game_state', ...guessGameState })));
            return;
        }
    });

    ws.on("close", () => {
        console.log("❌ Client disconnected.");
        gameRoom = gameRoom.filter(client => client.id !== ws.id);
        if (gameRoom.length === 1) {
            console.log("Only one client remaining. Restarting games.");
            initializeTicTacToeGame();
            initializeGuessingGame();
            gameRoom[0].send(JSON.stringify({ type: 'tic_tac_toe_state', ...ticTacToeState }));
            gameRoom[0].send(JSON.stringify({ type: 'guess_game_state', ...guessGameState }));
        }
    });
});

server.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on http://${HOST}:${PORT}`);
});

// A simple endpoint to keep the server alive
app.get('/healthz', (req, res) => {
    res.status(200).send('ok');
});