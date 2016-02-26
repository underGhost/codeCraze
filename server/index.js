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

let socket;
let gameTimer;
let matchTime;
let matchStart = false;
const players = [];
const clients = [];

// Send all game info
function gameLoop() {
  if (matchStart) {
    for (let i = 0; i < clients.length; i++) {
      clients[i].emit('gameInfo', players);
    }
  }
}

io.on('connection', (socketConnection) => {
  socket = socketConnection;

  socket.on('joinedGame', (username) => {
    const player = {};
    console.log('A new user has joined the game!', username);
    clients.push(socket);
    player.id = socket.id;
    player.name = username;
    players.push(player);
    socket.emit('joinMatch', socket.id);
    matchStart = true;
  });

  socket.on('matchEnded', () => {
    matchStart = false;
    clearInterval(gameTimer);
  });

  socket.on('success', (userId, perfTime, time) => {
    // TODO: Fix time update
    console.log(`[Winner] ${userId}`);
    console.log(`[Performance Time] ${perfTime}ms`);
    console.log('[FINISHED IN]', `${new Date(time - matchTime).getMinutes()}m:${new Date(time - matchTime).getSeconds()}s:${new Date(time - matchTime).getMilliseconds()}ms`);
    let username = '';
    for (let i = 0; i < players.length; i++) {
      if (players[i].id === userId) {
        username = players[i].name;
      }
    }

    if (username) {
      for (let i = 0; i < clients.length; i++) {
        clients[i].emit('alertPlayers', username);
      }
    }
  });
});

// Loop game
gameTimer = setInterval(gameLoop, 1000 / 60);

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
