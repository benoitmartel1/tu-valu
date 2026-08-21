-- Enable Row Level Security on all tables
ALTER TABLE tu_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tu_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE tu_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tu_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE tu_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tu_session_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authenticated users with app isolation
-- These policies allow any authenticated user from tu-valu app to perform CRUD operations

-- tu_classes policies
CREATE POLICY "tu-valu users can view classes"
  ON tu_classes
  FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can insert classes"
  ON tu_classes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can update classes"
  ON tu_classes
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu')
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can delete classes"
  ON tu_classes
  FOR DELETE
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

-- tu_students policies
CREATE POLICY "tu-valu users can view students"
  ON tu_students
  FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can insert students"
  ON tu_students
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can update students"
  ON tu_students
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu')
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can delete students"
  ON tu_students
  FOR DELETE
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

-- tu_evaluations policies
CREATE POLICY "tu-valu users can view evaluations"
  ON tu_evaluations
  FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can insert evaluations"
  ON tu_evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can update evaluations"
  ON tu_evaluations
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu')
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can delete evaluations"
  ON tu_evaluations
  FOR DELETE
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

-- tu_skills policies
CREATE POLICY "tu-valu users can view skills"
  ON tu_skills
  FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can insert skills"
  ON tu_skills
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can update skills"
  ON tu_skills
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu')
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can delete skills"
  ON tu_skills
  FOR DELETE
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

-- tu_sessions policies
CREATE POLICY "tu-valu users can view sessions"
  ON tu_sessions
  FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can insert sessions"
  ON tu_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can update sessions"
  ON tu_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu')
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can delete sessions"
  ON tu_sessions
  FOR DELETE
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

-- tu_session_events policies
CREATE POLICY "tu-valu users can view session events"
  ON tu_session_events
  FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can insert session events"
  ON tu_session_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can update session events"
  ON tu_session_events
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu')
  WITH CHECK (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');

CREATE POLICY "tu-valu users can delete session events"
  ON tu_session_events
  FOR DELETE
  TO authenticated
  USING (auth.jwt() -> 'user_metadata' ->> 'app_name' = 'tu-valu');
