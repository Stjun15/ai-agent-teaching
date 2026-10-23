/**
 * 浏览器端 / 通用 id 生成。
 *
 * 为什么不直接调 `crypto.randomUUID()`
 * -----------------------------------
 * `randomUUID` 只在**安全上下文**（HTTPS 或 localhost）可用。生产环境是
 * `http://<ECS-IP>` 明文访问，浏览器里 `crypto.randomUUID` 是 `undefined`，
 * 调用直接抛 `TypeError`。这类缺口本地验收永远抓不到（localhost 算安全上下文），
 * 一上线就炸：2026-10-23 线上讲解页恒显示「还没有对话」，真因就是讲稿种入时
 * 生成消息 id 崩在这里。
 *
 * `crypto.getRandomValues` **不受**安全上下文限制，因此降级用它拼一个 UUID v4。
 */
export function randomUuid(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
