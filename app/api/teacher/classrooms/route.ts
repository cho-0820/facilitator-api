import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
    try {
        // Fetch all classrooms ordered by creation date
        const { data: classrooms, error: classError } = await supabase
            .from('classrooms')
            .select('id, name, teacher_name, created_at')
            .order('created_at', { ascending: false });

        if (classError) {
            console.error('[TeacherAPI] Error fetching classrooms:', classError);
            return NextResponse.json(
                { error: 'Failed to fetch classrooms' },
                { status: 500 }
            );
        }

        // Fetch student count for each classroom
        const { data: students, error: studentError } = await supabase
            .from('students')
            .select('classroom_id');

        if (studentError) {
            console.error('[TeacherAPI] Error fetching student counts:', studentError);
            return NextResponse.json(
                { error: 'Failed to fetch student counts' },
                { status: 500 }
            );
        }

        const countMap: Record<string, number> = {};
        for (const s of students || []) {
            countMap[s.classroom_id] = (countMap[s.classroom_id] || 0) + 1;
        }

        const result = (classrooms || []).map((c) => ({
            id: c.id,
            name: c.name,
            teacher_name: c.teacher_name,
            created_at: c.created_at,
            student_count: countMap[c.id] || 0,
        }));

        return NextResponse.json({ classrooms: result }, { status: 200 });
    } catch (err: any) {
        console.error('[TeacherAPI] Unexpected error in GET /api/teacher/classrooms:', err);
        return NextResponse.json(
            { error: `Internal server error: ${err.message}` },
            { status: 500 }
        );
    }
}
