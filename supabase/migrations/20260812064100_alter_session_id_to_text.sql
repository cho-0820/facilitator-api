-- Drop foreign key constraint on events
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_session_id_fkey;

-- Alter column session_id in events to TEXT
ALTER TABLE events ALTER COLUMN session_id TYPE TEXT;

-- Alter column id in sessions to TEXT
ALTER TABLE sessions ALTER COLUMN id TYPE TEXT;

-- Recreate foreign key constraint on events
ALTER TABLE events ADD CONSTRAINT events_session_id_fkey FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;
