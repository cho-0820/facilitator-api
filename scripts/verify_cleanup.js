// facilitator-api/scripts/verify_cleanup.js
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

async function check() {
    await supabase.from('classrooms').delete().eq('name', '실시간 로깅 테스트반');
    const { count: c } = await supabase.from('classrooms').select('*', { count: 'exact', head: true });
    const { count: st } = await supabase.from('students').select('*', { count: 'exact', head: true });
    const { count: se } = await supabase.from('sessions').select('*', { count: 'exact', head: true });
    const { count: ev } = await supabase.from('events').select('*', { count: 'exact', head: true });

    console.log('=== DB COUNTS AFTER CLEANUP ===');
    console.log(`classrooms: ${c}`);
    console.log(`students  : ${st}`);
    console.log(`sessions  : ${se}`);
    console.log(`events    : ${ev}`);
}

check().catch(console.error);
