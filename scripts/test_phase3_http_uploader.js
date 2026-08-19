// facilitator-api/scripts/test_phase3_http_uploader.js
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
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = path.join(__dirname, '../.puppeteer_phase3_profile_' + Date.now());

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log('===========================================================');
    console.log('=== PHASE 3: HTTP DATA UPLOADER TO /api/logs VERIFICATION ===');
    console.log('===========================================================\n');

    let testClassroomId = null;
    let testStudentId = null;

    try {
        // ----------------------------------------------------
        // Step 1: Create Dummy Classroom & Consented Student
        // ----------------------------------------------------
        console.log('1. Creating Dummy Classroom & Consented Student in DB...');
        const { data: classroom, error: classErr } = await supabase
            .from('classrooms')
            .insert({
                name: '실시간 로깅 테스트반',
                teacher_name: '박교사'
            })
            .select()
            .single();

        if (classErr || !classroom) throw new Error(`Classroom insert failed: ${JSON.stringify(classErr)}`);
        testClassroomId = classroom.id;

        const { data: student, error: stErr } = await supabase
            .from('students')
            .insert({
                classroom_id: testClassroomId,
                student_code: 'TEST-HTTP-001',
                nickname: '동의학생(실시간)',
                consent_status: true // Consented student
            })
            .select()
            .single();

        if (stErr || !student) throw new Error(`Student insert failed: ${JSON.stringify(stErr)}`);
        testStudentId = student.id;

        console.log(`- Created Classroom: id=${classroom.id}, name="${classroom.name}"`);
        console.log(`- Created Student: id=${student.id}, code="${student.student_code}", consent_status=${student.consent_status}\n`);

        // ----------------------------------------------------
        // Step 2: Send Logs to /api/logs via HttpDataUploader format
        // ----------------------------------------------------
        console.log('2. Sending HTTP POST request to http://localhost:3000/api/logs ...');
        const testSessionId = `session_http_${Date.now()}`;
        const nowIso = new Date().toISOString();

        const requestBody = {
            student_code: 'TEST-HTTP-001',
            session_id: testSessionId,
            events: [
                {
                    type: 'ai_chat_input',
                    timestamp: nowIso,
                    payload: { message: '엔트리봇 움직이기', strategy: 'modeling' }
                },
                {
                    type: 'ai_chat_input',
                    timestamp: nowIso,
                    payload: { message: '어떻게 할까?', strategy: 'scaffolding' }
                },
                {
                    type: 'block_suggestion',
                    timestamp: nowIso,
                    payload: { strategy: 'clarification' }
                },
                {
                    type: 'error',
                    timestamp: nowIso,
                    payload: { message: 'message_syntax_unexpected_token', strategy: 'exploration' }
                },
                {
                    type: 'error',
                    timestamp: nowIso,
                    payload: { message: 'message_syntax_unexpected_token', strategy: 'exploration' }
                }
            ]
        };

        console.log('Request Body (Raw JSON):');
        console.log(JSON.stringify(requestBody, null, 2));

        const uploadRes = await fetch('http://localhost:3000/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        console.log(`\nResponse HTTP Status: ${uploadRes.status} ${uploadRes.statusText}`);
        const uploadJson = await uploadRes.json();
        console.log('Response Body:');
        console.log(JSON.stringify(uploadJson, null, 2));

        if (!uploadRes.ok || uploadJson.status !== 'success') {
            throw new Error(`Upload failed or status not 'success': ${JSON.stringify(uploadJson)}`);
        }

        // ----------------------------------------------------
        // Step 3: Directly Query Supabase DB to Verify Inserted Events
        // ----------------------------------------------------
        console.log('\n3. Querying Supabase sessions and events tables directly...');
        const { data: dbSessions, error: dbSessErr } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', testSessionId);

        console.log(`- Sessions queried for ${testSessionId}:`);
        console.log(JSON.stringify(dbSessions, null, 2));

        const { data: dbEvents, error: dbEvErr } = await supabase
            .from('events')
            .select('id, session_id, event_type, trigger_strategy, payload, event_timestamp')
            .eq('session_id', testSessionId);

        console.log(`- Events queried for session (Total: ${dbEvents?.length || 0}):`);
        console.table(dbEvents);

        // ----------------------------------------------------
        // Step 4: Verify Teacher Dashboard API & UI
        // ----------------------------------------------------
        console.log('\n4. Checking Teacher Dashboard API for this classroom...');
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
        const summaryRes = await fetch(`http://localhost:3000/api/teacher/classrooms/${testClassroomId}/summary`, {
            headers: { 'Cookie': `teacher_session=${token}` }
        });
        const summaryJson = await summaryRes.json();
        console.log('Teacher Summary API Result:');
        console.log(JSON.stringify(summaryJson, null, 2));

        // Browser Screenshot Test
        console.log('\n5. Launching Puppeteer to capture Teacher Dashboard UI...');
        const browser = await puppeteer.launch({
            executablePath: CHROME_PATH,
            headless: true,
            userDataDir: USER_DATA_DIR,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1280,800']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        await page.goto('http://localhost:3000/teacher/login', { waitUntil: 'domcontentloaded' });
        await sleep(1500);

        await page.waitForSelector('#pin');
        await page.click('#pin');
        await page.keyboard.type(process.env.TEACHER_DASHBOARD_PIN || '123456', { delay: 30 });
        await page.click('button[type="submit"]');
        await sleep(3000);

        await page.waitForSelector('#classroom-select');
        await page.select('#classroom-select', testClassroomId);
        await sleep(2500);

        const shotPath = path.resolve(__dirname, '../../visualizations/screenshot_phase3_http_upload_dashboard.png');
        await page.screenshot({ path: shotPath, fullPage: false });
        console.log(`- Screenshot saved to: ${shotPath} (${fs.statSync(shotPath).size} bytes)`);

        await browser.close();

    } finally {
        // ----------------------------------------------------
        // Step 6: Cleanup Test Data & Verify 0 records
        // ----------------------------------------------------
        console.log('\n6. Cleaning up test data from Supabase...');
        if (testClassroomId) {
            const { error: delErr } = await supabase
                .from('classrooms')
                .delete()
                .eq('id', testClassroomId);

            if (delErr) {
                console.error('Failed to delete test classroom:', delErr);
            } else {
                console.log(`- Deleted test classroom ${testClassroomId} (CASCADE clean)`);
            }
        }

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

runTest().catch(err => {
    console.error('Fatal error during test:', err);
    process.exit(1);
});
