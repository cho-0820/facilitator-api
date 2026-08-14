// facilitator-api/scripts/update_students_consent.js
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const envContent = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const [k, ...v] = trimmed.split('=');
        if (k && v.length) process.env[k.trim()] = v.join('=').replace(/^["'](.*)["']$/, '$1');
    }
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log('===========================================================');
    console.log('=== 1. UPDATE 전: 현재 consent_status 분포 조회 ===');
    console.log('===========================================================');
    const { data: beforeData, error: beforeErr } = await supabase
        .from('students')
        .select('id, student_code, nickname, consent_status');

    if (beforeErr) throw beforeErr;

    const trueCountBefore = beforeData.filter(s => s.consent_status === true).length;
    const falseCountBefore = beforeData.filter(s => s.consent_status === false).length;

    console.log(`총 학생 수: ${beforeData.length}명`);
    console.log(`- consent_status = true : ${trueCountBefore}명`);
    console.log(`- consent_status = false: ${falseCountBefore}명\n`);
    console.table(beforeData);

    console.log('===========================================================');
    console.log('=== 2. UPDATE 실행: 모든 학생 consent_status = true ===');
    console.log('===========================================================');
    const { data: updateData, error: updateErr } = await supabase
        .from('students')
        .update({ consent_status: true })
        .neq('id', '00000000-0000-0000-0000-000000000000') // 전체 대상 update
        .select();

    if (updateErr) throw updateErr;
    console.log(`UPDATE 완료된 행 수: ${updateData.length}개\n`);

    console.log('===========================================================');
    console.log('=== 3. UPDATE 후: 15명 전체 consent_status 확인 ===');
    console.log('===========================================================');
    const { data: afterData, error: afterErr } = await supabase
        .from('students')
        .select('id, student_code, nickname, consent_status')
        .order('student_code', { ascending: true });

    if (afterErr) throw afterErr;

    const trueCountAfter = afterData.filter(s => s.consent_status === true).length;
    const falseCountAfter = afterData.filter(s => s.consent_status === false).length;

    console.log(`총 학생 수: ${afterData.length}명`);
    console.log(`- consent_status = true : ${trueCountAfter}명`);
    console.log(`- consent_status = false: ${falseCountAfter}명\n`);
    console.table(afterData);
}

run().catch(console.error);
