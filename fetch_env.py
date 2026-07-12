#!/usr/bin/env python3
import json
import os
import sys
import urllib.request
import urllib.error

project_id = 'prj_aZmiCLVpGMhhCp0R2ed2sTMPETON'

# Try to read token from vercel's cache/config locations
token = None
possible_paths = [
    os.path.expanduser('~/.vercel/auth.json'),
    os.path.expanduser('~/.config/vercel/auth.json'),
    os.path.expanduser('~/.cache/vercel/auth.json'),
    os.path.join(os.environ.get('APPDATA', ''), 'Vercel', 'auth.json'),
    os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Vercel', 'auth.json'),
]

for path in possible_paths:
    if os.path.exists(path):
        try:
            with open(path) as f:
                auth_data = json.load(f)
                token = auth_data.get('token')
                if token:
                    print(f"✓ Found token in {path}", file=sys.stderr)
                    break
        except Exception as e:
            pass

if not token:
    print("✗ Could not find Vercel auth token", file=sys.stderr)
    # Try checking environment variable
    token = os.environ.get('VERCEL_TOKEN')
    if token:
        print("✓ Using VERCEL_TOKEN from environment", file=sys.stderr)
    else:
        print("✗ VERCEL_TOKEN not in environment either", file=sys.stderr)
        sys.exit(1)

# Fetch from Vercel API
url = f'https://api.vercel.com/v9/projects/{project_id}/env?environment=production'
headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
    
    if 'envs' in data:
        env_vars = {}
        for env in data['envs']:
            env_vars[env['key']] = env['value']
        
        # Write to .env.production
        with open('.env.production', 'w') as f:
            for key, val in env_vars.items():
                # Escape quotes in values
                val_escaped = val.replace('"', '\\"')
                f.write(f'{key}="{val_escaped}"\n')
        
        print(f"✓ Written {len(env_vars)} env vars to .env.production")
        print(f"\nKey variables:")
        print(f"POSTGRES_URL_NON_POOLING: {'✓ found' if 'POSTGRES_URL_NON_POOLING' in env_vars else '✗ missing'}")
        print(f"SUPABASE_SECRET_KEY: {'✓ found' if 'SUPABASE_SECRET_KEY' in env_vars else '✗ missing'}")
        print(f"DATABASE_URL: {'✓ found' if 'DATABASE_URL' in env_vars else '✗ missing'}")
    else:
        print(f"✗ Error: {data}", file=sys.stderr)
        sys.exit(1)
        
except urllib.error.HTTPError as e:
    print(f"✗ HTTP Error {e.code}: {e.reason}", file=sys.stderr)
    print(f"Response: {e.read().decode()}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"✗ Error: {e}", file=sys.stderr)
    sys.exit(1)
