import os

# Check task log file
task_log = r"C:\Users\Atelier Arte\.gemini\antigravity\brain\8f090ab8-74bd-4612-87a2-ab2800f39185\.system_generated\tasks\task-5471.log"
if os.path.exists(task_log):
    print("=== TASK 5471 LOG ===")
    with open(task_log, "r", encoding="utf-8", errors="ignore") as f:
        print(f.read()[-3000:])
else:
    print("Task log not found at", task_log)
