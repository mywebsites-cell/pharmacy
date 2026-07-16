import requests
import os

token = "YOUR_GITHUB_TOKEN_HERE"
repo = "mywebsites-cell/pharmacy"
tag = "v1.0.13"
release_dir = r"d:\webs\pharmacy app\apps\desktop\release"

# Get release ID
headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
resp = requests.get(f"https://api.github.com/repos/{repo}/releases/tags/{tag}", headers=headers)
if resp.status_code == 200:
    release = resp.json()
    release_id = release["id"]
    print(f"Found release {tag} with ID {release_id}")
    
    # Upload files
    files_to_upload = [
        ("Medicly Setup 1.0.13.exe", "application/octet-stream"),
        ("latest.yml", "application/x-yaml"),
        ("Medicly Setup 1.0.13.exe.blockmap", "application/octet-stream")
    ]
    
    for filename, content_type in files_to_upload:
        filepath = os.path.join(release_dir, filename)
        if os.path.exists(filepath):
            with open(filepath, "rb") as f:
                file_data = f.read()
            
            upload_url = f"https://uploads.github.com/repos/{repo}/releases/{release_id}/assets?name={filename}"
            upload_headers = {**headers, "Content-Type": content_type}
            upload_resp = requests.post(upload_url, data=file_data, headers=upload_headers)
            print(f"{filename}: {upload_resp.status_code}")
        else:
            print(f"File not found: {filepath}")
else:
    print(f"Release not found: {resp.status_code}")
    print(resp.text)
