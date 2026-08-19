import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ImportRowResult {
    row: number;
    classroom_name: string;
    nickname: string;
    student_code?: string;
    consent_status?: boolean;
    status: 'success' | 'failed';
    reason?: string;
    is_generated?: boolean;
}

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as Blob | null;

        if (!file) {
            return NextResponse.json(
                { error: '엑셀 파일이 업로드되지 않았습니다.' },
                { status: 400 }
            );
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = XLSX.read(buffer, { type: 'buffer' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            return NextResponse.json(
                { error: '엑셀 파일에 시트가 존재하지 않습니다.' },
                { status: 400 }
            );
        }

        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (rawData.length <= 1) {
            return NextResponse.json(
                { error: '등록할 학생 데이터가 엑셀 파일에 없습니다.' },
                { status: 400 }
            );
        }

        // 1. Parse header row
        const headerRow = rawData[0].map((h: any) => String(h || '').trim());
        let classCol = -1;
        let nickCol = -1;
        let codeCol = -1;
        let consentCol = -1;

        for (let c = 0; c < headerRow.length; c++) {
            const h = headerRow[c];
            if (h.includes('학급') || h.includes('반')) classCol = c;
            else if (h.includes('닉네임') || h.includes('이름')) nickCol = c;
            else if (h.includes('학생코드') || h.includes('코드') || h.includes('아이디')) codeCol = c;
            else if (h.includes('동의')) consentCol = c;
        }

        // Default fallback if headers are in standard order
        if (classCol === -1) classCol = 0;
        if (nickCol === -1) nickCol = 1;
        if (codeCol === -1) codeCol = 2;
        if (consentCol === -1) consentCol = 3;

        // 2. Fetch all existing classrooms & students from DB into memory
        const { data: existingClassrooms, error: cErr } = await supabase
            .from('classrooms')
            .select('id, name, teacher_name');
        if (cErr) throw cErr;

        const { data: existingStudents, error: sErr } = await supabase
            .from('students')
            .select('id, student_code, classroom_id');
        if (sErr) throw sErr;

        const classroomMap = new Map<string, string>(); // name -> id
        (existingClassrooms || []).forEach(c => classroomMap.set(c.name.trim(), c.id));

        const existingStudentCodes = new Set<string>();
        (existingStudents || []).forEach(s => {
            if (s.student_code) existingStudentCodes.add(s.student_code.trim());
        });

        // Track max sequence numbers per classroom for auto-generation
        const classroomMaxSeq = new Map<string, number>();

        // Initialize sequence tracking based on existing codes
        (existingStudents || []).forEach(s => {
            if (!s.student_code) return;
            const code = s.student_code.trim();
            // Match pattern like S3-1-05
            const m = code.match(/^[A-Za-z0-9]+-[A-Za-z0-9]+-(\d+)$/);
            if (m) {
                const seq = parseInt(m[1], 10);
                const classId = s.classroom_id;
                // find classroom name
                const cObj = existingClassrooms?.find(c => c.id === classId);
                if (cObj) {
                    const cName = cObj.name.trim();
                    const currentMax = classroomMaxSeq.get(cName) || 0;
                    if (seq > currentMax) classroomMaxSeq.set(cName, seq);
                }
            }
        });

        const results: ImportRowResult[] = [];
        const studentsToInsert: Array<{
            classroom_id: string;
            student_code: string;
            nickname: string;
            consent_status: boolean;
        }> = [];

        // 3. Process each row
        for (let r = 1; r < rawData.length; r++) {
            const rowNumber = r + 1;
            const rowData = rawData[r];

            // Check if entire row is empty
            if (!rowData || rowData.every((cell: any) => String(cell || '').trim() === '')) {
                continue;
            }

            const rawClass = String(rowData[classCol] || '').trim();
            const rawNick = String(rowData[nickCol] || '').trim();
            const rawCode = String(rowData[codeCol] || '').trim();
            const rawConsent = String(rowData[consentCol] || '').trim();

            // Validate classroom name
            if (!rawClass) {
                results.push({
                    row: rowNumber,
                    classroom_name: '',
                    nickname: rawNick,
                    status: 'failed',
                    reason: '학급명이 비어있습니다.'
                });
                continue;
            }

            // Validate nickname
            if (!rawNick) {
                results.push({
                    row: rowNumber,
                    classroom_name: rawClass,
                    nickname: '',
                    status: 'failed',
                    reason: '닉네임이 비어있습니다.'
                });
                continue;
            }

            // Validate consent_status
            let consentStatus: boolean | null = null;
            const normConsent = rawConsent.toLowerCase();
            if (['y', '예', 'true', '1', '동의'].includes(normConsent)) {
                consentStatus = true;
            } else if (['n', '아니오', '아니요', 'false', '0', '미동의'].includes(normConsent)) {
                consentStatus = false;
            }

            if (consentStatus === null) {
                results.push({
                    row: rowNumber,
                    classroom_name: rawClass,
                    nickname: rawNick,
                    status: 'failed',
                    reason: `동의여부 값이 올바르지 않습니다. (입력값: "${rawConsent}") 'Y' 또는 'N'으로 입력해주세요.`
                });
                continue;
            }

            // Ensure classroom exists or create it
            let classroomId = classroomMap.get(rawClass);
            if (!classroomId) {
                const { data: newClass, error: classInsErr } = await supabase
                    .from('classrooms')
                    .insert({
                        name: rawClass,
                        teacher_name: '미지정'
                    })
                    .select('id')
                    .single();

                if (classInsErr || !newClass) {
                    results.push({
                        row: rowNumber,
                        classroom_name: rawClass,
                        nickname: rawNick,
                        status: 'failed',
                        reason: `신규 학급 생성 실패: ${classInsErr?.message || 'DB 오류'}`
                    });
                    continue;
                }
                classroomId = newClass.id;
                classroomMap.set(rawClass, classroomId!);
            }

            // Determine student code
            let finalCode = '';
            let isGenerated = false;

            if (rawCode) {
                // Explicit student code provided
                if (existingStudentCodes.has(rawCode)) {
                    results.push({
                        row: rowNumber,
                        classroom_name: rawClass,
                        nickname: rawNick,
                        student_code: rawCode,
                        status: 'failed',
                        reason: `이미 등록된 학생코드입니다. (중복: "${rawCode}")`
                    });
                    continue;
                }
                finalCode = rawCode;
                existingStudentCodes.add(finalCode);
            } else {
                // Auto-generate student code based on classroom name pattern S{grade}-{class}-{seq}
                isGenerated = true;
                let prefix = '';
                const gradeClassMatch = rawClass.match(/(\d+)\s*학년\s*(\d+)\s*반/) || rawClass.match(/(\d+)-(\d+)/);

                if (gradeClassMatch) {
                    prefix = `S${gradeClassMatch[1]}-${gradeClassMatch[2]}-`;
                } else {
                    // Fallback for special classroom names (e.g. "늘봄교실")
                    const simpleClean = rawClass.replace(/[^0-9a-zA-Z가-힣]/g, '');
                    prefix = `S-${simpleClean.substring(0, 3)}-`;
                }

                let currentSeq = classroomMaxSeq.get(rawClass) || 0;
                let candidate = '';
                do {
                    currentSeq++;
                    candidate = `${prefix}${String(currentSeq).padStart(2, '0')}`;
                } while (existingStudentCodes.has(candidate));

                classroomMaxSeq.set(rawClass, currentSeq);
                finalCode = candidate;
                existingStudentCodes.add(finalCode);
            }

            studentsToInsert.push({
                classroom_id: classroomId,
                student_code: finalCode,
                nickname: rawNick,
                consent_status: consentStatus
            });

            results.push({
                row: rowNumber,
                classroom_name: rawClass,
                nickname: rawNick,
                student_code: finalCode,
                consent_status: consentStatus,
                status: 'success',
                is_generated: isGenerated
            });
        }

        // 4. Batch insert successful students into Supabase
        if (studentsToInsert.length > 0) {
            const { error: insErr } = await supabase
                .from('students')
                .insert(studentsToInsert);

            if (insErr) {
                console.error('[StudentImportAPI] Failed to batch insert students:', insErr);
                return NextResponse.json(
                    { error: `학생 일괄 등록 DB 저장 실패: ${insErr.message}` },
                    { status: 500 }
                );
            }
        }

        const successCount = results.filter(r => r.status === 'success').length;
        const failedCount = results.filter(r => r.status === 'failed').length;
        const generatedList = results.filter(r => r.status === 'success' && r.is_generated);

        return NextResponse.json({
            message: `학생 명단 처리 완료 (성공: ${successCount}명, 실패: ${failedCount}명)`,
            summary: {
                total: results.length,
                success: successCount,
                failed: failedCount,
                generated_count: generatedList.length
            },
            results: results,
            generated_students: generatedList.map(g => ({
                classroom_name: g.classroom_name,
                nickname: g.nickname,
                student_code: g.student_code,
                consent_status: g.consent_status ? '동의 (Y)' : '미동의 (N)'
            }))
        });

    } catch (err: any) {
        console.error('[StudentImportAPI] Unhandled error during excel import:', err);
        return NextResponse.json(
            { error: `엑셀 파일 처리 중 오류가 발생했습니다: ${err.message || err}` },
            { status: 500 }
        );
    }
}
