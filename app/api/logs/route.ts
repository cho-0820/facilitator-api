import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function getCorsHeaders() {
    const headers = new Headers();
    // TODO: Restrict CORS origin to the specific student web application domain in production (e.g. playentry.org)
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return headers;
}

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: getCorsHeaders() });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { student_code, session_id, events = [] } = body;

        // 1. Mandatory parameter validation
        if (!student_code || !session_id) {
            return NextResponse.json(
                { error: 'Missing required parameters: student_code and session_id are mandatory' },
                { status: 400, headers: getCorsHeaders() }
            );
        }

        // 2. Query student table by student_code
        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('id, consent_status')
            .eq('student_code', student_code)
            .single();

        if (studentError || !student) {
            console.warn(`[LogsAPI] Student code not found: "${student_code}"`);
            return NextResponse.json(
                { error: 'Student code is not registered by the teacher' },
                { status: 404, headers: getCorsHeaders() }
            );
        }

        // 3. Skip saving if consent_status is false
        if (!student.consent_status) {
            console.info(`[LogsAPI] Skipping log insertion for "${student_code}" (consent_status is false).`);
            return NextResponse.json(
                { message: 'Consent not granted. Logs skipped.', status: 'skipped' },
                { status: 200, headers: getCorsHeaders() }
            );
        }

        // 4. Ensure session exists in sessions table to prevent foreign key errors
        const { data: session, error: sessionQueryError } = await supabase
            .from('sessions')
            .select('id')
            .eq('id', session_id)
            .single();

        if (sessionQueryError || !session) {
            // First time receiving log for this session, insert session record
            const startedAt = events.length > 0 && events[0].timestamp 
                ? events[0].timestamp 
                : new Date().toISOString();

            const { error: sessionInsertError } = await supabase
                .from('sessions')
                .insert({
                    id: session_id,
                    student_id: student.id,
                    started_at: startedAt,
                });

            if (sessionInsertError) {
                console.error(`[LogsAPI] Failed to auto-create session record:`, sessionInsertError);
                return NextResponse.json(
                    { error: 'Database session initialization error' },
                    { status: 500, headers: getCorsHeaders() }
                );
            }
            console.info(`[LogsAPI] New session record initialized: "${session_id}" for student "${student.id}"`);
        }

        // 5. Batch insert events if the list is not empty
        if (events.length > 0) {
            const eventsToInsert = events.map((e: any) => ({
                session_id: session_id,
                event_type: e.type,
                trigger_strategy: e.payload?.strategy || e.payload?.trigger_strategy || null,
                event_timestamp: e.timestamp || new Date().toISOString(),
                payload: e.payload || {},
            }));

            const { error: insertError } = await supabase
                .from('events')
                .insert(eventsToInsert);

            if (insertError) {
                console.error(`[LogsAPI] Failed to batch insert events:`, insertError);
                return NextResponse.json(
                    { error: 'Failed to record event logs in database' },
                    { status: 500, headers: getCorsHeaders() }
                );
            }
        }

        return NextResponse.json(
            { message: 'Event logs successfully recorded', status: 'success', insertedCount: events.length },
            { status: 200, headers: getCorsHeaders() }
        );

    } catch (err: any) {
        console.error('[LogsAPI] Unexpected handler error:', err);
        return NextResponse.json(
            { error: `Internal server error: ${err.message}` },
            { status: 500, headers: getCorsHeaders() }
        );
    }
}
