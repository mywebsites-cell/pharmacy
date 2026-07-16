#!/usr/bin/env python3
"""Upload release assets to GitHub"""
import requests
import os
from pathlib import Path
import sys

TOKEN = "YOUR_GITHUB_TOKEN_HERE"
OWNER = "mywebsites-cell"
REPO = "pharmacy"
VERSION = sys.argv[1] if len(sys.argv) > 1 else "v1.0.17"
TAG = VERSION if VERSION.startswith("v") else f"v{VERSION}"
RELEASE_DIR = Path(r"d:\webs\pharmacy app\apps\desktop\release")

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json"
}

# Step 1: Check if release exists
print(f"[1/4] Checking if release {TAG} exists...")
try:
    resp = requests.get(
        f"https://api.github.com/repos/{OWNER}/{REPO}/releases/tags/{TAG}",
        headers=headers
    )
    
    if resp.status_code == 200:
        release = resp.json()
        print(f"  ✓ Release found (ID: {release['id']})")
        print(f"  ✓ Current assets: {len(release['assets'])}")
        
        release_id = release['id']
        
        # List current assets
        for asset in release['assets']:
            print(f"    - {asset['name']}")
    else:
        print(f"  ✗ Release not found (status: {resp.status_code})")
        print(f"  Response: {resp.text[:200]}")
        
        # Try to create release
        print(f"\n[2/4] Creating release {TAG}...")
        create_resp = requests.post(
            f"https://api.github.com/repos/{OWNER}/{REPO}/releases",
            headers=headers,
            json={
                "tag_name": TAG,
                "name": f"Medicly {TAG}",
                "body": "Dashboard improvements & auto-updater fixes.\n\n### Fixed\n- Dashboard now displays actual subscription plan name (was showing 'No Plan')\n- Auto-updater now properly applies updates on app restart\n- Fixed explicit quitAndInstall() call for update installation\n\n### Technical\n- Plan name passed through AppShell bridge to subscription object\n- Auto-updater event handlers improved",
                "draft": False,
                "prerelease": False
            }
        )
        
        if create_resp.status_code == 201:
            release = create_resp.json()
            release_id = release['id']
            print(f"  ✓ Release created (ID: {release_id})")
        else:
            print(f"  ✗ Failed to create release: {create_resp.status_code}")
            print(f"  Response: {create_resp.text}")
            exit(1)
    
    # Step 2: Delete any existing assets (in case of re-upload with corrected filenames)
    if release.get('assets'):
        print(f"  Deleting {len(release['assets'])} old assets...")
        for asset in release['assets']:
            del_resp = requests.delete(
                f"https://api.github.com/repos/{OWNER}/{REPO}/releases/assets/{asset['id']}",
                headers=headers
            )
            print(f"    Deleted: {asset['name']} ({del_resp.status_code})")
    
    # Step 3: Upload assets
    print(f"\n[3/4] Uploading assets...")
    version_num = TAG.replace("v", "")
    files = [
        (f"Medicly-setup-{version_num}.exe", "application/octet-stream"),
        ("latest.yml", "application/x-yaml"),
        (f"Medicly-setup-{version_num}.exe.blockmap", "application/octet-stream")
    ]
    
    for filename, content_type in files:
        filepath = RELEASE_DIR / filename
        if filepath.exists():
            print(f"  Uploading {filename}...")
            with open(filepath, "rb") as f:
                file_data = f.read()
            
            upload_url = f"https://uploads.github.com/repos/{OWNER}/{REPO}/releases/{release_id}/assets?name={filename}"
            upload_headers = {**headers, "Content-Type": content_type}
            
            upload_resp = requests.post(upload_url, data=file_data, headers=upload_headers)
            
            if upload_resp.status_code in [200, 201]:
                print(f"    ✓ Uploaded ({len(file_data) / 1024 / 1024:.1f} MB)")
            else:
                print(f"    ✗ Failed (status: {upload_resp.status_code})")
                print(f"      {upload_resp.text[:200]}")
        else:
            print(f"  ✗ File not found: {filepath}")
    
    print(f"\n[4/4] Done!")
    print(f"\nRelease URL: https://github.com/{OWNER}/{REPO}/releases/tag/{TAG}")

except Exception as e:
    print(f"Error: {e}")
    exit(1)
