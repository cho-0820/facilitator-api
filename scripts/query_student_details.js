// facilitator-api/scripts/query_student_details.js
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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
    const { data: student, error: stErr } = await supabase
        .from('students')
        .select('*, classrooms(*)')
        .eq('student_code', 'S3-1-01')
        .single();

    console.log('=== Student Details (S3-1-01) ===');
    console.log(JSON.stringify(student, null, 2));

    const { data: sessions, error: seErr } = await supabase
        .from('sessions')
        .select('*')
        .eq('student_id', student.id);

    console.log('\n=== Sessions ===');
    console.log(JSON.stringify(sessions, null, 2));

    const { data: events, error: evErr } = await supabase
        .from('events')
        .select('id, session_id, event_type, trigger_strategy, event_timestamp, payload')
        .in('session_id', sessions.map(s => s.id))
        .order('event_timestamp', { ascending: false });

    console.log(`\n=== Events (Total: ${events?.length || 0}) ===`);
    console.log(JSON.stringify(events, null, 2));
}

run().catch(console.error);
