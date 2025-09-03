const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let gameRoom = [];
let ticTacToeState = {};
let guessGameState = {};
let youtubeSyncState = {};

// Expanded word list
const wordLists = {
    easy: [
        "APPLE", "DREAM", "WATER", "BIRD", "DOG", "SUN", "HOUSE", "FLOWER", "HAPPY", "GHOST",
        "SMOKE", "CLOUDS", "TABLE", "CHAIR", "BOOK", "PANTS", "COFFEE", "MUSIC", "GAMES", "PIZZA"
    ],
    medium: [
        "MOUNTAIN", "KEYBOARD", "PLANET", "FRIENDSHIP", "ALPHABET", "GUITAR", "OCEAN", "CASTLE",
        "JOURNEY", "FESTIVAL", "PENCIL", "BLIZZARD", "SUNFLOWER", "OCTOPUS", "COMPUTER", "PROGRAMMING"
    ],
    hard: [
        "AMBIGUOUS", "EXAGGERATE", "INNOVATION", "PHOENIX", "SYMPHONY", "QUICKSAND",
        "ZEPHYR", "JUXTAPOSE", "PARADIGM", "SERENDIPITY", "UNEMPLOYMENT", "INCORRIGIBLE"
    ]
};

// Function to get a random word from a chosen difficulty
function getRandomWord() {
    const difficulties = Object.keys(wordLists);
    const randomDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
    const wordList = wordLists[randomDifficulty];
    return wordList[Math.floor(Math.random() * wordList.length)];
}

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
        gameRoom[0].player = 'X';
        gameRoom[1].player = 'O';
    }
}

// Function to initialize a new Word Guessing Game
function initializeGuessingGame() {
    const word = getRandomWord();
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
    
    ws.send(JSON.stringify({ type: 'client_joined', message: 'Connected to the server.' }));

    if (gameRoom.length === 2) {
        console.log("➡️ Two clients connected. Starting peer connections and games.");
        gameRoom[0].send(JSON.stringify({ type: 'peer_connected' }));
        initializeTicTacToeGame();
        initializeGuessingGame();
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
        
        if (['offer', 'answer', 'candidate', 'end_call'].includes(data.type)) {
            const otherClient = gameRoom.find(client => client !== ws);
            if (otherClient && otherClient.readyState === WebSocket.OPEN) {
                otherClient.send(JSON.stringify(data));
            }
            return;
        }
        
        if (data.type === 'chat_message') {
            gameRoom.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
            return;
        }
        
        const playerClient = gameRoom.find(client => client.id === ws.id);

        if (data.type === 'tic_tac_toe_move' && ticTacToeState.gameActive) {
            const player = playerClient.player;
            if (ticTacToeState.currentPlayer !== player) return;
            if (ticTacToeState.gameState[data.index] !== '') return;

            ticTacToeState.gameState[data.index] = player;
            
            const winningConditions = [
                [0, 1, 2], [3, 4, 5], [6, 7, 8],
                [0, 3, 6], [1, 4, 7], [2, 5, 8],
                [0, 4, 8], [2, 4, 6]
            ];
            let roundWon = false;
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
            
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'tic_tac_toe_state', ...ticTacToeState }));
                }
            });
            return;
        }

        if (data.type === 'tic_tac_toe_restart') {
            initializeTicTacToeGame();
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'tic_tac_toe_state', ...ticTacToeState }));
                }
            });
            return;
        }
        
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
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'guess_game_state', ...guessGameState }));
                }
            });
            return;
        }
        
        if (data.type === 'guess_game_restart') {
            initializeGuessingGame();
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'guess_game_state', ...guessGameState }));
                }
            });
            return;
        }

        // --- CORRECTED YOUTUBE SYNC LOGIC ---
        // It now broadcasts to all clients to ensure synchronization.
        if (data.type.startsWith('youtube_')) {
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    // Send the message to all clients, including the one who sent it.
                    // This is for instant feedback. The client-side logic will handle it.
                    client.send(JSON.stringify(data));
                }
            });
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

app.get('/healthz', (req, res) => {
    res.status(200).send('ok');
});