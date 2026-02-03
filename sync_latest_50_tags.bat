@echo off
setlocal enabledelayedexpansion

set TAG_COUNT=50
set PROXY=http://127.0.0.1:10808
@REM set PROXY=socks5h://127.0.0.1:10808
set ORIGIN=origin

echo ===============================
echo 1. Fetch upstream latest tags
echo ===============================

git -c https.proxy=%PROXY% fetch upstream --tags

echo ===============================
echo 2. Get latest %TAG_COUNT% tags from upstream
echo ===============================

git tag -l --sort=-creatordate > upstream_tags_all.txt
powershell -command "Get-Content upstream_tags_all.txt | Select-Object -First %TAG_COUNT%" > upstream_latest_tags.txt

echo ===============================
echo 3. Fetch missing tags locally
echo ===============================

for /F %%i in (upstream_latest_tags.txt) do (
    git show-ref --tags --quiet refs/tags/%%i
    if errorlevel 1 (
        echo Fetch missing tag %%i
        git fetch upstream refs/tags/%%i:refs/tags/%%i
    ) else (
        echo Skip existing local tag %%i
    )
)

echo ===============================
echo 4. Get origin tags
echo ===============================

git ls-remote --tags %ORIGIN% > origin_tags_raw.txt

REM 遍历 origin_tags_raw.txt，取第三段（即 tag 名），并写入 origin_tags.txt
del origin_tags.txt 2>nul
for /F "tokens=3 delims=/" %%i in (origin_tags_raw.txt) do (
    REM %%i 可能是 v1.1.208 或 v1.1.208^{}
    REM 只保留不含 ^{ } 的行
    echo %%i | findstr /V "[\^{}]" >> origin_tags.txt
)

echo ===============================
echo 5. Push missing tags to origin
echo ===============================

for /F %%i in (upstream_latest_tags.txt) do (
    echo Processing tag -%%i-
    
    REM 检查 tag 是否存在于 origin_tags.txt
    findstr "%%i" origin_tags.txt >nul
    if ERRORLEVEL 1 (
        echo [DRY-RUN] Would push tag --%%i-
        git push origin refs/tags/%%i
    ) else (
        echo Tag %%i already exists on origin
    )
)

echo ===============================
echo 6. Delete old tags from origin (keep only latest %TAG_COUNT%)
echo ===============================

for /F %%i in (origin_tags.txt) do (
    findstr /x "%%i" upstream_latest_tags.txt >nul
    if errorlevel 1 (
        echo Delete old tag %%i from origin
        git push origin :refs/tags/%%i
    )
)

echo ===============================
echo 7. Clean up temporary files
echo ===============================

del upstream_tags_all.txt 2>nul
del upstream_latest_tags.txt 2>nul
del origin_tags_raw.txt 2>nul
del origin_tags.txt 2>nul

echo ===============================
echo DONE. origin now has only latest %TAG_COUNT% tags.
echo ===============================

endlocal
pause
