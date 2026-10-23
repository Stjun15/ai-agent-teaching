#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/Stjun15/ai-agent-teaching.git"
APP_DIR="/opt/ai-agent-teaching"
DATA_DIR="/var/lib/ai-teaching"
SERVICE="ai-teaching"
PORT=3000

if [ "${EUID}" -ne 0 ]; then echo "请用 root / sudo 运行"; exit 1; fi

echo "==> [1/8] 系统依赖（git、curl、nginx）"
apt-get update -qq
apt-get install -y -qq git curl nginx ca-certificates

echo "==> [2/8] Node 22（node:sqlite 需要 >= 22.5）"
if ! command -v node >/dev/null || [ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
node -v
corepack enable 2>/dev/null || npm i -g pnpm@latest-10

echo "==> [3/8] 交换分区（2G；小型服务器构建 Next 容易 OOM，加 swap 兜底）"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile \
    && mkswap /swapfile && swapon /swapfile \
    && echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> [4/8] 使用本地已上传代码"
cd "${APP_DIR}"

echo "==> [5/8] 数据目录与密钥（只落服务器，绝不进仓库）"
mkdir -p "${DATA_DIR}"
if [ ! -f /etc/${SERVICE}.env ]; then
  if [ -n "${ARK_API_KEY:-}" ]; then
    ARK_KEY="${ARK_API_KEY}"
  else
    read -rsp "输入 ARK_API_KEY（火山方舟）: " ARK_KEY; echo
  fi
  [ -n "${ARK_KEY}" ] || { echo "密钥不能为空"; exit 1; }
  printf 'ARK_API_KEY=%s\nPORT=%s\nDATABASE_URL=file:%s/app.db\n' \
    "${ARK_KEY}" "${PORT}" "${DATA_DIR}" > /etc/${SERVICE}.env
  chmod 600 /etc/${SERVICE}.env
fi

echo "==> [6/8] 安装依赖、建表、构建"
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build

echo "==> [7/8] systemd 服务（开机自启 + 崩溃自动拉起）"
cat > /etc/systemd/system/${SERVICE}.service <<UNIT
[Unit]
Description=AI Native Teaching Assistant (Next.js)
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
EnvironmentFile=/etc/${SERVICE}.env
ExecStart=/usr/bin/env pnpm start
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now ${SERVICE}

echo "==> [8/8] nginx 反向代理（SSE 关缓冲 + 转发真实 IP）"
cat > /etc/nginx/sites-available/${SERVICE} <<'NGINX'
server {
  listen 80 default_server;
  server_name _;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
  }
}
NGINX
ln -sf /etc/nginx/sites-available/${SERVICE} /etc/nginx/sites-enabled/${SERVICE}
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo
echo "==> 完成。自检："
echo "    curl -s http://127.0.0.1:${PORT}/api/health | head -c 400"
echo "    systemctl status ${SERVICE} --no-pager | head -5"