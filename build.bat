@echo off
setlocal enabledelayedexpansion
@REM /etc/ssh/sshd_config PermitRootLogin yes PubkeyAuthentication yes
@REM systemctl restart ssh

set KEY_PATH=C:\Users\Zenos\.ssh\nube_id_rsa
set SERVICE_NAME=claude-relay-service
set REMOTE_USER=root
set REMOTE_IP=38.207.186.173
set REMOTE_SCRIPT_PATH=/root/%SERVICE_NAME%/update-local-image.sh
set REMOTE_TAR_DIR=/root/%SERVICE_NAME%-build/
set LOCAL_TAR_PATH=%SERVICE_NAME%.tar

REM 删除旧的 %LOCAL_TAR_PATH% 文件（如果存在）
if exist %LOCAL_TAR_PATH% (
    echo Deleting old %LOCAL_TAR_PATH% file...
    del "%LOCAL_TAR_PATH%"
    echo Old %LOCAL_TAR_PATH% deleted.
) else (
    echo No existing %LOCAL_TAR_PATH% file found.
)

echo Tags and main branch sync completed!

REM 先尝试 git describe，如果失败则获取最新的标签
for /f "delims=" %%i in ('git tag --sort^=-version:refname ^| findstr /v "patch" ^| findstr /r "^v"') do (
    if not defined VERSION set VERSION=%%i
)
set VERSION=%VERSION:v=%

REM 写入 VERSION 文件
echo %VERSION%>VERSION
echo Version %VERSION% written to VERSION file

echo Building Docker image with version: %VERSION%

REM 构建 Docker 镜像
REM docker build -t %LOCAL_TAR_PATH%:%VERSION% -t %LOCAL_TAR_PATH%:latest .
docker build --no-cache -t %LOCAL_TAR_PATH%:latest . 
echo Build complete: %LOCAL_TAR_PATH%:%VERSION%
docker save -o %LOCAL_TAR_PATH% %LOCAL_TAR_PATH%:latest

echo 开始执行2S等待...
timeout /t 2 /nobreak > nul
echo 2秒后继续...
docker image prune -f
@REM docker system prune -f

@REM set HTTP_PROXY=http://127.0.0.1:10808
@REM set HTTPS_PROXY=http://127.0.0.1:10808
echo --- Step 1: Uploading %LOCAL_TAR_PATH% to server ---
ssh -o IdentitiesOnly=yes -i %KEY_PATH% %REMOTE_USER%@%REMOTE_IP% "rm -f %REMOTE_TAR_DIR%%LOCAL_TAR_PATH%"
scp -o IdentitiesOnly=yes -i %KEY_PATH% %LOCAL_TAR_PATH% %REMOTE_USER%@%REMOTE_IP%:%REMOTE_TAR_DIR%
ssh -o IdentitiesOnly=yes -i %KEY_PATH% %REMOTE_USER%@%REMOTE_IP% "rm -f %REMOTE_TAR_DIR%%LOCAL_TAR_PATH%"

echo --- Step 2: Running remote update script ---
ssh -o IdentitiesOnly=yes -i %KEY_PATH% %REMOTE_USER%@%REMOTE_IP% "sh %REMOTE_SCRIPT_PATH%"

echo --- Deployment finished successfully! ---

echo 1.1.286>VERSION
REM 删除旧的 %LOCAL_TAR_PATH%.tar 文件（如果存在）
if exist "%LOCAL_TAR_PATH%" (
    echo Deleting old %LOCAL_TAR_PATH% file...
    del "%LOCAL_TAR_PATH%"
    echo Old %LOCAL_TAR_PATH% deleted.
) else (
    echo No existing %LOCAL_TAR_PATH% file found.
)

pause

