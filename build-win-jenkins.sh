#!/bin/bash

PASSWORD=YMyxwX8EBmkgRMaR
REMOTE_USER=root
REMOTE_IP=38.95.79.52
REMOTE_TAR_DIR=/root/claude-relay-service-build/
REMOTE_UPDATE_PATH=/root/claude-relay-service/update-local-image.sh
LOCAL_TAR_PATH=claude-relay-service.tar
CURRENT_DIR=/data/claude-relay-service/

set -e

# 设置错误处理：任何命令失败立即退出脚本


# 函数：错误处理
handle_exit() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
    echo "❌ Error occurred, exit code: $exit_code"
    echo "Deployment failed!"
    fi
}

trap handle_exit EXIT
echo "--- Starting deployment process ---"

apt-get update && apt-get install -y sshpass && apt-get install -y rsync

# 获取版本号用于 Docker 镜像标签
# 先尝试 git describe，如果失败则获取最新的标签
# VERSION=$(git describe --tags --abbrev=0 2>/dev/null)

# 如果上面失败，获取最新的非 alpha/patch 版本标签
# if [ -z "$VERSION" ]; then
#     VERSION=$(git tag --sort=-version:refname | grep -v "alpha" | grep -v "patch" | grep -E "^v" | head -n 1)
# fi

# # 如果还是没有，就获取任意最新标签
# if [ -z "$VERSION" ]; then
#     VERSION=$(git tag --sort=-version:refname | head -n 1)
# fi

# 最后的默认值（取消注释如果需要）
# if [ -z "$VERSION" ]; then
#     VERSION="dev"
# fi

# 写入 VERSION 文件
# echo "$VERSION" > VERSION
# echo "✅ Version $VERSION written to VERSION file"

# echo "Building Docker image with version: $VERSION"


# 删除旧的 Docker 镜像
# echo "--- Cleaning up old Docker images ---"
# 删除所有名为 new-api 的镜像，除了最新的
# docker images new-api --format "table {{.ID}}\t{{.Repository}}\t{{.Tag}}" | grep -v "IMAGE ID" | while read -r id repository tag; do
#     if [ "$tag" != "latest" ]; then
#         echo "Removing old image: $repository:$tag ($id)"
#         docker rmi "$id" 2>/dev/null || true
#     fi
# done

# 清理悬空镜像（构建过程中产生的中间层镜像）
# echo "Cleaning up dangling images..."
# docker image prune -f

# export DOCKER_BUILDKIT=0
# export DOCKER_REGISTRY_MIRROR=https://gkt07718.mirror.aliyuncs.com
# # export DOCKER_REGISTRY_MIRROR=https://docker.m.daocloud.io

# 构建 Docker 镜像
# echo "--- Building new Docker image ---"
# if ! docker build --no-cache -t new-api:latest .; then
#     echo "❌  ERROR: Docker build failed!"
#     exit 1
# fi

# echo -n > VERSION
# echo "Successfully restored VERSION file locally."

# # 如果有版本号，也打上版本标签
# if [ -n "$VERSION" ] && [ "$VERSION" != "latest" ]; then
#     echo " Tagging image with version: $VERSION"
#     docker tag new-api:latest "new-api:$VERSION"
#     echo "Build complete: new-api:$VERSION"
# fi

# # 删除旧的 new-api.tar 文件（如果存在）
# if [ -f "$LOCAL_TAR_PATH" ]; then
#     echo "Deleting old new-api.tar file..."
#     rm "$LOCAL_TAR_PATH"
#     echo "Old new-api.tar deleted."
# else
#     echo "No existing new-api.tar file found."
# fi

# # 保存镜像
# echo "Saving Docker image to tar file..."
# if ! docker save -o new-api.tar new-api:latest; then
#     echo "❌ ERROR: Failed to save Docker image!"
#     exit 1
# fi
# echo "✅Docker image saved to new-api.tar"

# 设置代理（取消注释如果需要）
# export HTTP_PROXY=http://127.0.0.1:10808
# export HTTPS_PROXY=http://127.0.0.1:10808

# 执行远程命令
# sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no ${SSH_USER}@${SERVER_IP} "远程命令"

# # 复制文件到远程
# sshpass -p "${SSH_PASSWORD}" scp -o StrictHostKeyChecking=no 本地文件 ${SSH_USER}@${SERVER_IP}:远程路径

echo "--- Step 1: SSH remove old tar ---"
echo "sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no -o CheckHostIP=no ${REMOTE_USER}@${REMOTE_IP} "rm -f ${REMOTE_TAR_DIR}${LOCAL_TAR_PATH}""
if ! sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no -o CheckHostIP=no ${REMOTE_USER}@${REMOTE_IP} "rm -f ${REMOTE_TAR_DIR}${LOCAL_TAR_PATH}"; then
    echo "⚠️WARNING: Failed to remove old tar on remote server, continuing..."
fi
echo "--- ✅SSH remove old tar Success ---"

echo "--- Step 2: Install Rsync on remote server ---"
if ! sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no -o CheckHostIP=no ${REMOTE_USER}@${REMOTE_IP} "apt-get update && apt-get install -y rsync";
then
    echo "❌ ERROR: Failed to install rsync on remote server!"
    exit 1
fi

echo "--- Step 3: Scp to Server ---"
# if ! sshpass -p "$PASSWORD" scp -o StrictHostKeyChecking=no "$CURRENT_DIR$LOCAL_TAR_PATH" "$REMOTE_USER@$REMOTE_IP:$REMOTE_TAR_DIR"; then
#     echo "❌ ERROR: Failed to upload tar file to server!"
#     exit 1
# fi

# echo "sshpass -p "$PASSWORD" rsync -av --progress -e "ssh -o StrictHostKeyChecking=no" "$CURRENT_DIR$LOCAL_TAR_PATH" "$REMOTE_USER@$REMOTE_IP:$REMOTE_TAR_DIR""
if ! sshpass -p "$PASSWORD" rsync -av --progress \
  -e "ssh -o StrictHostKeyChecking=no" \
  "$CURRENT_DIR$LOCAL_TAR_PATH" \
  "$REMOTE_USER@$REMOTE_IP:$REMOTE_TAR_DIR"; then
    echo "❌ ERROR: Failed to upload tar file to server!"
    exit 1
fi


echo "--- ✅Scp to Server Success ---"

echo "--- Step 4: Running remote update script ---"
if ! sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no ${REMOTE_USER}@${REMOTE_IP} "sh $REMOTE_UPDATE_PATH"; then
    echo "❌ ERROR: Remote update script failed!"
    exit 1
fi
echo "--- ✅Running remote update script ---"

echo "--- ✅✅✅Deployment finished successfully! ---"