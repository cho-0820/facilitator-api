const path = require('path');
const fs = require('fs');

const authPath = path.resolve(process.env.APPDATA || 'C:\\Users\\ohmyg\\AppData\\Roaming', 'com.vercel.cli/auth.json');
const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
const token = auth.token;

async function inspectDeployment() {
    const deployId = 'dpl_oG7qupVGEXUMvqMHGP6hbGqc9RZv';
    const res = await fetch(`https://api.vercel.com/v13/deployments/${deployId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log('Deployment Details:');
    console.log(JSON.stringify({
        id: data.id,
        url: data.url,
        target: data.target,
        readyState: data.readyState,
        createdAt: new Date(data.createdAt).toISOString(),
        githubCommitSha: data.meta?.githubCommitSha,
        githubCommitMessage: data.meta?.githubCommitMessage,
        githubCommitRef: data.meta?.githubCommitRef
    }, null, 2));
}

inspectDeployment().catch(console.error);
