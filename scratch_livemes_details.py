import urllib.request
import re

headers = {'User-Agent': 'Mozilla/5.0'}

def get_page(url):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return resp.read().decode('utf-8', errors='ignore')

faq_html = get_page('https://www.livemes.com/perguntas-frequentes-faq/')
print("=== FAQ ===")
questions = re.findall(r'<h[2-5][^>]*>(.*?)</h[2-5]>', faq_html, re.DOTALL)
for q in questions:
    clean = re.sub(r'<[^>]+>', '', q).strip()
    if clean:
        print("Q:", clean)

func_html = get_page('https://www.livemes.com/funcionalidades/')
print("\n=== FUNCIONALIDADES ===")
funcs = re.findall(r'<h[2-5][^>]*>(.*?)</h[2-5]>', func_html, re.DOTALL)
for f in funcs:
    clean = re.sub(r'<[^>]+>', '', f).strip()
    if clean and len(clean) > 5:
        print("F:", clean)
