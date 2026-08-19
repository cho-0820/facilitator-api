// scripts/browser_test_cdp.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBrowserTest() {
    console.log('=== STARTING BROWSER REAL VERIFICATION WITH CDP ===');

    const chrome = spawn(CHROME_PATH, [
        `--remote-debugging-port=${PORT}`,
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=1280,800',
        '--user-data-dir=' + path.resolve(__dirname, '../.chrome-test-profile')
    ]);

    chrome.stderr.on('data', () => {});
    await sleep(2000);

    try {
        const newTabRes = await fetch(`http://localhost:${PORT}/json/new`, { method: 'PUT' });
        const target = await newTabRes.json();
        console.log('Created Target:', target.webSocketDebuggerUrl);

        const ws = new WebSocket(target.webSocketDebuggerUrl);
        let idCounter = 1;
        const pendingCallbacks = new Map();

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.id && pendingCallbacks.has(data.id)) {
                const cb = pendingCallbacks.get(data.id);
                pendingCallbacks.delete(data.id);
                cb(data.result);
            }
        };

        await new Promise(resolve => ws.onopen = resolve);

        function send(method, params = {}) {
            return new Promise((resolve) => {
                const id = idCounter++;
                pendingCallbacks.set(id, resolve);
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        await send('Page.enable');
        await send('Runtime.enable');
        await send('DOM.enable');

        // Test d: Navigate to /teacher directly without session cookie
        console.log('Navigating to http://localhost:3000/teacher...');
        await send('Page.navigate', { url: 'http://localhost:3000/teacher' });
        await sleep(3500);

        const evalUrlD = await send('Runtime.evaluate', { expression: 'window.location.href' });
        const currentUrlD = evalUrlD.result.value;
        console.log(`[Test d] Current URL after navigating to /teacher: ${currentUrlD}`);

        const shotD = await send('Page.captureScreenshot', { format: 'png' });
        const shotDPath = path.resolve(__dirname, '../../visualizations/screenshot_d_teacher_redirect_login.png');
        fs.writeFileSync(shotDPath, Buffer.from(shotD.data, 'base64'));
        console.log(`[Test d] Screenshot saved to: ${shotDPath} (${fs.statSync(shotDPath).size} bytes)`);

        // Test e: Fill in PIN and submit
        console.log('[Test e] Typing PIN "1234" and clicking submit button...');
        await send('Runtime.evaluate', {
            expression: `
                (function() {
                    const input = document.getElementById('pin');
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    nativeInputValueSetter.call(input, '1234');
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    const btn = document.querySelector('button[type="submit"]');
                    btn.click();
                })()
            `
        });

        await sleep(4000);

        const evalUrlE = await send('Runtime.evaluate', { expression: 'window.location.href' });
        const currentUrlE = evalUrlE.result.value;
        console.log(`[Test e] Current URL after login submission: ${currentUrlE}`);

        const evalBodyText = await send('Runtime.evaluate', { expression: 'document.body.innerText' });
        console.log(`[Test e] Rendered page text:\n"${evalBodyText.result.value.trim()}"`);

        const shotE = await send('Page.captureScreenshot', { format: 'png' });
        const shotEPath = path.resolve(__dirname, '../../visualizations/screenshot_e_teacher_authenticated.png');
        fs.writeFileSync(shotEPath, Buffer.from(shotE.data, 'base64'));
        console.log(`[Test e] Screenshot saved to: ${shotEPath} (${fs.statSync(shotEPath).size} bytes)`);

        ws.close();
        console.log('=== BROWSER CDP VERIFICATION FINISHED SUCCESSFULLY ===');
    } finally {
        chrome.kill();
    }
}

runBrowserTest().catch(console.error);
