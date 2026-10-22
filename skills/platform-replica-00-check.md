# 平台复刻 · 启动台验收脚本

你现在还没有 Agent Loop（那是第二斧的事），所以这段脚本你自己在终端里跑——和 `node --version` 一样，只是它一次帮你查完所有项。

---

## 验收脚本

```typescript
// check-startup.ts —— 保存到 teaching-platform/ 目录下，终端运行 npx tsx check-startup.ts
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const checks: { label: string; ok: boolean; detail: string }[] = [];

// ① Node 版本
try {
  const nodeVer = execSync("node --version", { encoding: "utf8" }).trim();
  const major = parseInt(nodeVer.replace("v", "").split(".")[0]);
  const minor = parseInt(nodeVer.split(".")[1]);
  const ok = major > 22 || (major === 22 && minor >= 5);
  checks.push({
    label: "Node ≥ 22.5",
    ok,
    detail: ok ? nodeVer : `${nodeVer}（需要 v22.5.0+）`,
  });
} catch {
  checks.push({ label: "Node ≥ 22.5", ok: false, detail: "Node 未安装或 PATH 不生效——关掉终端重开后重试" });
}

// ② Git 版本
try {
  const gitVer = execSync("git --version", { encoding: "utf8" }).trim();
  checks.push({ label: "Git 已安装", ok: true, detail: gitVer });
} catch {
  checks.push({ label: "Git 已安装", ok: false, detail: "Git 未安装 → https://git-scm.com/downloads" });
}

// ③ 项目目录
const pkgPath = resolve("package.json");
if (existsSync(pkgPath)) {
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    checks.push({ label: "teaching-platform 项目存在", ok: true, detail: `Next.js ${pkg.dependencies?.next ?? "?"}` });
  } catch {
    checks.push({ label: "teaching-platform 项目存在", ok: false, detail: "package.json 存在但解析失败" });
  }
} else {
  checks.push({ label: "teaching-platform 项目存在", ok: false, detail: "package.json 不存在——确认在 teaching-platform/ 目录下运行" });
}

// ④ 环境变量文件
const envPath = resolve(".env.local");
if (existsSync(envPath)) {
  checks.push({ label: ".env.local 存在", ok: true, detail: "环境变量文件已创建" });
} else {
  checks.push({ label: ".env.local 存在", ok: false, detail: "还没创建——没关系，第一斧才需要配 API Key" });
}

// ⑤ Git 存档
try {
  const log = execSync("git log --oneline", { encoding: "utf8" }).trim();
  const hasCommit = log.length > 0;
  checks.push({
    label: "Git 已存档",
    ok: hasCommit,
    detail: hasCommit ? `已有 commit：${log.split("\n")[0]}` : "git log 为空——跑 git add -A && git commit",
  });
} catch {
  checks.push({ label: "Git 已存档", ok: false, detail: "还没 git init 或没 commit——回到上一步操作" });
}

// 输出
const pass = checks.filter((c) => c.ok).length;
const total = checks.length;
console.log(`\n启动台验收：${pass}/${total} 通过\n`);
for (const c of checks) {
  console.log(`${c.ok ? "✓" : "✗"} ${c.label.padEnd(24)} ${c.ok ? c.detail : "→ " + c.detail}`);
}
console.log(pass === total ? "\n✅ 启动台全部通过！可以进入第一斧了。" : `\n⚠️  ${total - pass} 项未通过，按提示修复后再跑一次。`);
```

## 怎么运行

```bash
# 在 teaching-platform/ 目录下
npx tsx check-startup.ts
```

不需要 `npm install` 任何东西——`tsx` 是临时借来跑 TypeScript 的（和 `npx create-next-app` 一样，用完即走）。

## 你会看到什么

```
启动台验收：4/5 通过

✓ Node ≥ 22.5              v22.7.0
✗ Git 已安装              → Git 未安装 → https://git-scm.com/downloads
✓ teaching-platform 项目存在  Next.js 16.0.5
✓ .env.local 存在           环境变量文件已创建
✓ Git 已存档               已有 commit：空项目跑通
```

每项一行，✓ 或 ✗ 一目了然。✗ 的那行直接告诉你该怎么修。