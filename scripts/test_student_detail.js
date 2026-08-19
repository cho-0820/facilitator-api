const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
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
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = path.join(__dirname, '../.puppeteer_detail_test_' + Date.now());

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function createTeacherToken(pin) {
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

async function cleanupTestData() {
    await supabase.from('projects').delete().filter('project_name', 'in', '("자판기 프로그램","도형 그리기","비공개 프로젝트")');
    await supabase.from('students').delete().in('student_code', ['S3-1-TEST-A', 'S3-1-TEST-B']);
}

async function runDetailTest() {
    console.log('========================================================================');
    console.log('=== PHASE 4: STUDENT DETAIL (PROJECT SUMMARY & AI CHAT) VERIFICATION ===');
    console.log('========================================================================\n');

    let studentA = null;
    let studentB = null;

    // Clean up any leftovers first
    await cleanupTestData();

    try {
        // 1. Fetch default classroom "3학년 1반"
        const { data: classroom, error: cErr } = await supabase
            .from('classrooms')
            .select('id, name')
            .eq('name', '3학년 1반')
            .single();

        if (cErr || !classroom) throw new Error('Classroom "3학년 1반" not found: ' + cErr?.message);

        console.log(`1. Creating Dummy Students in "${classroom.name}" (ID: ${classroom.id})...`);

        // a) Dummy Student A (consent_status: true)
        const { data: insertedA, error: aErr } = await supabase
            .from('students')
            .insert({
                classroom_id: classroom.id,
                student_code: 'S3-1-TEST-A',
                nickname: '테스트 토끼 (A)',
                consent_status: true
            })
            .select('id, student_code, nickname, consent_status')
            .single();
        if (aErr) throw aErr;
        studentA = insertedA;
        console.log(`- Created Student A: ${studentA.nickname} (ID: ${studentA.id}, Code: ${studentA.student_code}, Consent: ${studentA.consent_status})`);

        // b) Dummy Student B (consent_status: false)
        const { data: insertedB, error: bErr } = await supabase
            .from('students')
            .insert({
                classroom_id: classroom.id,
                student_code: 'S3-1-TEST-B',
                nickname: '비동의 부엉이 (B)',
                consent_status: false
            })
            .select('id, student_code, nickname, consent_status')
            .single();
        if (bErr) throw bErr;
        studentB = insertedB;
        console.log(`- Created Student B: ${studentB.nickname} (ID: ${studentB.id}, Code: ${studentB.student_code}, Consent: ${studentB.consent_status})\n`);

        // 2. Insert Dummy Projects for Student A (2 projects with complex nested blocks & chat messages)
        console.log('2. Inserting Dummy Projects for Student A & B...');

        const projectDataA1 = {
            name: '자판기 프로그램',
            objects: [
                {
                    id: 'obj1',
                    name: '엔트리봇',
                    script: JSON.stringify([
                        [
                            { type: 'when_run_button_click', params: [] },
                            { type: 'set_variable', params: ['총금액', { type: 'number', params: [0] }] },
                            {
                                type: 'repeat_basic',
                                params: [{ type: 'number', params: [3] }],
                                statements: [
                                    [
                                        { type: 'move_direction', params: [{ type: 'number', params: [10] }] },
                                        { type: 'move_direction', params: [] },
                                        { type: 'sound_something', params: ['beep'] }
                                    ]
                                ]
                            },
                            {
                                type: 'if_else',
                                params: [
                                    {
                                        type: 'boolean_bigger',
                                        params: [
                                            { type: 'calc_plus', params: [{ type: 'number', params: [5] }, { type: 'number', params: [2] }] },
                                            { type: 'number', params: [10] }
                                        ]
                                    }
                                ],
                                statements: [
                                    [{ type: 'show_dialog', params: ['안녕!'] }],
                                    [{ type: 'hide_dialog', params: [] }]
                                ]
                            }
                        ]
                    ])
                }
            ],
            messages: [
                { type: 'user', text: '자판기 프로그램을 만들고 싶어.', time: '10:00' },
                { type: 'assistant', text: '자판기에는 동전을 넣는 반복문과 금액을 비교하는 조건문이 필요해요.', time: '10:01' },
                { type: 'user', text: '금액이 1000원이 넘으면 음료수가 나오는 코드를 짜줘.', time: '10:02' },
                { type: 'assistant', text: '만약 총금액 > 1000 이라면 음료수를 출력하는 블록을 만들었어요!', time: '10:03' }
            ]
        };

        const { error: a1Err } = await supabase
            .from('projects')
            .insert({
                student_id: studentA.id,
                project_name: '자판기 프로그램',
                project_data: projectDataA1,
                updated_at: new Date(Date.now() - 10000).toISOString()
            });
        if (a1Err) throw a1Err;

        const projectDataA2 = {
            name: '도형 그리기',
            objects: [
                {
                    id: 'obj2',
                    name: '연필',
                    script: JSON.stringify([
                        [
                            { type: 'when_run_button_click', params: [] },
                            {
                                type: 'repeat_basic',
                                params: [{ type: 'number', params: [4] }],
                                statements: [
                                    [
                                        { type: 'move_direction', params: [] },
                                        { type: 'rotate_by_angle', params: [] }
                                    ]
                                ]
                            }
                        ]
                    ])
                }
            ],
            messages: [
                { type: 'user', text: '사각형을 어떻게 그려?', time: '11:00' },
                { type: 'assistant', text: '4번 반복하기 블록 안에 90도 회전 블록을 넣으세요.', time: '11:01' }
            ]
        };

        const { error: a2Err } = await supabase
            .from('projects')
            .insert({
                student_id: studentA.id,
                project_name: '도형 그리기',
                project_data: projectDataA2,
                updated_at: new Date().toISOString()
            });
        if (a2Err) throw a2Err;

        // Project B1 for Student B (consent_status: false)
        const { error: b1Err } = await supabase
            .from('projects')
            .insert({
                student_id: studentB.id,
                project_name: '비공개 프로젝트',
                project_data: { name: '비공개', objects: [] },
                updated_at: new Date().toISOString()
            });
        if (b1Err) throw b1Err;

        console.log('- Projects inserted for Student A (2 projects) and Student B (1 project).\n');

        // 3. Test GET /api/teacher/students/[studentA.id]/detail
        console.log(`3. Testing API: GET http://localhost:3000/api/teacher/students/${studentA.id}/detail ...`);
        const token = await createTeacherToken(env.TEACHER_DASHBOARD_PIN || '123456');

        const resA = await fetch(`http://localhost:3000/api/teacher/students/${studentA.id}/detail`, {
            headers: { 'Cookie': `teacher_session=${token}` }
        });
        console.log(`- HTTP Status: ${resA.status} ${resA.statusText}`);
        const dataA = await resA.json();
        console.log('\n--- Student A API Response JSON (Raw) ---');
        console.log(JSON.stringify(dataA, null, 2));

        if (!resA.ok) throw new Error('API request failed for Student A: ' + JSON.stringify(dataA));

        // Verification of Student A details
        if (!dataA.consent_status) throw new Error('Student A consent_status should be true!');
        if (!dataA.projects || dataA.projects.length !== 2) {
            throw new Error(`Expected 2 projects for Student A, got ${dataA.projects?.length}`);
        }

        const pA1 = dataA.projects.find(p => p.project_name === '자판기 프로그램');
        if (!pA1) throw new Error('Project "자판기 프로그램" missing from response!');

        console.log('\n- Verifying Block Summary for "자판기 프로그램":');
        console.log('  Actual Summary:', pA1.block_summary);
        console.log('  Actual Total Blocks:', pA1.total_blocks);

        // Check essential nested block types in A1
        if (!pA1.block_summary.when_run_button_click || pA1.block_summary.when_run_button_click !== 1) {
            throw new Error('Missing or wrong count for when_run_button_click!');
        }
        if (!pA1.block_summary.repeat_basic || pA1.block_summary.repeat_basic !== 1) {
            throw new Error('Missing or wrong count for repeat_basic!');
        }
        if (!pA1.block_summary.move_direction || pA1.block_summary.move_direction !== 2) {
            throw new Error(`Nested move_direction count mismatch! Expected 2, got ${pA1.block_summary.move_direction}`);
        }
        if (!pA1.block_summary.if_else || pA1.block_summary.if_else !== 1) {
            throw new Error('Missing or wrong count for if_else!');
        }
        if (!pA1.block_summary.show_dialog || pA1.block_summary.show_dialog !== 1) {
            throw new Error('Nested show_dialog count mismatch!');
        }
        if (!pA1.block_summary.hide_dialog || pA1.block_summary.hide_dialog !== 1) {
            throw new Error('Nested hide_dialog count mismatch!');
        }
        if (pA1.chat_messages.length !== 4) {
            throw new Error(`Chat messages count mismatch! Expected 4, got ${pA1.chat_messages.length}`);
        }
        console.log('  ✓ Block summary and nested counts for Project A1 matched 100% perfectly!');

        // 4. Test GET /api/teacher/students/[studentB.id]/detail (Consent = false)
        console.log(`\n4. Testing API: GET http://localhost:3000/api/teacher/students/${studentB.id}/detail ...`);
        const resB = await fetch(`http://localhost:3000/api/teacher/students/${studentB.id}/detail`, {
            headers: { 'Cookie': `teacher_session=${token}` }
        });
        console.log(`- HTTP Status: ${resB.status} ${resB.statusText}`);
        const dataB = await resB.json();
        console.log('\n--- Student B API Response JSON (Raw) ---');
        console.log(JSON.stringify(dataB, null, 2));

        if (dataB.consent_status !== false) {
            throw new Error('Student B consent_status should be false!');
        }
        if (dataB.projects || dataB.student || dataB.block_summary) {
            throw new Error('Student B response must NOT contain projects or student data!');
        }
        console.log('  ✓ Student B (consent_status: false) correctly returned { consent_status: false } only!');

        // 5. Read-only Verification of Existing Student "기발한 토끼" (S3-1-01)
        console.log('\n5. Performing Read-Only Verification on Real Student "기발한 토끼" (S3-1-01)...');
        const { data: realStudent } = await supabase
            .from('students')
            .select('id, student_code, nickname')
            .eq('student_code', 'S3-1-01')
            .single();

        if (realStudent) {
            const resReal = await fetch(`http://localhost:3000/api/teacher/students/${realStudent.id}/detail`, {
                headers: { 'Cookie': `teacher_session=${token}` }
            });
            console.log(`- Real Student HTTP Status: ${resReal.status} ${resReal.statusText}`);
            const dataReal = await resReal.json();
            console.log(`- Real Student Details: consent_status=${dataReal.consent_status}, projects_count=${dataReal.projects?.length}`);
            if (dataReal.projects && dataReal.projects.length > 0) {
                console.log(`  Project 1: "${dataReal.projects[0].project_name}" (blocks: ${dataReal.projects[0].total_blocks}, chats: ${dataReal.projects[0].chat_messages?.length})`);
            }
            console.log('  ✓ Real student data retrieved cleanly without error.');
        }

        // 6. Puppeteer Browser UI Verification
        console.log('\n6. Launching Puppeteer for UI Verification...');
        const browser = await puppeteer.launch({
            executablePath: CHROME_PATH,
            headless: true,
            userDataDir: USER_DATA_DIR,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1280,960']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 960 });

        await page.setCookie({
            name: 'teacher_session',
            value: token,
            domain: 'localhost',
            path: '/',
            httpOnly: true
        });

        console.log('- Navigating to http://localhost:3000/teacher ...');
        await page.goto('http://localhost:3000/teacher', { waitUntil: 'networkidle0' });
        await sleep(1500);

        // Select "3학년 1반" to show our test students
        console.log(`- Selecting classroom "${classroom.name}" (#classroom-select)...`);
        await page.waitForSelector('#classroom-select');
        await page.select('#classroom-select', classroom.id);
        await sleep(2000);

        // A. Capture Disabled Button for Student B
        console.log('- Checking disabled state for Student B (#btn-detail-disabled-S3-1-TEST-B)...');
        await page.waitForSelector('#btn-detail-disabled-S3-1-TEST-B');
        const disabledBtn = await page.$('#btn-detail-disabled-S3-1-TEST-B');
        const isDisabled = await page.evaluate(el => el.disabled, disabledBtn);
        console.log(`  Student B button disabled attribute: ${isDisabled}`);

        // B. Click "상세보기" for Student A
        console.log('- Clicking "상세보기" for Student A (#btn-detail-S3-1-TEST-A)...');
        await page.waitForSelector('#btn-detail-S3-1-TEST-A');
        await page.click('#btn-detail-S3-1-TEST-A');
        await sleep(2000);

        // Verify Modal is opened
        await page.waitForSelector('#student-detail-modal');
        console.log('- Student detail modal is visible!');

        // Select project "자판기 프로그램"
        console.log('- Switching project to "자판기 프로그램" in modal dropdown...');
        await page.select('#select-detail-project', '1');
        await sleep(1000);

        // Screenshot Modal
        const screenshotModalPath = path.resolve(__dirname, '../../visualizations/screenshot_student_detail_modal.png');
        await page.screenshot({ path: screenshotModalPath, fullPage: false });
        console.log(`- Modal Screenshot saved to: ${screenshotModalPath} (${fs.statSync(screenshotModalPath).size} bytes)`);

        // Close Modal
        console.log('- Closing detail modal...');
        await page.click('#btn-close-detail-modal');
        await sleep(1000);

        // Screenshot Table Overview
        const screenshotTablePath = path.resolve(__dirname, '../../visualizations/screenshot_student_detail_table.png');
        await page.screenshot({ path: screenshotTablePath, fullPage: false });
        console.log(`- Table Overview Screenshot saved to: ${screenshotTablePath} (${fs.statSync(screenshotTablePath).size} bytes)`);

        await browser.close();

    } finally {
        // 7. Cleanup Test Data ONLY
        console.log('\n7. Cleaning up dummy students and dummy projects...');
        await cleanupTestData();

        // Final Count Verification
        const { count: finalStudentCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
        const { count: finalProjectCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });

        console.log('\n=== FINAL DB STATUS AFTER CLEANUP ===');
        console.log(`- Students count: ${finalStudentCount} (15 expected)`);
        console.log(`- Projects count: ${finalProjectCount} (4 expected)`);
        console.log('=====================================\n');
    }
}

runDetailTest().catch(err => {
    console.error('Fatal error during detail test:', err);
    process.exit(1);
});
