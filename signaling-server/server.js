require('dotenv').config();
require('./database/db');

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth.routes'));

const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

const users = new Map();

function broadcastUsers() {

  const list = [];

  users.forEach((user, username) => {

    list.push({
      username,
      status: user.status
    });

  });

  io.emit('users-list', list);

}

function getUser(username) {

  return users.get(username);

}

function setStatus(username, status) {

  const user = users.get(username);

  if (!user) return;

  user.status = status;

}

io.on('connection', (socket) => {

  console.log('Connected:', socket.id);

  /*
  ==========================
  LOGIN
  ==========================
  */

  socket.on('login', (username) => {

    users.set(username, {

      socketId: socket.id,
      status: 'ONLINE',
      calling: null

    });

    socket.username = username;

    console.log(`${username} logged in`);

    broadcastUsers();

  });

  /*
  ==========================
  CALL USER
  ==========================
  */

  socket.on('call-user', ({ to }) => {

    const caller = getUser(socket.username);
    const receiver = getUser(to);

    if (!caller || !receiver) {

      socket.emit('call-failed', 'User not found');

      return;

    }

    if (to === socket.username) {

      socket.emit('call-failed', 'You cannot call yourself');

      return;

    }

    if (caller.status !== 'ONLINE') {

      socket.emit('call-failed', 'You are already busy');

      return;

    }

    if (receiver.status !== 'ONLINE') {

      socket.emit('call-failed', 'User is busy');

      return;

    }

    caller.status = 'RINGING';
    receiver.status = 'RINGING';

    caller.calling = to;
    receiver.calling = socket.username;

    broadcastUsers();

    io.to(receiver.socketId).emit('incoming-call', {

      from: socket.username

    });

  });

  /*
  ==========================
  ACCEPT CALL
  ==========================
  */
   socket.on('accept-call', () => {

    const receiver = getUser(socket.username);

    if (!receiver || !receiver.calling) return;

    const caller = getUser(receiver.calling);

    if (!caller) return;

    receiver.status = 'BUSY';
    caller.status = 'BUSY';

    broadcastUsers();

    io.to(caller.socketId).emit('call-accepted');

  });

  /*
  ==========================
  REJECT CALL
  ==========================
  */

  socket.on('reject-call', () => {

    const receiver = getUser(socket.username);

    if (!receiver || !receiver.calling) return;

    const caller = getUser(receiver.calling);

    if (!caller) return;

    receiver.status = 'ONLINE';
    caller.status = 'ONLINE';

    receiver.calling = null;
    caller.calling = null;

    broadcastUsers();

    io.to(caller.socketId).emit('call-rejected');

  });

  /*
  ==========================
  CANCEL CALL (caller backs out while ringing)
  ==========================
  */

  socket.on('cancel-call', () => {

    console.log('CANCEL-CALL received from:', socket.username);

    const caller = getUser(socket.username);

    if (!caller || !caller.calling) return;

    const receiver = getUser(caller.calling);

    if (receiver) {

      receiver.status = 'ONLINE';
      receiver.calling = null;

      io.to(receiver.socketId).emit('call-cancelled');

    }

    caller.status = 'ONLINE';
    caller.calling = null;

    broadcastUsers();

  });

  /*
  ==========================
  OFFER
  ==========================
  */

  socket.on('offer', (offer) => {

    const caller = getUser(socket.username);

    if (!caller || !caller.calling) return;

    const receiver = getUser(caller.calling);

    if (!receiver) return;

    io.to(receiver.socketId).emit('offer', offer);

  });

  /*
  ==========================
  ANSWER
  ==========================
  */

  socket.on('answer', (answer) => {

    const receiver = getUser(socket.username);

    if (!receiver || !receiver.calling) return;

    const caller = getUser(receiver.calling);

    if (!caller) return;

    io.to(caller.socketId).emit('answer', answer);

  });

  /*
  ==========================
  ICE CANDIDATE
  ==========================
  */

  socket.on('ice-candidate', (candidate) => {

    const me = getUser(socket.username);

    if (!me || !me.calling) return;

    const other = getUser(me.calling);

    if (!other) return;

    io.to(other.socketId).emit('ice-candidate', candidate);

  });

  /*
  ==========================
  HANGUP
  ==========================
  */

  socket.on('hangup', () => {

    const me = getUser(socket.username);

    if (!me) return;

    if (me.calling) {

      const other = getUser(me.calling);

      if (other) {

        other.status = 'ONLINE';
        other.calling = null;

        io.to(other.socketId).emit('hangup');

      }

    }

    me.status = 'ONLINE';
    me.calling = null;

    broadcastUsers();

  });

  /*
  ==========================
  DISCONNECT
  ==========================
  */

  socket.on('disconnect', () => {

    console.log('Disconnected:', socket.id);

    if (!socket.username) return;

    const me = getUser(socket.username);

    if (me?.calling) {

      const other = getUser(me.calling);

      if (other) {

        other.status = 'ONLINE';
        other.calling = null;

        io.to(other.socketId).emit('hangup');

      }

    }

    users.delete(socket.username);

    broadcastUsers();

  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {

  console.log(`🚀 Server running on port ${PORT}`);

});