// Piece Symbols
const PIECE_SYMBOLS = {
  'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔',
  'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚'
};

// Initial Board
const initialBoardState = [
  ['r','n','b','q','k','b','n','r'],
  ['p','p','p','p','p','p','p','p'],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['P','P','P','P','P','P','P','P'],
  ['R','N','B','Q','K','B','N','R']
];

// Utility
function isOpponent(piece, target) {
  if (!target) return false;
  return (piece === piece.toUpperCase() && target === target.toLowerCase()) ||
         (piece === piece.toLowerCase() && target === target.toUpperCase());
}

// Move Validation
function isMoveValid(startRow, startCol, endRow, endCol, board) {
  const piece = board[startRow][startCol];
  const target = board[endRow][endCol];
  if (!piece) return false;

  const rowDiff = endRow - startRow;
  const colDiff = endCol - startCol;
  const absRow = Math.abs(rowDiff);
  const absCol = Math.abs(colDiff);

  const isWhite = piece === piece.toUpperCase();

  switch (piece.toUpperCase()) {
    case 'P': { // Pawn
      const dir = isWhite ? -1 : 1;
      const startRank = isWhite ? 6 : 1;

      // Move forward
      if (colDiff === 0 && !target) {
        if (rowDiff === dir) return true;
        if (startRow === startRank && rowDiff === 2*dir && !board[startRow+dir][startCol]) return true;
      }
      // Capture
      if (absCol === 1 && rowDiff === dir && target && isOpponent(piece, target)) {
        return true;
      }
      return false;
    }
    case 'R': { // Rook
      if (rowDiff === 0 || colDiff === 0) {
        return isPathClear(startRow, startCol, endRow, endCol, board) &&
               (!target || isOpponent(piece, target));
      }
      return false;
    }
    case 'N': { // Knight
      if ((absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2)) {
        return (!target || isOpponent(piece, target));
      }
      return false;
    }
    case 'B': { // Bishop
      if (absRow === absCol) {
        return isPathClear(startRow, startCol, endRow, endCol, board) &&
               (!target || isOpponent(piece, target));
      }
      return false;
    }
    case 'Q': { // Queen
      if (rowDiff === 0 || colDiff === 0 || absRow === absCol) {
        return isPathClear(startRow, startCol, endRow, endCol, board) &&
               (!target || isOpponent(piece, target));
      }
      return false;
    }
    case 'K': { // King
      if (absRow <= 1 && absCol <= 1) {
        return (!target || isOpponent(piece, target));
      }
      return false;
    }
    default:
      return false;
  }
}

// Path clearance for sliding pieces
function isPathClear(startRow, startCol, endRow, endCol, board) {
  const rowStep = Math.sign(endRow - startRow);
  const colStep = Math.sign(endCol - startCol);

  let r = startRow + rowStep;
  let c = startCol + colStep;

  while (r !== endRow || c !== endCol) {
    if (board[r][c]) return false;
    r += rowStep;
    c += colStep;
  }
  return true;
}
