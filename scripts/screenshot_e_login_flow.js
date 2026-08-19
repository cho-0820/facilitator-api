// scripts/screenshot_e_login_flow.js
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = path.join(__dirname, '../.puppeteer_flow_profile_' + Date.now());

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('=== LOGGING IN VIA FORM AND TAKING SCREENSHOT E ===');

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

    try {
        console.log('Opening http://localhost:3000/teacher/login ...');
        await page.goto('http://localhost:3000/teacher/login', { waitUntil: 'domcontentloaded' });
        await sleep(1500);

        console.log('Typing PIN "1234" via keyboard and submitting login form...');
        await page.waitForSelector('#pin');
        await page.click('#pin');
        await page.keyboard.type('1234', { delay: 50 });

        await page.click('button[type="submit"]');
        await sleep(4000);

        const currentUrl = page.url();
        console.log(`Current URL after login: ${currentUrl}`);

        const bodyText = await page.evaluate(() => document.body.innerText);
        console.log(`Rendered Page Text:\n"${bodyText.trim()}"`);

        const shotEPath = path.resolve(__dirname, '../../visualizations/screenshot_e_teacher_authenticated.png');
        await page.screenshot({ path: shotEPath, fullPage: false });
        console.log(`Screenshot successfully saved to: ${shotEPath} (${fs.statSync(shotEPath).size} bytes)`);

        console.log('=== SCREENSHOT E SAVED SUCCESSFULLY ===');
    } finally {
        await browser.close();
    }
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
