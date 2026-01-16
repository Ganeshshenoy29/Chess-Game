const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Chess } = require("chess.js");
const cors = require("cors");

const players = {}; // roomId -> [socketId]

const app = express();
app.use(cors());

const path = require("path");
app.use(express.static(path.join(__dirname)));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const games = {}; // roomId -> chess instance

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  socket.on("joinGame", (roomId) => {

    // create room if not exists
    if (!games[roomId]) {
      games[roomId] = new Chess();
      players[roomId] = [];
      console.log("New game created:", roomId);
    }
  
    // 🚫 room full
    if (players[roomId].length >= 2) {
      socket.emit("roomFull");
      return;
    }
  
    socket.join(roomId);
    players[roomId].push(socket.id);
  
    let color = null;
    if (players[roomId][0] === socket.id) color = "w";
    else if (players[roomId][1] === socket.id) color = "b";
  
    socket.emit("playerColor", color);
    socket.emit("gameState", games[roomId].fen());
  });
  
  

  socket.on("move", ({ roomId, move }) => {
    const game = games[roomId];
    if (!game) return;
  
    try {
      // 🚫 prevent from == to
      if (move.from === move.to) return;
  
      const result = game.move(move);
  
      if (result) {
        io.to(roomId).emit("gameState", game.fen());
      }
    } catch (err) {
      console.log("Invalid move ignored:", move);
    }
  });
  

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
  });
});

server.listen(3000, () => {
  console.log("✅ Chess server running on http://localhost:3000");
});
