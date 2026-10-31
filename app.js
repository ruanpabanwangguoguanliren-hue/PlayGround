import {
  createGame,
  legalMoves,
  playMove,
  isInCheck,
  kingIndex,
  squareName,
  rowOf,
  colOf,
  isLight,
  opposite,
  SIDES,
  TYPE_LABEL,
  TYPE_MOVE,
  TYPE_LETTER,
} from './engine.js';

const STORAGE_KEY = 'shift-chess-save-v1';
const SOUND_KEY = 'shift-chess-sound-v1';

const boardEl = document.getElementById('board');
const fxLayer = document.getElementById('fxLayer');
const boardShell = document.getElementById('boardShell');
const boardFrame = () => document.querySelector('.board-frame');
const turnPanel = document.getElementById('turnPanel');
const turnOrb = document.getElementById('turnOrb');
const turnLabel = document.getElementById('turnLabel');
const turnHint = document.getElementById('turnHint');
const moveNumberEl = document.getElementById('moveNumber');
const readoutIcon = document.getElementById('readoutIcon');
const readoutEyebrow = document.getElementById('readoutEyebrow');
const readoutTitle = document.getElementById('readoutTitle');
const readoutSub = document.getElementById('readoutSub');
const moveLog = document.getElementById('moveLog');
const desktopShiftEvent = document.getElementById('desktopShiftEvent');
const mobileShiftEvent = document.getElementById('mobileShiftEvent');
const mobileCaptureCount = document.getElementById('mobileCaptureCount');
const swapCountEl = document.getElementById('swapCount');
const captureCountEl = document.getElementById('captureCount');
const turnCountEl = document.getElementById('turnCount');
const takenByWhite = document.getElementById('takenByWhite');
const takenByBlack = document.getElementById('takenByBlack');
const takeTotal = document.getElementById('takeTotal');
const undoButton = document.getElementById('undoButton');
const soundButton = document.getElementById('soundButton');
const tiltButton = document.getElementById('tiltButton');
const helpButton = document.getElementById('helpButton');
const rulesButton = document.getElementById('rulesButton');
const newButton = document.getElementById('newButton');
const toastEl = document.getElementById('toast');
const rulesDialog = document.getElementById('rulesDialog');
const newDialog = document.getElementById('newDialog');
const resultDialog = document.getElementById('resultDialog');
const confirmNewButton = document.getElementById('confirmNewButton');
const reviewButton = document.getElementById('reviewButton');
const rematchButton = document.getElementById('rematchButton');
const resultEyebrow = document.getElementById('resultEyebrow');
const resultTitle = document.getElementById('resultTitle');
const resultText = document.getElementById('resultText');
const resultCrown = document.getElementById('resultCrown');
const resultMoves = document.getElementById('resultMoves');
const resultCaptures = document.getElementById('resultCaptures');
const resultSwaps = document.getElementById('resultSwaps');

const squares = [];
let game = loadGame() || createGame();
let selected = null;
let legalForSelected = [];
let history = [];
let toastTimer = 0;
let resultTimer = 0;
let tiltEnabled = false;
let tiltHandler = null;
let tiltGotEvent = false;
let tiltPermitted = false;
let tiltBase = null;
let tiltFrame = 0;
let pendingOrientation = null;
let lastFocusedSquare = 52;
let completedFxTimers = new Set();

let soundEnabled = (() => {
  try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
})();

const liveRegion = document.createElement('div');
liveRegion.className = 'sr-only';
liveRegion.setAttribute('aria-live', 'polite');
liveRegion.setAttribute('aria-atomic', 'true');
document.body.appendChild(liveRegion);

/* ── Sound ─────────────────────────────────────────────────── */
const sound = {
  ctx: null,
  noiseBuffer: null,
  ensure() {
    if (!soundEnabled) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },
  tone(freq, duration, { type = 'sine', gain = .03, delay = 0, glide = 0 } = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + glide), t + duration);
    amp.gain.setValueAtTime(.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + .011);
    amp.gain.exponentialRampToValueAtTime(.0001, t + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + .03);
  },
  noise(duration = .12, { gain = .022, delay = 0, frequency = 900, q = .8 } = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    if (!this.noiseBuffer) {
      const length = Math.floor(ctx.sampleRate * .35);
      this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        last = last * .72 + white * .28;
        data[i] = last;
      }
    }
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + .008);
    amp.gain.exponentialRampToValueAtTime(.0001, t + duration);
    src.connect(filter).connect(amp).connect(ctx.destination);
    src.start(t);
    src.stop(t + duration + .02);
  },
  select() {
    this.tone(560, .055, { type: 'triangle', gain: .014, glide: 40 });
    this.noise(.035, { gain: .006, frequency: 1700 });
  },
  move() {
    this.noise(.075, { gain: .018, frequency: 430, q: 1.5 });
    this.tone(136, .09, { type: 'triangle', gain: .032, glide: -18 });
  },
  capture() {
    this.noise(.14, { gain: .045, frequency: 300, q: .55 });
    this.tone(88, .17, { type: 'triangle', gain: .045, glide: -34 });
    this.tone(220, .1, { type: 'sine', gain: .016, delay: .03, glide: -70 });
  },
  swap() {
    [392, 523.25, 659.25, 783.99].forEach((freq, i) => {
      this.tone(freq, .18, { type: 'sine', gain: .014, delay: .06 + i * .055, glide: 8 });
    });
  },
  check() {
    this.tone(392, .12, { type: 'triangle', gain: .026 });
    this.tone(311, .2, { type: 'triangle', gain: .024, delay: .12 });
  },
  win() {
    [261.63, 329.63, 392, 523.25].forEach((freq, i) => {
      this.tone(freq, .55, { type: 'sine', gain: .019, delay: i * .08 });
    });
  },
  draw() {
    this.tone(261.63, .55, { type: 'sine', gain: .016 });
    this.tone(246.94, .65, { type: 'sine', gain: .012, delay: .06 });
  },
  undo() {
    this.tone(420, .09, { type: 'triangle', gain: .022, glide: -90 });
    this.noise(.06, { gain: .01, frequency: 800 });
  },
  nope() {
    this.tone(180, .07, { type: 'triangle', gain: .012, glide: -30 });
  },
};

