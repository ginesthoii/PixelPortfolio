// ----- Elements & Setup -----
const board = document.getElementById('board');
const squares = document.getElementsByClassName('square');
const players = ['X', 'O'];
let currentPlayer = players[0];
let someoneWon = false;

// Grab the status message div under the board
const statusMessage = document.getElementById('statusMessage');
statusMessage.textContent = `X's turn!`;

// ----- Scorecard UI (built dynamically) -----
function ensureScoreUI() {
  const endGame = document.getElementById('endGame');
  if (!endGame) return;

  // Only build once
  if (document.getElementById('scoreCard')) return;

  const scoreCard = document.createElement('div');
  scoreCard.id = 'scoreCard';
  scoreCard.innerHTML = `
    <p style="margin:6px 0;">X Wins: <span id="xScore">0</span></p>
    <p style="margin:6px 0;">O Wins: <span id="oScore">0</span></p>
    <p style="margin:6px 0;">Ties: <span id="tieScore">0</span></p>
  `;

  const restartBtn = document.getElementById('restartButton');
  if (restartBtn) {
    endGame.insertBefore(scoreCard, restartBtn);
  } else {
    endGame.appendChild(scoreCard);
  }
}
ensureScoreUI();

// ----- Scores (with localStorage persistence) -----
let scores = { X: 0, O: 0, T: 0 };

function loadScores() {
  try {
    const saved = JSON.parse(localStorage.getItem('tttScores'));
    if (saved && typeof saved === 'object') {
      scores = {
        X: Number(saved.X) || 0,
        O: Number(saved.O) || 0,
        T: Number(saved.T) || 0,
      };
    }
  } catch (e) {}
  updateScoreUI();
}

function saveScores() {
  localStorage.setItem('tttScores', JSON.stringify(scores));
}

function updateScoreUI() {
  const xEl = document.getElementById('xScore');
  const oEl = document.getElementById('oScore');
  const tEl = document.getElementById('tieScore');
  if (xEl) xEl.textContent = scores.X;
  if (oEl) oEl.textContent = scores.O;
  if (tEl) tEl.textContent = scores.T;
}

loadScores();

// ----- Game Logic -----
const winning_combinations = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

for (let i = 0; i < squares.length; i++) {
  squares[i].addEventListener('click', () => {
    if (someoneWon) return;
    if (squares[i].textContent !== '') return;

    squares[i].textContent = currentPlayer;

    if (checkWin(currentPlayer)) {
      someoneWon = true;
      statusMessage.textContent = `Game over! ${currentPlayer} wins!`;
      if (currentPlayer === 'X') {
        scores.X++;
      } else {
        scores.O++;
      }
      updateScoreUI();
      saveScores();
      return;
    }

    if (checkTie()) {
      someoneWon = true;
      statusMessage.textContent = `Game is tied!`;
      scores.T++;
      updateScoreUI();
      saveScores();
      return;
    }

    // Swap player
    currentPlayer = (currentPlayer === players[0]) ? players[1] : players[0];
    statusMessage.textContent = `${currentPlayer}'s turn!`;
  });
}

function checkWin(player) {
  for (let i = 0; i < winning_combinations.length; i++) {
    const [a, b, c] = winning_combinations[i];
    if (
      squares[a].textContent === player &&
      squares[b].textContent === player &&
      squares[c].textContent === player
    ) {
      return true;
    }
  }
  return false;
}

function checkTie() {
  for (let i = 0; i < squares.length; i++) {
    if (squares[i].textContent === '') return false;
  }
  return true;
}

// ----- Restart Round (does NOT reset scores) -----
function clearBoard() {
  for (let i = 0; i < squares.length; i++) {
    squares[i].textContent = '';
  }
}

function restartButton() {
  someoneWon = false;
  clearBoard();
  statusMessage.textContent = `X's turn!`;
  currentPlayer = players[0];
}

// Expose restartButton globally for inline onclick
window.restartButton = restartButton;