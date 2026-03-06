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

        for (const day in routines) {
            const r = routines[day];

            // 1️⃣ Insert or update routine
            const routineResult = await pool.query(
                `INSERT INTO routine_templates (user_id, day_of_week, rt_name)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, day_of_week)
                DO UPDATE SET rt_name = EXCLUDED.rt_name
                RETURNING rt_id`,
                [req.user.user_id, day, r.name]
            );

            const rtId = routineResult.rows[0].rt_id;

            // 2️⃣ Delete old exercises for that routine
            await pool.query(
                `DELETE FROM exercises_templates WHERE rt_id = $1`,
                [rtId]
            );

            // 3️⃣ Insert exercises
            if (r.exercises && r.exercises.length > 0) {
                for (const ex of r.exercises) {
                    await pool.query(
                        `INSERT INTO exercises_templates
                        (et_name, target_sets, target_reps, rt_id)
                        VALUES ($1, $2, $3, $4)`,
                        [
                            ex.name,
                            ex.sets,
                            ex.reps,
                            rtId
                        ]
                    );
                }
            }
        }

        res.json({ success: true });

    } catch (err) {
        console.error("Routine Save Error:", err);
        res.status(500).json({ error: "Failed to save routines" });
    }
});

app.get('/api/logs/:date', authenticateToken, async (req, res) => {
    const { date } = req.params; // Expects 'YYYY-MM-DD'
    const userId = req.user.user_id;

    try {
        // 1. Ensure the log exists for this specific day
        // We pull the routine name directly from the template for that weekday
        const logInit = await pool.query(
            `INSERT INTO daily_logs (user_id, workout_date, rt_name)
             VALUES ($1, $2, (
                 SELECT rt_name FROM routine_templates 
                 WHERE user_id = $1 AND day_of_week = TRIM(TO_CHAR($2::date, 'Day'))
             ))
             ON CONFLICT (user_id, workout_date) 
             DO UPDATE SET rt_name = EXCLUDED.rt_name 
             RETURNING logs_id, rt_name`,
            [userId, date]
        );

        const log = logInit.rows[0];

        // 2. Hydrate: If this is a new log (0 exercises), clone from the Master Template
        await pool.query(
            `INSERT INTO daily_exercises (logs_id, de_name, actual_sets, actual_reps, status)
             SELECT $1, et_name, target_sets, target_reps, 'Pending'
             FROM exercises_templates
             WHERE rt_id = (
                 SELECT rt_id FROM routine_templates 
                 WHERE user_id = $2 AND day_of_week = TRIM(TO_CHAR($3::date, 'Day'))
             )
             AND NOT EXISTS (SELECT 1 FROM daily_exercises WHERE logs_id = $1)`,
            [log.logs_id, userId, date]
        );

        // 3. Return the instance-specific exercises
        const exercises = await pool.query(
            'SELECT * FROM daily_exercises WHERE logs_id = $1 ORDER BY de_id ASC',
            [log.logs_id]
        );

        res.json({
            logs_id: log.logs_id,
            rt_name: log.rt_name || 'Rest Day',
            exercises: exercises.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Sync failed" });
    }
});

app.post('/api/logs/:logId/exercise', authenticateToken, async (req, res) => {
    const { logId } = req.params;
    const { name, sets, reps } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO daily_exercises (logs_id, de_name, actual_sets, actual_reps, status)
             VALUES ($1, $2, $3, $4, 'Pending') RETURNING *`,
            [logId, name, sets, reps]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Failed to add daily exercise" });
    }
});

app.delete('/api/exercises/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        // Only delete from daily_exercises to keep the Master template safe
        await pool.query('DELETE FROM daily_exercises WHERE de_id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Database error during delete" });
    }
});

app.patch('/api/exercises/:id', authenticateToken, async (req, res) => {

    const { id } = req.params;
    const { name, sets, reps } = req.body;

    try {

        await pool.query(
            `UPDATE daily_exercises
            SET de_name=$1,
                actual_sets=$2,
                actual_reps=$3
            WHERE de_id=$4`,
            [
                name,
                sets,
                reps,
                id
            ]
        );

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }

});

app.patch('/api/exercises/:id/status', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await pool.query('UPDATE daily_exercises SET status = $1 WHERE de_id = $2', [status, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});