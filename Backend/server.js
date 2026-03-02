import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import bcrypt from 'bcryptjs';
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// 1. NEON CONNECTION STRING (Get this from your Neon Dashboard)
// It looks like: postgres://user:pass@ep-cool-site.us-east-2.aws.neon.tech/neondb?sslmode=require
const connectionString = 'postgresql://neondb_owner:npg_VB31zvbwAuSp@ep-nameless-sun-ai6wxnfb-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString,
  ssl: true,
});

// 2. CREATE TABLE (Run this once to set up your DB)
// You can also run this SQL directly in the Neon SQL Editor
app.get('/setup-db', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_accounts (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);
    res.send("Database table created!");
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

// 4. LOGIN ROUTE
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

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});