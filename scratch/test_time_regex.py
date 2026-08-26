import re

def parse_time_string(txt):
    if not txt:
        return None
    
    # 1. HH:MM:SS format
    m1 = re.search(r'(?:worked\s*times?|work\s*time|estimate\s*time|tempo\s*estimado|tempo)?[:\s]*(\d{1,2}):(\d{2}):(\d{2})', txt, re.IGNORECASE)
    if m1:
        h, m, s = map(int, m1.groups())
        tot = h * 60 + m + s / 60.0
        if tot > 0:
            return round(tot, 2)
            
    # 2. MM:SS format
    m2 = re.search(r'(?:worked\s*times?|work\s*time|estimate\s*time|tempo\s*estimado|tempo)[:\s]*(\d{1,2}):(\d{2})\b', txt, re.IGNORECASE)
    if m2:
        m, s = map(int, m2.groups())
        tot = m + s / 60.0
        if tot > 0:
            return round(tot, 2)

    # 3. e.g. "5m 30s" or "5 min 30 sec"
    m3 = re.search(r'(\d+)\s*(?:m|min)\s*(\d+)?\s*(?:s|sec)?', txt, re.IGNORECASE)
    if m3:
        m = int(m3.group(1))
        s = int(m3.group(2)) if m3.group(2) else 0
        tot = m + s / 60.0
        if tot > 0:
            return round(tot, 2)

    return None

test_cases = [
    "Worked Times:00:05:30",
    "Worked Times: 01:15:20",
    "Work Time: 00:08:00",
    "Worked Times:00:00:00",
    "Estimate Work Time: 12:45",
    "Tempo: 4m 30s",
    "Worked Times:00:02:15"
]

for tc in test_cases:
    res = parse_time_string(tc)
    print(f"'{tc}' -> {res} min")
