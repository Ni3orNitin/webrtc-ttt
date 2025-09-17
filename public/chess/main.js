let board = initialBoardState.map(r => r.slice());
let selectedPiece = null;
let selectedSquare = null;
let currentTurn = 'white';

const chessboardElement = document.getElementById('chessboard');
const turnDisplay = document.getElementById('turnDisplay');

// Render board
function renderBoard() {
  chessboardElement.innerHTML = '';

  board.forEach((row, r) => {
    row.forEach((piece, c) => {
      const square = document.createElement('div');
      square.classList.add('square', (r+c) % 2 === 0 ? 'light' : 'dark');
      square.dataset.row = r;
      square.dataset.col = c;
      if (piece) square.textContent = PIECE_SYMBOLS[piece];

      square.addEventListener('click', handleSquareClick);
      chessboardElement.appendChild(square);
    });
  });

  turnDisplay.textContent = `Turn: ${currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1)}`;
}

// Handle square click
function handleSquareClick(event) {
  const clickedSquare = event.target;
  const row = parseInt(clickedSquare.dataset.row);
  const col = parseInt(clickedSquare.dataset.col);
  const piece = board[row][col];

  if (!selectedPiece && piece) {
    // Check turn
    if ((currentTurn === 'white' && piece === piece.toLowerCase()) ||
        (currentTurn === 'black' && piece === piece.toUpperCase())) {
      return; // Not this player's turn
    }
    selectedPiece = piece;
    selectedSquare = clickedSquare;
    clickedSquare.classList.add('selected');
  } else if (selectedPiece) {
    const startRow = parseInt(selectedSquare.dataset.row);
    const startCol = parseInt(selectedSquare.dataset.col);

    if (isMoveValid(startRow, startCol, row, col, board)) {
      // Move piece
      board[row][col] = selectedPiece;
      board[startRow][startCol] = '';

      // Switch turn
      currentTurn = currentTurn === 'white' ? 'black' : 'white';
    }

    selectedSquare.classList.remove('selected');
    selectedPiece = null;
    selectedSquare = null;

    renderBoard();
  }
}

// Initial render
renderBoard();
