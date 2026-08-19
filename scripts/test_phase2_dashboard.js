// scripts/test_phase2_dashboard.js
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer-core');
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

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = path.join(__dirname, '../.puppeteer_phase2_profile_' + Date.now());

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runPhase2Test() {
    console.log('=====================================================');
    console.log('=== PHASE 2: TEACHER DASHBOARD STATS VERIFICATION ===');
    console.log('=====================================================\n');

    let testClassroomId = null;

    try {
        // ----------------------------------------------------
        // Step 1: Create Dummy Classroom
        // ----------------------------------------------------
        console.log('1. Creating Dummy Classroom...');
        const { data: classroom, error: classErr } = await supabase
            .from('classrooms')
            .insert({
                name: '테스트 5학년 1반',
                teacher_name: '김선생'
            })
            .select()
            .single();

        if (classErr || !classroom) {
            throw new Error(`Failed to create classroom: ${JSON.stringify(classErr)}`);
        }
        testClassroomId = classroom.id;
        console.log(`- Created Classroom: id=${classroom.id}, name="${classroom.name}", teacher="${classroom.teacher_name}"\n`);

        // ----------------------------------------------------
        // Step 2: Create 2 Students (1 consented, 1 unconsented)
        // ----------------------------------------------------
        console.log('2. Creating 2 Students (A: consented, B: unconsented)...');
        const { data: studentA, error: errA } = await supabase
            .from('students')
            .insert({
                classroom_id: testClassroomId,
                student_code: 'TEST-STU-001',
                nickname: '철수(동의)',
                consent_status: true
            })
            .select()
            .single();

        if (errA || !studentA) throw new Error(`Failed to create student A: ${JSON.stringify(errA)}`);

        const { data: studentB, error: errB } = await supabase
            .from('students')
            .insert({
                classroom_id: testClassroomId,
                student_code: 'TEST-STU-002',
                nickname: '영희(미동의)',
                consent_status: false
            })
            .select()
            .single();

        if (errB || !studentB) throw new Error(`Failed to create student B: ${JSON.stringify(errB)}`);

        console.log(`- Student A (Consented): id=${studentA.id}, code=${studentA.student_code}, nickname=${studentA.nickname}`);
        console.log(`- Student B (Unconsented): id=${studentB.id}, code=${studentB.student_code}, nickname=${studentB.nickname}\n`);

        // ----------------------------------------------------
        // Step 3: Create Sessions
        // ----------------------------------------------------
        console.log('3. Creating Sessions for both students...');
        const sessionAId = `test-session-a-${Date.now()}`;
        const sessionBId = `test-session-b-${Date.now()}`;

        const { error: sessErrA } = await supabase.from('sessions').insert({
            id: sessionAId,
            student_id: studentA.id,
            started_at: new Date().toISOString()
        });
        if (sessErrA) throw new Error(`Failed to create session A: ${JSON.stringify(sessErrA)}`);

        const { error: sessErrB } = await supabase.from('sessions').insert({
            id: sessionBId,
            student_id: studentB.id,
            started_at: new Date().toISOString()
        });
        if (sessErrB) throw new Error(`Failed to create session B: ${JSON.stringify(sessErrB)}`);

        console.log(`- Created Session A: ${sessionAId}`);
        console.log(`- Created Session B: ${sessionBId}\n`);

        // ----------------------------------------------------
        // Step 4: Insert Events for Student A (Consented)
        // ----------------------------------------------------
        console.log('4. Inserting Events for Student A (all 6 triggers + repeated error)...');
        // Insert:
        // - modeling: 1
        // - scaffolding: 2 (planning total = 3)
        // - coaching: 2
        // - clarification: 1 (monitoring total = 3)
        // - reflection: 1
        // - exploration: 3 (modification total = 4)
        // - Repeated Error: "message_syntax_unexpected_token" x 3 occurrences
        // - Non-repeated Error: "message_conv_no_variable" x 1 occurrence
        const nowIso = new Date().toISOString();
        const eventsStudentA = [
            // Planning
            { session_id: sessionAId, event_type: 'ai_chat_input', trigger_strategy: 'modeling', event_timestamp: nowIso, payload: { strategy: 'modeling' } },
            { session_id: sessionAId, event_type: 'ai_chat_input', trigger_strategy: 'scaffolding', event_timestamp: nowIso, payload: { strategy: 'scaffolding' } },
            { session_id: sessionAId, event_type: 'ai_chat_input', trigger_strategy: 'scaffolding', event_timestamp: nowIso, payload: { strategy: 'scaffolding' } },
            
            // Monitoring
            { session_id: sessionAId, event_type: 'ai_chat_input', trigger_strategy: 'coaching', event_timestamp: nowIso, payload: { strategy: 'coaching' } },
            { session_id: sessionAId, event_type: 'ai_chat_input', trigger_strategy: 'coaching', event_timestamp: nowIso, payload: { strategy: 'coaching' } },
            { session_id: sessionAId, event_type: 'block_suggestion', trigger_strategy: 'clarification', event_timestamp: nowIso, payload: { strategy: 'clarification' } },

            // Modification
            { session_id: sessionAId, event_type: 'ai_chat_input', trigger_strategy: 'reflection', event_timestamp: nowIso, payload: { strategy: 'reflection' } },
            { session_id: sessionAId, event_type: 'error', trigger_strategy: 'exploration', event_timestamp: nowIso, payload: { strategy: 'exploration', message: 'message_syntax_unexpected_token' } },
            { session_id: sessionAId, event_type: 'error', trigger_strategy: 'exploration', event_timestamp: nowIso, payload: { strategy: 'exploration', message: 'message_syntax_unexpected_token' } },
            { session_id: sessionAId, event_type: 'error', trigger_strategy: 'exploration', event_timestamp: nowIso, payload: { strategy: 'exploration', message: 'message_syntax_unexpected_token' } },

            // Non-repeated single error
            { session_id: sessionAId, event_type: 'error', trigger_strategy: null, event_timestamp: nowIso, payload: { message: 'message_conv_no_variable' } }
        ];

        const { error: evErrA } = await supabase.from('events').insert(eventsStudentA);
        if (evErrA) throw new Error(`Failed to insert events for Student A: ${JSON.stringify(evErrA)}`);
        console.log(`- Inserted ${eventsStudentA.length} events for Student A.\n`);

        // ----------------------------------------------------
        // Step 5: Insert Events for Student B (Unconsented)
        // ----------------------------------------------------
        console.log('5. Inserting Events for Student B (to verify strict redaction)...');
        const eventsStudentB = [
            { session_id: sessionBId, event_type: 'ai_chat_input', trigger_strategy: 'modeling', event_timestamp: nowIso, payload: { strategy: 'modeling' } },
            { session_id: sessionBId, event_type: 'error', trigger_strategy: 'exploration', event_timestamp: nowIso, payload: { message: 'secret_error_should_be_hidden' } }
        ];
        const { error: evErrB } = await supabase.from('events').insert(eventsStudentB);
        if (evErrB) throw new Error(`Failed to insert events for Student B: ${JSON.stringify(evErrB)}`);
        console.log(`- Inserted ${eventsStudentB.length} events for Student B.\n`);

        // Inline HMAC token generation for API testing
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

        const authToken = await createToken(process.env.TEACHER_DASHBOARD_PIN || '1234');
        const authHeaders = { 'Cookie': `teacher_session=${authToken}` };

        // ----------------------------------------------------
        // Step 6: Test API Endpoints
        // ----------------------------------------------------
        console.log('6. Calling GET /api/teacher/classrooms (with auth cookie) ...');
        const listRes = await fetch('http://localhost:3000/api/teacher/classrooms', { headers: authHeaders });
        const listData = await listRes.json();
        console.log('Response Status:', listRes.status);
        console.log('Classrooms List Result:');
        console.log(JSON.stringify(listData, null, 2));

        console.log(`\n7. Calling GET /api/teacher/classrooms/${testClassroomId}/summary (with auth cookie) ...`);
        const summaryRes = await fetch(`http://localhost:3000/api/teacher/classrooms/${testClassroomId}/summary`, { headers: authHeaders });
        const summaryData = await summaryRes.json();
        console.log('Response Status:', summaryRes.status);
        console.log('Summary Result (Raw JSON):');
        console.log(JSON.stringify(summaryData, null, 2));

        // ----------------------------------------------------
        // Step 7: Browser UI Screenshot Test
        // ----------------------------------------------------
        console.log('\n8. Launching Browser to verify /teacher Dashboard UI...');
        const browser = await puppeteer.launch({
            executablePath: CHROME_PATH,
            headless: true,
            userDataDir: USER_DATA_DIR,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--window-size=1280,800'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Authenticate via login page
        console.log('- Navigating to login page...');
        await page.goto('http://localhost:3000/teacher/login', { waitUntil: 'domcontentloaded' });
        await sleep(1500);

        await page.waitForSelector('#pin');
        await page.click('#pin');
        await page.keyboard.type(process.env.TEACHER_DASHBOARD_PIN || '1234', { delay: 30 });
        await page.click('button[type="submit"]');

        console.log('- Waiting for dashboard table rendering...');
        await sleep(3500);

        // Select our test classroom if needed
        await page.waitForSelector('#classroom-select');
        await page.select('#classroom-select', testClassroomId);
        await sleep(2500);

        const currentUrl = page.url();
        console.log(`- Current Page URL: ${currentUrl}`);

        const shotPath = path.resolve(__dirname, '../../visualizations/screenshot_phase2_dashboard.png');
        await page.screenshot({ path: shotPath, fullPage: false });
        console.log(`- Dashboard Screenshot saved to: ${shotPath} (${fs.statSync(shotPath).size} bytes)`);

        await browser.close();

    } finally {
        // ----------------------------------------------------
        // Step 8: Clean up all dummy data & verify 0 records
        // ----------------------------------------------------
        console.log('\n9. Cleaning up test data from Supabase...');
        if (testClassroomId) {
            const { error: delErr } = await supabase
                .from('classrooms')
                .delete()
                .eq('id', testClassroomId);

            if (delErr) {
                console.error('Failed to delete test classroom:', delErr);
            } else {
                console.log(`- Deleted test classroom ${testClassroomId} (CASCADE deleted students, sessions, events)`);
            }
        }

        // Verify counts on all 4 tables
        const { count: cCount } = await supabase.from('classrooms').select('*', { count: 'exact', head: true });
        const { count: stCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
        const { count: seCount } = await supabase.from('sessions').select('*', { count: 'exact', head: true });
        const { count: evCount } = await supabase.from('events').select('*', { count: 'exact', head: true });

        console.log('\n=== DB TABLES COUNT CHECK AFTER CLEANUP ===');
        console.log(`- classrooms table count: ${cCount}`);
        console.log(`- students table count   : ${stCount}`);
        console.log(`- sessions table count   : ${seCount}`);
        console.log(`- events table count     : ${evCount}`);
        console.log('============================================\n');
    }
}

runPhase2Test().catch(err => {
    console.error('Fatal error in Phase 2 test:', err);
    process.exit(1);
});
