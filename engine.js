// SHIFT — a chess variant where every capture transfers movement power.
// Pure-ish rules engine. All positions use index 0 = a8 … 63 = h1.

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const SIDES = { w: 'Ivory', b: 'Onyx' };
export const TYPES = ['p', 'n', 'b', 'r', 'q', 'k'];
export const TYPE_LABEL = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
};
export const TYPE_MOVE = {
  p: 'One step forward · captures diagonally',
  n: 'L-shaped leap over the board',
  b: 'Any distance on a diagonal',
  r: 'Any distance on a rank or file',
  q: 'Any distance in every direction',
  k: 'One step in every direction',
};
export const TYPE_LETTER = { p: '', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };

export const opposite = (color) => (color === 'w' ? 'b' : 'w');
export const rowOf = (index) => Math.floor(index / 8);
export const colOf = (index) => index % 8;
export const squareName = (index) =>
  `${FILES[colOf(index)]}${8 - rowOf(index)}`;
export const isLight = (index) => (rowOf(index) + colOf(index)) % 2 === 0;
export const inBounds = (row, col) => row >= 0 && row < 8 && col >= 0 && col < 8;

const ROOK_DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const BISHOP_DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
const QUEEN_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS];
const KNIGHT_OFFSETS = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];
const KING_OFFSETS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

let pieceSerial = 0;
function makePiece(color, type, index) {
  return {
    id: `${color}-${type}-${squareName(index)}-${pieceSerial++}`,
    color,
    type,
    moved: false,
    royal: type === 'k',
  };
}

export function createGame() {
  const board = new Array(64).fill(null);
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let col = 0; col < 8; col++) {
    board[col] = makePiece('b', back[col], col);
    board[8 + col] = makePiece('b', 'p', 8 + col);
    board[48 + col] = makePiece('w', 'p', 48 + col);
    board[56 + col] = makePiece('w', back[col], 56 + col);
  }
  return {
    board,
    turn: 'w',
    ep: null,
    halfmove: 0,
    fullmove: 1,
    lastMove: null,
    captured: { w: [], b: [] },
    log: [],
    status: 'playing',
    winner: null,
    statusReason: '',
    check: false,
  };
}

export function cloneBoard(board) {
  return board.map((piece) => (piece ? { ...piece } : null));
}

function cloneState(state) {
  return {
    ...state,
    board: cloneBoard(state.board),
    ep: state.ep ? { ...state.ep } : null,
    captured: {
      w: state.captured.w.map((piece) => ({ ...piece })),
      b: state.captured.b.map((piece) => ({ ...piece })),
    },
    log: state.log.map((entry) => ({ ...entry })),
    lastMove: state.lastMove ? { ...state.lastMove } : null,
  };
}

function addMove(moves, from, to, extra = {}) {
  const seen = moves.some((move) => move.to === to);
  if (!seen) moves.push({ from, to, ...extra });
}

/**
 * Pseudo-legal moves for one piece. `attacksOnly` ignores pawn pushes and
 * castling and includes occupied squares, which is what check detection needs.
 */
