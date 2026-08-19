// facilitator-api/scripts/test_summary_s3_1.js
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

async function run() {
    async function createToken(pin) {
        const encoder = new TextEncoder();
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
        const payload = `teacher_session:${expiresAt}`;
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(pin),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
        const sigHex = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
        return `${expiresAt}.${sigHex}`;
    }

    const token = await createToken(process.env.TEACHER_DASHBOARD_PIN || '123456');
    const classroomId = 'a8b79f80-0cf7-4db3-bc8e-2e452c92e76f'; // 3학년 1반
    const res = await fetch(`http://localhost:3000/api/teacher/classrooms/${classroomId}/summary`, {
        headers: { 'Cookie': `teacher_session=${token}` }
    });
    const json = await res.json();
    console.log('Status:', res.status);
    console.log('S3-1-01 Student Summary:');
    const s3_01 = json.students?.find(s => s.student_code === 'S3-1-01');
    console.log(JSON.stringify(s3_01, null, 2));
}

run().catch(console.error);
