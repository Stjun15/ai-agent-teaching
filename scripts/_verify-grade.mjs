/**
 * 批改闭环 E2E（跑完即删）：动手模仿 → 写一段平庸的 Prompt → 提交点评
 * → 等点评 Agent 真实批改 → 断言结果面板出现分数 / 维度 / 问题。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { BROWSERS } from "./lib/browser-registry.mjs";
import { openBrowser, sleep } from "./lib/cdp-browser.mjs";

const APP = "http://localhost:3311";
mkdirSync(".walkthrough", { recursive: true });
const edge = BROWSERS.find((b) => b.key === "edge");
const { session, kill } = await openBrowser(edge, 9337, APP);
await session.send("Page.enable");

await session.send("Page.navigate", {
  url: `${APP}/learn/llm-api/imitate`,
});
await sleep(3500);

/* 选「Prompt」任务类型（默认是 code） */
const tab = await session.evaluate(`
  const b = [...document.querySelectorAll("button")].find(
    (x) => x.innerText.trim() === "Prompt");
  if (b) { b.click(); return true; }
  return false;
`);
console.log("选 Prompt 任务类型:", tab);
await sleep(500);

/* 往编辑器里塞一段刻意平庸的 Prompt（会拿到有问题的点评，更有信息量） */
const filled = await session.evaluate(`
  async function fill() {
    for (let i = 0; i < 30; i++) {
      if (window.monaco?.editor) {
        const model = window.monaco.editor.getModels()[0];
        if (model) {
          model.setValue("帮我写一个好的提示词，让 AI 变聪明一点，反正就是让它回答得好一些就行。");
          return "monaco";
        }
      }
      const ta = document.querySelector('textarea[aria-label*="纯文本降级"]');
      if (ta) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, "value").set;
        setter.call(ta, "帮我写一个好的提示词，让 AI 变聪明一点，反正就是让它回答得好一些就行。");
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        return "fallback";
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }
  return fill();
`);
console.log("编辑器填充:", filled);

/* 点「提交点评」 */
const clicked = await session.evaluate(`
  const b = [...document.querySelectorAll("button")].find(
    (x) => x.innerText.includes("提交点评") && !x.disabled);
  if (b) { b.click(); return true; }
  return false;
`);
console.log("点提交点评:", clicked);

/* 等结果面板：出现「/ 100」且不再是「正在批改」 */
const t0 = Date.now();
let done = "", ok = false;
while (Date.now() - t0 < 150_000) {
  const cur = (await session.evaluate("return document.body?.innerText ?? ''")) ?? "";
  const grading = cur.includes("正在按评分维度逐项批改");
  if (!grading && (cur.includes("/ 100") || cur.includes("没有完成"))) {
    done = cur;
    ok = true;
    break;
  }
  await sleep(2500);
}
console.log(`等待 ${Math.round((Date.now() - t0) / 1000)}s，出结果:`, ok);

const shot = await session.send("Page.captureScreenshot", { format: "png" });
writeFileSync(".walkthrough/10-grade-loop.png", Buffer.from(shot.data, "base64"));
writeFileSync(".walkthrough/10-grade-loop.txt", done);

if (ok) {
  const seg = done.slice(done.indexOf("总分") >= 0 ? done.indexOf("总分") : Math.max(0, done.indexOf("提交点评")));
  console.log("结果面板含 维度分:", /\/ 100/.test(seg));
  console.log("结果面板含 问题清单(严重错误/优化建议):", /严重错误|优化建议/.test(seg));
  console.log("结果面板含 建议:", seg.includes("下一步建议"));
  console.log("通过与否:", seg.includes("通过") ? (seg.includes("还没通过") ? "未通过(符合平庸输入预期)" : "通过") : "未显示");
  console.log("---- 面板片段 ----");
  console.log(seg.slice(0, 700));
}
console.log("JS 异常:", session.pageErrors.length === 0 ? "无" : session.pageErrors.slice(0, 3).join("\n"));
kill();
