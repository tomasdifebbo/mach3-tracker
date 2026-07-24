@echo off
title Mach3 & Laser Monitor
cd /d "%~dp0"
echo Iniciando Monitor do Mach3 e Laser...
"C:\Users\Atelier Arte\AppData\Local\Programs\Python\Python312\python.exe" monitor.py
pause
