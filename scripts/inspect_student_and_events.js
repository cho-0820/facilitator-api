// scripts/inspect_student_and_events.js
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [k, ...v] = trimmed.split('=');
            if (k && v.length > 0) {
                const val = v.join('=').replace(/^["'](.*)["']$/, '$1');
                process.env[k.trim()] = val;
            }
        }
    }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function inspect() {
    console.log('=== 1. Supabase Students Table Query ===');
    // Search by nickname '민첩한 표범' or student_code 'S4-1-01' or list all 4학년 1반 students
    const { data: allStudents, error: stErr } = await supabase
        .from('students')
        .select('id, student_code, nickname, consent_status, classroom_id, created_at')
        .order('student_code', { ascending: true });

    if (stErr) {
        console.error('Error fetching students:', stErr);
    } else {
        console.log('All students in DB:');
        console.table(allStudents);
    }

    const leopard = allStudents?.find(s => s.nickname.includes('표범') || s.student_code === 'S4-1-01');
    console.log('\n"민첩한 표범" Student Row Detail:');
    console.log(JSON.stringify(leopard, null, 2));

    console.log('\n=== 3. Sessions & Events for this Student ===');
    if (leopard) {
        const { data: sessions, error: sessErr } = await supabase
            .from('sessions')
            .select('*')
            .eq('student_id', leopard.id);

        console.log(`Sessions count for ${leopard.nickname} (${leopard.student_code}): ${sessions?.length || 0}`);
        console.log(JSON.stringify(sessions, null, 2));

        const sessionIds = (sessions || []).map(s => s.id);
        if (sessionIds.length > 0) {
            const { data: events, error: evErr } = await supabase
                .from('events')
                .select('*')
                .in('session_id', sessionIds);

            console.log(`Events count for ${leopard.nickname}: ${events?.length || 0}`);
            console.log(JSON.stringify(events, null, 2));
        } else {
            console.log('No sessions found, checking all events in DB...');
            const { data: allEvents } = await supabase.from('events').select('*');
            console.log(`Total events in events table: ${allEvents?.length || 0}`);
            if (allEvents && allEvents.length > 0) {
                console.log(JSON.stringify(allEvents, null, 2));
            }
        }
    }
}

inspect().catch(err => {
    console.error('Inspection failed:', err);
});