/* ── Board creation ────────────────────────────────────────── */
for (let i = 0; i < 64; i++) {
  const square = document.createElement('button');
  square.type = 'button';
  square.dataset.index = String(i);
  square.setAttribute('role', 'gridcell');
  square.tabIndex = i === 52 ? 0 : -1;
  square.className = `square ${isLight(i) ? 'light' : 'dark'}`;
  square.addEventListener('click', () => onSquareActivate(i));
  square.addEventListener('keydown', (event) => onSquareKeyDown(event, i));
  square.addEventListener('focus', () => {
    lastFocusedSquare = i;
    squares.forEach((item, index) => { item.tabIndex = index === i ? 0 : -1; });
  });
  boardEl.appendChild(square);
  squares.push(square);
}

const SYMBOL_NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
function pieceSvg(type) {
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#piece-${SYMBOL_NAME[type] || 'pawn'}"></use></svg>`;
}

function pieceMarkup(piece, extraClass = '') {
  if (!piece) return '';
  return `
    <span class="piece ${piece.color === 'w' ? 'white' : 'black'} ${extraClass}" data-piece-type="${piece.type}" data-piece-color="${piece.color}">
      ${pieceSvg(piece.type)}
      ${piece.royal ? `<span class="royal-badge" title="Royal piece"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#royal-mark"></use></svg></span>` : ''}
    </span>`;
}

function miniMarkup(type, color, className = 'taken-mini') {
  return `<span class="${className} ${color === 'b' ? 'dark' : ''}" aria-hidden="true">${pieceSvg(type)}</span>`;
}

function updateSquareAria(index, piece, target, isCheck) {
  const parts = [squareName(index)];
  if (piece) {
    parts.push(`${SIDES[piece.color]} ${TYPE_LABEL[piece.type]}${piece.royal ? ', royal' : ''}`);
  } else {
    parts.push('empty');
  }
  if (index === selected) parts.push('selected');
  if (target) {
    if (target.enPassant) parts.push('capture en passant available');
    else if (target.capture) parts.push('capture available');
    else parts.push('legal move available');
  }
  if (isCheck) parts.push('in check');
  squares[index].setAttribute('aria-label', parts.join(', '));
  squares[index].setAttribute('aria-selected', index === selected ? 'true' : 'false');
}

function renderBoard({ animate = null } = {}) {
  const last = game.lastMove;
  const inCheck = game.check || game.status === 'checkmate';
  const checkedKing = inCheck ? kingIndex(game.board, game.turn) : -1;

  for (let i = 0; i < 64; i++) {
    const square = squares[i];
    const piece = game.board[i];
    const target = legalForSelected.find((move) => move.to === i);
    const isLast = Boolean(last && (last.from === i || last.to === i));
    const isSelected = selected === i;
    const isCheck = checkedKing === i;
    const classes = ['square', isLight(i) ? 'light' : 'dark'];
    if (isLast) classes.push('is-last');
    if (isSelected) classes.push('selected');
    if (target) classes.push('is-target');
    if (target?.capture) classes.push('is-capture');
    if (isCheck) classes.push('in-check');
    square.className = classes.join(' ');

    let html = '';
    if (rowOf(i) === 7) html += `<span class="coord coord-file" aria-hidden="true">${squareName(i)[0]}</span>`;
    if (colOf(i) === 0) html += `<span class="coord coord-rank" aria-hidden="true">${8 - rowOf(i)}</span>`;
    if (piece) html += pieceMarkup(piece);
    if (target) html += `<span class="move-hint ${target.capture ? 'is-capture' : ''}" aria-hidden="true"></span>`;
    square.innerHTML = html;
    updateSquareAria(i, piece, target, isCheck);
  }

  if (animate) {
    requestAnimationFrame(() => {
      const destination = squares[animate.event.to]?.querySelector('.piece');
      if (destination) {
        const cls = animate.event.capturedType ? 'power-shift' : 'arriving';
        destination.classList.add(cls);
        window.setTimeout(() => destination.classList.remove(cls), 760);
      }
      if (animate.event.castle) {
        const rookTo = animate.event.castle === 'king'
          ? animate.event.to - 1
          : animate.event.to + 1;
        const rook = squares[rookTo]?.querySelector('.piece');
        if (rook) {
          rook.classList.add('arriving');
          window.setTimeout(() => rook.classList.remove('arriving'), 460);
        }
      }
    });
  }
}

/* ── Interface rendering ───────────────────────────────────── */
function captureEntries() {
  return game.log.filter((entry) => entry.capturedType);
}

function latestCapture() {
  for (let i = game.log.length - 1; i >= 0; i--) {
    if (game.log[i].capturedType) return game.log[i];
  }
  return null;
}

function renderHud() {
  const inCheck = game.check && game.status === 'playing';
  turnPanel.classList.toggle('is-check', inCheck || game.status === 'checkmate');
  turnOrb.dataset.side = game.turn;
  moveNumberEl.textContent = String(game.fullmove);

  let label;
  let hint;
  if (game.status === 'checkmate') {
    label = 'CHECKMATE';
    hint = `${SIDES[game.winner]} takes the crown.`;
  } else if (game.status === 'stalemate') {
    label = 'STALEMATE';
    hint = 'No legal move remains. The game is drawn.';
  } else if (game.status === 'draw') {
    label = 'DRAW';
    hint = game.statusReason || 'The game is drawn.';
  } else if (inCheck) {
    label = `${SIDES[game.turn].toUpperCase()} IN CHECK`;
    hint = 'The crown is exposed. Find a safe move.';
  } else {
    label = `${SIDES[game.turn].toUpperCase()} TO MOVE`;
    const selectedPiece = selected === null ? null : game.board[selected];
    if (selectedPiece) {
      const moves = legalForSelected.length;
      hint = moves
        ? `${TYPE_LABEL[selectedPiece.type]} · ${moves} ${moves === 1 ? 'destination' : 'destinations'}`
        : 'No legal move — pinned or blocked.';
    } else {
      hint = 'Tap a piece to reveal its power';
    }
  }
  turnLabel.textContent = label;
  turnHint.textContent = hint;
  undoButton.disabled = history.length === 0;
}

function renderReadout() {
  const selectedPiece = selected === null ? null : game.board[selected];
  if (selectedPiece) {
    const royal = selectedPiece.royal;
    readoutEyebrow.textContent = royal ? 'SELECTED · ROYAL CROWN' : 'SELECTED POWER';
    readoutTitle.textContent = `${TYPE_LABEL[selectedPiece.type]}${royal ? ' · royal' : ''}`;
    readoutSub.textContent = legalForSelected.length
      ? TYPE_MOVE[selectedPiece.type]
      : 'No legal destination for this piece.';
    readoutIcon.className = `readout-icon ${selectedPiece.color === 'b' ? 'onyx' : ''}`;
    readoutIcon.innerHTML = pieceSvg(selectedPiece.type);
    if (royal) readoutIcon.innerHTML += '<span class="readout-crown" aria-hidden="true"></span>';
    return;
  }

  const capture = latestCapture();
  if (capture) {
    readoutEyebrow.textContent = capture.pieceType !== capture.newType ? 'LATEST SHIFT' : 'LATEST CAPTURE';
    readoutTitle.textContent = capture.pieceType !== capture.newType
      ? `${TYPE_LABEL[capture.pieceType]} became ${TYPE_LABEL[capture.newType]}`
      : `${TYPE_LABEL[capture.pieceType]} took a ${TYPE_LABEL[capture.capturedType]}`;
    readoutSub.textContent = capture.pieceType !== capture.newType
      ? `${SIDES[capture.color]} seized a ${TYPE_LABEL[capture.capturedType]} on ${capture.capturedName}.`
      : `The power stayed the same. Move ${capture.number}.`;
    readoutIcon.className = `readout-icon ${capture.color === 'b' ? 'onyx' : ''}`;
    readoutIcon.innerHTML = pieceSvg(capture.newType);
    return;
  }

  if (game.status === 'checkmate') {
    readoutEyebrow.textContent = 'THE CROWN FALLS';
    readoutTitle.textContent = `${SIDES[game.winner]} wins by checkmate`;
    readoutSub.textContent = 'Review the board, or begin a new game.';
    readoutIcon.className = 'readout-icon';
    readoutIcon.innerHTML = pieceSvg('k');
    return;
  }

  readoutEyebrow.textContent = 'THE SHIFT';
  readoutTitle.textContent = 'A capture rewrites a piece';
  readoutSub.textContent = 'Tap any piece to inspect its power.';
  readoutIcon.className = 'readout-icon';
  readoutIcon.innerHTML = pieceSvg('p');
}

function shiftEventMarkup(entry) {
  if (!entry) {
    return '<p class="shift-empty">No powers have changed hands. Yet.</p>';
  }
  const changed = entry.pieceType !== entry.newType;
  return `
    <div class="shift-event-line">
      <span class="shift-pieces">
        ${miniMarkup(entry.pieceType, entry.color, 'shift-mini')}
        <span class="shift-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#icon-swap"></use></svg></span>
        ${miniMarkup(entry.newType, entry.color, 'shift-mini')}
      </span>
      <span class="shift-copy">
        <span class="shift-title"><b>${TYPE_LABEL[entry.pieceType]}</b> took a ${TYPE_LABEL[entry.capturedType]} on ${entry.capturedName}</span>
        <span class="shift-sub">${changed ? `Now moves like a <span class="cap">${TYPE_LABEL[entry.newType]}</span>` : 'Power unchanged'} · Move ${entry.number}</span>
      </span>
    </div>`;
}

function renderShiftPanels() {
  const latest = latestCapture();
  const events = captureEntries();
  const swapCount = events.filter((entry) => entry.pieceType !== entry.newType).length;
  const html = shiftEventMarkup(latest);
  desktopShiftEvent.innerHTML = html;
  mobileShiftEvent.innerHTML = html;
  swapCountEl.textContent = String(swapCount);
  captureCountEl.textContent = String(events.length);
  turnCountEl.textContent = String(game.log.length + 1);
  mobileCaptureCount.textContent = `${events.length} ${events.length === 1 ? 'CAPTURE' : 'CAPTURES'}`;
}

function renderTaken() {
  takenByWhite.innerHTML = game.captured.w.length
    ? game.captured.w.map((piece) => miniMarkup(piece.type, piece.color)).join('')
    : '<span class="taken-empty">—</span>';
  takenByBlack.innerHTML = game.captured.b.length
    ? game.captured.b.map((piece) => miniMarkup(piece.type, piece.color)).join('')
    : '<span class="taken-empty">—</span>';
  takeTotal.textContent = `${Math.max(0, 32 - game.captured.w.length - game.captured.b.length)} ON BOARD`;
}

function entrySan(entry) {
  if (entry.castle) return entry.castle === 'king' ? 'O-O' : 'O-O-O';
  if (entry.pieceType === 'p') {
    return entry.capturedType
      ? `${entry.fromName[0]}×${entry.toName}${entry.promoted ? '=Q' : ''}`
      : `${entry.toName}${entry.promoted ? '=Q' : ''}`;
  }
  return `${TYPE_LETTER[entry.pieceType] || ''}${entry.capturedType ? '×' : ''}${entry.toName}${entry.promoted ? '=Q' : ''}`;
}

function renderLog({ scroll = false } = {}) {
  if (!game.log.length) {
    moveLog.innerHTML = '<li class="log-empty">The board is still. Make the first move.</li>';
    return;
  }
  moveLog.innerHTML = game.log.map((entry) => {
    const changed = entry.pieceType !== entry.newType;
    const tag = entry.mate
      ? 'MATE'
      : entry.castle
        ? 'CASTLE'
        : entry.promoted
          ? 'QUEEN'
          : entry.capturedType
            ? (changed ? 'SWAP' : 'CAPTURE')
            : 'MOVE';
    return `
      <li>
        <span class="log-no">${entry.number}${entry.color === 'w' ? '.' : '…'}</span>
        <span class="log-main">
          ${miniMarkup(entry.pieceType, entry.color, 'log-piece')}
          <span class="log-san">${entrySan(entry).replace(/[+#]/g, '')}</span>
          ${changed ? `<span class="log-swap">→${TYPE_LETTER[entry.newType] || 'P'}</span>` : ''}
          ${entry.mate ? '<span class="log-check">#</span>' : entry.check ? '<span class="log-check">+</span>' : ''}
        </span>
        <span class="log-tag ${entry.capturedType ? 'capture' : ''}">${tag}</span>
      </li>`;
  }).join('');
  if (scroll) {
    requestAnimationFrame(() => { moveLog.scrollTop = moveLog.scrollHeight; });
  }
}

function renderAll({ animate = null, scrollLog = false } = {}) {
  renderBoard({ animate });
  renderHud();
  renderReadout();
  renderShiftPanels();
  renderTaken();
  renderLog({ scroll: scrollLog });
  updateToolButtons();
}

/* ── Interaction ───────────────────────────────────────────── */
function setRovingFocus(index) {
  lastFocusedSquare = index;
  squares.forEach((square, i) => { square.tabIndex = i === index ? 0 : -1; });
}

function selectSquare(index) {
  const piece = game.board[index];
  if (!piece || piece.color !== game.turn) return;
  selected = index;
  legalForSelected = legalMoves(game, index);
  setRovingFocus(index);
  sound.select();
  renderAll();
  if (!legalForSelected.length) {
    showToast(`${TYPE_LABEL[piece.type]} has no legal move.`, 1700);
  }
}

function clearSelection() {
  if (selected === null) return;
  selected = null;
  legalForSelected = [];
  renderAll();
}

function onSquareActivate(index) {
  if (game.status !== 'playing') {
    showToast('The game is over. Review the board or start a new game.', 2200);
    return;
  }
  const piece = game.board[index];

  if (selected !== null && index === selected) {
    clearSelection();
    return;
  }

  if (selected !== null) {
    const target = legalForSelected.find((move) => move.to === index);
    if (target) {
      makeMove(selected, index, target);
      return;
    }
  }

  if (piece && piece.color === game.turn) {
    selectSquare(index);
    return;
  }

  if (piece) {
    showToast(`That piece belongs to ${SIDES[piece.color]}. ${SIDES[game.turn]} to move.`, 1700);
    sound.nope();
    return;
  }

  if (selected !== null) {
    clearSelection();
  } else {
    sound.nope();
  }
}

function onSquareKeyDown(event, index) {
  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  let row = rowOf(index);
  let col = colOf(index);
  if (event.key === 'ArrowUp') row = Math.max(0, row - 1);
  if (event.key === 'ArrowDown') row = Math.min(7, row + 1);
  if (event.key === 'ArrowLeft') col = Math.max(0, col - 1);
  if (event.key === 'ArrowRight') col = Math.min(7, col + 1);
  if (event.key === 'Home') col = 0;
  if (event.key === 'End') col = 7;
  const next = row * 8 + col;
  setRovingFocus(next);
  squares[next].focus();
}

function makeMove(from, to, target) {
  const working = game;
  const movingBefore = working.board[from];
  const victim = working.board[to] || (target.capturedAt != null ? working.board[target.capturedAt] : null);
  const result = playMove(working, from, to);
  if (!result) {
    sound.nope();
    showToast('That move is not legal.', 1500);
    clearSelection();
    return;
  }

  pushHistory(working);
  game = result.state;
  selected = null;
  legalForSelected = [];
  cancelResultTimer();
  const { event } = result;

  saveGame();
  renderAll({ animate: { event }, scrollLog: true });

  if (event.capturedType) {
    sound.capture();
    window.setTimeout(() => {
      if (event.newType !== event.pieceType) sound.swap();
    }, 210);
    vibrate([9, 26, 12]);
    spawnCaptureFx(event, victim || movingBefore);
  } else {
    sound.move();
    vibrate(7);
  }

  if (event.check && !event.mate) {
    window.setTimeout(() => sound.check(), 140);
    showToast(`${SIDES[game.turn]} is in check.`, 1700);
    vibrate([10, 30, 10]);
  }

  const announceParts = [
    `${SIDES[event.color]} ${TYPE_LABEL[event.pieceType]} ${event.fromName} to ${event.toName}`,
  ];
  if (event.capturedType) {
    announceParts.push(
      `captures ${SIDES[event.capturedColor]} ${TYPE_LABEL[event.capturedType]}`,
      event.newType !== event.pieceType
        ? `and becomes a ${TYPE_LABEL[event.newType]}`
        : 'with no power change',
    );
  }
  if (event.castle) announceParts.push('castles');
  announceParts.push(`${SIDES[game.turn]} to move`);
  if (event.check) announceParts.push('check');
  if (event.mate) announceParts.push('checkmate');
  if (event.stalemate) announceParts.push('stalemate');
  announce(announceParts.join('. ') + '.');

  if (game.status === 'checkmate') {
    window.setTimeout(() => sound.win(), 480);
    scheduleResult(950);
  } else if (game.status === 'stalemate' || game.status === 'draw') {
    window.setTimeout(() => sound.draw(), 480);
    scheduleResult(950);
  }
}

function pushHistory(state) {
  try {
    history.push(JSON.stringify(state));
    if (history.length > 160) history.shift();
  } catch {
    history = [];
  }
}

function undo() {
  if (!history.length) {
    sound.nope();
    return;
  }
  cancelResultTimer();
  if (resultDialog.open) resultDialog.close();
  const previous = history.pop();
  try {
    game = JSON.parse(previous);
  } catch {
    showToast('Could not rewind that move.', 1800);
    return;
  }
  selected = null;
  legalForSelected = [];
  saveGame();
  sound.undo();
  renderAll({ scrollLog: true });
  showToast('Move rewound. Powers restored.', 1600);
  announce('Move undone.');
}

function startNew() {
  cancelResultTimer();
  if (resultDialog.open) resultDialog.close();
  if (newDialog.open) newDialog.close();
  game = createGame();
  selected = null;
  legalForSelected = [];
  history = [];
  saveGame();
  renderAll();
  showToast('A new board. Every power is home.', 1800);
  announce('New game. Ivory to move.');
  sound.move();
}

/* ── Effects ───────────────────────────────────────────────── */
function centerFor(index) {
  const frame = boardFrame();
  const size = frame.clientWidth / 8;
  const row = rowOf(index);
  const col = colOf(index);
  return { x: (col + .5) * size, y: (row + .5) * size, cell: size };
}

function spawnCaptureFx(event, victim) {
  const frame = boardFrame();
  if (!frame || !victim) return;
  const victimIndex = event.capturedAt != null ? event.capturedAt : event.to;
  const from = centerFor(victimIndex);
  const to = centerFor(event.to);
  const cell = from.cell;
  const victimColor = victim.color;

  fxLayer.replaceChildren();

  const ghost = document.createElement('div');
  ghost.className = 'capture-ghost';
  ghost.style.left = `${colOf(victimIndex) * cell}px`;
  ghost.style.top = `${rowOf(victimIndex) * cell}px`;
  ghost.style.width = `${cell}px`;
  ghost.style.height = `${cell}px`;
  ghost.innerHTML = pieceMarkup({ type: victim.type, color: victimColor, royal: false });
  fxLayer.appendChild(ghost);
  const ghostAnim = ghost.animate([
    { opacity: 1, transform: 'scale(1) rotate(0deg)', filter: 'brightness(1)' },
    { opacity: 1, transform: 'scale(1.14) rotate(-3deg)', filter: 'brightness(2.3)', offset: .26 },
    { opacity: .92, transform: 'scale(1.07) rotate(-1deg)', filter: 'brightness(1.7)', offset: .55 },
    { opacity: 0, transform: 'scale(.38) rotate(13deg) translateY(-20%)', filter: 'brightness(2.8)' },
  ], { duration: 620, easing: 'cubic-bezier(.24,.6,.3,1)', fill: 'forwards' });
  ghostAnim.onfinish = () => ghost.remove();

  const orbSize = Math.max(26, cell * .4);
  const orb = document.createElement('div');
  orb.className = 'swap-orb';
  orb.style.width = `${orbSize}px`;
  orb.style.height = `${orbSize}px`;
  orb.style.left = `${from.x - orbSize / 2}px`;
  orb.style.top = `${from.y - orbSize / 2}px`;
  orb.style.color = victimColor === 'b' ? '#0b1713' : '#f7dfaa';
  orb.innerHTML = pieceSvg(victim.type);
  fxLayer.appendChild(orb);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const orbAnim = orb.animate([
    { transform: 'translate(0,0) scale(.55)', opacity: 0 },
    { transform: `translate(${dx * .16}px, ${dy * .16 - cell * .4}px) scale(1.2)`, opacity: 1, offset: .26 },
    { transform: `translate(${dx * .58}px, ${dy * .58 - cell * .18}px) scale(1.04)`, opacity: 1, offset: .56 },
    { transform: `translate(${dx}px, ${dy}px) scale(.45)`, opacity: 0 },
  ], { duration: 720, delay: 60, easing: 'cubic-bezier(.28,.62,.24,1)', fill: 'forwards' });
  orbAnim.onfinish = () => orb.remove();

  const ring = document.createElement('div');
  ring.className = 'swap-ring';
  ring.style.left = `${to.x - cell * .38}px`;
  ring.style.top = `${to.y - cell * .38}px`;
  ring.style.width = `${cell * .76}px`;
  ring.style.height = `${cell * .76}px`;
  fxLayer.appendChild(ring);
  const ringAnim = ring.animate([
    { transform: 'scale(.5)', opacity: 0 },
    { transform: 'scale(.92)', opacity: .95, offset: .18 },
    { transform: 'scale(1.28)', opacity: .85, offset: .5 },
    { transform: 'scale(2.05)', opacity: 0 },
  ], { duration: 820, delay: 430, easing: 'cubic-bezier(.2,.62,.28,1)', fill: 'forwards' });
  ringAnim.onfinish = () => ring.remove();

  for (let i = 0; i < 10; i++) {
    const spark = document.createElement('span');
    spark.className = 'spark';
    spark.style.left = `${to.x - 1.5}px`;
    spark.style.top = `${to.y - 1.5}px`;
    fxLayer.appendChild(spark);
    const angle = (Math.PI * 2 * i) / 10 + Math.random() * .35;
    const distance = cell * (.26 + Math.random() * .42);
    const anim = spark.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 0 },
      { transform: 'translate(0,0) scale(1.25)', opacity: 1, offset: .1 },
      { transform: `translate(${Math.cos(angle) * distance * .55}px, ${Math.sin(angle) * distance * .55}px) scale(1)`, opacity: .95, offset: .45 },
      { transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0)`, opacity: 0 },
    ], { duration: 780, delay: 440 + Math.random() * 120, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'forwards' });
    anim.onfinish = () => spark.remove();
  }

  const changed = event.pieceType !== event.newType;
  const callout = document.createElement('div');
  callout.className = 'swap-callout';
  callout.innerHTML = changed
    ? `POWER SWAP · ${TYPE_LABEL[event.pieceType]} <b>→</b> ${TYPE_LABEL[event.newType]}`
    : `CAPTURE · POWER UNCHANGED`;
  fxLayer.appendChild(callout);
  const calloutAnim = callout.animate([
    { opacity: 0, transform: 'translate(-50%, -7px) scale(.96)' },
    { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: .12 },
    { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: .76 },
    { opacity: 0, transform: 'translate(-50%, -4px) scale(.985)' },
  ], { duration: 1900, delay: 90, easing: 'ease-out', fill: 'forwards' });
  calloutAnim.onfinish = () => callout.remove();
}

