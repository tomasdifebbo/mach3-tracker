import requests, re

url = "https://mach3-tracker.onrender.com"

r = requests.get(url)
print("=== INDEX.HTML FROM RENDER ===")
print("Status:", r.status_code)
html = r.text
print(html)

# Extract script src
js_files = re.findall(r'src="([^"]+)"', html)
print("\nJS files found:", js_files)

for js_rel in js_files:
    js_url = f"{url}{js_rel}" if js_rel.startswith('/') else f"{url}/{js_rel}"
    js_r = requests.get(js_url)
    print(f"\nAsset: {js_rel} | Status: {js_r.status_code} | Size: {len(js_r.text)} bytes")
