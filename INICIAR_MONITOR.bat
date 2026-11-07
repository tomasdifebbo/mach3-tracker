@echo off
title Mach3 & Laser Multi-Router Monitor V2.0
color 0A
cd /d "C:\DASHBOARD"
echo ==================================================
echo   MACH3 TRACKER - MONITOR MULTI-ROUTER V2.0
echo ==================================================
echo.
echo [*] Atualizando repositorio...
git pull
echo.
echo [*] Iniciando Assistente de Pastas (Oficina 3)...
start "" "C:\Users\Atelier Arte\AppData\Local\Programs\Python\Python312\pythonw.exe" "C:\DASHBOARD\assistente_pastas\painel_oficina.py"
echo.
echo [*] Iniciando Monitor do Mach3 e Laser...
cd /d "C:\DASHBOARD\monitor"
"C:\Users\Atelier Arte\AppData\Local\Programs\Python\Python312\python.exe" -u monitor.py
pause