function vibrate(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch { /* haptics are optional */ }
}

/* ── Result handling ───────────────────────────────────────── */
function scheduleResult(delay = 900) {
  cancelResultTimer();
  resultTimer = window.setTimeout(showResult, delay);
}
function cancelResultTimer() {
  if (resultTimer) window.clearTimeout(resultTimer);
  resultTimer = 0;
}

function showResult() {
  if (game.status === 'playing') return;
  if (resultDialog.open) return;
  const winner = game.winner;
  const swapped = captureEntries().filter((entry) => entry.pieceType !== entry.newType).length;
  resultMoves.textContent = String(Math.ceil(game.log.length / 2));
  resultCaptures.textContent = String(captureEntries().length);
  resultSwaps.textContent = String(swapped);
  resultCrown.className = 'result-crown';

  if (game.status === 'checkmate') {
    resultEyebrow.textContent = `CHECKMATE · ${SIDES[winner].toUpperCase()} WINS`;
    resultTitle.textContent = 'The crown falls.';
    resultText.textContent = `${SIDES[winner]} takes the game. ${SIDES[opposite(winner)]}'s king has no escape.`;
    resultCrown.classList.add(winner === 'b' ? 'onyx' : 'ivory');
  } else if (game.status === 'stalemate') {
    resultEyebrow.textContent = 'STALEMATE · DRAW';
    resultTitle.textContent = 'No move remains.';
    resultText.textContent = 'The crown is safe, but no legal move is left. The game is drawn.';
  } else {
    resultEyebrow.textContent = 'DRAW';
    resultTitle.textContent = 'No one takes the crown.';
    resultText.textContent = game.statusReason || 'The game ends without a winner.';
  }
  resultDialog.showModal();
}

