const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const [k, ...v] = trimmed.split('=');
        if (k && v.length > 0) {
            env[k.trim()] = v.join('=').replace(/^["'](.*)["']$/, '$1');
        }
    }
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const { data: classrooms, error: cErr } = await supabase.from('classrooms').select('*').order('created_at');
    console.log('=== CLASSROOMS ===');
    console.table(classrooms);

    const { data: students, error: sErr } = await supabase
        .from('students')
        .select('id, student_code, nickname, consent_status, classroom_id')
        .order('student_code');
    console.log(`\n=== STUDENTS (${students?.length || 0} rows) ===`);
    console.table(students);

    // Map classroom_id to classroom name
    const classMap = new Map((classrooms || []).map(c => [c.id, c.name]));
    console.log('\n=== STUDENTS WITH CLASSROOM NAME ===');
    const enriched = (students || []).map(s => ({
        student_code: s.student_code,
        nickname: s.nickname,
        classroom_name: classMap.get(s.classroom_id) || 'Unknown',
        consent_status: s.consent_status,
        classroom_id: s.classroom_id
    }));
    console.table(enriched);
}

main().catch(console.error);
