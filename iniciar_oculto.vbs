Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd C:\DASHBOARD\server && node server.js", 0, False
WshShell.Run "cmd /c cd C:\DASHBOARD\monitor && python monitor.py", 0, False
