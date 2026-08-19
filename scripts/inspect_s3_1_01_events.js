// facilitator-api/scripts/inspect_s3_1_01_events.js
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

async function inspect() {
    console.log('=== 1. Student & Classroom Info (S3-1-01) ===');
    const { data: student, error: stErr } = await supabase
        .from('students')
        .select('*')
        .eq('student_code', 'S3-1-01')
        .single();

    if (stErr) console.error('Student Error:', stErr);
    console.log('Student:', student);

    if (student?.classroom_id) {
        const { data: classroom, error: clErr } = await supabase
            .from('classrooms')
            .select('*')
            .eq('id', student.classroom_id)
            .single();
        if (clErr) console.error('Classroom Error:', clErr);
        console.log('Classroom:', classroom);
    }

    console.log('\n=== 2. Sessions for S3-1-01 ===');
    const { data: sessions, error: seErr } = await supabase
        .from('sessions')
        .select('*')
        .eq('student_id', student.id)
        .order('started_at', { ascending: false });

    if (seErr) console.error('Sessions Error:', seErr);
    console.log('Sessions count:', sessions?.length);
    console.log('Sessions:', sessions);

    console.log('\n=== 3. Events for S3-1-01 (via student_id or sessions) ===');
    const sessionIds = (sessions || []).map(s => s.id);
    if (sessionIds.length > 0) {
        const { data: events, error: evErr } = await supabase
            .from('events')
            .select('*')
            .in('session_id', sessionIds)
            .order('event_timestamp', { ascending: false });

        if (evErr) console.error('Events Error:', evErr);
        console.log('Events count:', events?.length);
        console.log('Events:', JSON.stringify(events, null, 2));
    } else {
        // Also check all events just in case session_id didn't match
        const { data: allEvents } = await supabase.from('events').select('*');
        console.log('All events count in DB:', allEvents?.length);
        console.log('All events in DB:', allEvents);
    }
}

inspect().catch(console.error);
