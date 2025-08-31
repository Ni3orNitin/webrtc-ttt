import random

def play_game():
    """
    Plays a word-guessing game with the user.

    The game selects a random word from a list, and the player
    guesses letters one by one to uncover the word.
    """
    # A list of words the game can choose from
    word_list = ["python", "programming", "computer", "keyboard", "developer", "algorithm", "variable"]
    word = random.choice(word_list).upper()
    
    # Initialize the game's state
    guessed_letters = []
    display_word = ["_"] * len(word)
    turns = 6  # The number of incorrect guesses allowed
    
    print("Welcome to the Word Guessing Game!")
    print(f"The word has {len(word)} letters.")
    print("You have 6 turns to guess the word.")
    
    # Main game loop
    while turns > 0 and "_" in display_word:
        print("\n" + " ".join(display_word))
        print(f"Turns left: {turns}")
        
        guess = input("Guess a letter: ").upper()

        # Check for valid input
        if len(guess) != 1 or not guess.isalpha():
            print("Please enter a single letter.")
            continue
        
        # Check if the letter has already been guessed
        if guess in guessed_letters:
            print("You already guessed that letter. Try a new one.")
            continue
            
        guessed_letters.append(guess)
        
        if guess in word:
            print(f"Good guess! The letter '{guess}' is in the word.")
            # Update the display with the correctly guessed letter
            for i in range(len(word)):
                if word[i] == guess:
                    display_word[i] = guess
        else:
            print(f"Sorry, '{guess}' is not in the word.")
            turns -= 1
            
    # Game end conditions
    print("\n" + " ".join(display_word))
    if "_" not in display_word:
        print(f"Congratulations! You guessed the word: {word} 🎉")
    else:
        print(f"You ran out of turns. The word was: {word} 😔")

if __name__ == "__main__":
    play_game()
