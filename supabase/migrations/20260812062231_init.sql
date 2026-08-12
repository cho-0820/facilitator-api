-- Create classrooms table
CREATE TABLE classrooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    teacher_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create students table
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE NOT NULL,
    student_code TEXT UNIQUE NOT NULL,
    consent_status BOOLEAN DEFAULT false NOT NULL,
    consent_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create sessions table
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    ended_at TIMESTAMPTZ
);

-- Create events table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL,
    trigger_strategy TEXT,
    event_timestamp TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes for performance and constraint lookups
CREATE INDEX idx_students_classroom_id ON students(classroom_id);
CREATE INDEX idx_sessions_student_id ON sessions(student_id);
CREATE INDEX idx_events_session_id ON events(session_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Note: Since RLS is enabled and no permissive policies are defined,
-- all read and write access for 'anon' and 'authenticated' roles is denied by default.
-- Only the 'service_role' key (which bypasses RLS) will have access.
