import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
// --- ADDED FOR SOCKET.IO ---
import { createServer } from 'http'; 
import { Server } from 'socket.io'; 
// ---------------------------

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// --- ADDED FOR SOCKET.IO ---
// Wrap the Express app in a standard HTTP server to allow WebSockets
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // Allow your React frontend to connect
    methods: ["GET", "POST"]
  }
});

// The Lobby Logic
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // When a user clicks "Create Lobby"
  socket.on('create_lobby', () => {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    socket.join(roomCode); 
    socket.emit('lobby_created', roomCode); 
    console.log(`Lobby created: ${roomCode}`);
  });

  // When a user types in a code and clicks "Join Lobby"
  socket.on('join_lobby', (roomCode) => {
    socket.join(roomCode); 
    io.to(roomCode).emit('room_update', `A new player joined lobby ${roomCode}!`);
    console.log(`User ${socket.id} joined lobby: ${roomCode}`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});
// ---------------------------

// 1. NEON CONNECTION STRING (Get this from your Neon Dashboard)
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: true,
});

// 2. CREATE TABLE (Run this once to set up your DB)
app.get('/setup-db', async (req, res) => {
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

// 3. SIGNUP ROUTE
app.post('/api/signup', async (req, res) => {
    const { email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Map 'email' to 'UserName' and 'password' to 'UserPassword'
        const result = await pool.query(
            'INSERT INTO "tblUsers" ("UserName", "UserPassword") VALUES ($1, $2) RETURNING *',
            [email, hashedPassword]
        );

        const user = result.rows[0];
        delete user.UserPassword; // Secure the response

        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. LOGIN ROUTE (Updated for tblUsers)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Search using the UserName column
        const result = await pool.query(
            'SELECT * FROM "tblUsers" WHERE "UserName" = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const user = result.rows[0];

        // Compare against the UserPassword column
        const validPassword = await bcrypt.compare(password, user.UserPassword);

        if (validPassword) {
            delete user.UserPassword;
            res.json({ success: true, user });
        } else {
            res.status(401).json({ error: "Invalid credentials" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Initialize a dedicated schema and two tables for character fields and values
// Initialize a dedicated schema and three normalized tables for characters, fields, and values
async function initCharacterSchema() {
    const schemaName = 'character_schema';
    try {
        await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);

        // 1. Core characters table to generate and store CharacterID
        await pool.query(`
            CREATE TABLE IF NOT EXISTS "${schemaName}"."tblCharacters" (
                "id" SERIAL PRIMARY KEY,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Field Definitions (Names) table linking to Character
        await pool.query(`
            CREATE TABLE IF NOT EXISTS "${schemaName}"."tblCharacterFields" (
                "id" SERIAL PRIMARY KEY,
                "character_id" INTEGER REFERENCES "${schemaName}"."tblCharacters"("id") ON DELETE CASCADE,
                "field_index" INTEGER NOT NULL,
                "field_name" VARCHAR(255) NOT NULL,
                UNIQUE("character_id", "field_index")
            );
        `);

        // 3. Field Values table linking to Character
        await pool.query(`
            CREATE TABLE IF NOT EXISTS "${schemaName}"."tblCharacterFieldValues" (
                "id" SERIAL PRIMARY KEY,
                "character_id" INTEGER REFERENCES "${schemaName}"."tblCharacters"("id") ON DELETE CASCADE,
                "field_index" INTEGER NOT NULL,
                "field_value" TEXT NOT NULL,
                UNIQUE("character_id", "field_index")
            );
        `);

        console.log(`Character schema and normalized tables ensured in schema: ${schemaName}`);
    } catch (err) {
        console.error('Error initializing character schema/tables:', err.message || err);
    }
}
initCharacterSchema();

// Create character row (server-generated integer id if none provided)
app.post('/api/characters', async (req, res) => {
    let { characterId } = req.body;
    try {
        if (characterId === undefined || characterId === null || characterId === '') {
            // create new character row to generate id
            const result = await pool.query('INSERT INTO "character_schema"."tblCharacters" DEFAULT VALUES RETURNING "id"');
            const newId = result.rows[0].id;
            return res.json({ success: true, characterId: newId });
        }

        const numericId = Number(characterId);
        if (!Number.isInteger(numericId) || numericId <= 0) return res.status(400).json({ error: 'characterId must be a positive integer or omitted' });

        // allow client-provided id: insert into tblCharacters if not exists
        await pool.query('INSERT INTO "character_schema"."tblCharacters" ("id") VALUES ($1) ON CONFLICT ("id") DO NOTHING', [numericId]);
        
        res.json({ success: true, characterId: numericId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Save Character Fields (Names)
app.post('/api/character-fields', async (req, res) => {
    const { characterId, fields } = req.body;
    try {
        const numericId = Number(characterId);
        if (!Number.isInteger(numericId) || numericId <= 0) return res.status(400).json({ error: 'Invalid characterId' });

        // fields object looks like: { "Field1": "Weight", "Field2": "Height" }
        for (const [key, name] of Object.entries(fields)) {
            const match = key.match(/^Field(\d+)$/);
            if (match) {
                const fieldIndex = parseInt(match[1], 10);
                await pool.query(
                    `INSERT INTO "character_schema"."tblCharacterFields" ("character_id", "field_index", "field_name") 
                     VALUES ($1, $2, $3) 
                     ON CONFLICT ("character_id", "field_index") 
                     DO UPDATE SET "field_name" = EXCLUDED."field_name"`,
                    [numericId, fieldIndex, name]
                );
            }
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Save Character Field Values
app.post('/api/character-values', async (req, res) => {
    const { characterId, values } = req.body;
    try {
        const numericId = Number(characterId);
        if (!Number.isInteger(numericId) || numericId <= 0) return res.status(400).json({ error: 'Invalid characterId' });

        // values object looks like: { "Value1": "85 pounds", "Value2": "5'10\"" }
        for (const [key, value] of Object.entries(values)) {
            const match = key.match(/^Value(\d+)$/);
            if (match) {
                const fieldIndex = parseInt(match[1], 10);
                await pool.query(
                    `INSERT INTO "character_schema"."tblCharacterFieldValues" ("character_id", "field_index", "field_value") 
                     VALUES ($1, $2, $3) 
                     ON CONFLICT ("character_id", "field_index") 
                     DO UPDATE SET "field_value" = EXCLUDED."field_value"`,
                    [numericId, fieldIndex, value]
                );
            }
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
// --- CHANGED FOR SOCKET.IO ---
// We now listen on the httpServer instead of the express app
httpServer.listen(3000, () => {
  console.log('Server & WebSockets running on http://localhost:3000');
});