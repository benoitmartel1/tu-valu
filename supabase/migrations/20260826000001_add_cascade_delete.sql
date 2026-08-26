-- Drop and recreate foreign key constraints with CASCADE delete
-- This allows deleting classes/students/skills even if they have related session events

-- For tu_session_events -> tu_classes
ALTER TABLE tu_session_events
DROP CONSTRAINT IF EXISTS tu_session_events_class_id_fkey,
ADD CONSTRAINT tu_session_events_class_id_fkey 
  FOREIGN KEY (class_id) REFERENCES tu_classes(id) ON DELETE CASCADE;

-- For tu_session_events -> tu_students  
ALTER TABLE tu_session_events
DROP CONSTRAINT IF EXISTS tu_session_events_student_id_fkey,
ADD CONSTRAINT tu_session_events_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES tu_students(id) ON DELETE CASCADE;

-- For tu_session_events -> tu_skills
ALTER TABLE tu_session_events
DROP CONSTRAINT IF EXISTS tu_session_events_skill_id_fkey,
ADD CONSTRAINT tu_session_events_skill_id_fkey 
  FOREIGN KEY (skill_id) REFERENCES tu_skills(id) ON DELETE CASCADE;

-- For tu_session_events -> tu_evaluations
ALTER TABLE tu_session_events
DROP CONSTRAINT IF EXISTS tu_session_events_evaluation_id_fkey,
ADD CONSTRAINT tu_session_events_evaluation_id_fkey 
  FOREIGN KEY (evaluation_id) REFERENCES tu_evaluations(id) ON DELETE CASCADE;

-- For tu_sessions -> tu_classes
ALTER TABLE tu_sessions
DROP CONSTRAINT IF EXISTS tu_sessions_class_id_fkey,
ADD CONSTRAINT tu_sessions_class_id_fkey 
  FOREIGN KEY (class_id) REFERENCES tu_classes(id) ON DELETE CASCADE;

-- For tu_sessions -> tu_evaluations
ALTER TABLE tu_sessions
DROP CONSTRAINT IF EXISTS tu_sessions_evaluation_id_fkey,
ADD CONSTRAINT tu_sessions_evaluation_id_fkey 
  FOREIGN KEY (evaluation_id) REFERENCES tu_evaluations(id) ON DELETE CASCADE;

-- For tu_students -> tu_classes
ALTER TABLE tu_students
DROP CONSTRAINT IF EXISTS tu_students_class_id_fkey,
ADD CONSTRAINT tu_students_class_id_fkey 
  FOREIGN KEY (class_id) REFERENCES tu_classes(id) ON DELETE CASCADE;

-- For tu_skills -> tu_evaluations
ALTER TABLE tu_skills
DROP CONSTRAINT IF EXISTS tu_skills_evaluation_id_fkey,
ADD CONSTRAINT tu_skills_evaluation_id_fkey 
  FOREIGN KEY (evaluation_id) REFERENCES tu_evaluations(id) ON DELETE CASCADE;
