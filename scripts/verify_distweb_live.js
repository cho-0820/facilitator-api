const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = path.join(__dirname, '../.puppeteer_verify_live_' + Date.now());

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyLive() {
    console.log('=== 4. POST-DEPLOYMENT VERIFICATION ===\n');

    // 1. Fetch & Verify render.bundle.js strings directly
    console.log('1. Checking Live render.bundle.js for facilitator_intervention & logFacilitatorIntervention ...');
    const bundleUrl = 'https://distweb-theta.vercel.app/src/renderer_build/render.bundle.js';
    const res = await fetch(bundleUrl);
    console.log(`- Fetch ${bundleUrl}: HTTP ${res.status} ${res.statusText}`);
    const bundleCode = await res.text();

    const hasInterventionType = bundleCode.includes('facilitator_intervention');
    const hasLogHelper = bundleCode.includes('logFacilitatorIntervention');

    console.log(`- Contains 'facilitator_intervention': ${hasInterventionType}`);
    console.log(`- Contains 'logFacilitatorIntervention': ${hasLogHelper}`);

    if (!hasInterventionType || !hasLogHelper) {
        throw new Error('Live render.bundle.js does not contain the updated facilitator intervention code!');
    }

    // 2. Launch Browser & Check main.html for 404/5xx errors
    console.log('\n2. Navigating to https://distweb-theta.vercel.app/src/main/views/main.html ...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        userDataDir: USER_DATA_DIR,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1280,800']
    });

    const failedRequests = [];
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    page.on('response', response => {
        const status = response.status();
        const url = response.url();
        if (status >= 400) {
            failedRequests.push({ status, url });
        }
    });

    await page.goto('https://distweb-theta.vercel.app/src/main/views/main.html', { waitUntil: 'networkidle0' });
    await sleep(3000);

    const shotPath = path.resolve(__dirname, '../../visualizations/screenshot_distweb_live_verified.png');
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`- Live page screenshot saved to: ${shotPath}`);

    console.log(`\n- Total Failed HTTP Requests (4xx/5xx): ${failedRequests.length}`);
    if (failedRequests.length > 0) {
        console.table(failedRequests);
        throw new Error(`Found ${failedRequests.length} failed HTTP requests during live page load!`);
    }

    console.log('✓ Post-deployment live verification PASSED successfully (0 errors, strings verified)!');
    await browser.close();
}

verifyLive().catch(err => {
    console.error('Live verification failed:', err);
    process.exit(1);
});
