-- 1. USERS Table: Core Profile Data
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    user_name VARCHAR(100) NOT NULL,
    user_email VARCHAR(150) UNIQUE NOT NULL,
    user_pass VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. ROUTINE_TEMPLATES: Stores the 7-day weekly schedule
CREATE TABLE IF NOT EXISTS routine_templates (
    rt_id SERIAL PRIMARY KEY,
    rt_name VARCHAR(100) NOT NULL, 
    day_of_week VARCHAR(20) NOT NULL, 
    user_id INTEGER REFERENCES USERS(user_id) ON DELETE CASCADE,
    exercises JSONB DEFAULT '[]',
    UNIQUE(user_id, day_of_week) 
);

-- 3. EXERCISES_TEMPLATES: Preset exercises for the weekly routine
CREATE TABLE IF NOT EXISTS exercises_templates (
    et_id SERIAL PRIMARY KEY,
    et_name VARCHAR(100) NOT NULL,
    target_sets INTEGER NOT NULL,
    target_reps INTEGER NOT NULL,
    rt_id INTEGER REFERENCES ROUTINE_TEMPLATES(rt_id) ON DELETE CASCADE
);

-- 4. DAILY_LOGS: Entry for a specific calendar date
CREATE TABLE IF NOT EXISTS daily_logs (
    logs_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES USERS(user_id) ON DELETE CASCADE,
    workout_date DATE NOT NULL,
    rt_name VARCHAR(100), 
    is_completed BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, workout_date) 
);

-- 5. DAILY_EXERCISES: Individual performance records
CREATE TABLE IF NOT EXISTS daily_exercises (
    de_id SERIAL PRIMARY KEY,
    logs_id INTEGER REFERENCES DAILY_LOGS(logs_id) ON DELETE CASCADE,
    de_name VARCHAR(100) NOT NULL,
    actual_sets INTEGER DEFAULT 0,
    actual_reps INTEGER DEFAULT 0,
    total_volume INTEGER GENERATED ALWAYS AS (actual_sets * actual_reps) STORED, 
    status VARCHAR(50) DEFAULT 'Pending',
    position INTEGER DEFAULT 0 
);