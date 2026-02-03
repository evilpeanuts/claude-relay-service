@echo off
setlocal enabledelayedexpansion

@REM set KEY_PATH=C:\Users\Zenos\.ssh\yearVpsprivate.key
@REM set REMOTE_USER=root
@REM set REMOTE_IP=38.247.3.139
@REM set REMOTE_SCRIPT_PATH=/root/claude-relay-service/update-local-image.sh
@REM set REMOTE_TAR_DIR=/root/claude-relay-service-build/
@REM set LOCAL_TAR_PATH=claude-relay-service.tar

@REM 关闭 WSL 以释放文件锁（如果适用）
@REM wsl --shutdown

REM 删除旧的 claude-relay-service.tar 文件（如果存在）
if exist "claude-relay-service.tar" (
    echo Deleting old claude-relay-service.tar file...
    del "claude-relay-service.tar"
    echo Old claude-relay-service.tar deleted.
) else (
    echo No existing claude-relay-service.tar file found.
)

@REM 获取版本号用于 Docker 镜像标签

@REM git fetch upstream --tags

@REM 删除远程origin上的所有remote-tracking分支引用
@REM echo Cleaning up remote-tracking branches...
@REM git remote prune origin

@REM 获取最新的50个tags并推送到origin
@REM echo Fetching latest 50 tags and pushing to origin...
@REM for /f "delims=" %%i in ('powershell -Command "git tag --sort=-creatordate | Select-Object -First 50"') do (
@REM     echo Pushing tag: %%i
@REM     git push origin %%i
@REM )

@REM 推送main分支到origin
@REM echo Pushing main branch to origin...
@REM git push origin main

echo Tags and main branch sync completed!

REM 先尝试 git describe，如果失败则获取最新的标签
for /f "delims=" %%i in ('git describe --tags --abbrev=0 2^>nul') do set VERSION=%%i

REM 如果上面失败，获取最新的非 alpha/patch 版本标签
if "%VERSION%"=="" (
    for /f "delims=" %%i in ('git tag --sort^=-version:refname ^| findstr /v "alpha" ^| findstr /v "patch" ^| findstr /r "^v"') do (
        if not defined VERSION set VERSION=%%i
    )
)

REM 如果还是没有，就获取任意最新标签
if "%VERSION%"=="" (
    for /f "delims=" %%i in ('git tag --sort^=-version:refname') do (
        if not defined VERSION set VERSION=%%i
    )
)

set VERSION=%VERSION:v=%

REM 写入 VERSION 文件
echo %VERSION%>VERSION
echo Version %VERSION% written to VERSION file

echo Building Docker image with version: %VERSION%

REM 构建 Docker 镜像
REM docker build -t claude-relay-service:%VERSION% -t claude-relay-service:latest .
docker build --no-cache -t claude-relay-service:latest .
echo Build complete: claude-relay-service:%VERSION%
docker save -o claude-relay-service.tar claude-relay-service:latest

echo 开始执行2S等待...
timeout /t 2 /nobreak > nul
echo 2秒后继续...
docker image prune -f
@REM docker system prune -f

@REM @REM set HTTP_PROXY=http://127.0.0.1:10808
@REM @REM set HTTPS_PROXY=http://127.0.0.1:10808
@REM echo --- Step 1: Uploading claude-relay-service.tar to server ---
@REM ssh -i %KEY_PATH% %REMOTE_USER%@%REMOTE_IP% "rm -f %REMOTE_TAR_DIR%%LOCAL_TAR_PATH%"
@REM scp -i %KEY_PATH% %LOCAL_TAR_PATH% %REMOTE_USER%@%REMOTE_IP%:%REMOTE_TAR_DIR%
@REM ssh -i %KEY_PATH% %REMOTE_USER%@%REMOTE_IP% "rm -f %REMOTE_TAR_DIR%%LOCAL_TAR_PATH%"

@REM echo --- Step 2: Running remote update script ---
@REM ssh -i %KEY_PATH% %REMOTE_USER%@%REMOTE_IP% "sh %REMOTE_SCRIPT_PATH%"

@REM echo --- Deployment finished successfully! ---
pause
