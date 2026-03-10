-- View to calculate total volume per daily log
CREATE OR REPLACE VIEW view_log_volume AS
SELECT 
    dl.logs_id,
    dl.user_id,
    dl.workout_date,
    COALESCE(SUM(de.total_volume), 0) as log_total_volume
FROM daily_logs dl
LEFT JOIN daily_exercises de ON dl.logs_id = de.logs_id
WHERE de.status = 'Completed' -- Only count finished exercises
GROUP BY dl.logs_id, dl.user_id, dl.workout_date;