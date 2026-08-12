-- Create projects table
-- Allows multiple projects per student (no unique constraint on student_id alone)
CREATE TABLE projects (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id   UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    project_name TEXT        NOT NULL,
    project_data JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by student
CREATE INDEX idx_projects_student_id ON projects(student_id);

-- Unique constraint: one project_name per student (upsert target)
CREATE UNIQUE INDEX idx_projects_student_name ON projects(student_id, project_name);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- No permissive policies → only service_role (bypasses RLS) has access
-- anon / authenticated roles are denied by default
