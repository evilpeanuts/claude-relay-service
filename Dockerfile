# 🎯 后端依赖阶段 (与前端构建并行)
FROM node:25-alpine AS backend-deps

# 🔧 安装编译工具，并创建 python 软链接
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++ \
    && ln -sf python3 /usr/bin/python \
    && echo "export PYTHON=/usr/bin/python3" >> /etc/profile \
    && rm -rf /var/cache/apk/*

# 📁 设置工作目录
WORKDIR /app

# 📦 复制 package 文件
COPY package*.json ./

# 🔽 安装依赖 (生产环境) - 使用 BuildKit 缓存加速
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

# 🧹 清理构建工具（重要！）
RUN apk del .build-deps && \
    rm -rf /var/cache/apk/* && \
    npm cache clean --force
# 🎯 前端构建阶段 (与后端依赖并行)
FROM node:25-alpine AS frontend-builder

# 📁 设置工作目录
WORKDIR /app/web/admin-spa

# 📦 复制前端依赖文件
COPY web/admin-spa/package*.json ./
COPY web/admin-spa/.npmrc ./

# 🔽 安装前端依赖 - 使用 BuildKit 缓存加速
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# 📋 复制前端源代码
COPY web/admin-spa/ ./

# 🏗️ 构建前端
RUN npm run build

# 🐳 主应用阶段
FROM node:25-alpine

RUN apk add --no-cache dumb-init

# 📋 设置标签
LABEL maintainer="claude-relay-service@example.com"
LABEL description="Claude Code API Relay Service"
LABEL version="1.0.0"

# 🔧 安装系统依赖
# RUN apk add --no-cache \
#     curl \
#     dumb-init \
#     sed \
#     && rm -rf /var/cache/apk/*

# 🔧 安装编译工具，并创建 python 软链接
# RUN apk add --no-cache --virtual .build-deps \
#     curl\
#     dumb-init \
#     sed \
#     python3 \
#     make \
#     g++ \
#     && ln -sf python3 /usr/bin/python \
#     && echo "export PYTHON=/usr/bin/python3" >> /etc/profile \
#     && rm -rf /var/cache/apk/*

# 确保 PATH 包含 python
ENV PATH="/usr/bin:$PATH"
ENV PYTHON=/usr/bin/python3
# 📁 设置工作目录
WORKDIR /app

# 📦 复制 package 文件 (用于版本信息等)
COPY package*.json ./

# 📦 从后端依赖阶段复制 node_modules (已预装好)
COPY --from=backend-deps /app/node_modules ./node_modules

# 📋 复制应用代码
COPY . .

# 📦 从前端构建阶段复制前端产物
COPY --from=frontend-builder /app/web/admin-spa/dist /app/web/admin-spa/dist

# 🧹 清理构建工具（重要！）
# RUN apk del .build-deps && \
#     rm -rf /var/cache/apk/* && \
#     npm cache clean --force

# 🔧 复制并设置启动脚本权限
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 检查文件是否存在，然后根据DEBUG变量决定是否输出详细信息
RUN if [ -f "/usr/local/bin/docker-entrypoint.sh" ]; then \
        echo "[INFO] 文件已成功复制到容器" ; \
    else \
        echo "[ERROR] 文件未找到！请检查COPY命令" && \
        exit 1; \
    fi

# 📁 创建必要目录
RUN mkdir -p logs data temp

# 🔧 预先创建配置文件
RUN if [ ! -f "/app/config/config.js" ] && [ -f "/app/config/config.example.js" ]; then \
        cp /app/config/config.example.js /app/config/config.js; \
    fi

# 🌐 暴露端口
EXPOSE 3000

# 🏥 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 🚀 启动应用
ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "src/app.js"]