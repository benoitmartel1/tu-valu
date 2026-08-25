-- Add name_display_prefs column to tu_students table
-- Stores JSON object with showFirstname, showInitial, showLastname booleans
ALTER TABLE tu_students 
ADD COLUMN IF NOT EXISTS name_display_prefs JSONB DEFAULT '{"showFirstname": true, "showInitial": false, "showLastname": false}'::jsonb;

-- Add comment to document the column
COMMENT ON COLUMN tu_students.name_display_prefs IS 'JSON object storing name display preferences: {showFirstname: boolean, showInitial: boolean, showLastname: boolean}';
