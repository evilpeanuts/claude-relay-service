#!/bin/bash

set -euo pipefail

KEY_PATH=~/.ssh/nube_id_rsa
SERVICE_NAME=claude-relay-service
REMOTE_USER=root
REMOTE_IP=38.95.79.52
REMOTE_SCRIPT_PATH=/root/${SERVICE_NAME}/update-local-image.sh
REMOTE_TAR_DIR=/root/${SERVICE_NAME}-build/
LOCAL_TAR_PATH=${SERVICE_NAME}.tar

if [ -f "$LOCAL_TAR_PATH" ]; then
    echo "Deleting old $LOCAL_TAR_PATH file..."
    rm -f "$LOCAL_TAR_PATH"
    echo "Old $LOCAL_TAR_PATH deleted."
else
    echo "No existing $LOCAL_TAR_PATH file found."
fi

echo "Tags and main branch sync completed!"

VERSION=$(git tag --sort=-version:refname | grep -v 'patch' | grep -E '^v' | head -n 1)
VERSION=${VERSION#v}

echo "$VERSION" > VERSION
echo "Version $VERSION written to VERSION file"

echo "Building Docker image with version: $VERSION"
docker build --no-cache -t ${SERVICE_NAME}:latest .
echo "Build complete: ${LOCAL_TAR_PATH}:$VERSION"
docker save -o "$LOCAL_TAR_PATH" ${SERVICE_NAME}:latest

echo "开始执行2S等待..."
sleep 2
echo "2秒后继续..."
docker image prune -f

echo "--- Step 1: Uploading $LOCAL_TAR_PATH to server ---"
ssh -o IdentitiesOnly=yes -i "$KEY_PATH" ${REMOTE_USER}@${REMOTE_IP} "rm -f ${REMOTE_TAR_DIR}${LOCAL_TAR_PATH}"
scp -o IdentitiesOnly=yes -i "$KEY_PATH" "$LOCAL_TAR_PATH" ${REMOTE_USER}@${REMOTE_IP}:${REMOTE_TAR_DIR}

echo "--- Step 2: Running remote update script ---"
ssh -o IdentitiesOnly=yes -i "$KEY_PATH" ${REMOTE_USER}@${REMOTE_IP} "sh ${REMOTE_SCRIPT_PATH}"

echo "--- Deployment finished successfully! ---"

if [ -f "$LOCAL_TAR_PATH" ]; then
    echo "Deleting old $LOCAL_TAR_PATH file..."
    rm -f "$LOCAL_TAR_PATH"
    echo "Old $LOCAL_TAR_PATH deleted."
else
    echo "No existing $LOCAL_TAR_PATH file found."
fi
