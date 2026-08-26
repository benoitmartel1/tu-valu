-- Add user_id columns to all main tables for future user-level isolation
-- This migration adds the columns but keeps existing RLS policies (app-level isolation)
-- Future migrations can update RLS policies to use user_id for per-user isolation

-- Add user_id to tu_classes
ALTER TABLE tu_classes 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to tu_students
ALTER TABLE tu_students 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to tu_evaluations
ALTER TABLE tu_evaluations 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to tu_skills
ALTER TABLE tu_skills 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to tu_sessions
ALTER TABLE tu_sessions 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to tu_session_events
ALTER TABLE tu_session_events 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create indexes on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_classes_user_id ON tu_classes(user_id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON tu_students(user_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_user_id ON tu_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_skills_user_id ON tu_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON tu_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_session_events_user_id ON tu_session_events(user_id);

-- Set user_id for existing records based on the first authenticated user who created them
-- For now, we'll assign all existing data to NULL (will be updated when users interact with it)
-- In production, you might want to assign existing data to a specific admin user

COMMENT ON COLUMN tu_classes.user_id IS 'ID of the user who owns this class';
COMMENT ON COLUMN tu_students.user_id IS 'ID of the user who owns this student record';
COMMENT ON COLUMN tu_evaluations.user_id IS 'ID of the user who owns this evaluation';
COMMENT ON COLUMN tu_skills.user_id IS 'ID of the user who owns this skill';
COMMENT ON COLUMN tu_sessions.user_id IS 'ID of the user who owns this session';
COMMENT ON COLUMN tu_session_events.user_id IS 'ID of the user who owns this session event';
