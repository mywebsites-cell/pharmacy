import requests
from pathlib import Path

TOKEN = "YOUR_GITHUB_TOKEN_HERE"
OWNER = "mywebsites-cell"
REPO = "pharmacy"
RELEASE_DIR = Path(r"d:\webs\pharmacy app\apps\desktop\release2")
headers = {"Authorization": f"Bearer {TOKEN}", "Accept": "application/vnd.github+json"}

# These old releases had Medicly Setup X.exe (spaces) → GitHub converted to Medicly.Setup.X.exe
# Need to re-build with artifactName set, but for now we just need to check if latest.yml
# in those releases points to the right filename
for tag in ["v1.0.13", "v1.0.14", "v1.0.15"]:
    resp = requests.get(f"https://api.github.com/repos/{OWNER}/{REPO}/releases/tags/{tag}", headers=headers)
    if resp.status_code != 200:
        print(f"{tag}: not found ({resp.status_code})")
        continue
    release = resp.json()
    print(f"\n{tag} (ID: {release['id']}):")
    for asset in release["assets"]:
        print(f"  {asset['name']} ({asset['browser_download_url']})")
