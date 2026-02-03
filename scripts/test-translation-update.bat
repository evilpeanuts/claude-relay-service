@echo off
REM 测试翻译账户更新功能
REM 使用方法: test-translation-update.bat [base_url]

setlocal

if "%~1"=="" (
    set BASE_URL=http://localhost:3000
) else (
    set BASE_URL=%~1
)

echo Testing translation account update at %BASE_URL%...
echo.

node scripts\test-translation-update.js

endlocal
