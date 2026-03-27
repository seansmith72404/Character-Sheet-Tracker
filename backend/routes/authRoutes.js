const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const router = express.Router();

// --- REGISTER ROUTE ---
router.post('/signup', async (req, res) => {
    const { email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await db.query(
            'INSERT INTO Users (email, password_hash) VALUES ($1, $2) RETURNING userID, email',
            [email, hashedPassword]
        );
        res.status(201).json({ message: "User created!", user: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') { // Postgres unique violation code
            return res.status(400).json({ error: "Email already exists." });
        }
        res.status(500).json({ error: "Server error during registration." });
    }
});

// --- LOGIN ROUTE ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // 1. Find the user
        const result = await db.query('SELECT * FROM Users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        const user = result.rows[0];

        // 2. Check the password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        // 3. Create the VIP Pass (JWT)
        const token = jwt.sign({ userID: user.userid }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ message: "Logged in successfully!", token });
    } catch (err) {
        res.status(500).json({ error: "Server error during login." });
    }
});

module.exports = router;