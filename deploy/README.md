# 在线演示部署套件（常驻主机路线）

大赛「在线演示」是可选加分项，要求：公网可访问 + 评审期间保持可用。
本目录是 `docs/deployment.md` 路径 B 的**可执行版**——买一台最便宜的
云服务器，跑一个脚本，十分钟内拿到公网演示地址。

## 你需要准备的

1. **一台云服务器**：Ubuntu 22.04+，最低配即可（1C1G 也行，脚本会加 swap）。
   腾讯云轻量 / 阿里云 ECS / 华为云均可，新用户或学生机通常几十元一年。
2. **一个 GitHub 细粒度 PAT**（仓库是私有的，服务器拉代码要用）：
   GitHub → Settings → Developer settings → Fine-grained tokens →
   仅授权 `ai-agent-teaching` 仓库、仅 `Contents: Read-only`、有效期设短。
3. **火山方舟的 `ARK_API_KEY`**（模型密钥，只写进服务器环境文件，绝不入库）。

## 三步部署（在服务器上执行）

```bash
# 1. 服务器上拿到部署脚本（或直接从本地上传 scp deploy/deploy.sh root@服务器IP:/root/）
# 2. 执行（会交互式询问 ARK_API_KEY）
GITHUB_TOKEN=github_pat_xxx bash deploy.sh
# 3. 自检
curl -s http://127.0.0.1:3000/api/health
```

然后浏览器访问 `http://服务器IP/`（nginx 已反代 80 → 3000）。

## 脚本做了什么（8 步，全部幂等可重跑）

装 git/curl/nginx 与 Node 22 → 加 2G swap（防小内存构建 OOM）→
克隆/更新仓库 → 数据目录 `/var/lib/ai-teaching`（持久盘语义）→
密钥写入 `/etc/ai-teaching.env`（chmod 600）→ 依赖 + 建表 + 构建 →
systemd 服务（崩溃自动拉起、开机自启）→ nginx 反代（SSE 关缓冲、
转发 X-Forwarded-For，限流按真实 IP 计数）。

## 评审期间保持可用（大赛硬要求）

- 服务器保持运行即可（systemd 自动守护；云主机不欠费）。
- 建议评审开始前重启一次并打开 `/api/health` 确认。
- 若绑定域名：在 nginx 配置加 `server_name` 并上 HTTPS（certbot）。
