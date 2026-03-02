const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();
const port = 3000;

// PostgreSQL Connection
const pool = new Pool({
    user: process.env.POSTGRES_USER || 'postgres',
    host: process.env.DB_HOST || 'db', // Matches the service name in docker-compose
    database: process.env.POSTGRES_DB || 'flexlog_db',
    password: process.env.POSTGRES_PASSWORD || 'secret',
    port: 5432,
  });

app.use(express.json());

// Serve static assets (CSS, JS, Images) from the frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// --- HTML Page Routes ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/main.html'));
});

// --- API Endpoints ---

// GET Exercises for today
app.get('/api/exercises', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM DAILY_EXERCISES WHERE status != 'Deleted'");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST New Exercise (Log Activity)
app.post('/api/exercises', async (req, res) => {
  const { name, sets, reps } = req.body;
  const volume = sets * reps; // Calculate Progressive Overload
  try {
    const result = await pool.query(
      'INSERT INTO DAILY_EXERCISES (DE_NAME, actual_SETS, actual_REPS, total_volume) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, sets, reps, volume]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, () => {
    console.log(`Backend running on port 5000`);
  });