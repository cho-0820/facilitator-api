import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

// CORS headers helper
function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: getCorsHeaders(),
    });
}

export async function POST(req: Request) {
    try {
        const { student_code } = await req.json();

        if (!student_code) {
            return NextResponse.json(
                { valid: false, error: 'student_code is required' },
                { status: 400, headers: getCorsHeaders() }
            );
        }

        console.log(`[VerifyAPI] Verifying student code: ${student_code}`);

        // Fetch student record and join with classrooms table
        const { data, error } = await supabase
            .from('students')
            .select(`
                nickname,
                classrooms (
                    name
                )
            `)
            .eq('student_code', student_code)
            .maybeSingle();

        if (error) {
            console.error('[VerifyAPI] Database query error:', error.message);
            return NextResponse.json(
                { valid: false, error: 'Database query failed' },
                { status: 500, headers: getCorsHeaders() }
            );
        }

        if (!data) {
            console.log(`[VerifyAPI] Student code not found: ${student_code}`);
            return NextResponse.json(
                { valid: false },
                { status: 404, headers: getCorsHeaders() }
            );
        }

        // Cast joined classrooms data
        const classroomData = data.classrooms as any;
        const classroomName = classroomData ? classroomData.name : '';

        console.log(`[VerifyAPI] Valid code found. Nickname: ${data.nickname}, Classroom: ${classroomName}`);

        return NextResponse.json(
            {
                valid: true,
                nickname: data.nickname,
                classroom_name: classroomName
            },
            { status: 200, headers: getCorsHeaders() }
        );

    } catch (err: any) {
        console.error('[VerifyAPI] Unexpected handler crash:', err.message || err);
        return NextResponse.json(
            { valid: false, error: 'Internal Server Error' },
            { status: 500, headers: getCorsHeaders() }
        );
    }
}