/* ── Dialogs and controls ──────────────────────────────────── */
function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}
function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}
document.querySelectorAll('[data-close-dialog]').forEach((button) => {
  button.addEventListener('click', () => closeDialog(button.closest('dialog')));
});
[rulesDialog, newDialog, resultDialog].forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
});

function updateToolButtons() {
  soundButton.classList.toggle('is-muted', !soundEnabled);
  soundButton.setAttribute('aria-label', soundEnabled ? 'Mute sound' : 'Enable sound');
  soundButton.title = soundEnabled ? 'Sound on (M)' : 'Sound off (M)';
  tiltButton.classList.toggle('active', tiltEnabled);
  tiltButton.setAttribute('aria-pressed', tiltEnabled ? 'true' : 'false');
  tiltButton.setAttribute('aria-label', tiltEnabled ? 'Disable tilt' : 'Enable tilt');
  tiltButton.title = tiltEnabled ? 'Tilt on (T)' : 'Tilt the board (T)';
  undoButton.disabled = history.length === 0;
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  try { localStorage.setItem(SOUND_KEY, soundEnabled ? 'on' : 'off'); } catch {}
  updateToolButtons();
  if (soundEnabled) {
    sound.ensure();
    sound.select();
    showToast('Sound on.', 1200);
  } else {
    showToast('Sound off.', 1200);
  }
}

