Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd ""C:\DASHBOARD\monitor"" && ""C:\Users\Atelier Arte\AppData\Local\Programs\Python\Python312\python.exe"" monitor.py", 1, False
