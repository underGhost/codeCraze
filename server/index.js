console.log('[STARTING SERVER]');
import express from 'express';
import webpack from 'webpack';
import webpackMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';
import config from '../webpack.config.js';

const isDeveloping = process.env.NODE_ENV !== 'production';
const app = express();

if (isDeveloping) {
  const compiler = webpack(config);
  const middleware = webpackMiddleware(compiler, {
    publicPath: config.output.publicPath,
    contentBase: 'src',
    stats: {
      colors: true,
      hash: false,
      timings: true,
      chunks: false,
      chunkModules: false,
      modules: false
    }
  });

  app.use(middleware);
  app.use(webpackHotMiddleware(compiler));
}

import Http from 'http';
import IO from 'socket.io';
import Config from '../config.json';

const http = (Http).Server(app);
const io = (IO)(http);

let matchStart;
const players = [];
const clients = {};
let gameMode = 'waiting';

// Countdown timers
let countingDown = false;
let finalCountdown;
let countdownTime = 10;

function eachPlayer(callback) {
  for (let i = 0; i < players.length; i++) {
    callback(players[i], i);
  }
}

function stopTimers() {
  eachPlayer((player) => {
    clients[player.id].emit('stopCountdown');
  });
  countingDown = false;
  countdownTime = 10;
  clearInterval(finalCountdown);
}

function startGame() {
  stopTimers();
  gameMode = 'start';
  matchStart = new Date().getTime();
}

function countDown() {
  if (countdownTime > 0) {
    eachPlayer((player) => {
      clients[player.id].emit('finalCountdown', countdownTime);
    });
    countdownTime--;
  } else {
    startGame();
  }
}

function startTimers() {
  // Update each player to in game
  eachPlayer((player) => {
    player.inGame = true;
  });
  countingDown = true;
  finalCountdown = setInterval(countDown, 1000);
}

// Send all game info
function gameLoop() {
  for (const key in clients) {
    if (key) {
      // Update clients
      clients[key].emit('gameInfo', gameMode, players);
    }
  }
  eachPlayer((player) => {
    if (player.inGame && !countingDown) {
      clients[player.id].emit('startedGame');
    } else {
      clients[player.id].emit('waitingGame');
    }
  });
}

function resetGame() {
  gameMode = 'waiting';
  eachPlayer((player) => {
    if (player.inGame) {
      player.inGame = false;
    }
  });
  if (players.length > 1) {
    startTimers();
  }
}

io.on('connection', (socket) => {
  socket.on('joinedGame', (username) => {
    const player = {};
    let playerIndex;
    console.log(`${username} joined the game.`);
    clients[socket.id] = socket;
    player.id = socket.id;
    player.name = username;
    player.inGame = false;
    players.push(player);
    playerIndex = players.length - 1;
    socket.emit('registerPlayer', {index: players.length - 1, id: socket.id});
    if (gameMode !== 'start' && players.length > 1 && !countingDown) {
      startTimers();
    } else if (countingDown) {
      players[playerIndex].inGame = true;
    }
  });

  socket.on('success', (userId, perfTime) => {
    // TODO: SUBMIT TO COMPLETION ARRAY. WHEN ALL PLAYERS DONE TAKE TO RESULTS PAGE THEN RESET TIMER IF PLAYERS
    const time = new Date().getTime();
    let username;

    console.log(`[Winner] ${userId}`);
    console.log(`[Performance Time] ${perfTime}ms`);
    console.log('[FINISHED IN]', `${new Date(time - matchStart).getMinutes()}m:${new Date(time - matchStart).getSeconds()}s:${new Date(time - matchStart).getMilliseconds()}ms`);

    eachPlayer((player) => {
      if (player.id === userId) {
        username = player.name;
      }
    });

    if (username) {
      for (const key in clients) {
        if (key) {
          clients[key].emit('alertPlayers', username);
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('SOMEONE DISCONNECTED', socket.id);

    delete clients[socket.id];

    eachPlayer((player, i) => {
      if (player.id === socket.id) {
        players.splice(i, 1);
      }
    });

    const playersIngame = players.filter((p) => {
      return p.inGame;
    });

    if (playersIngame.length < 2) {
      if (countingDown) {
        stopTimers();
      }
      resetGame();
    }
  });
});

// Loop game
setInterval(gameLoop, 1000 / 60);

// Don't touch, IP configurations.
const ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || '127.0.0.1';
const serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || Config.port;
if (process.env.OPENSHIFT_NODEJS_IP !== undefined) {
  http.listen( serverport, ipaddress, () => {
    console.log(`[DEBUG] Listening on *:${serverport}`);
  });
} else {
  http.listen( serverport, () => {
    console.log(`[DEBUG] Listening on *:${Config.port}`);
  });
}
