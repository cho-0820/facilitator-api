import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: getCorsHeaders() });
}

// ──────────────────────────────────────────────────────────
// GET /api/projects?student_code=S3-1-01
// Returns all projects for the given student_code
// ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const student_code = searchParams.get('student_code');

        if (!student_code) {
            return NextResponse.json(
                { error: 'student_code query parameter is required' },
                { status: 400, headers: getCorsHeaders() }
            );
        }

        // Resolve student_code → student row
        const { data: student, error: studentErr } = await supabase
            .from('students')
            .select('id')
            .eq('student_code', student_code)
            .maybeSingle();

        if (studentErr) {
            console.error('[ProjectsAPI] GET student lookup error:', studentErr.message);
            return NextResponse.json(
                { error: 'Database error while looking up student' },
                { status: 500, headers: getCorsHeaders() }
            );
        }

        if (!student) {
            return NextResponse.json(
                { error: 'Student not found' },
                { status: 404, headers: getCorsHeaders() }
            );
        }

        const includeData = searchParams.get('include_data') === 'true';

        // Fetch all projects for this student
        const selectFields = includeData
            ? 'id, project_name, project_data, updated_at'
            : 'id, project_name, updated_at';

        const { data: projects, error: projectsErr } = await supabase
            .from('projects')
            .select(selectFields)
            .eq('student_id', student.id)
            .order('updated_at', { ascending: false });

        if (projectsErr) {
            console.error('[ProjectsAPI] GET projects error:', projectsErr.message);
            return NextResponse.json(
                { error: 'Database error while fetching projects' },
                { status: 500, headers: getCorsHeaders() }
            );
        }

        return NextResponse.json(
            { projects: projects ?? [] },
            { status: 200, headers: getCorsHeaders() }
        );

    } catch (err: any) {
        console.error('[ProjectsAPI] GET unexpected error:', err.message || err);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500, headers: getCorsHeaders() }
        );
    }
}

// ──────────────────────────────────────────────────────────
// POST /api/projects
// Body: { student_code, project_name, project_data }
// Upserts (insert or update) by (student_id, project_name)
// ──────────────────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { student_code, project_name, project_data } = body;

        if (!student_code || !project_name || project_data === undefined) {
            return NextResponse.json(
                { error: 'student_code, project_name, and project_data are required' },
                { status: 400, headers: getCorsHeaders() }
            );
        }

        // Resolve student_code → student_id
        const { data: student, error: studentErr } = await supabase
            .from('students')
            .select('id')
            .eq('student_code', student_code)
            .maybeSingle();

        if (studentErr) {
            console.error('[ProjectsAPI] POST student lookup error:', studentErr.message);
            return NextResponse.json(
                { error: 'Database error while looking up student' },
                { status: 500, headers: getCorsHeaders() }
            );
        }

        if (!student) {
            return NextResponse.json(
                { error: 'Student not found' },
                { status: 404, headers: getCorsHeaders() }
            );
        }

        // Upsert: if (student_id + project_name) exists → update; else → insert
        const { data: upserted, error: upsertErr } = await supabase
            .from('projects')
            .upsert(
                {
                    student_id:   student.id,
                    project_name: project_name,
                    project_data: project_data,
                    updated_at:   new Date().toISOString(),
                },
                {
                    onConflict: 'student_id,project_name',  // must match the unique index
                }
            )
            .select('id, project_name, updated_at')
            .single();

        if (upsertErr) {
            console.error('[ProjectsAPI] POST upsert error:', upsertErr.message);
            return NextResponse.json(
                { error: 'Database error while saving project' },
                { status: 500, headers: getCorsHeaders() }
            );
        }

        console.log(`[ProjectsAPI] Upserted project '${project_name}' for student ${student_code} → id=${upserted?.id}`);

        return NextResponse.json(
            { success: true, project: upserted },
            { status: 200, headers: getCorsHeaders() }
        );

    } catch (err: any) {
        console.error('[ProjectsAPI] POST unexpected error:', err.message || err);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500, headers: getCorsHeaders() }
        );
    }
}
