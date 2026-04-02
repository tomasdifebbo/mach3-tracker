@echo off  
color 0A  
echo ===================================================  
echo   INSTALADOR DE MONITORAMENTO - ROUTER 2 (ACT10)  
echo ===================================================  
echo Tentando copiar macros para Router ACT10...  
set SRC=C:\DASHBOARD\temp_macros  
set DEST=\\ACT10\Mach3\macros\Mach3Mill  
copy /Y \" "%SRC%\M101.m1s\ \%DEST%\M101.m1s\  
copy /Y \%SRC%\M102.m1s\ \%DEST%\M102.m1s\  
if 0 EQU 0 (  
    echo [SUCESSO] Macros instaladas com sucesso!  
) else (  
    echo [ERRO] Falha ao copiar. Verifique se a ACT10 esta ligada.  
)  
pause  
