-- Add custom_name column to tu_students table
-- This field allows setting a custom display name for use in live sessions
ALTER TABLE tu_students 
ADD COLUMN IF NOT EXISTS custom_name TEXT;

-- Add index on custom_name for faster lookups (optional, but useful if filtering by custom name)
CREATE INDEX IF NOT EXISTS idx_students_custom_name ON tu_students(custom_name);

-- Add comment to document the column
COMMENT ON COLUMN tu_students.custom_name IS 'Custom display name to be used in live sessions instead of firstname/lastname';