function enableTilt() {
  tiltEnabled = true;
  tiltBase = null;
  tiltGotEvent = false;
  updateToolButtons();
  tiltHandler = (event) => {
    pendingOrientation = event;
    if (tiltFrame) return;
    tiltFrame = requestAnimationFrame(applyTilt);
  };
  window.addEventListener('deviceorientation', tiltHandler, true);
  boardShell.classList.add('is-tilting');
  showToast('Tilt on. Lean your device to move the board.', 2100);
  setTimeout(() => {
    if (tiltEnabled && !tiltGotEvent) {
      showToast('Tilt is on, but this device has not reported motion.', 2400);
    }
  }, 1800);
}

function disableTilt() {
  tiltEnabled = false;
  tiltHandler && window.removeEventListener('deviceorientation', tiltHandler, true);
  tiltHandler = null;
  if (tiltFrame) cancelAnimationFrame(tiltFrame);
  tiltFrame = 0;
  tiltBase = null;
  tiltGotEvent = false;
  const perspective = document.getElementById('boardPerspective');
  perspective.style.setProperty('--tilt-x', '0deg');
  perspective.style.setProperty('--tilt-y', '0deg');
  boardShell.classList.remove('is-tilting');
  boardShell.style.removeProperty('--glare-x');
  boardShell.style.removeProperty('--glare-y');
  updateToolButtons();
  showToast('Tilt off. The board is steady.', 1500);
}

