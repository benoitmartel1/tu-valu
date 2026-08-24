-- Create tu_teams table
CREATE TABLE tu_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create tu_student_teams junction table
CREATE TABLE tu_student_teams (
  student_id UUID REFERENCES tu_students(id) ON DELETE CASCADE,
  team_id UUID REFERENCES tu_teams(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (student_id, team_id)
);

-- Add team_id column to tu_session_events (nullable)
ALTER TABLE tu_session_events ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES tu_teams(id) ON DELETE SET NULL;

-- Enable Row Level Security on new tables
ALTER TABLE tu_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tu_student_teams ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tu_teams
CREATE POLICY "tu-valu users can view teams"
  ON tu_teams
  FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can insert teams"
  ON tu_teams
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can update teams"
  ON tu_teams
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu')
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can delete teams"
  ON tu_teams
  FOR DELETE
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

-- Create RLS policies for tu_student_teams
CREATE POLICY "tu-valu users can view student teams"
  ON tu_student_teams
  FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can insert student teams"
  ON tu_student_teams
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can update student teams"
  ON tu_student_teams
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu')
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can delete student teams"
  ON tu_student_teams
  FOR DELETE
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

-- Update RLS policy for tu_session_events to include team_id
DROP POLICY IF EXISTS "tu-valu users can insert session events" ON tu_session_events;
CREATE POLICY "tu-valu users can insert session events"
  ON tu_session_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

DROP POLICY IF EXISTS "tu-valu users can update session events" ON tu_session_events;
CREATE POLICY "tu-valu users can update session events"
  ON tu_session_events
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu')
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');
