document.addEventListener('DOMContentLoaded', () => {
    let currentWord;
    let displayWord;
    let turnsLeft;
    let guessedLetters;
    const defaultWordList = ["PYTHON", "PROGRAMMING", "COMPUTER", "KEYBOARD", "DEVELOPER", "ALGORITHM", "VARIABLE"];

    const wordDisplay = document.getElementById('wordDisplay');
    const messageDisplay = document.getElementById('message');
    const turnsDisplay = document.getElementById('turnsDisplay');
    const usedLettersDisplay = document.getElementById('usedLetters');
    const guessInput = document.getElementById('guessInput');
    const guessBtn = document.getElementById('guessBtn');
    const restartBtn = document.getElementById('restartBtn');
    const getHintBtn = document.getElementById('getHintBtn');
    const hintDisplay = document.getElementById('hintDisplay');

    const apiKey = "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    async function generateWord() {
        wordDisplay.innerHTML = '<div class="loading-spinner"></div>';
        messageDisplay.textContent = 'Generating a new word...';
        
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: "Generate a single, common English word for a word guessing game. The word should be between 5 and 10 letters long." }] }],
                    generationConfig: {
                        responseMimeType: "text/plain"
                    }
                })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const result = await response.json();
            const generatedText = result.candidates[0].content.parts[0].text;
            
            const newWord = generatedText.trim().replace(/[^a-zA-Z]/g, '').toUpperCase();
            
            if (newWord.length > 0) {
                currentWord = newWord;
                initializeGame();
            } else {
                // Fallback to local word list if API returns an invalid word
                console.error("API returned an empty word. Using fallback list.");
                currentWord = defaultWordList[Math.floor(Math.random() * defaultWordList.length)];
                initializeGame();
            }

        } catch (error) {
            // Fallback to local word list on API failure
            console.error("Error generating word via API, using fallback list:", error);
            currentWord = defaultWordList[Math.floor(Math.random() * defaultWordList.length)];
            initializeGame();
        }
    }
    
    async function getHint() {
        if (!currentWord) {
            hintDisplay.textContent = "Please start a game first.";
            return;
        }
        
        getHintBtn.disabled = true;
        hintDisplay.textContent = 'Generating hint...';
        
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `Provide a one-sentence, non-obvious hint for the word "${currentWord.toLowerCase()}". Do not use the word itself in the hint.` }] }],
                    generationConfig: {
                        responseMimeType: "text/plain"
                    }
                })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const result = await response.json();
            const hintText = result.candidates[0].content.parts[0].text;
            hintDisplay.textContent = `Hint: ${hintText.trim()}`;

        } catch (error) {
            hintDisplay.textContent = "Error getting hint. Please try again.";
            console.error("Error getting hint:", error);
        } finally {
            getHintBtn.disabled = false;
        }
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
});