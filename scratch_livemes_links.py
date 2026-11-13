import urllib.request
import re

headers = {'User-Agent': 'Mozilla/5.0'}
req = urllib.request.Request('https://www.livemes.com/novidades/', headers=headers)
html = urllib.request.urlopen(req).read().decode('utf-8', errors='ignore')

# Extract all links and their text
links = re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', html, re.DOTALL)
for href, text in links:
    clean = re.sub(r'<[^>]+>', '', text).strip()
    if clean and len(clean) > 5 and ('livemes.com' in href or href.startswith('/')):
        print(f"LINK: {clean} -> {href}")
