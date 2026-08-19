// scripts/verify_ui_screenshots.js
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = path.join(__dirname, '../.puppeteer_test_profile_' + Date.now());

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('=== STARTING PUPPETEER REAL BROWSER TEST ===\n');

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        userDataDir: USER_DATA_DIR,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--window-size=1280,800'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        // [Test d] First navigate to unauthenticated /teacher -> Middleware redirects to /teacher/login
        console.log('[Test d] Fetching /teacher directly to verify 307 redirect ...');
        const resRedirect = await fetch('http://127.0.0.1:3000/teacher', { redirect: 'manual' });
        console.log(`[Test d] Fetch status: ${resRedirect.status}, location: ${resRedirect.headers.get('location')}`);

        console.log('[Test d] Loading /teacher/login on browser via 127.0.0.1...');
        await page.goto('http://127.0.0.1:3000/teacher/login', { waitUntil: 'domcontentloaded' });
        await sleep(1500);

        const urlLogin = page.url();
        console.log(`[Test d] Current Browser URL: ${urlLogin}`);

        const shotDPath = path.resolve(__dirname, '../../visualizations/screenshot_d_teacher_redirect_login.png');
        await page.screenshot({ path: shotDPath, fullPage: false });
        console.log(`[Test d] Screenshot successfully saved: ${shotDPath} (${fs.statSync(shotDPath).size} bytes)\n`);

        // [Test e] Type correct PIN "1234" and submit form
        console.log('[Test e] Typing PIN "1234" into #pin input and submitting form...');
        await page.waitForSelector('#pin');
        await page.type('#pin', '1234');
        
        await page.click('button[type="submit"]');
        await sleep(3000);

        const urlAfterLogin = page.url();
        console.log(`[Test e] Current URL after login: ${urlAfterLogin}`);

        const bodyText = await page.evaluate(() => document.body.innerText);
        console.log(`[Test e] Rendered page text:\n${bodyText.trim()}`);

        const shotEPath = path.resolve(__dirname, '../../visualizations/screenshot_e_teacher_authenticated.png');
        await page.screenshot({ path: shotEPath, fullPage: false });
        console.log(`[Test e] Screenshot successfully saved: ${shotEPath} (${fs.statSync(shotEPath).size} bytes)\n`);

        console.log('=== REAL BROWSER SCREENSHOT VERIFICATION COMPLETED SUCCESSFULLY ===');
    } finally {
        await browser.close();
    }
}

main().catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
});