export function generateMoves(state, from, { attacksOnly = false } = {}) {
  const board = state.board || state;
  const ep = state.ep || null;
  const piece = board[from];
  if (!piece) return [];
  const moves = [];
  const row = rowOf(from);
  const col = colOf(from);
  const enemy = opposite(piece.color);

  const tryAdd = (r, c, extra = {}) => {
    if (!inBounds(r, c)) return false;
    const to = r * 8 + c;
    const target = board[to];
    if (!attacksOnly && target?.color === piece.color) return false;
    addMove(moves, from, to, {
      ...extra,
      capture: Boolean(target && target.color === enemy),
    });
    return true;
  };

  if (piece.type === 'p') {
    const dir = piece.color === 'w' ? -1 : 1;
    const startRow = piece.color === 'w' ? 6 : 1;
    const promotionRow = piece.color === 'w' ? 0 : 7;
    if (!attacksOnly) {
      const oneRow = row + dir;
      if (inBounds(oneRow, col) && !board[oneRow * 8 + col]) {
        tryAdd(oneRow, col, {
          promotion: oneRow === promotionRow,
        });
        const twoRow = row + dir * 2;
        if (
          !piece.moved &&
          row === startRow &&
          inBounds(twoRow, col) &&
          !board[twoRow * 8 + col]
        ) {
          tryAdd(twoRow, col, { double: true });
        }
      }
    }
    for (const dc of [-1, 1]) {
      const r = row + dir;
      const c = col + dc;
      if (!inBounds(r, c)) continue;
      const to = r * 8 + c;
      const target = board[to];
      if (attacksOnly) {
        addMove(moves, from, to, { capture: Boolean(target && target.color === enemy) });
      } else if (target && target.color === enemy) {
        addMove(moves, from, to, {
          capture: true,
          promotion: r === promotionRow,
        });
      } else if (!target && ep && ep.to === to) {
        addMove(moves, from, to, {
          capture: true,
          enPassant: true,
          capturedAt: ep.victim,
        });
      }
    }
    return moves;
  }

  if (piece.type === 'n') {
    for (const [dr, dc] of KNIGHT_OFFSETS) {
      tryAdd(row + dr, col + dc);
    }
    return moves;
  }

  if (piece.type === 'b' || piece.type === 'r' || piece.type === 'q') {
    const dirs =
      piece.type === 'b' ? BISHOP_DIRS : piece.type === 'r' ? ROOK_DIRS : QUEEN_DIRS;
    for (const [dr, dc] of dirs) {
      let r = row + dr;
      let c = col + dc;
      while (inBounds(r, c)) {
        const to = r * 8 + c;
        const target = board[to];
        if (!target) {
          addMove(moves, from, to);
        } else {
          if (target.color === enemy) {
            addMove(moves, from, to, { capture: true });
          }
          break;
        }
        r += dr;
        c += dc;
      }
    }
    return moves;
  }

  if (piece.type === 'k') {
    for (const [dr, dc] of KING_OFFSETS) {
      tryAdd(row + dr, col + dc);
    }

    if (!attacksOnly && piece.royal && !piece.moved) {
      const homeRow = piece.color === 'w' ? 7 : 0;
      if (row === homeRow && col === 4) {
        const rookKingSide = board[from + 3];
        const rookQueenSide = board[from - 4];
        const emptyKingSide = !board[from + 1] && !board[from + 2];
        const emptyQueenSide =
          !board[from - 1] && !board[from - 2] && !board[from - 3];
        const safe = (index) =>
          !isSquareAttacked(board, index, enemy, ep);

        if (
          emptyKingSide &&
          rookKingSide &&
          rookKingSide.type === 'r' &&
          !rookKingSide.moved &&
          !rookKingSide.royal &&
          safe(from) &&
          safe(from + 1) &&
          safe(from + 2)
        ) {
          addMove(moves, from, from + 2, {
            castle: 'king',
            rookFrom: from + 3,
            rookTo: from + 1,
          });
        }
        if (
          emptyQueenSide &&
          rookQueenSide &&
          rookQueenSide.type === 'r' &&
          !rookQueenSide.moved &&
          !rookQueenSide.royal &&
          safe(from) &&
          safe(from - 1) &&
          safe(from - 2)
        ) {
          addMove(moves, from, from - 2, {
            castle: 'queen',
            rookFrom: from - 4,
            rookTo: from - 1,
          });
        }
      }
    }
  }
  return moves;
}

function isSquareAttacked(board, index, byColor, ep = null) {
  for (let from = 0; from < 64; from++) {
    const piece = board[from];
    if (!piece || piece.color !== byColor) continue;
    const attacks = generateMoves({ board, ep }, from, { attacksOnly: true });
    if (attacks.some((move) => move.to === index)) return true;
  }
  return false;
}

