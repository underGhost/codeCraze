console.log('[STARTING CLIENT]');

import CodeMirror from 'codemirror/lib/codemirror';
import io from 'socket.io-client';
import 'codemirror/mode/xml/xml';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/css/css';
import 'codemirror/mode/htmlmixed/htmlmixed';
import 'codemirror/addon/edit/matchbrackets';

import '../css/App.scss';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/dracula.css';

let editor;
let socket;
let currentPlayer;
let editorDisplayed = false;

function displayNames(playerList) {
  const container = document.getElementById('players');
  container.innerHTML = `<ul>${playerList}</ul>`;
}

function startGame() {
  if (!editorDisplayed) {
    editor = CodeMirror.fromTextArea(document.getElementById('demotext'), {
      lineNumbers: true,
      mode: 'text/javascript',
      matchBrackets: true,
      theme: 'dracula'
    });
    editorDisplayed = true;
  }
}

function setupSocket() {
  if (!socket) {
    socket = io({query: 'type=player'});

    socket.on('registerPlayer', (playerId) => {
      currentPlayer = playerId;
    });

    socket.on('startedGame', () => {
      if (document.body.className !== 'inGame') {
        document.body.className = 'inGame';
      }
      startGame();
    });

    socket.on('waitingGame', () => {
      if (document.body.className !== 'waitingGame') {
        document.body.className = 'waitingGame';
      }
      // Player missed the cutoff. Waiting...
      console.log('Will join when the game ends');
    });

    socket.on('gameInfo', (gameMode, players) => {
      // Update player list
      const playerList = players.filter((p) => {
        return p.inGame;
      }).map((p) =>{ return `<li>${p.name}</li>`; }).join('');

      displayNames(playerList);
    });

    socket.on('finalCountdown', (time) => {
      const container = document.getElementById('countdown');
      container.style.display = 'block';
      container.innerHTML = `${time}s til the game is started`;
    });

    socket.on('stopCountdown', () => {
      const container = document.getElementById('countdown');
      container.style.display = 'none';
    });

    socket.on('alertPlayers', (user) => {
      alert(`${user} won the match!`);
    });

    // TODO: SANITIZE USERNAME SO NO SPACES AND CHARACTERS ALLOWED
    // Enter game
    socket.emit('joinedGame', document.getElementById('playerName').value);
  } else {
    console.log('There is already a socket for you!');
  }
}

class TestCode {
  constructor(code) {
    this.code = code;
  }

  sendMessage = (status, message) => {
    const wrapper = document.getElementById('gameWrapper');
    const container = document.getElementById('message');
    const stat = status ? 'Pass' : 'Fail';
    wrapper.className = status ? 'passMessage' : 'failMessage';
    container.innerHTML = `Status: ${stat}<br><br>${message ?  `${message}<br><br>` : ''}Completed in: ${this.performance}ms`;
  }

  assertEquals = (exec, answer) => {
    let result;
    let end;
    const start = performance.now();
    const codeComplete = `${this.code}\n${exec}`;
    try {
      result = eval(codeComplete);
      end = performance.now();
      this.performance =  (end - start).toFixed(4);
    } catch (err) {
      end = performance.now();
      this.performance =  (end - start).toFixed(4);
      this.sendMessage(false, err);
      return false;
    }

    if (answer === result) {
      this.sendMessage(true);
      socket.emit('success', currentPlayer.id, this.performance);
    } else {
      this.sendMessage(false, `Expected: ${answer}, instead got: ${result}`);
    }
  }
}

function submitTest() {
  const testCode = editor.getValue();
  const Test = new TestCode(testCode);
  Test.assertEquals('highAndLow("4 5 29 54 4 0 -214 542 -64 1 -3 6 -6")', '542 -214');
}

document.body.onkeydown = (e) => {
  const evtobj = window.event ? event : e;
  if (evtobj.keyCode === 83 && evtobj.ctrlKey) {
    submitTest();
  }
};

// TODO: BIND THIS TO ENTER FOR SUBMISSION AS WELL
// Execute code
document.getElementById('submit').onclick = () => {
  setupSocket();
};
