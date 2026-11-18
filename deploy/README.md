# 一键部署（常驻主机路线）

一台全新 Ubuntu 22.04+ / Debian 12 服务器，root 执行一条命令，得到可访问
的公网演示地址。脚本幂等，重复执行＝拉最新代码并重启。

## 你要准备的

1. **服务器**：任意云主机，最低配即可（1C1G 也能跑，脚本自动加 swap）。
2. **`DASHSCOPE_API_KEY`**（百炼模型密钥）：只写进服务器 `/etc/ai-teaching.env`，
   不入库、不进日志。仓库已 Public，拉代码不需要 Token。

## 一键部署

```bash
curl -fsSL https://raw.githubusercontent.com/Stjun15/ai-agent-teaching/dev/deploy/deploy.sh -o deploy.sh
sudo DASHSCOPE_API_KEY=sk-xxx bash deploy.sh      # 交互式输入密钥时可省略该变量
```

结束后脚本自己打健康检查结果与访问地址：`http://服务器IP/`，
演示账号 `test / test1234`（另有 `demo1 / demo1234`、`demo2 / demo1234`）。

## 两种构建路线

| 场景 | 命令 | 说明 |
|---|---|---|
| 2G 以上内存 | `sudo bash deploy.sh` | 机上加 swap 后就地 `pnpm build` |
| 1C1G 小机 | 先本地 `pnpm build` 再传 `.next`，然后 `sudo bash deploy.sh --no-build` | 机上构建会打进 swap 风暴，官方推荐这条 |

传包时 zip 内路径必须带 `.next/` 前缀；解压后把 `required-server-files.json`
里的本地绝对路径改成服务器上的路径，再跑脚本重启即可。

## 脚本做了什么（9 步，全部幂等）

装 git/curl/nginx/openssl → Node ≥22.5（不用 corepack，避免启动时联网解析）
→ 内存不足 2G 时加 2G swap → 建系统用户 `ai-teaching` 与数据目录
`/var/lib/ai-teaching`（服务降权，不用 root 跑应用）→ 拉 `dev` 分支
→ 生成 `/etc/ai-teaching.env`（600，`AUTH_SECRET` 自动生成）→ 依赖 +
建表 + 演示账号种子 → systemd 托管（`Restart=always`、`ProtectSystem=full`、
`NoNewPrivileges`、只监听 `127.0.0.1:3000`）→ nginx 反代与加固
（`server_tokens off`、安全响应头、隐藏 `X-Powered-By`、`client_max_body_size 2m`、
SSE 关缓冲）→ 健康检查。

## 脚本不覆盖的部分（主机层，按需手工）

- SSH 加固（仅密钥登录、安全组收口）与内核参数（`rp_filter` 等）；
- 域名与 HTTPS（配 `server_name` 后用 certbot）；
- Cloudflare quick tunnel（可选，隧道地址每次重启都会变）。

## 评审期间保持可用

systemd 已 `enabled`，机器重启与进程崩溃都会自愈；云主机不欠费即可。
评审前建议重启一次并打开 `/api/health` 确认返回 `status: ok`。
