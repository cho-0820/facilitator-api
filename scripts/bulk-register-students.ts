import fs from 'fs';
import path from 'path';
import { loadEnvConfig } from '@next/env';

// Load environment variables from .env.local
loadEnvConfig(path.resolve(__dirname, '..'));

async function main() {
    const { supabase } = require('../lib/supabase');
    const csvFile = process.argv[2];
    if (!csvFile) {
        console.error('Usage: npx tsx scripts/bulk-register-students.ts <csv-file-path>');
        process.exit(1);
    }

    const filePath = path.resolve(process.cwd(), csvFile);
    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found at ${filePath}`);
        process.exit(1);
    }

    console.log(`Reading CSV file from: ${filePath}`);
    let content = fs.readFileSync(filePath, 'utf8');

    // Rule 7 Compliance: Handle UTF-8 with BOM (utf-8-sig) by stripping BOM character if present
    if (content.startsWith('\uFEFF')) {
        console.log('Detected UTF-8-BOM (utf-8-sig). Stripping BOM signature...');
        content = content.substring(1);
    }

    const lines = content.split(/\r?\n/);
    console.log(`Parsing ${lines.length} lines (including potential header)...`);

    let successCount = 0;
    let failCount = 0;

    // Cache of classroom_name to classroom_id to minimize DB queries
    const classroomCache = new Map<string, string>();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Skip CSV header if present
        if (i === 0 && (line.includes('classroom_name') || line.includes('student_code') || line.includes('nickname'))) {
            console.log('Skipping CSV header line.');
            continue;
        }

        // Simple CSV parse by splitting commas
        const parts = line.split(',').map(p => p.trim());
        if (parts.length < 3) {
            console.warn(`Line ${i + 1} skipped (invalid column count): "${line}"`);
            failCount++;
            continue;
        }

        const [classroomName, studentCode, nickname] = parts;
        if (!classroomName || !studentCode || !nickname) {
            console.warn(`Line ${i + 1} skipped (missing classroom_name, student_code, or nickname): "${line}"`);
            failCount++;
            continue;
        }

        try {
            let classroomId = classroomCache.get(classroomName);

            // Fetch or create classroom
            if (!classroomId) {
                // Check if classroom already exists in DB
                const { data: existingClass, error: findError } = await supabase
                    .from('classrooms')
                    .select('id')
                    .eq('name', classroomName)
                    .maybeSingle();

                if (findError) {
                    throw new Error(`Failed to query classroom "${classroomName}": ${findError.message}`);
                }

                if (existingClass) {
                    classroomId = existingClass.id;
                } else {
                    // Create new classroom
                    console.log(`Classroom "${classroomName}" not found. Creating new one...`);
                    const { data: newClass, error: insertClassError } = await supabase
                        .from('classrooms')
                        .insert({ name: classroomName, teacher_name: '교사' })
                        .select('id')
                        .single();

                    if (insertClassError) {
                        throw new Error(`Failed to create classroom "${classroomName}": ${insertClassError.message}`);
                    }
                    classroomId = newClass.id;
                }
                classroomCache.set(classroomName, classroomId!);
            }

            // Insert student
            const { error: insertStudentError } = await supabase
                .from('students')
                .insert({
                    classroom_id: classroomId,
                    student_code: studentCode,
                    nickname: nickname,
                    consent_status: false
                });

            if (insertStudentError) {
                // Supabase/Postgres Unique Violation Error Code: '23505'
                if (insertStudentError.code === '23505') {
                    console.error(`[중복 에러] 학생 코드 [${studentCode}]는 이미 등록되어 있습니다. (이름: ${nickname})`);
                } else {
                    throw insertStudentError;
                }
                failCount++;
            } else {
                console.log(`[등록 성공] 학급: ${classroomName} | 코드: ${studentCode} | 닉네임: ${nickname}`);
                successCount++;
            }

        } catch (err: any) {
            console.error(`[등록 실패] Line ${i + 1} ("${line}"):`, err.message || err);
            failCount++;
        }
    }

    console.log('\n--- Bulk Registration Finished ---');
    console.log(`Successfully registered: ${successCount} student(s)`);
    console.log(`Failed / Skipped: ${failCount} student(s)`);
}

main().catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
});
