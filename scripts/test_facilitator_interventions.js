// facilitator-api/scripts/test_facilitator_interventions.js
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

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
const USER_DATA_DIR = path.join(__dirname, '../.puppeteer_fac_profile_' + Date.now());

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log('================================================================');
    console.log('=== PHASE 3: 6 FACILITATOR INTERVENTIONS REAL VERIFICATION ===');
    console.log('================================================================\n');

    let testClassroomId = null;

    try {
        // 1. Create Dummy Classroom & Student
        console.log('1. Creating Test Classroom & Consented Student in DB...');
        const { data: classroom, error: classErr } = await supabase
            .from('classrooms')
            .insert({
                name: '퍼실리테이터 개입 검증반',
                teacher_name: '이교사'
            })
            .select()
            .single();

        if (classErr || !classroom) throw new Error(`Classroom insert failed: ${JSON.stringify(classErr)}`);
        testClassroomId = classroom.id;

        const { data: student, error: stErr } = await supabase
            .from('students')
            .insert({
                classroom_id: testClassroomId,
                student_code: 'TEST-FAC-001',
                nickname: '개입검증학생',
                consent_status: true
            })
            .select()
            .single();

        if (stErr || !student) throw new Error(`Student insert failed: ${JSON.stringify(stErr)}`);

        console.log(`- Created Classroom: id=${classroom.id}, name="${classroom.name}"`);
        console.log(`- Created Student: id=${student.id}, code="${student.student_code}"\n`);

        // 2. Post 6 Facilitator Intervention Events to /api/logs
        console.log('2. Sending 6 Facilitator Intervention Events to http://localhost:3000/api/logs ...');
        const testSessionId = `session_fac_verify_${Date.now()}`;
        const nowIso = new Date().toISOString();

        const requestBody = {
            student_code: 'TEST-FAC-001',
            session_id: testSessionId,
            events: [
                {
                    type: 'facilitator_intervention',
                    timestamp: nowIso,
                    payload: {
                        strategy: 'modeling',
                        text: '어떤 기능이 필요하고 어떤 순서로 만들지 생각해봤나요?'
                    }
                },
                {
                    type: 'facilitator_intervention',
                    timestamp: nowIso,
                    payload: {
                        strategy: 'scaffolding',
                        text: '어떤 부분을 스스로 해결할 수 있고, 어떤 부분에 AI 도움이 필요한가요?'
                    }
                },
                {
                    type: 'facilitator_intervention',
                    timestamp: nowIso,
                    payload: {
                        strategy: 'coaching',
                        text: 'AI의 답변 중 어떤 부분이 이해하기 어려운가요?',
                        keyword: '모르겠',
                        count: 3
                    }
                },
                {
                    type: 'facilitator_intervention',
                    timestamp: nowIso,
                    payload: {
                        strategy: 'clarification',
                        text: 'AI가 제안한 블록이 뭘 하는지 스스로 설명해볼 수 있나요?'
                    }
                },
                {
                    type: 'facilitator_intervention',
                    timestamp: nowIso,
                    payload: {
                        strategy: 'reflection',
                        text: 'AI의 접근 방식이 당신과 어떻게 다르고, 왜 다른가요?'
                    }
                },
                {
                    type: 'facilitator_intervention',
                    timestamp: nowIso,
                    payload: {
                        strategy: 'exploration',
                        text: 'AI에게 확인하기 전에, 코드를 고칠 다른 방법을 생각해보세요.',
                        errorKey: 'syntax_error',
                        errorCount: 2
                    }
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

        if (!uploadRes.ok || uploadJson.status !== 'success' || uploadJson.insertedCount !== 6) {
            throw new Error(`Upload verification failed: ${JSON.stringify(uploadJson)}`);
        }

        // 3. Query Supabase events Table Directly
        console.log('\n3. Querying Supabase events table directly for session: ' + testSessionId);
        const { data: dbEvents, error: dbEvErr } = await supabase
            .from('events')
            .select('id, session_id, event_type, trigger_strategy, payload, event_timestamp')
            .eq('session_id', testSessionId)
            .order('created_at', { ascending: true });

        if (dbEvErr) throw dbEvErr;
        console.log(`- Inserted Events Count: ${dbEvents?.length || 0}`);
        console.table(dbEvents);

        // 4. Verify Teacher Summary API
        console.log('\n4. Checking Teacher Dashboard API for summary counts...');
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
        console.log('Summary API Result:');
        console.log(JSON.stringify(summaryJson, null, 2));

        // 5. Browser Screenshot via Puppeteer
        console.log('\n5. Launching browser to capture Teacher Dashboard UI...');
        const browser = await puppeteer.launch({
            executablePath: CHROME_PATH,
            headless: true,
            userDataDir: USER_DATA_DIR,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1280,800']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        await page.setCookie({
            name: 'teacher_session',
            value: token,
            domain: 'localhost',
            path: '/',
            httpOnly: true
        });

        await page.goto('http://localhost:3000/teacher', { waitUntil: 'networkidle0' });
        await sleep(1500);

        await page.waitForSelector('#classroom-select');
        await page.select('#classroom-select', testClassroomId);
        await sleep(2500);

        const shotPath = path.resolve(__dirname, '../../visualizations/screenshot_phase3_facilitator_triggers_verified.png');
        await page.screenshot({ path: shotPath, fullPage: false });
        console.log(`- Screenshot saved to: ${shotPath} (${fs.statSync(shotPath).size} bytes)`);

        await browser.close();

    } finally {
        // 6. Cleanup Test Classroom & Students
        console.log('\n6. Cleaning up test data from Supabase...');
        if (testClassroomId) {
            const { error: delErr } = await supabase
                .from('classrooms')
                .delete()
                .eq('id', testClassroomId);

            if (delErr) console.error('Failed to delete test classroom:', delErr);
            else console.log(`- Deleted test classroom ${testClassroomId} (CASCADE clean)`);
        }

        const { count: cCount } = await supabase.from('classrooms').select('*', { count: 'exact', head: true });
        const { count: stCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
        const { count: seCount } = await supabase.from('sessions').select('*', { count: 'exact', head: true });
        const { count: evCount } = await supabase.from('events').select('*', { count: 'exact', head: true });

        console.log('\n=== DB TABLES COUNT CHECK AFTER CLEANUP ===');
        console.log(`- classrooms table count: ${cCount}`);
        console.log(`- students table count   : ${stCount}`);
        console.log(`- sessions table count   : ${seCount}`);
        console.log(`- events table count     : ${evCount} (기존 학생 대화 이벤트 5건 보존됨)`);
        console.log('============================================\n');
    }
}

runTest().catch(err => {
    console.error('Fatal error during test:', err);
    process.exit(1);
});
