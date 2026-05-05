import express from "express";
import cors from "cors";
import pkg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

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

io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication error: No token provided."));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error("Authentication error: Invalid token."));

    socket.user = decoded;
    next();
  });
});

const activeRooms = {};

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.user.username} (${socket.id})`);

  const updateRoomUsers = async (roomCode) => {
    const sockets = await io.in(roomCode).fetchSockets();
    const users = sockets.map(s => ({
      id: s.id,
      username: s.user.username,
      character: s.characterInfo || null
    }));
    io.to(roomCode).emit("room_users_update", users);
  };

  socket.on("create_lobby", async (characterInfo) => {
    const roomCode = uuidv4().substring(0, 5).toUpperCase();
    const userId = socket.user.id;
    const username = socket.user.username;

    socket.characterInfo = characterInfo || null;

    try {
      const initialTokens = {
        'party_token': { id: 'party_token', name: 'The Party', owner: 'party', x: 50, y: 50, color: 'bg-primary text-white font-bold', isParty: true }
      };

      await pool.query(
        `INSERT INTO "tblCampaigns" (dm_id, join_code, world_map_url, battle_map_url, is_combat, tokens)
             VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, roomCode, '', '', false, initialTokens]
      );

      activeRooms[roomCode] = {
        host: username,
        worldMapUrl: "",
        battleMapUrl: "",
        isCombat: false,
        tokens: initialTokens,
        proposedMoves: {},
        bannedUsers: []
      };

      socket.join(roomCode);
      socket.emit("lobby_created", roomCode);
      socket.emit("room_state", {
        host: username,
        worldMapUrl: "",
        battleMapUrl: "",
        isCombat: false,
        tokens: initialTokens
      });
      console.log(`Campaign saved and lobby created: ${roomCode} by ${username}`);

      await updateRoomUsers(roomCode);
    } catch (err) {
      console.error("Failed to create campaign in DB:", err);
      socket.emit("room_update", "Error creating campaign in database.");
    }
  });

  socket.on("join_lobby", async (roomCode, characterInfo) => {
    // Prevent banned users from joining if room is in memory
    if (activeRooms[roomCode] && activeRooms[roomCode].bannedUsers && activeRooms[roomCode].bannedUsers.includes(socket.user.username)) {
      socket.emit("kicked_from_lobby", "You are banned from this campaign and cannot rejoin.");
      return;
    }

    if (!activeRooms[roomCode]) {
      try {
        const result = await pool.query(
          `SELECT c.*, u."UserName" as host_name 
                 FROM "tblCampaigns" c 
                 JOIN "tblUsers" u ON c.dm_id = u.id 
                 WHERE c.join_code = $1`,
          [roomCode]
        );

        if (result.rows.length > 0) {
          const dbRoom = result.rows[0];
          const bannedUsers = dbRoom.banned_users || [];
          
          if (bannedUsers.includes(socket.user.username)) {
            socket.emit("kicked_from_lobby", "You are banned from this campaign and cannot rejoin.");
            return;
          }

          activeRooms[roomCode] = {
            host: dbRoom.host_name,
            worldMapUrl: dbRoom.world_map_url || "",
            battleMapUrl: dbRoom.battle_map_url || "",
            isCombat: dbRoom.is_combat,
            tokens: dbRoom.tokens || {},
            proposedMoves: {},
            bannedUsers: bannedUsers
          };
          console.log(`Recovered room ${roomCode} from database.`);
        } else {
          socket.emit("room_update", `Error: Campaign ${roomCode} does not exist.`);
          return;
        }
      } catch (err) {
        console.error("Database fetch error:", err);
        return;
      }
    }

    socket.join(roomCode);
    socket.characterInfo = characterInfo || null;

    io.to(roomCode).emit("room_update", `${socket.user.username} joined lobby ${roomCode}!`);
    console.log(`User ${socket.user.username} joined lobby: ${roomCode}`);

    await updateRoomUsers(roomCode);

    socket.emit("room_state", {
      host: activeRooms[roomCode].host,
      worldMapUrl: activeRooms[roomCode].worldMapUrl,
      battleMapUrl: activeRooms[roomCode].battleMapUrl,
      isCombat: activeRooms[roomCode].isCombat,
      tokens: activeRooms[roomCode].tokens
    });
  });

  const saveCampaign = async (roomCode, room) => {
    try {
      const tokenJson = JSON.stringify(room.tokens);
      const result = await pool.query(
        `UPDATE "tblCampaigns" 
         SET world_map_url = $1, battle_map_url = $2, is_combat = $3, tokens = $4 
         WHERE join_code = $5`,
        [room.worldMapUrl, room.battleMapUrl, room.isCombat, tokenJson, roomCode]
      );
      return result.rowCount > 0;
    } catch (err) {
      console.error("[VTT] Database Save Error:", err);
      return false;
    }
  };

  socket.on("save_campaign", async (roomCode) => {
    console.log(`[VTT] Save requested for room: ${roomCode} by ${socket.user.username}`);

    if (!activeRooms[roomCode]) {
      console.log(`[VTT] Error: Room ${roomCode} not found in active RAM.`);
      socket.emit("room_update", "❌ Cannot save: Campaign is not active in server memory. Please go to the hub and create a new campaign.");
      return;
    }

    if (activeRooms[roomCode].host !== socket.user.username) {
      console.log(`[VTT] Error: ${socket.user.username} tried to save, but host is ${activeRooms[roomCode].host}`);
      socket.emit("room_update", "❌ Only the DM can save the campaign.");
      return;
    }

    const success = await saveCampaign(roomCode, activeRooms[roomCode]);
    if (success) {
      io.to(roomCode).emit("room_update", "💾 The DM has saved the campaign state.");
      console.log(`[VTT] Campaign ${roomCode} successfully saved to DB.`);
    } else {
      socket.emit("room_update", "❌ Save failed: Database error or campaign does not exist.");
    }
  });

  socket.on("update_map_url", (roomCode, mapType, newUrl) => {
    console.log(`[VTT] update_map_url called by ${socket.user.username} for room ${roomCode}. Type: ${mapType}, URL: ${newUrl}`);
    if (!activeRooms[roomCode]) {
      console.log(`[VTT] update_map_url failed: Room ${roomCode} not active.`);
      return;
    }

    if (activeRooms[roomCode].host === socket.user.username) {
      if (mapType === 'world') activeRooms[roomCode].worldMapUrl = newUrl;
      if (mapType === 'battle') activeRooms[roomCode].battleMapUrl = newUrl;

      io.to(roomCode).emit("map_updated", mapType, newUrl);
      console.log(`[VTT] map_updated emitted for ${mapType} to ${newUrl}`);
    } else {
      console.log(`[VTT] update_map_url failed: ${socket.user.username} is not the host (${activeRooms[roomCode].host})`);
    }
  });

  socket.on("toggle_combat", (roomCode, combatState) => {
    if (!activeRooms[roomCode]) return;

    if (activeRooms[roomCode].host === socket.user.username) {
      activeRooms[roomCode].isCombat = combatState;
      io.to(roomCode).emit("combat_toggled", combatState);
    }
  });

  socket.on("setup_combat", async (roomCode, config) => {
    console.log(`[VTT] setup_combat called by ${socket.user.username} for room ${roomCode}`);
    if (!activeRooms[roomCode]) {
      console.log(`[VTT] setup_combat failed: Room ${roomCode} not active.`);
      return;
    }
    if (activeRooms[roomCode].host !== socket.user.username) {
      console.log(`[VTT] setup_combat failed: ${socket.user.username} is not the host (${activeRooms[roomCode].host})`);
      return;
    }

    const room = activeRooms[roomCode];
    console.log(`[VTT] setup_combat config:`, config);

    // Set map if provided
    if (config.mapUrl) {
      room.battleMapUrl = config.mapUrl;
      io.to(roomCode).emit("map_updated", 'battle', config.mapUrl);
    }

    // Spawn enemies
    const enemies = [];
    if (config.enemyGroups && config.enemyGroups.length > 0) {
      config.enemyGroups.forEach(group => {
        if (group.count > 0 && group.name) {
          for (let i = 0; i < group.count; i++) {
            const id = `tok_${uuidv4()}`;
            const finalName = group.count > 1 ? `${group.name} ${i + 1}` : group.name;

            const enemyToken = {
              id,
              name: finalName,
              owner: room.host,
              x: 80 - (Math.random() * 10),
              y: 80 - (Math.random() * 10),
              color: 'bg-error text-white',
              dex: group.dex || 0,
              isParty: false
            };
            room.tokens[id] = enemyToken;
            enemies.push(enemyToken);
          }
        }
      });
    }

    // Auto-spawn players if they don't have a token on the board
    const sockets = await io.in(roomCode).fetchSockets();
    sockets.forEach((s, index) => {
      if (s.user.username === room.host) return;
      const existingToken = Object.values(room.tokens).find(t => t.owner === s.user.username && !t.isParty);
      if (!existingToken) {
        const id = `tok_${uuidv4()}`;
        const maxHp = s.characterInfo?.core_stats?.MaxHP || 10;
        room.tokens[id] = {
          id,
          name: s.characterInfo ? s.characterInfo.character_name : s.user.username,
          owner: s.user.username,
          x: 10 + (index * 10),
          y: 90,
          color: 'bg-info text-white',
          hp: maxHp,
          maxHp: maxHp,
          dex: s.characterInfo?.core_stats?.DEX || 0,
          isParty: false
        };
      }
    });

    // Roll initiative 
    const initiativeRolls = [];
    Object.values(room.tokens).forEach(token => {
      if (token.isParty) return;

      let dexModifier = 0;
      if (token.owner === room.host) {
        dexModifier = token.dex || 0;
      } else {
        dexModifier = token.dex || 0;
      }

      const roll = Math.floor(Math.random() * 20) + 1;
      const total = roll + dexModifier;

      initiativeRolls.push({
        tokenId: token.id,
        name: token.name,
        roll: roll,
        total: total
      });
    });

    // Sort descending by total
    initiativeRolls.sort((a, b) => b.total - a.total);

    room.turnOrder = initiativeRolls.map(r => r.tokenId);
    room.currentTurnIndex = 0;
    room.isCombat = true;

    io.to(roomCode).emit("board_update", room.tokens);
    io.to(roomCode).emit("combat_toggled", true);
    io.to(roomCode).emit("turn_order_update", {
      order: room.turnOrder,
      currentIndex: room.currentTurnIndex,
      rolls: initiativeRolls
    });
    console.log(`[VTT] setup_combat completed and events emitted for ${roomCode}`);
  });

  socket.on("next_turn", (roomCode) => {
    if (!activeRooms[roomCode] || activeRooms[roomCode].host !== socket.user.username) return;
    const room = activeRooms[roomCode];

    if (room.turnOrder && room.turnOrder.length > 0) {
      room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
      io.to(roomCode).emit("turn_order_update", {
        order: room.turnOrder,
        currentIndex: room.currentTurnIndex
      });
    }
  });

  socket.on("end_combat", (roomCode) => {
    if (!activeRooms[roomCode] || activeRooms[roomCode].host !== socket.user.username) return;

    // Remove all non-party tokens at the end of combat
    Object.keys(activeRooms[roomCode].tokens).forEach(tokenId => {
      if (!activeRooms[roomCode].tokens[tokenId].isParty) {
        delete activeRooms[roomCode].tokens[tokenId];
      }
    });

    activeRooms[roomCode].isCombat = false;
    activeRooms[roomCode].turnOrder = [];
    activeRooms[roomCode].currentTurnIndex = 0;
    activeRooms[roomCode].isPartySplit = false;

    io.to(roomCode).emit("board_update", activeRooms[roomCode].tokens);
    io.to(roomCode).emit("party_split_toggled", false);
    io.to(roomCode).emit("combat_toggled", false);
  });

  socket.on("toggle_party_split", async (roomCode, isSplit) => {
    if (!activeRooms[roomCode] || activeRooms[roomCode].host !== socket.user.username) return;
    activeRooms[roomCode].isPartySplit = isSplit;

    if (isSplit) {
      const sockets = await io.in(roomCode).fetchSockets();
      sockets.forEach((s, index) => {
        if (s.user.username === activeRooms[roomCode].host) return;
        const existingToken = Object.values(activeRooms[roomCode].tokens).find(t => t.owner === s.user.username && !t.isParty);
        if (!existingToken) {
          const id = `tok_${uuidv4()}`;
          const maxHp = s.characterInfo?.core_stats?.MaxHP || 10;
          activeRooms[roomCode].tokens[id] = {
            id,
            name: s.characterInfo ? s.characterInfo.character_name : s.user.username,
            owner: s.user.username,
            x: 10 + (index * 5),
            y: 50,
            color: 'bg-info text-white',
            hp: maxHp,
            maxHp: maxHp,
            dex: s.characterInfo?.core_stats?.DEX || 0,
            isParty: false
          };
        }
      });
      io.to(roomCode).emit("board_update", activeRooms[roomCode].tokens);
    }

    io.to(roomCode).emit("party_split_toggled", isSplit);
  });

  socket.on("spawn_token", (roomCode, tokenData) => {
    if (!activeRooms[roomCode]) return;
    activeRooms[roomCode].tokens[tokenData.id] = tokenData;
    io.to(roomCode).emit("board_update", activeRooms[roomCode].tokens);
  });

  socket.on("move_token", (roomCode, { id, x, y }) => {
    if (!activeRooms[roomCode] || !activeRooms[roomCode].tokens[id]) return;
    activeRooms[roomCode].tokens[id].x = x;
    activeRooms[roomCode].tokens[id].y = y;
    io.to(roomCode).emit("board_update", activeRooms[roomCode].tokens);
  });

  socket.on("propose_move", (roomCode, { id, x, y }) => {
    if (!activeRooms[roomCode] || !activeRooms[roomCode].tokens[id]) return;
    activeRooms[roomCode].proposedMoves[id] = { x, y };
    io.to(roomCode).emit("proposed_move_update", activeRooms[roomCode].proposedMoves);
  });

  socket.on("resolve_move", (roomCode, tokenId, approved) => {
    if (!activeRooms[roomCode] || activeRooms[roomCode].host !== socket.user.username) return;

    const proposed = activeRooms[roomCode].proposedMoves[tokenId];
    if (proposed && approved) {
      activeRooms[roomCode].tokens[tokenId].x = proposed.x;
      activeRooms[roomCode].tokens[tokenId].y = proposed.y;
      io.to(roomCode).emit("board_update", activeRooms[roomCode].tokens);
    }

    delete activeRooms[roomCode].proposedMoves[tokenId];
    io.to(roomCode).emit("proposed_move_update", activeRooms[roomCode].proposedMoves);
  });

  socket.on("delete_token", (roomCode, tokenId) => {
    if (!activeRooms[roomCode] || !activeRooms[roomCode].tokens[tokenId]) return;

    const token = activeRooms[roomCode].tokens[tokenId];

    if (activeRooms[roomCode].host === socket.user.username || token.owner === socket.user.username) {
      delete activeRooms[roomCode].tokens[tokenId];
      io.to(roomCode).emit("board_update", activeRooms[roomCode].tokens);
    }
  });

  socket.on("send_message", (roomCode, message) => {
    io.to(roomCode).emit("receive_message", {
      username: socket.user.username,
      text: message
    });
  });

  socket.on("update_hp", (roomCode, tokenId, newHp) => {
    if (!activeRooms[roomCode] || !activeRooms[roomCode].tokens[tokenId]) return;

    const token = activeRooms[roomCode].tokens[tokenId];
    if (activeRooms[roomCode].host === socket.user.username || token.owner === socket.user.username) {
      token.hp = newHp;
      io.to(roomCode).emit("board_update", activeRooms[roomCode].tokens);
    }
  });

  socket.on("roll_dice", (roomCode, diceString) => {
    let total = 0;
    let rollDetails = [];

    try {
      const terms = diceString.replace(/\s+/g, '').match(/[+-]?[^+-]+/g);
      if (!terms) throw new Error("Invalid dice format");

      terms.forEach(term => {
        const sign = term.startsWith('-') ? -1 : 1;
        const cleanTerm = term.replace(/^[+-]/, '');

        if (cleanTerm.includes('d')) {
          const [countStr, typeStr] = cleanTerm.split('d');
          const count = parseInt(countStr) || 1;
          const type = parseInt(typeStr) || 20;

          if (count > 50 || type > 100) throw new Error("Dice limits exceeded");

          let termTotal = 0;
          let termRolls = [];
          for (let i = 0; i < count; i++) {
            const roll = Math.floor(Math.random() * type) + 1;
            termRolls.push(roll);
            termTotal += roll;
          }

          total += sign * termTotal;
          rollDetails.push(`${sign < 0 ? '-' : '+'}[${termRolls.join(",")}]`);
        } else {
          const num = parseInt(cleanTerm);
          if (!isNaN(num)) {
            total += sign * num;
            rollDetails.push(`${sign < 0 ? '-' : '+'}${num}`);
          }
        }
      });

      let detailStr = rollDetails.join(" ");
      if (detailStr.startsWith('+')) detailStr = detailStr.substring(1);

      const message = `🎲 rolled ${diceString}: ${detailStr} = **${total}**`;

      io.to(roomCode).emit("receive_message", {
        username: socket.user.username,
        text: message
      });
    } catch (err) {
      socket.emit("receive_message", {
        username: "System",
        text: `❌ Error parsing dice: Use format like '2d6 + 1d4 + 2'`
      });
    }
  });

  const handleDisbandOrLeave = async (roomCode, socketId, username) => {
    if (!activeRooms[roomCode]) return;

    if (activeRooms[roomCode].host === username) {
      // Host leaves -> Disband
      await saveCampaign(roomCode, activeRooms[roomCode]);
      io.to(roomCode).emit("lobby_disbanded", "The host has left. The lobby has been disbanded and progress saved.");
      delete activeRooms[roomCode];
    } else {
      // Player leaves
      io.to(roomCode).emit("room_update", `${username} left the lobby.`);
      const sockets = await io.in(roomCode).fetchSockets();
      const users = sockets
        .filter(s => s.id !== socketId)
        .map(s => ({ id: s.id, username: s.user.username, character: s.characterInfo || null }));

      io.to(roomCode).emit("room_users_update", users);
    }
  };

  socket.on("leave_lobby", async (roomCode) => {
    await handleDisbandOrLeave(roomCode, socket.id, socket.user.username);
    socket.leave(roomCode);
  });

  socket.on("kick_player", async (roomCode, targetSocketId) => {
    if (!activeRooms[roomCode] || activeRooms[roomCode].host !== socket.user.username) return;

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      const username = targetSocket.user.username;
      
      if (!activeRooms[roomCode].bannedUsers) activeRooms[roomCode].bannedUsers = [];
      if (!activeRooms[roomCode].bannedUsers.includes(username)) {
        activeRooms[roomCode].bannedUsers.push(username);
      }

      try {
        await pool.query(
          `UPDATE "tblCampaigns" SET banned_users = $1 WHERE join_code = $2`,
          [JSON.stringify(activeRooms[roomCode].bannedUsers), roomCode]
        );
      } catch (err) {
        console.error("Failed to update banned_users in DB:", err);
      }

      io.to(targetSocketId).emit("kicked_from_lobby", "You have been kicked from the campaign by the DM.");
      targetSocket.leave(roomCode);
      await handleDisbandOrLeave(roomCode, targetSocketId, username);
    }
  });

  socket.on("disconnecting", async () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        await handleDisbandOrLeave(room, socket.id, socket.user.username);
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "tblCharacters" (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES "tblUsers"(id) ON DELETE CASCADE,
        character_name VARCHAR(255) NOT NULL,
        game_system VARCHAR(50) NOT NULL,
        core_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
        custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "tblCampaigns" (
        id SERIAL PRIMARY KEY,
        dm_id INTEGER REFERENCES "tblUsers"(id) ON DELETE CASCADE,
        join_code VARCHAR(10) UNIQUE NOT NULL,
        world_map_url TEXT DEFAULT '',
        battle_map_url TEXT DEFAULT '',
        is_combat BOOLEAN DEFAULT false,
        tokens JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    res.send("tblUsers, tblCharacters, and tblCampaigns tables created/verified!");
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
    const token = jwt.sign({ id: user.id, username: user.UserName }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({ user, token });
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
      const token = jwt.sign({ id: user.id, username: user.UserName }, process.env.JWT_SECRET, { expiresIn: '24h' });
      res.json({ success: true, user, token });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.status(401).json({ error: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

app.post("/api/characters", authenticateToken, async (req, res) => {
  const { name, game_system, core_stats, custom_fields } = req.body;
  const userId = req.user.id;

  try {
    if (!name || !game_system) {
      return res.status(400).json({ error: "Character name and game system are required." });
    }

    if (game_system === 'DND5E') {
      if (!core_stats || typeof core_stats.DEX !== 'number' || typeof core_stats.Speed !== 'number') {
        return res.status(400).json({ error: "D&D 5e requires valid DEX and Speed numbers." });
      }
    }

    const result = await pool.query(
      `INSERT INTO "tblCharacters" (user_id, character_name, game_system, core_stats, custom_fields) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [userId, name, game_system, core_stats || {}, custom_fields || {}]
    );

    res.status(201).json({ success: true, characterId: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/characters", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      'SELECT * FROM "tblCharacters" WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json({ success: true, characters: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

httpServer.listen(3000, () => {
  console.log("Server & WebSockets running on http://localhost:3000");
});