export function findRoyal(board, color) {
  return board.find((piece) => piece?.royal && piece.color === color) || null;
}

export function kingIndex(board, color) {
  return board.findIndex((piece) => piece?.royal && piece.color === color);
}

export function isInCheck(state, color = state.turn) {
  const index = kingIndex(state.board, color);
  if (index < 0) return false;
  return isSquareAttacked(state.board, index, opposite(color), state.ep);
}

/**
 * Apply one move to a mutable board clone, including the power transfer,
 * en-passant removal, castling rook and automatic promotion.
 */
export function applyMoveToBoard(board, from, to, ep, move = {}) {
  const moving = { ...board[from] };
  const target = board[to];
  const oldType = moving.type;
  const row = rowOf(to);
  board[from] = null;

  let captured = null;
  let capturedAt = -1;
  let enPassant = false;

  if (!target && ep && ep.to === to && moving.type === 'p') {
    captured = board[ep.victim] ? { ...board[ep.victim] } : null;
    capturedAt = ep.victim;
    board[ep.victim] = null;
    enPassant = true;
  } else if (target && target.color !== moving.color) {
    captured = { ...target };
    capturedAt = to;
    board[to] = null;
  }

  let royalCaptured = null;
  if (captured?.royal) royalCaptured = captured.color;

  if (captured && !captured.royal) {
    moving.type = captured.type;
  }

  moving.moved = true;
  board[to] = moving;

  let castleRook = null;
  if (!captured && moving.royal && moving.type === 'k' && rowOf(from) === row) {
    const dc = colOf(to) - colOf(from);
    if (Math.abs(dc) === 2) {
      const rookFrom = move.rookFrom ?? (dc > 0 ? from + 3 : from - 4);
      const rookTo = move.rookTo ?? (dc > 0 ? from + 1 : from - 1);
      const rook = board[rookFrom];
      if (rook && rook.type === 'r' && !rook.moved) {
        const rookPiece = { ...rook, moved: true };
        board[rookFrom] = null;
        board[rookTo] = rookPiece;
        castleRook = { from: rookFrom, to: rookTo };
      }
    }
  }

  let promoted = false;
  if (moving.type === 'p' && (row === 0 || row === 7)) {
    moving.type = 'q';
    promoted = true;
  }

  let newEp = null;
  if (
    moving.type === 'p' &&
    !captured &&
    !castleRook &&
    Math.abs(row - rowOf(from)) === 2
  ) {
    newEp = { to: (from + to) / 2, victim: to };
  }

  return {
    piece: moving,
    oldType,
    newType: moving.type,
    captured,
    capturedAt,
    enPassant,
    castleRook,
    promoted,
    royalCaptured,
    newEp,
  };
}

export function legalMoves(state, from) {
  const piece = state.board[from];
  if (!piece || piece.color !== state.turn) return [];
  const pseudo = generateMoves(state, from);
  return pseudo.filter((move) => {
    const board = cloneBoard(state.board);
    applyMoveToBoard(board, from, move.to, state.ep, move);
    return !isSquareAttacked(
      board,
      kingIndex(board, piece.color),
      opposite(piece.color),
      null,
    );
  });
}

export function allLegalMoves(state) {
  const moves = [];
  for (let from = 0; from < 64; from++) {
    if (state.board[from]?.color !== state.turn) continue;
    for (const move of legalMoves(state, from)) moves.push(move);
  }
  return moves;
}

export function hasAnyLegalMove(state) {
  for (let from = 0; from < 64; from++) {
    if (state.board[from]?.color !== state.turn) continue;
    if (legalMoves(state, from).length) return true;
  }
  return false;
}

/**
 * Plays a legal move and returns a new state plus a UI-friendly event.
 * The input state is never mutated.
 */
