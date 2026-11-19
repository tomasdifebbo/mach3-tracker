Set WshShell = CreateObject("WScript.Shell")
Set objWMIService = GetObject("winmgmts:\\.\root\cimv2")

Function IsProcessRunning(matchText)
    Dim colProcesses, objProcess, cmd
    IsProcessRunning = False
    On Error Resume Next
    Set colProcesses = objWMIService.ExecQuery("SELECT CommandLine FROM Win32_Process WHERE Name = 'node.exe' OR Name = 'python.exe'")
    For Each objProcess In colProcesses
        cmd = LCase(objProcess.CommandLine & "")
        If InStr(cmd, LCase(matchText)) > 0 Then
            IsProcessRunning = True
            Exit For
        End If
    Next
    On Error GoTo 0
End Function

If Not IsProcessRunning("monitor.py") Then
    WshShell.Run "cmd /c cd /d ""C:\DASHBOARD\monitor"" && ""C:\Users\Atelier Arte\AppData\Local\Programs\Python\Python312\python.exe"" monitor.py", 1, False
End If

If Not IsProcessRunning("server.js") Then
    WshShell.CurrentDirectory = "C:\DASHBOARD\server"
    WshShell.Run """C:\Program Files\nodejs\node.exe"" ""C:\DASHBOARD\server\server.js""", 0, False
End If

If Not IsProcessRunning("pipeline_sync_daemon.js") Then
    WshShell.CurrentDirectory = "C:\DASHBOARD\server"
    WshShell.Run """C:\Program Files\nodejs\node.exe"" ""C:\DASHBOARD\server\pipeline_sync_daemon.js""", 0, False
End If
