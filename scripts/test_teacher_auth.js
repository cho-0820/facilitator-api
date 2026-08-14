// scripts/test_teacher_auth.js

async function runTests() {
    console.log('=== TEST SUITE: TEACHER AUTH ===\n');

    // Test a: Wrong PIN
    console.log('--- Test a: Wrong PIN (POST /api/teacher/auth with pin: "wrong_pin") ---');
    const resA = await fetch('http://localhost:3000/api/teacher/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: 'wrong_pin' })
    });
    console.log(`Status: ${resA.status} ${resA.statusText}`);
    console.log(`Headers:`, Object.fromEntries(resA.headers.entries()));
    const bodyA = await resA.text();
    console.log(`Body: ${bodyA}\n`);

    // Test b: Correct PIN
    console.log('--- Test b: Correct PIN (POST /api/teacher/auth with pin: "1234") ---');
    const resB = await fetch('http://localhost:3000/api/teacher/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '1234' })
    });
    console.log(`Status: ${resB.status} ${resB.statusText}`);
    console.log(`Set-Cookie header: ${resB.headers.get('set-cookie')}`);
    const bodyB = await resB.text();
    console.log(`Body: ${bodyB}\n`);

    const setCookie = resB.headers.get('set-cookie');

    // Test c-1: Unauthenticated request to /teacher (page)
    console.log('--- Test c-1: Unauthenticated GET /teacher (expect redirect to /teacher/login) ---');
    const resC1 = await fetch('http://localhost:3000/teacher', {
        redirect: 'manual'
    });
    console.log(`Status: ${resC1.status} ${resC1.statusText}`);
    console.log(`Location: ${resC1.headers.get('location')}\n`);

    // Test c-2: Unauthenticated request to /api/teacher/protected-example (API)
    console.log('--- Test c-2: Unauthenticated GET /api/teacher/test (expect 401 Unauthorized) ---');
    const resC2 = await fetch('http://localhost:3000/api/teacher/test');
    console.log(`Status: ${resC2.status} ${resC2.statusText}`);
    const bodyC2 = await resC2.text();
    console.log(`Body: ${bodyC2}\n`);

    // Test c-3: Authenticated request to /teacher with Cookie
    console.log('--- Test c-3: Authenticated GET /teacher with cookie ---');
    const resC3 = await fetch('http://localhost:3000/teacher', {
        headers: { 'Cookie': setCookie ? setCookie.split(';')[0] : '' },
        redirect: 'manual'
    });
    console.log(`Status: ${resC3.status} ${resC3.statusText}\n`);
}

runTests().catch(console.error);
