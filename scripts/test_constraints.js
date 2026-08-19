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

async function testConstraints() {
    console.log('--- Testing students table constraints ---');

    // 1. Check duplicate student_code constraint
    const { error: dupCodeErr } = await supabase.from('students').insert({
        classroom_id: '7caede5b-36be-49e8-9977-0eb0d78f452f',
        student_code: 'S3-1-01', // Already exists
        nickname: '중복테스트',
        consent_status: true
    });
    console.log('Duplicate student_code insert error:', dupCodeErr?.code, dupCodeErr?.message);

    // 2. Check null classroom_id constraint
    const { error: nullClassErr } = await supabase.from('students').insert({
        classroom_id: null,
        student_code: 'TEST-NULL-CLASS',
        nickname: '학급없음테스트',
        consent_status: true
    });
    console.log('Null classroom_id insert error:', nullClassErr?.code, nullClassErr?.message);

    // 3. Check null student_code constraint
    const { error: nullCodeErr } = await supabase.from('students').insert({
        classroom_id: '7caede5b-36be-49e8-9977-0eb0d78f452f',
        student_code: null,
        nickname: '코드없음테스트',
        consent_status: true
    });
    console.log('Null student_code insert error:', nullCodeErr?.code, nullCodeErr?.message);
}

testConstraints().catch(console.error);
