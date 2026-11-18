#!/usr/bin/env bash
# ============================================================================
# 一键部署（Ubuntu 22.04+ / Debian 12+，root 执行）
#
#   sudo bash deploy/deploy.sh                 # 全流程：装环境→拉代码→建表→种子→构建→systemd→nginx→自检
#   sudo bash deploy/deploy.sh --no-build      # 1C1G 小机：跳过机上构建（先把本地 .next 传上去）
#   sudo bash deploy/deploy.sh --no-pull       # 代码已手工上传到 APP_DIR，不从远端拉
#   DASHSCOPE_API_KEY=sk-xxx sudo -E bash deploy/deploy.sh   # 非交互
#
# 幂等：重复执行＝更新（pull → 迁移 → 种子 → 构建 → 重启），账号与密钥不会重复创建。
# 密钥只写 /etc/ai-teaching.env（600），不落仓库、不进日志、不出现在 ps 里。
# ============================================================================
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Stjun15/ai-agent-teaching.git}"
BRANCH="${BRANCH:-dev}"
APP_DIR="${APP_DIR:-/opt/ai-agent-teaching-app}"
DATA_DIR="${DATA_DIR:-/var/lib/ai-teaching}"
ENV_FILE="${ENV_FILE:-/etc/ai-teaching.env}"
SERVICE="${SERVICE:-ai-teaching}"
RUN_USER="${RUN_USER:-ai-teaching}"
PORT="${PORT:-3000}"

DO_BUILD=1
DO_PULL=1
for arg in "$@"; do
  case "${arg}" in
    --no-build) DO_BUILD=0 ;;
    --no-pull) DO_PULL=0 ;;
    *) echo "未知参数: ${arg}（可用 --no-build / --no-pull）"; exit 2 ;;
  esac
done

step() { printf '\n==> [%s] %s\n' "$1" "$2"; }
load_env() { set -a; . "${ENV_FILE}"; set +a; }
as_app() { runuser -p -u "${RUN_USER}" -- env HOME="${DATA_DIR}" "$@"; }

[ "${EUID}" -eq 0 ] || { echo "请用 root / sudo 运行"; exit 1; }

step 1/9 "系统依赖（git / curl / nginx / openssl）"
apt-get update -qq
apt-get install -y -qq git curl nginx ca-certificates openssl

step 2/9 "Node ≥ 22.5（node:sqlite 硬要求）"
node_ver="$(node -v 2>/dev/null | cut -dv -f2 || true)"
if [ -z "${node_ver}" ] || [ "$(printf '%s\n%s\n' "22.5.0" "${node_ver}" | sort -V | head -1)" != "22.5.0" ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
node -v
NODE_BIN="$(command -v node)"
# 不用 corepack 的 pnpm：/usr/bin/pnpm 是 shim，会在首次调用时联网解析版本，
# 以服务用户身份运行时直接 EACCES，表现为启动超时。装成真实二进制一次到位。
npm i -g pnpm@10 >/dev/null 2>&1

step 3/9 "交换分区（内存 < 2G 且无 swap 时加 2G，防小机构建 OOM）"
if ! swapon --show | grep -q . && [ "$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo)" -lt 2048 ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null \
    && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

step 4/9 "运行用户与数据目录（服务降权，不用 root 跑应用）"
id -u "${RUN_USER}" >/dev/null 2>&1 \
  || useradd --system --create-home --home-dir "${DATA_DIR}" --shell /usr/sbin/nologin "${RUN_USER}"
mkdir -p "${APP_DIR}" "${DATA_DIR}"
chown -R "${RUN_USER}:${RUN_USER}" "${DATA_DIR}"

step 5/9 "代码（${BRANCH} 分支）"
if [ "${DO_PULL}" -eq 1 ]; then
  if [ -d "${APP_DIR}/.git" ]; then
    git -C "${APP_DIR}" fetch --depth 1 origin "${BRANCH}"
    git -C "${APP_DIR}" checkout -q -B "${BRANCH}" FETCH_HEAD
  else
    git clone --depth 1 --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
  fi
fi
chown -R "${RUN_USER}:${RUN_USER}" "${APP_DIR}"

step 6/9 "环境文件（密钥只落服务器）"
if [ ! -f "${ENV_FILE}" ]; then
  key="${DASHSCOPE_API_KEY:-}"
  if [ -z "${key}" ]; then read -rsp "输入 DASHSCOPE_API_KEY（百炼）: " key; echo; fi
  [ -n "${key}" ] || { echo "密钥不能为空"; exit 1; }
  umask 077
  cat > "${ENV_FILE}" <<EOF
DASHSCOPE_API_KEY=${key}
AUTH_SECRET=$(openssl rand -base64 48 | tr -d '\n=' | tr '+/' '-_')
DATABASE_URL=file:${DATA_DIR}/app.db
NODE_ENV=production
EOF
  chmod 600 "${ENV_FILE}"
fi
load_env

step 7/9 "依赖、建表、演示账号"
cd "${APP_DIR}"
as_app pnpm install --frozen-lockfile
as_app pnpm db:migrate
as_app pnpm db:seed:auth

step 8/9 "构建并托管（systemd）"
if [ "${DO_BUILD}" -eq 1 ]; then
  as_app pnpm build
else
  echo "已跳过构建：请确认 ${APP_DIR}/.next 是上传好的产物"
fi
cat > "/etc/systemd/system/${SERVICE}.service" <<UNIT
[Unit]
Description=AI Native 编程教学助手（Next.js）
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${RUN_USER}
Group=${RUN_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
Environment=HOME=${DATA_DIR}
Environment=NODE_ENV=production
ExecStart=${NODE_BIN} ${APP_DIR}/node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${PORT}
Restart=always
RestartSec=3
TimeoutStopSec=20
NoNewPrivileges=yes
PrivateTmp=yes
ProtectHome=yes
ProtectSystem=full
ReadWritePaths=${APP_DIR} ${DATA_DIR}

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable "${SERVICE}" >/dev/null 2>&1
systemctl restart "${SERVICE}"

step 9/9 "nginx 反代与安全加固（SSE 关缓冲）"
cat > "/etc/nginx/sites-available/${SERVICE}" <<NGINX
server {
  listen 80 default_server;
  server_name _;

  server_tokens off;
  client_max_body_size 2m;
  client_header_timeout 15s;
  client_body_timeout 15s;

  add_header X-Content-Type-Options nosniff always;
  add_header X-Frame-Options SAMEORIGIN always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
  add_header Permissions-Policy "camera=(), microphone=(self), geolocation=()" always;
  proxy_hide_header X-Powered-By;

  location / {
    proxy_pass http://127.0.0.1:${PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    # 限流按真实 IP 计数依赖这个头（见 src/lib/security/rate-limit.ts）
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    # SSE：不关缓冲则打字机效果会整段卡到结束才吐
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
  }
}
NGINX
ln -sf "/etc/nginx/sites-available/${SERVICE}" "/etc/nginx/sites-enabled/${SERVICE}"
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable nginx >/dev/null 2>&1 && systemctl restart nginx

printf '\n==> 健康检查：'
ok=0
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" -o /tmp/ai-teaching-health.json 2>/dev/null; then ok=1; break; fi
  sleep 2
done
if [ "${ok}" -eq 1 ]; then
  head -c 400 /tmp/ai-teaching-health.json; echo
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  printf '\n部署完成：http://%s  （账号 test / test1234）\n' "${ip:-<服务器IP>}"
else
  echo "失败：30 次重试仍未就绪，查看 journalctl -u ${SERVICE} -n 80 --no-pager"
  exit 1
fi
