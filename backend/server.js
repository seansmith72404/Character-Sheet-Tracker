import express from "express";
import cors from "cors";
import pkg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken"; // <-- Imported JWT
import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// --- JWT SOCKET MIDDLEWARE ---
// This blocks any socket connection that doesn't provide a valid token
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error("Authentication error: No token provided."));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error("Authentication error: Invalid token."));
    
    // Attach the decoded user data (like username) directly to the socket
    socket.user = decoded; 
    next();
  });
});
// -----------------------------

// The Lobby Logic
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.user.username} (${socket.id})`);

  const updateRoomUsers = async (roomCode) => {
    const sockets = await io.in(roomCode).fetchSockets();
    const users = sockets.map(s => ({
      id: s.id,
      username: s.user.username
    }));
    io.to(roomCode).emit("room_users_update", users);
  };

  socket.on("create_lobby", async () => {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    socket.join(roomCode);
    socket.emit("lobby_created", roomCode);
    console.log(`Lobby created: ${roomCode} by ${socket.user.username}`);
    
    await updateRoomUsers(roomCode);
  });

  socket.on("join_lobby", async (roomCode) => {
    socket.join(roomCode);
    io.to(roomCode).emit(
      "room_update",
      `${socket.user.username} joined lobby ${roomCode}!`
    );
    console.log(`User ${socket.user.username} joined lobby: ${roomCode}`);
    
    await updateRoomUsers(roomCode);
  });

  // --- NEW CHAT LISTENER ---
  socket.on("send_message", (roomCode, message) => {
    io.to(roomCode).emit("receive_message", {
      username: socket.user.username,
      text: message
    });
  });
  // -------------------------

  socket.on("disconnecting", async () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        io.to(room).emit("room_update", `${socket.user.username} disconnected.`);
        
        const sockets = await io.in(room).fetchSockets();
        const users = sockets
          .filter(s => s.id !== socket.id)
          .map(s => ({ id: s.id, username: s.user.username }));
          
        io.to(room).emit("room_users_update", users);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

  
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: true,
});

app.get("/setup-db", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "tblUsers" (
        id SERIAL PRIMARY KEY,
        "UserName" VARCHAR(255) UNIQUE NOT NULL,
        "UserPassword" VARCHAR(255) NOT NULL
      );
    `);
    res.send("tblUsers database table created!");
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

app.post("/api/signup", async (req, res) => {
  const { email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO "tblUsers" ("UserName", "UserPassword") VALUES ($1, $2) RETURNING *',
      [email, hashedPassword],
    );

    const user = result.rows[0];
    delete user.UserPassword;

    // Generate the token
    const token = jwt.sign({ id: user.id, username: user.UserName }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({ user, token }); // Send token back to the frontend
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM "tblUsers" WHERE "UserName" = $1',
      [email],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.UserPassword);

    if (validPassword) {
      delete user.UserPassword;
      
      // Generate the token
      const token = jwt.sign({ id: user.id, username: user.UserName }, process.env.JWT_SECRET, { expiresIn: '24h' });
      
      res.json({ success: true, user, token }); // Send token back to the frontend
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

httpServer.listen(3000, () => {
  console.log("Server & WebSockets running on http://localhost:3000");
});