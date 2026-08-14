// scripts/test_preview_curl.js
const https = require('https');

async function testAuth() {
    const previewUrl = 'https://facilitator-k3669qp34-cho14.vercel.app/api/teacher/auth';
    const bypassToken = 'P8ubdmFtFGlycb8H21bAN1Z0uRwOEvNa';

    console.log('Sending POST request to:', previewUrl);
    console.log('Payload:', JSON.stringify({ pin: '123456' }));

    const res = await fetch(previewUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-vercel-protection-bypass': bypassToken
        },
        body: JSON.stringify({ pin: '123456' })
    });

    console.log('\n--- RESPONSE HEADERS ---');
    console.log('HTTP Status:', res.status, res.statusText);
    console.log('Set-Cookie :', res.headers.get('set-cookie'));

    const body = await res.json();
    console.log('\n--- RESPONSE BODY ---');
    console.log(JSON.stringify(body, null, 2));
}

testAuth().catch(err => {
    console.error('Error during test:', err);
    process.exit(1);
});
