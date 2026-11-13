import urllib.request
import re

headers = {'User-Agent': 'Mozilla/5.0'}

def get_page(url):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return resp.read().decode('utf-8', errors='ignore')

faq_html = get_page('https://www.livemes.com/perguntas-frequentes-faq/')
# let's look for accordion or faq items
items = re.findall(r'<div[^>]*class="[^"]*elementor-tab-title[^"]*"[^>]*>(.*?)</div>.*?<div[^>]*class="[^"]*elementor-tab-content[^"]*"[^>]*>(.*?)</div>', faq_html, re.DOTALL)
print(f"Found {len(items)} FAQ items")
for title, content in items:
    clean_t = re.sub(r'<[^>]+>', '', title).strip()
    clean_c = re.sub(r'<[^>]+>', '', content).strip()
    print(f"\n[FAQ] {clean_t}\n-> {clean_c}")

# Let's search for "preço", "custo", "valor", "mensalidade", "plano" in both pages or web
