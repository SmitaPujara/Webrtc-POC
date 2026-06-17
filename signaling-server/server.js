const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

function getRoomSize(roomId) {
  return io.sockets.adapter.rooms.get(roomId)?.size ?? 0;
}

function emitRoomCount(roomId) {
  io.to(roomId).emit('room-count', getRoomSize(roomId));
}

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);
  let currentRoom = null;

  socket.on('join-room', (roomId) => {
    if (currentRoom) {
      socket.leave(currentRoom);
    }

    currentRoom = roomId;
    socket.join(roomId);
    console.log(`${socket.id} joined room ${roomId}`);
    emitRoomCount(roomId);
  });

  socket.on('offer', (offer) => {
    if (!currentRoom) {
      return;
    }

    socket.to(currentRoom).emit('offer', offer);
  });

  socket.on('answer', (answer) => {
    if (!currentRoom) {
      return;
    }

    socket.to(currentRoom).emit('answer', answer);
  });

  socket.on('ice-candidate', (candidate) => {
    if (!currentRoom) {
      return;
    }

    socket.to(currentRoom).emit('ice-candidate', candidate);
  });

  socket.on('hangup', () => {
    if (!currentRoom) {
      return;
    }

    socket.to(currentRoom).emit('hangup');
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      emitRoomCount(currentRoom);
    }

    console.log('Disconnected:', socket.id);
  });
});

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