function applyTilt() {
  tiltFrame = 0;
  const event = pendingOrientation;
  if (!tiltEnabled || !event) return;
  const beta = Number.isFinite(event.beta) ? event.beta : 0;
  const gamma = Number.isFinite(event.gamma) ? event.gamma : 0;
  if (beta === 0 && gamma === 0) return;
  tiltGotEvent = true;
  if (!tiltBase) tiltBase = { beta, gamma };
  const dBeta = beta - tiltBase.beta;
  const dGamma = gamma - tiltBase.gamma;
  const landscape = window.innerWidth > window.innerHeight;
  const rawX = landscape ? dGamma * .12 : -dBeta * .12;
  const rawY = landscape ? -dBeta * .12 : dGamma * .15;
  const clamp = (v) => Math.max(-7.5, Math.min(7.5, v));
  const rx = clamp(rawX);
  const ry = clamp(rawY);
  const perspective = document.getElementById('boardPerspective');
  perspective.style.setProperty('--tilt-x', `${rx.toFixed(2)}deg`);
  perspective.style.setProperty('--tilt-y', `${ry.toFixed(2)}deg`);
  boardShell.style.setProperty('--glare-x', `${(50 + ry * 4.5).toFixed(1)}%`);
  boardShell.style.setProperty('--glare-y', `${(12 - rx * 3.2).toFixed(1)}%`);
}

