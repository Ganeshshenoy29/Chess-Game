const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const games = {};
const players = {};

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("createRoom", (roomId) => {
    games[roomId] = new Chess();
    players[roomId] = [{ id: socket.id, color: 'w' }];
    
    socket.join(roomId);
    socket.emit("roomCreated");
    socket.emit("playerColor", "w");
    socket.emit("gameState", games[roomId].fen());
    
    console.log(`Room ${roomId} created by ${socket.id}`);
  });

  socket.on("joinRoom", (roomId) => {
    console.log(`${socket.id} trying to join room ${roomId}`);
    
    if (!games[roomId]) {
      console.log(`Room ${roomId} not found`);
      socket.emit("roomNotFound");
      return;
    }

    if (players[roomId].length >= 2) {
      console.log(`Room ${roomId} is full`);
      socket.emit("roomFull");
      return;
    }

    players[roomId].push({ id: socket.id, color: 'b' });
    socket.join(roomId);
    
    socket.emit("playerColor", "b");
    socket.emit("gameState", games[roomId].fen());
    
    io.to(roomId).emit("gameStart");
    
    console.log(`${socket.id} joined room ${roomId} as Black`);
  });

  socket.on("rejoinGame", (roomId) => {
    console.log(`${socket.id} trying to rejoin ${roomId}`);
  
    if (!games[roomId]) {
      socket.emit("roomNotFound");
      return;
    }
  
    // 🚫 BLOCK spectators
    if (players[roomId].length >= 2) {
      socket.emit("roomFull");
      console.log(`Spectator blocked from room ${roomId}`);
      return;
    }
  
    // Assign color
    let color = "w";
    if (players[roomId].length === 1) {
      color = players[roomId][0].color === "w" ? "b" : "w";
    }
  
    players[roomId].push({ id: socket.id, color });
    socket.join(roomId);
  
    socket.emit("playerColor", color);
    socket.emit("gameState", games[roomId].fen());
  
    console.log(`Rejoined ${roomId} as ${color}`);
  });
  
  

  socket.on("move", ({ roomId, move }) => {
    const game = games[roomId];
    if (!game) return;

    try {
      if (move.from === move.to) return;
      
      const result = game.move(move);
      if (result) {
        io.to(roomId).emit("gameState", game.fen());
        console.log(`Move in ${roomId}: ${move.from} → ${move.to}`);
      }
    } catch (err) {
      console.log("Invalid move:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    
    for (let roomId in players) {
      const index = players[roomId].findIndex(p => p.id === socket.id);
      if (index !== -1) {
        players[roomId].splice(index, 1);
        io.to(roomId).emit("playerDisconnected");
        
        // if (players[roomId].length === 0) {
        //   delete games[roomId];
        //   delete players[roomId];
        //   console.log(`Room ${roomId} deleted`);
        // }
        break;
      }
    }
  });
});

server.listen(3000, () => {
  console.log("✅ Server running on http://localhost:3000/lobby.html");
});