export function playMove(state, from, to) {
  const move = legalMoves(state, from).find((candidate) => candidate.to === to);
  if (!move || state.status !== 'playing') return null;

  const next = cloneState(state);
  const movingBefore = { ...state.board[from] };
  const applied = applyMoveToBoard(next.board, from, to, state.ep, move);
  const playingColor = state.turn;

  next.ep = applied.newEp;
  next.lastMove = {
    from,
    to,
    color: playingColor,
    oldType: applied.oldType,
    newType: applied.newType,
    capturedType: applied.captured?.type || null,
    capturedColor: applied.captured?.color || null,
    enPassant: applied.enPassant,
    castle: move.castle || null,
    promoted: applied.promoted,
    capturedAt: applied.capturedAt >= 0 ? applied.capturedAt : null,
  };

  if (applied.captured) {
    next.captured[playingColor].push({
      type: applied.captured.type,
      color: applied.captured.color,
      at: squareName(applied.capturedAt),
      move: state.fullmove,
    });
  }

  next.halfmove =
    applied.captured || applied.oldType === 'p' ? 0 : state.halfmove + 1;
  next.fullmove = playingColor === 'b' ? state.fullmove + 1 : state.fullmove;
  next.turn = opposite(playingColor);
  next.status = 'playing';
  next.winner = null;
  next.statusReason = '';
  next.check = isInCheck(next, next.turn);

  const canMove = hasAnyLegalMove(next);
  if (applied.royalCaptured) {
    next.status = 'checkmate';
    next.winner = playingColor;
    next.statusReason = 'The royal crown was taken.';
  } else if (!canMove) {
    if (next.check) {
      next.status = 'checkmate';
      next.winner = playingColor;
      next.statusReason = 'No legal move can save the crown.';
    } else {
      next.status = 'stalemate';
      next.statusReason = 'No legal move remains, but the crown is safe.';
    }
  } else if (next.halfmove >= 100) {
    next.status = 'draw';
    next.statusReason = 'Fifty moves without a capture or pawn move.';
  }

  const event = {
    from,
    to,
    fromName: squareName(from),
    toName: squareName(to),
    color: playingColor,
    pieceType: applied.oldType,
    newType: applied.newType,
    capturedType: applied.captured?.type || null,
    capturedColor: applied.captured?.color || null,
    capturedName: applied.captured ? squareName(applied.capturedAt) : null,
    enPassant: applied.enPassant,
    castle: move.castle || null,
    promoted: applied.promoted,
    check: next.check,
    mate: next.status === 'checkmate',
    stalemate: next.status === 'stalemate',
    status: next.status,
  };

  next.log.push({
    number: state.fullmove,
    color: playingColor,
    from,
    to,
    fromName: event.fromName,
    toName: event.toName,
    pieceType: applied.oldType,
    newType: applied.newType,
    capturedType: event.capturedType,
    capturedColor: event.capturedColor,
    capturedName: event.capturedName,
    enPassant: applied.enPassant,
    castle: move.castle || null,
    promoted: applied.promoted,
    check: next.check,
    mate: next.status === 'checkmate',
    status: next.status,
  });

  event.movingBefore = movingBefore;
  return { state: next, event, move };
}

export function moveNotation(entry) {
  const prefix = entry.color === 'w' ? `${entry.number}.` : `${entry.number}…`;
  if (entry.castle) {
    return `${prefix} ${entry.castle === 'king' ? 'O-O' : 'O-O-O'}`;
  }
  const piece = TYPE_LETTER[entry.pieceType];
  const marker = entry.capturedType ? '×' : '';
  const captureTarget = entry.capturedType ? entry.toName : '';
  const destination = entry.capturedType ? captureTarget : entry.toName;
  const swap =
    entry.capturedType && entry.newType !== entry.pieceType
      ? `→${TYPE_LETTER[entry.newType] || 'P'}`
      : '';
  const check = entry.mate ? '#' : entry.check ? '+' : '';
  return `${prefix} ${piece}${marker}${destination}${entry.promoted ? '=Q' : ''}${swap}${check}`.trim();
}
