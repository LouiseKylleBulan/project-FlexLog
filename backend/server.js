const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'flexlog_super_secret';

const pool = new Pool({
    user: process.env.POSTGRES_USER || 'postgres',
    host: process.env.DB_HOST || 'db',
    database: process.env.POSTGRES_DB || 'flexlog_db',
    password: process.env.POSTGRES_PASSWORD || 'secret',
    port: 5432,
});

app.use(express.json());

// --- Middleware: Verify JWT ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Access denied" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = user;
        next();
    });
};

// --- Auth Routes ---
app.get('/api/me', authenticateToken, (req, res) => {
    // req.user is populated by the middleware
    res.json(req.user);
});

app.post('/api/auth/signup', async (req, res) => {
    const { username, email, password } = req.body; 
    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (user_name, user_email, user_pass) VALUES ($1, $2, $3) RETURNING user_id, user_name',
            [username, email, hash] 
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Registration failed" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE user_email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.user_pass);
        if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

        // Sign the JWT with user data
        const token = jwt.sign(
            { user_id: user.user_id, user_name: user.user_name }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );

        res.json({ token, user: { user_id: user.user_id, user_name: user.user_name } });
    } catch (err) {
        res.status(500).json({ error: "Login failed" });
    }
});

// --- Routine Routes ---
app.get('/api/routines', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM routine_templates WHERE user_id = $1', [req.user.user_id]);
        res.json({ routines: result.rows });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

app.post('/api/routines/update', authenticateToken, async (req, res) => {
    const { routines } = req.body;
    try {
        // Iterate through the keys (Monday, Tuesday, etc.) sent from the frontend
        for (const day in routines) {
            const r = routines[day];
            await pool.query(
                `INSERT INTO routine_templates (user_id, day_of_week, rt_name, exercises) 
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (user_id, day_of_week) 
                 DO UPDATE SET rt_name = EXCLUDED.rt_name, exercises = EXCLUDED.exercises`,
                [req.user.user_id, day, r.name, JSON.stringify(r.exercises)] // day is now 'Monday', etc.
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Update Error:", err.message);
        res.status(500).json({ error: "Failed to save routines" });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});