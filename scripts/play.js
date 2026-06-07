const fs = require('fs');

const STATE_FILE = './board_state.json';
const README_FILE = './README.md';

function parseIssueTitle(title) {
  if (!title || !title.startsWith('ttc|')) return null;
  const action = title.split('|')[1];
  return action; // 'restart' or a number '0'-'8'
}

function checkWinningState(board, mark) {
  const WIN_COMBOS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  return WIN_COMBOS.some(combo => combo.every(idx => board[idx] === mark));
}

function minimax(tempBoard, depth, isMaximizing) {
  if (checkWinningState(tempBoard, 'O')) return 10 - depth;
  if (checkWinningState(tempBoard, 'X')) return depth - 10;
  if (tempBoard.every(cell => cell !== null)) return 0;

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (tempBoard[i] === null) {
        tempBoard[i] = 'O';
        let score = minimax(tempBoard, depth + 1, false);
        tempBoard[i] = null;
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (tempBoard[i] === null) {
        tempBoard[i] = 'X';
        let score = minimax(tempBoard, depth + 1, true);
        tempBoard[i] = null;
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
}

function getBestMove(board) {
  let bestScore = -Infinity;
  let move = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = 'O';
      let score = minimax(board, 0, false);
      board[i] = null;
      if (score > bestScore) {
        bestScore = score;
        move = i;
      }
    }
  }
  return move;
}

function generateMarkdownBoard(state, repoUrl) {
  const { board, status, winner } = state;
  let md = '<table>\n';
  for (let row = 0; row < 3; row++) {
    md += '  <tr>\n';
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      const cell = board[idx];
      let imgLink = '';
      if (cell === 'X') {
        imgLink = `<img src="./assets/x.svg" width="60" />`;
      } else if (cell === 'O') {
        imgLink = `<img src="./assets/o.svg" width="60" />`;
      } else {
        if (status === 'playing') {
          const issueLink = `https://github.com/${repoUrl}/issues/new?title=ttc%7C${idx}`;
          imgLink = `<a href="${issueLink}"><img src="./assets/blank.svg" width="60" /></a>`;
        } else {
          imgLink = `<img src="./assets/blank.svg" width="60" />`;
        }
      }
      md += `    <td align="center">${imgLink}</td>\n`;
    }
    md += '  </tr>\n';
  }
  md += '</table>\n\n';

  if (status !== 'playing') {
    const msg = winner === 'X' ? "🎉 You defeated the unbeatable AI (Wait, that's impossible!)" 
              : winner === 'O' ? "💀 The Machine Wins." 
              : "🤝 It's a Draw!";
    md += `**Status:** ${msg} <br/> <a href="https://github.com/${repoUrl}/issues/new?title=ttc%7Crestart">Click here to Restart</a>`;
  } else {
    md += `**Status:** Your turn! Click an empty cell to place your **X**.`;
  }

  return md;
}

function updateReadme(mdBoard) {
  const readmeContent = fs.readFileSync(README_FILE, 'utf-8');
  const startMarker = '<!-- BOARD_START -->';
  const endMarker = '<!-- BOARD_END -->';
  
  const startIndex = readmeContent.indexOf(startMarker);
  const endIndex = readmeContent.indexOf(endMarker);
  
  if (startIndex !== -1 && endIndex !== -1) {
    const newContent = readmeContent.substring(0, startIndex + startMarker.length) + 
                       '\n' + mdBoard + '\n' + 
                       readmeContent.substring(endIndex);
    fs.writeFileSync(README_FILE, newContent);
  }
}

function main() {
  const issueTitle = process.env.ISSUE_TITLE;
  const repoSlug = process.env.GITHUB_REPOSITORY || 'ayush-thedev/ayush-thedev'; // Fallback
  
  const action = parseIssueTitle(issueTitle);
  if (!action) {
    console.log("Not a tic-tac-toe move issue. Exiting.");
    return;
  }

  let state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));

  if (action === 'restart') {
    state = { board: Array(9).fill(null), status: 'playing', winner: null };
  } else if (state.status === 'playing') {
    const moveIdx = parseInt(action);
    if (!isNaN(moveIdx) && moveIdx >= 0 && moveIdx < 9 && state.board[moveIdx] === null) {
      // Player move
      state.board[moveIdx] = 'X';
      
      // Check player win
      if (checkWinningState(state.board, 'X')) {
        state.status = 'finished';
        state.winner = 'X';
      } else if (state.board.every(c => c !== null)) {
        state.status = 'finished';
        state.winner = 'tie';
      } else {
        // AI move
        const aiMove = getBestMove(state.board);
        if (aiMove !== -1) {
          state.board[aiMove] = 'O';
          if (checkWinningState(state.board, 'O')) {
            state.status = 'finished';
            state.winner = 'O';
          } else if (state.board.every(c => c !== null)) {
            state.status = 'finished';
            state.winner = 'tie';
          }
        }
      }
    }
  }

  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  
  const mdBoard = generateMarkdownBoard(state, repoSlug);
  updateReadme(mdBoard);
}

main();
