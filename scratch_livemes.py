import urllib.request
import re

headers = {'User-Agent': 'Mozilla/5.0'}

def get_page(url):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return resp.read().decode('utf-8', errors='ignore')

# 1. Novidades
novidades_html = get_page('https://www.livemes.com/novidades/')
print("=== NOVIDADES POSTS ===")
posts = re.findall(r'<h[23][^>]*>(.*?)</h[23]>', novidades_html, re.DOTALL)
for p in posts:
    clean = re.sub(r'<[^>]+>', '', p).strip()
    if clean:
        print("- ", clean)

# 2. Main Page / Recursos
main_html = get_page('https://www.livemes.com/')
print("\n=== RECURSOS / PRODUTO ===")
features = re.findall(r'<h[234][^>]*>(.*?)</h[234]>', main_html, re.DOTALL)
for f in features:
    clean = re.sub(r'<[^>]+>', '', f).strip()
    if len(clean) > 5:
        print("- ", clean)
