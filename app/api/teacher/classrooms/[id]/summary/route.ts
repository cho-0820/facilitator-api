import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface RouteContext {
    params: Promise<{ id: string }>;
}

const STRATEGIES = [
    'modeling',
    'scaffolding',
    'coaching',
    'clarification',
    'reflection',
    'exploration',
] as const;

type StrategyType = (typeof STRATEGIES)[number];

export async function GET(req: NextRequest, context: RouteContext) {
    try {
        const { id: classroomId } = await context.params;

        if (!classroomId) {
            return NextResponse.json(
                { error: 'Classroom ID is required' },
                { status: 400 }
            );
        }

        // 1. Verify classroom existence
        const { data: classroom, error: classErr } = await supabase
            .from('classrooms')
            .select('id, name, teacher_name, created_at')
            .eq('id', classroomId)
            .single();

        if (classErr || !classroom) {
            return NextResponse.json(
                { error: 'Classroom not found' },
                { status: 404 }
            );
        }

        // 2. Fetch all students in this classroom
        const { data: students, error: studentErr } = await supabase
            .from('students')
            .select('id, student_code, nickname, consent_status, created_at')
            .eq('classroom_id', classroomId)
            .order('student_code', { ascending: true });

        if (studentErr) {
            console.error('[TeacherAPI] Error fetching students:', studentErr);
            return NextResponse.json(
                { error: 'Failed to fetch students' },
                { status: 500 }
            );
        }

        // 3. Process each student
        const studentSummaries = await Promise.all(
            (students || []).map(async (student) => {
                // If consent is NOT granted, return strictly redacted summary without querying events/sessions
                if (!student.consent_status) {
                    return {
                        id: student.id,
                        student_code: student.student_code,
                        nickname: student.nickname,
                        consent_status: false,
                        status_label: '비공개(미동의)',
                        phase_counts: null,
                        trigger_counts: null,
                        repeated_errors: null,
                        total_events: 0,
                    };
                }

                // If consent IS granted, fetch sessions & events
                const { data: sessions, error: sessionErr } = await supabase
                    .from('sessions')
                    .select('id')
                    .eq('student_id', student.id);

                if (sessionErr) {
                    console.warn(`[TeacherAPI] Failed to fetch sessions for student ${student.id}:`, sessionErr);
                }

                const sessionIds = (sessions || []).map((s) => s.id);

                if (sessionIds.length === 0) {
                    return {
                        id: student.id,
                        student_code: student.student_code,
                        nickname: student.nickname,
                        consent_status: true,
                        status_label: '동의',
                        phase_counts: {
                            planning: 0,
                            monitoring: 0,
                            modification: 0,
                        },
                        trigger_counts: {
                            modeling: 0,
                            scaffolding: 0,
                            coaching: 0,
                            clarification: 0,
                            reflection: 0,
                            exploration: 0,
                        },
                        repeated_errors: [],
                        total_events: 0,
                    };
                }

                // Fetch all events for these sessions
                const { data: events, error: eventErr } = await supabase
                    .from('events')
                    .select('id, event_type, trigger_strategy, payload, event_timestamp')
                    .in('session_id', sessionIds);

                if (eventErr) {
                    console.warn(`[TeacherAPI] Failed to fetch events for student ${student.id}:`, eventErr);
                }

                const eventList = events || [];

                // A. Compute trigger strategy counts
                const triggerCounts: Record<StrategyType, number> = {
                    modeling: 0,
                    scaffolding: 0,
                    coaching: 0,
                    clarification: 0,
                    reflection: 0,
                    exploration: 0,
                };

                for (const ev of eventList) {
                    const strategy = (ev.trigger_strategy || ev.payload?.strategy || ev.payload?.trigger_strategy || '') as StrategyType;
                    if (strategy && triggerCounts.hasOwnProperty(strategy)) {
                        triggerCounts[strategy] += 1;
                    }
                }

                // B. Compute phase counts mapped from trigger strategies:
                // - planning = modeling + scaffolding
                // - monitoring = coaching + clarification
                // - modification = reflection + exploration
                const phaseCounts = {
                    planning: triggerCounts.modeling + triggerCounts.scaffolding,
                    monitoring: triggerCounts.coaching + triggerCounts.clarification,
                    modification: triggerCounts.reflection + triggerCounts.exploration,
                };

                // C. Compute repeated errors (>= 2 occurrences of same error template message)
                const errorCountMap: Record<string, number> = {};

                for (const ev of eventList) {
                    if (ev.event_type === 'error') {
                        const errorMsg = ev.payload?.message || ev.payload?.title || '';
                        if (errorMsg) {
                            errorCountMap[errorMsg] = (errorCountMap[errorMsg] || 0) + 1;
                        }
                    }
                }

                const repeatedErrors = Object.entries(errorCountMap)
                    .filter(([_, count]) => count >= 2)
                    .map(([message, count]) => ({ message, count }))
                    .sort((a, b) => b.count - a.count);

                return {
                    id: student.id,
                    student_code: student.student_code,
                    nickname: student.nickname,
                    consent_status: true,
                    status_label: '동의',
                    phase_counts: phaseCounts,
                    trigger_counts: triggerCounts,
                    repeated_errors: repeatedErrors,
                    total_events: eventList.length,
                };
            })
        );

        return NextResponse.json(
            {
                classroom,
                students: studentSummaries,
            },
            { status: 200 }
        );
    } catch (err: any) {
        console.error('[TeacherAPI] Unexpected error in GET /api/teacher/classrooms/[id]/summary:', err);
        return NextResponse.json(
            { error: `Internal server error: ${err.message}` },
            { status: 500 }
        );
    }
}
