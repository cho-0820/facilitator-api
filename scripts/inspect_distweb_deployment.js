// facilitator-api/scripts/inspect_distweb_deployment.js
const fs = require('fs');
const path = require('path');

async function inspect() {
    const authPath = path.join(process.env.APPDATA, 'xdg.data', 'com.vercel.cli', 'auth.json');
    const authData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    const token = authData.token;

    const teamId = 'team_Qg4W1XqeGEjK551n3ZD2fmX5';
    const projectId = 'prj_kg0KTO5kiRoid8IdzGNrp2fDevY8'; // dist_web

    console.log('=== 1. Fetching Project Details (dist_web) ===');
    const projRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}?teamId=${teamId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const proj = await projRes.json();
    console.log('Project Name:', proj.name);
    console.log('Framework   :', proj.framework);
    console.log('Link / Git  :', JSON.stringify(proj.link, null, 2));

    console.log('\n=== 2. Fetching Latest Deployments for dist_web ===');
    const dplRes = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const dpls = await dplRes.json();
    console.log('Deployments count:', dpls.deployments?.length);

    for (const d of dpls.deployments || []) {
        console.log(`\n--- Deployment: ${d.uid} (${d.url}) ---`);
        console.log(`State       : ${d.state}`);
        console.log(`Target      : ${d.target}`);
        console.log(`Created At  : ${new Date(d.created).toLocaleString()}`);
        console.log(`Creator     : ${d.creator?.username}`);
        console.log(`Source / Type: ${d.source}`);
        console.log(`Meta / Git  :`, JSON.stringify(d.meta, null, 2));
    }

    console.log('\n=== 3. Inspecting Target Production Deployment (dpl_6pyZN8bBXiebnb9UuGHGBjKBPfqi) ===');
    const singleDplRes = await fetch(`https://api.vercel.com/v13/deployments/dpl_6pyZN8bBXiebnb9UuGHGBjKBPfqi?teamId=${teamId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const singleDpl = await singleDplRes.json();
    console.log('Aliases:', singleDpl.alias);
    console.log('Meta:', JSON.stringify(singleDpl.meta, null, 2));
}

inspect().catch(err => {
    console.error('Failed:', err);
});
