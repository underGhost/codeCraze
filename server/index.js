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

io.on('connection', (socketConnection) => {
  socket = socketConnection;

  socket.on('startGame', (time) => {
    console.log('Starting the game!');
    gameTimer = time;
  });

  socket.on('success', (user, perfTime, time) => {
    console.log(`[Winner] ${user}`);
    console.log(`[Performance Time] ${perfTime}ms`);
    console.log(time);
    console.log(gameTimer);
    console.log('[FINISHED IN]', `${new Date(time - gameTimer).getMinutes()}m:${new Date(time - gameTimer).getSeconds()}s:${new Date(time - gameTimer).getMilliseconds()}ms`);
  });
});

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
