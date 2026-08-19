import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function traverseBlock(block: any, summary: Record<string, number>) {
    if (!block || typeof block !== 'object') return;

    if (typeof block.type === 'string' && block.type.trim()) {
        const typeName = block.type.trim();
        summary[typeName] = (summary[typeName] || 0) + 1;
    }

    // 1. statements (nested branches in repeat, if, if_else, etc.)
    if (Array.isArray(block.statements)) {
        for (const branch of block.statements) {
            if (Array.isArray(branch)) {
                for (const subBlock of branch) {
                    traverseBlock(subBlock, summary);
                }
            }
        }
    }

    // 2. params (nested value/calc/operator blocks)
    if (Array.isArray(block.params)) {
        for (const param of block.params) {
            if (param && typeof param === 'object' && typeof param.type === 'string') {
                traverseBlock(param, summary);
            }
        }
    }
}

function extractBlockSummary(projectData: any): { summary: Record<string, number>; total: number } {
    const summary: Record<string, number> = {};
    if (!projectData || typeof projectData !== 'object') {
        return { summary, total: 0 };
    }

    const objects = projectData.objects;
    if (Array.isArray(objects)) {
        for (const obj of objects) {
            if (!obj || !obj.script) continue;
            let scriptData = obj.script;
            if (typeof scriptData === 'string') {
                try {
                    scriptData = JSON.parse(scriptData);
                } catch (e) {
                    continue;
                }
            }

            if (Array.isArray(scriptData)) {
                for (const item of scriptData) {
                    if (Array.isArray(item)) {
                        // Thread array: [block1, block2, ...]
                        for (const block of item) {
                            traverseBlock(block, summary);
                        }
                    } else if (item && typeof item === 'object') {
                        // Direct block
                        traverseBlock(item, summary);
                    }
                }
            }
        }
    }

    const total = Object.values(summary).reduce((acc, cur) => acc + cur, 0);
    return { summary, total };
}

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ studentId: string }> }
) {
    try {
        const params = await context.params;
        const studentId = params?.studentId;

        if (!studentId) {
            return NextResponse.json(
                { error: 'studentId is required' },
                { status: 400 }
            );
        }

        // 1. Look up student
        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('id, student_code, nickname, consent_status')
            .eq('id', studentId)
            .maybeSingle();

        if (studentError) {
            console.error('[StudentDetailAPI] Student lookup error:', studentError);
            return NextResponse.json(
                { error: 'Database error while querying student' },
                { status: 500 }
            );
        }

        if (!student) {
            return NextResponse.json(
                { error: 'Student not found' },
                { status: 404 }
            );
        }

        // 2. Consent check: If false, return only { consent_status: false }
        if (!student.consent_status) {
            return NextResponse.json({
                consent_status: false
            });
        }

        // 3. Fetch all projects for this student ordered by updated_at descending
        const { data: projects, error: projectsError } = await supabase
            .from('projects')
            .select('id, project_name, project_data, updated_at')
            .eq('student_id', student.id)
            .order('updated_at', { ascending: false });

        if (projectsError) {
            console.error('[StudentDetailAPI] Projects lookup error:', projectsError);
            return NextResponse.json(
                { error: 'Database error while querying projects' },
                { status: 500 }
            );
        }

        const projectList = (projects || []).map((p) => {
            const { summary, total } = extractBlockSummary(p.project_data);
            const chatMessages = Array.isArray(p.project_data?.messages)
                ? p.project_data.messages
                : [];

            return {
                id: p.id,
                project_name: p.project_name,
                updated_at: p.updated_at,
                block_summary: summary,
                total_blocks: total,
                chat_messages: chatMessages,
                project_data: p.project_data
            };
        });

        return NextResponse.json({
            consent_status: true,
            student: {
                nickname: student.nickname,
                student_code: student.student_code
            },
            projects: projectList
        });

    } catch (err: any) {
        console.error('[StudentDetailAPI] Unexpected error:', err);
        return NextResponse.json(
            { error: `Internal Server Error: ${err.message || err}` },
            { status: 500 }
        );
    }
}
