@echo off
REM 测试翻译统计功能
REM 使用方法: test-translation-stats.bat [base_url]

setlocal

if "%~1"=="" (
    set BASE_URL=http://localhost:3000
) else (
    set BASE_URL=%~1
)

echo Testing translation stats at %BASE_URL%...
echo.

node scripts\test-translation-stats.js

endlocal