async function toggleTilt() {
  if (tiltEnabled) {
    disableTilt();
    return;
  }
  if (typeof DeviceMotionEvent === 'undefined') {
    showToast('Tilt is not available on this device.', 2000);
    return;
  }
  try {
    if (typeof DeviceMotionEvent.requestPermission === 'function' && !tiltPermitted) {
      const permission = await DeviceMotionEvent.requestPermission();
      if (permission !== 'granted') {
        showToast('Motion access was not granted. Tilt stays off.', 2300);
        return;
      }
      tiltPermitted = true;
    }
    enableTilt();
  } catch {
    showToast('Motion access is unavailable here. Touch still works.', 2300);
  }
}

function showToast(message, duration = 2300) {
  if (toastTimer) window.clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.add('show');
  toastTimer = window.setTimeout(() => {
    toastEl.classList.remove('show');
    toastTimer = 0;
  }, duration);
}

function announce(message) {
  liveRegion.textContent = '';
  window.setTimeout(() => { liveRegion.textContent = message; }, 30);
}

function saveGame() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, game }));
  } catch { /* persistence is optional */ }
}

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || saved.version !== 1 || !saved.game) return null;
    const candidate = saved.game;
    if (!Array.isArray(candidate.board) || candidate.board.length !== 64) return null;
    if (!['w', 'b'].includes(candidate.turn)) return null;
    if (!Array.isArray(candidate.log) || !candidate.captured?.w || !candidate.captured?.b) return null;
    const validTypes = new Set(['p', 'n', 'b', 'r', 'q', 'k']);
    for (const piece of candidate.board) {
      if (!piece) continue;
      if (!['w', 'b'].includes(piece.color) || !validTypes.has(piece.type)) return null;
    }
    if (!['playing', 'checkmate', 'stalemate', 'draw'].includes(candidate.status)) candidate.status = 'playing';
    return candidate;
  } catch {
    return null;
  }
}

