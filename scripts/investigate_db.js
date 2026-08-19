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
        if (k && v.length > 0) env[k.trim()] = v.join('=').replace(/^["'](.*)["']$/, '$1');
    }
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function investigate() {
    // 1. Distinct event_types in events table
    console.log('=== 1. ALL DISTINCT EVENT TYPES IN events TABLE ===');
    const { data: allEvents } = await supabase
        .from('events')
        .select('event_type');
    const uniqueTypes = [...new Set((allEvents || []).map(r => r.event_type))].sort();
    const typeCounts = {};
    (allEvents || []).forEach(r => { typeCounts[r.event_type] = (typeCounts[r.event_type] || 0) + 1; });
    console.log('Distinct types with counts:', typeCounts);

    // 2. ai_chat_input sample payloads
    console.log('\n=== 2. ai_chat_input SAMPLE PAYLOADS (up to 5 rows) ===');
    const { data: chatInputs } = await supabase
        .from('events')
        .select('event_type, trigger_strategy, event_timestamp, payload')
        .eq('event_type', 'ai_chat_input')
        .order('event_timestamp', { ascending: true })
        .limit(5);
    (chatInputs || []).forEach((r, i) => {
        console.log(`\n--- ai_chat_input [${i+1}] ---`);
        console.log('timestamp:', r.event_timestamp);
        console.log('payload keys:', Object.keys(r.payload || {}));
        const s = JSON.stringify(r.payload);
        console.log('payload:', s.substring(0, 400) + (s.length > 400 ? '...(truncated)' : ''));
    });

    // 3. block_suggestion sample payloads
    console.log('\n=== 3. block_suggestion SAMPLE PAYLOADS (up to 5 rows) ===');
    const { data: suggestions } = await supabase
        .from('events')
        .select('event_type, trigger_strategy, event_timestamp, payload')
        .eq('event_type', 'block_suggestion')
        .order('event_timestamp', { ascending: true })
        .limit(5);
    (suggestions || []).forEach((r, i) => {
        console.log(`\n--- block_suggestion [${i+1}] ---`);
        console.log('timestamp:', r.event_timestamp);
        console.log('payload keys:', Object.keys(r.payload || {}));
        const s = JSON.stringify(r.payload);
        console.log('payload:', s.substring(0, 400) + (s.length > 400 ? '...(truncated)' : ''));
    });

    // 4. facilitator_intervention sample
    console.log('\n=== 4. facilitator_intervention SAMPLE (up to 5 rows) ===');
    const { data: facils } = await supabase
        .from('events')
        .select('event_type, trigger_strategy, event_timestamp, payload')
        .eq('event_type', 'facilitator_intervention')
        .order('event_timestamp', { ascending: true })
        .limit(5);
    (facils || []).forEach((r, i) => {
        console.log(`\n--- facilitator_intervention [${i+1}] ---`);
        console.log('timestamp:', r.event_timestamp, '| strategy:', r.trigger_strategy);
        const s = JSON.stringify(r.payload);
        console.log('payload:', s.substring(0, 300));
    });

    // 5. Interleaved ai_chat_input + block_suggestion from a single session
    console.log('\n=== 5. INTERLEAVED CHAT SESSION (ai_chat_input + block_suggestion, time-ordered) ===');
    const { data: sessionWithChat } = await supabase
        .from('events')
        .select('session_id, event_type, event_timestamp, payload')
        .in('event_type', ['ai_chat_input', 'block_suggestion'])
        .order('event_timestamp', { ascending: true })
        .limit(20);

    (sessionWithChat || []).forEach((r, i) => {
        const s = JSON.stringify(r.payload);
        console.log(`[${i+1}] ${r.event_type} @ ${r.event_timestamp}`);
        console.log(`  session: ${r.session_id}`);
        console.log(`  payload: ${s.substring(0, 300)}${s.length > 300 ? '...' : ''}`);
        console.log('');
    });

    if (!sessionWithChat || sessionWithChat.length === 0) {
        console.log('(No ai_chat_input or block_suggestion events found in DB)');
    }

    // 6. Check projects table
    console.log('\n=== 6. projects TABLE STATUS ===');
    const { count: projCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
    console.log('Row count:', projCount);

    if (projCount && projCount > 0) {
        const { data: projSample } = await supabase
            .from('projects')
            .select('id, student_id, project_name, updated_at')
            .limit(5);
        console.log('\nprojects metadata (id, student_id, project_name, updated_at):');
        console.table(projSample);

        const { data: oneProject } = await supabase
            .from('projects')
            .select('project_name, updated_at, project_data')
            .limit(1)
            .single();

        if (oneProject) {
            const dataStr = JSON.stringify(oneProject.project_data);
            console.log('\nproject_name:', oneProject.project_name);
            console.log('project_data total size (bytes):', dataStr.length);
            console.log('project_data top-level keys:', Object.keys(oneProject.project_data || {}));
            if (oneProject.project_data) {
                const pd = oneProject.project_data;
                if (pd.objects) console.log('  objects count:', pd.objects.length);
                if (pd.scenes) console.log('  scenes count:', pd.scenes.length);
                if (pd.variables) console.log('  variables count:', pd.variables.length);
                if (pd.messages) console.log('  messages count (AI conv):', pd.messages.length);
            }
            console.log('project_data preview (first 600 chars):');
            console.log(dataStr.substring(0, 600));
        }
    } else {
        console.log('No projects saved in DB yet.');
    }
}

investigate().catch(err => console.error('Fatal error:', err));
