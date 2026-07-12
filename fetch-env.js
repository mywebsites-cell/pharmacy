const fs = require('fs');
const path = require('path');
const https = require('https');

const projectId = 'prj_aZmiCLVpGMhhCp0R2ed2sTMPETON';
const authFile = path.join(process.env.HOME || process.env.USERPROFILE, '.vercel/auth.json');

let token = null;
try {
  const auth = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
  token = auth.token;
} catch (e) {
  console.error('Could not read Vercel auth token:', e.message);
  process.exit(1);
}

const options = {
  hostname: 'api.vercel.com',
  path: `/v9/projects/${projectId}/env?environment=production`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.envs) {
        const env = {};
        json.envs.forEach(e => {
          env[e.key] = e.value;
        });
        // Write to .env.production
        const envContent = Object.entries(env)
          .map(([k, v]) => `${k}="${v}"`)
          .join('\n');
        fs.writeFileSync('.env.production', envContent);
        console.log('✓ Written', Object.keys(env).length, 'env vars to .env.production');
        // Log the key ones
        console.log('\nKey variables:');
        console.log('POSTGRES_URL_NON_POOLING:', env.POSTGRES_URL_NON_POOLING ? '✓ found' : '✗ missing');
        console.log('SUPABASE_SECRET_KEY:', env.SUPABASE_SECRET_KEY ? '✓ found' : '✗ missing');
        console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ found' : '✗ missing');
      } else if (json.error) {
        console.error('API Error:', json.error.message || json.error);
        process.exit(1);
      }
    } catch (e) {
      console.error('Error parsing response:', e.message);
      console.error('Response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('Request failed:', e.message);
  process.exit(1);
});

req.end();
