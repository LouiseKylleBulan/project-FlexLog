ALTER TABLE daily_exercises
ADD COLUMN IF NOT EXISTS et_id INTEGER
REFERENCES exercises_templates(et_id)
ON DELETE SET NULL;