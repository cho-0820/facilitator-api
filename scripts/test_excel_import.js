const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const puppeteer = require('puppeteer-core');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const [k, ...v] = trimmed.split('=');
        if (k && v.length > 0) {
            env[k.trim()] = v.join('=').replace(/^["'](.*)["']$/, '$1');
        }
    }
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = path.join(__dirname, '../.puppeteer_excel_test_' + Date.now());

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
    await supabase
        .from('students')
        .delete()
        .in('student_code', ['S3-1-06', 'S5-3-01', 'S3-1-99', 'S3-1-100', 'S3-1-07', 'S5-3-02']);

    await supabase
        .from('classrooms')
        .delete()
        .eq('name', '5학년 3반');
}

async function runExcelTest() {
    console.log('===============================================================');
    console.log('=== PHASE 5: EXCEL BULK STUDENT IMPORT REAL VERIFICATION ===');
    console.log('===============================================================\n');

    const testExcelPath = path.resolve(__dirname, '../test_students_import.xlsx');

    // Pre-cleanup
    await cleanupTestData();

    try {
        // 1. Create Test Excel File (.xlsx)
        console.log('1. Creating test Excel file with 6 test cases (a ~ f)...');
        const testRows = [
            // Header
            ['학급명', '닉네임', '학생코드', '동의여부'],
            // a) 기존 학급명("3학년 1반")에 학생코드 없이 신규 학생 1명 (자동생성 S3-1-06 기대)
            ['3학년 1반', '빛나는 여우', '', 'Y'],
            // b) 새로운 학급명("5학년 3반")에 학생코드 없이 신규 학생 1명 (학급 생성 및 S5-3-01 기대)
            ['5학년 3반', '우주 탐험가', '', 'N'],
            // c) 학생코드를 직접 지정한 신규 학생 1명 (S3-1-99 성공 기대)
            ['3학년 1반', '용감한 판다', 'S3-1-99', '예'],
            // d) 이미 존재하는 학생코드(S3-1-01) 지정 (중복 실패 기대)
            ['3학년 1반', '중복 토끼', 'S3-1-01', 'Y'],
            // e) 동의여부에 이상한 값("모름") (동의값 오류 실패 기대)
            ['3학년 1반', '이상한 새', '', '모름'],
            // f) 닉네임을 빈 칸으로 둔 행 (닉네임 누락 실패 기대)
            ['3학년 1반', '', '', 'Y'],
        ];

        const ws = XLSX.utils.aoa_to_sheet(testRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '명단테스트');
        XLSX.writeFile(wb, testExcelPath);
        console.log(`- Saved test Excel file to: ${testExcelPath} (${fs.statSync(testExcelPath).size} bytes)\n`);

        // 2. Call POST /api/teacher/students/import via FormData
        console.log('2. Uploading test Excel file to POST http://localhost:3000/api/teacher/students/import ...');
        const token = await createTeacherToken(env.TEACHER_DASHBOARD_PIN || '123456');

        const fileBuffer = fs.readFileSync(testExcelPath);
        const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const formData = new FormData();
        formData.append('file', blob, 'test_students_import.xlsx');

        const uploadRes = await fetch('http://localhost:3000/api/teacher/students/import', {
            method: 'POST',
            headers: {
                'Cookie': `teacher_session=${token}`
            },
            body: formData
        });

        console.log(`- HTTP Status: ${uploadRes.status} ${uploadRes.statusText}`);
        const responseJson = await uploadRes.json();
        console.log('\n--- API Response JSON (Raw) ---');
        console.log(JSON.stringify(responseJson, null, 2));

        if (!uploadRes.ok) {
            throw new Error(`Upload API returned error: ${JSON.stringify(responseJson)}`);
        }

        // Verify summary
        const summary = responseJson.summary;
        console.log(`\n- Summary Check: Total=${summary.total}, Success=${summary.success}, Failed=${summary.failed}, Generated=${summary.generated_count}`);
        if (summary.total !== 6 || summary.success !== 3 || summary.failed !== 3) {
            throw new Error(`Unexpected summary counts! Expected Total 6, Success 3, Failed 3.`);
        }

        // 3. Query Supabase Directly to Verify Inserted Records
        console.log('\n3. Querying Supabase students and classrooms tables directly...');
        const { data: newClass } = await supabase
            .from('classrooms')
            .select('*')
            .eq('name', '5학년 3반')
            .single();
        console.log('- "5학년 3반" Classroom Created in DB:', newClass ? `Yes (ID: ${newClass.id})` : 'NO!');

        const { data: addedStudents } = await supabase
            .from('students')
            .select('id, student_code, nickname, consent_status, classroom_id')
            .in('student_code', ['S3-1-06', 'S5-3-01', 'S3-1-99']);

        console.log('\n- Newly Inserted Students in DB (3 expected):');
        console.table(addedStudents);

        if (!addedStudents || addedStudents.length !== 3) {
            throw new Error(`Expected 3 inserted students in DB, but found ${addedStudents?.length || 0}`);
        }

        // Clean up before browser test so browser test starts fresh
        await cleanupTestData();

        // 4. Browser UI Verification via Puppeteer
        console.log('\n4. Launching Puppeteer to test Teacher Dashboard UI...');
        const downloadDir = path.resolve(__dirname, '../.puppeteer_downloads_' + Date.now());
        if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

        const browser = await puppeteer.launch({
            executablePath: CHROME_PATH,
            headless: true,
            userDataDir: USER_DATA_DIR,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1280,960']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 960 });

        // Set download behavior for Chrome CDP
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadDir
        });

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

        // A. Test "Download Template" Button
        console.log('- Clicking "학생 명단 양식 다운로드 (.xlsx)" button...');
        await page.waitForSelector('#btn-download-template');
        await page.click('#btn-download-template');
        await sleep(1500);

        // B. Test Uploading via Form
        console.log('- Selecting test Excel file and clicking "명단 일괄 등록"...');
        const fileInput = await page.$('#file-upload-input');
        await fileInput.uploadFile(testExcelPath);
        await sleep(500);

        await page.click('#btn-upload-excel');
        await sleep(3000);

        // Verify result container is visible
        await page.waitForSelector('#import-result-container');
        console.log('- Import result container is visible on screen!');

        // Take UI Screenshot
        const screenshotPath = path.resolve(__dirname, '../../visualizations/screenshot_excel_bulk_import_result.png');
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`- Screenshot saved to: ${screenshotPath} (${fs.statSync(screenshotPath).size} bytes)`);

        // C. Test "Download Generated Codes" Button
        console.log('- Clicking "자동생성된 학생코드 목록 다운로드" button...');
        await page.waitForSelector('#btn-download-generated');
        await page.click('#btn-download-generated');
        await sleep(2000);

        const downloadedFiles = fs.readdirSync(downloadDir);
        console.log(`- Downloaded Files in Browser: ${downloadedFiles.join(', ') || '(none)'}`);

        await browser.close();

        // Cleanup download folder
        if (fs.existsSync(downloadDir)) {
            fs.rmSync(downloadDir, { recursive: true, force: true });
        }

    } finally {
        // 5. Final Cleanup Test Data ONLY
        console.log('\n5. Cleaning up test data from Supabase (preserving 15 seed students and 3 classrooms)...');
        await cleanupTestData();

        // Remove local test file
        if (fs.existsSync(testExcelPath)) {
            fs.unlinkSync(testExcelPath);
        }

        // Verify counts
        const { count: finalClassCount } = await supabase.from('classrooms').select('*', { count: 'exact', head: true });
        const { count: finalStudentCount } = await supabase.from('students').select('*', { count: 'exact', head: true });

        console.log('\n=== DB TABLES COUNT AFTER CLEANUP ===');
        console.log(`- classrooms table count: ${finalClassCount} (3 expected)`);
        console.log(`- students table count   : ${finalStudentCount} (15 expected)`);
        console.log('=====================================\n');
    }
}

runExcelTest().catch(err => {
    console.error('Fatal error during excel test:', err);
    process.exit(1);
});
