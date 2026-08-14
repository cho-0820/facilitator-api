// scripts/screenshot_authenticated.js
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = path.join(__dirname, '../.puppeteer_auth_profile_' + Date.now());

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function main() {
    console.log('=== AUTHENTICATING AND TAKING SCREENSHOT E ===');

    const token = await createToken('1234');
    console.log('Generated Token:', token);

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

    // Set auth cookie
    await page.setCookie({
        name: 'teacher_session',
        value: token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Strict'
    });

    console.log('Navigating to http://localhost:3000/teacher ...');
    await page.goto('http://localhost:3000/teacher', { waitUntil: 'domcontentloaded' });
    await sleep(2000);

    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log(`Rendered Page Text:\n"${bodyText.trim()}"`);

    const shotEPath = path.resolve(__dirname, '../../visualizations/screenshot_e_teacher_authenticated.png');
    await page.screenshot({ path: shotEPath, fullPage: false });
    console.log(`Screenshot saved to: ${shotEPath} (${fs.statSync(shotEPath).size} bytes)`);

    await browser.close();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
