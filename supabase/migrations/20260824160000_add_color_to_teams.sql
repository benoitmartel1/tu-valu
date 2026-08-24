-- Add color column to tu_teams table
ALTER TABLE tu_teams ADD COLUMN IF NOT EXISTS color TEXT;