/* ── Wiring ────────────────────────────────────────────────── */
soundButton.addEventListener('click', toggleSound);
tiltButton.addEventListener('click', toggleTilt);
helpButton.addEventListener('click', () => openDialog(rulesDialog));
rulesButton.addEventListener('click', () => openDialog(rulesDialog));
newButton.addEventListener('click', () => {
  if (!game.log.length && game.status === 'playing') {
    showToast('This board is already new.', 1500);
    return;
  }
  openDialog(newDialog);
});
confirmNewButton.addEventListener('click', startNew);
rematchButton.addEventListener('click', startNew);
reviewButton.addEventListener('click', () => closeDialog(resultDialog));
undoButton.addEventListener('click', undo);
window.addEventListener('pointerdown', () => { sound.ensure(); }, { once: true, passive: true });

document.addEventListener('keydown', (event) => {
  const openModal = document.querySelector('dialog[open]');
  if (openModal) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === 'u') { event.preventDefault(); undo(); }
  else if (key === 'n') { event.preventDefault(); newButton.click(); }
  else if (key === 'm') { event.preventDefault(); toggleSound(); }
  else if (key === 'h' || event.key === '?') { event.preventDefault(); openDialog(rulesDialog); }
  else if (key === 't') { event.preventDefault(); toggleTilt(); }
  else if (event.key === 'Escape' && selected !== null) {
    event.preventDefault();
    clearSelection();
  }
});

window.addEventListener('beforeunload', saveGame);

/* ── Start ─────────────────────────────────────────────────── */
document.querySelectorAll('.mini-piece[data-piece]').forEach((el) => {
  el.innerHTML = pieceSvg(el.dataset.piece);
});
selected = null;
legalForSelected = [];
renderAll();
updateToolButtons();
if (game.lastMove) {
  requestAnimationFrame(() => {
    squares[game.lastMove.to]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
}
