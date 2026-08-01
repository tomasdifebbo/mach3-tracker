import json, os

cids = [
    ('Monitor Core Reviewer', '6b6108e9-d091-4e1b-aeb4-f8a08cb8df45'),
    ('Server API Reviewer', '51c7fcbf-bac4-4525-bd9b-7e625888706a'),
    ('Raw Log Analyzer', '601f2cbd-154e-48b0-b06c-eaa1fac8f14b')
]

for name, cid in cids:
    p = f"C:\\Users\\Atelier Arte\\.gemini\\antigravity\\brain\\{cid}\\.system_generated\\logs\\transcript.jsonl"
    print(f"\n==================================================================")
    print(f"=== {name} ===")
    print(f"==================================================================")
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            lines = f.readlines()
        for line in reversed(lines):
            step = json.loads(line)
            content = step.get("content")
            if content and isinstance(content, str) and len(content.strip()) > 300:
                print(content)
                break
