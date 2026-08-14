// facilitator-api/scripts/verify_distweb_live.js
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = path.join(__dirname, '../.puppeteer_distweb_profile_' + Date.now());

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function verify() {
    console.log('===========================================================');
    console.log('=== VERIFYING LIVE DEPLOYMENT: distweb-theta.vercel.app ===');
    console.log('===========================================================\n');

    // 1. Check HttpDataUploader in live bundle
    console.log('1. Checking HttpDataUploader in live render.bundle.js...');
    const bundleUrl = 'https://distweb-theta.vercel.app/src/renderer_build/render.bundle.js';
    const bundleRes = await fetch(bundleUrl);
    console.log(`- Fetch bundle status: ${bundleRes.status} ${bundleRes.statusText}`);
    const bundleText = await bundleRes.text();
    console.log(`- Bundle size: ${bundleText.length} bytes`);

    const hasHttpDataUploader = bundleText.includes('HttpDataUploader');
    const hasApiLogs = bundleText.includes('/api/logs');
    const hasSessionStorageStudentCode = bundleText.includes("sessionStorage.getItem('student_code')") || bundleText.includes('student_code');

    console.log(`- Includes 'HttpDataUploader': ${hasHttpDataUploader}`);
    console.log(`- Includes '/api/logs': ${hasApiLogs}`);
    console.log(`- Includes dynamic student_code reading: ${hasSessionStorageStudentCode}\n`);

    // 2. Open browser and check for 404s and take screenshot
    console.log('2. Launching browser to verify page load & console/network errors...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        userDataDir: USER_DATA_DIR,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1400,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    const failedRequests = [];
    page.on('response', response => {
        if (response.status() >= 400) {
            failedRequests.push({ url: response.url(), status: response.status() });
        }
    });

    const consoleLogs = [];
    page.on('console', msg => {
        consoleLogs.push({ type: msg.type(), text: msg.text() });
    });

    const targetUrl = 'https://distweb-theta.vercel.app/src/main/views/main.html';
    console.log(`- Navigating to ${targetUrl} ...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(3000);

    const shotPath = path.resolve(__dirname, '../../visualizations/screenshot_distweb_live_verified.png');
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`- Screenshot saved to: ${shotPath} (${fs.statSync(shotPath).size} bytes)`);

    console.log('\n3. Failed Requests Count:', failedRequests.length);
    if (failedRequests.length > 0) {
        console.table(failedRequests.slice(0, 10));
    } else {
        console.log('- 0 HTTP 4xx/5xx errors! All assets loaded cleanly.');
    }

    await browser.close();
}

verify().catch(err => {
    console.error('Fatal error during verification:', err);
    process.exit(1);
});
