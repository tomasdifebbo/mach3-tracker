@echo off
color 0B
echo ===================================================
echo   INSTALADOR DE MONITORAMENTO - ROUTER 2 (ACT10)
echo ===================================================
echo Este script copia as macros de monitoramento da TOMAS
echo para a Router ACT10 atraves da rede.
echo.

set SRC=C:\DASHBOARD\temp_macros
set DEST=\\ACT10\Mach3\macros\Mach3Mill

echo Tentando copiar para: %DEST%
echo.

copy /Y "%SRC%\M101.m1s" "%DEST%\M101.m1s"
copy /Y "%SRC%\M102.m1s" "%DEST%\M102.m1s"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCESSO] Macros instaladas na Router ACT10!
    echo Agora a Router 2 passara a enviar relatorios ao Dashboard.
) else (
    echo.
    echo [ERRO] Falha ao copiar. Verifique se:
    echo 1. A Router ACT10 esta ligada e acessivel na rede.
    echo 2. Voce tem permissao de gravacao na pasta Mach3 da ACT10.
)

pause
