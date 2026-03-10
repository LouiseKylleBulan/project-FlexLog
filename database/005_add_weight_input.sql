-- 1. Drop the dependent view first to unlock the table
DROP VIEW IF EXISTS view_log_volume;

-- 2. Add the Master (Blueprint) weight column
ALTER TABLE exercises_templates 
ADD COLUMN IF NOT EXISTS target_weight NUMERIC DEFAULT 0;

-- 3. Add the Daily (Instance) weight column
ALTER TABLE daily_exercises 
ADD COLUMN IF NOT EXISTS actual_weight NUMERIC DEFAULT 0;

-- 4. Rebuild the auto-calculated volume to include Weight
ALTER TABLE daily_exercises DROP COLUMN IF EXISTS total_volume;

ALTER TABLE daily_exercises 
ADD COLUMN total_volume NUMERIC 
GENERATED ALWAYS AS (actual_sets * actual_reps * actual_weight) STORED;

-- 5. Recreate the view with the new calculation
CREATE OR REPLACE VIEW view_log_volume AS
SELECT 
    dl.logs_id,
    dl.user_id,
    dl.workout_date,
    COALESCE(SUM(de.total_volume), 0) as log_total_volume
FROM daily_logs dl
LEFT JOIN daily_exercises de ON dl.logs_id = de.logs_id
WHERE de.status = 'Completed'
GROUP BY dl.logs_id, dl.user_id, dl.workout_date;