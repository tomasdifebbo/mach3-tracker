import os

log_file = r"C:\Users\Atelier Arte\.gemini\antigravity\brain\8f090ab8-74bd-4612-87a2-ab2800f39185\.system_generated\tasks\task-6141.log"
if os.path.exists(log_file):
    with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
        print(f.read())
