/**
 * 凭证与指纹（服务端纯函数）
 *
 * 这里做三件事：把结构化数据规范化成稳定字符串、算 SHA-256 指纹、
 * 再用服务端密钥签发一份可复算的签名。界面上「模块凭证徽章 / 点评签名徽标 /
 * 学情指纹卡」三处展示的都是本文件的输出 —— 同一套算法，三种视图。
 *
 * 为什么全部留在服务端
 * ------------------
 * 生产入口是明文 HTTP，浏览器的 `crypto.subtle` 在非安全上下文里是
 * `undefined`；把哈希放到客户端，「校验」在真实环境会直接失效。
 * 所以客户端只负责显示结果，计算一律走 Node 的 `crypto`。
 *
 * ⚠️ 这是**完整性自检**，不是不可篡改的外部存证：密钥在本机，能改库的人
 * 也能改指纹。它的价值是「发现前后不一致」，不是「对外公示」。
 * 界面文案不要承诺超出这一层的保证。
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** 开发默认密钥。生产应通过 `CREDENTIAL_SECRET` 覆盖（缺省时回落到它）。 */
const DEV_SECRET = "ai-teaching-credential-dev-secret";

/** 读签名密钥。不校验强度：这一层是演示级完整性校验，见文件头。 */
export function credentialSecret(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.CREDENTIAL_SECRET?.trim();
  return value !== undefined && value !== "" ? value : DEV_SECRET;
}

/**
 * 规范化 JSON：递归按 key 字典序排列后再序列化。
 *
 * 同一份数据永远得到同一串，与对象字面量的书写顺序无关 —— 否则
 * 「换个字段顺序」就会算出一个新指纹，校验必然误报。
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

/** SHA-256 指纹（64 位小写十六进制）。 */
export function fingerprintOf(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}

/** 取指纹前缀。完整 64 位会把卡片撑破，界面上只露一小段。 */
export function shortHash(hex: string, length = 12): string {
  return hex.slice(0, Math.max(4, length));
}

/** 一份签发结果。 */
export interface CredentialStamp {
  /** 数据本身的 SHA-256。 */
  fingerprint: string;
  /** HMAC-SHA256 签名：覆盖同一段规范化数据。 */
  signature: string;
}

/** 签发：改任一字段，指纹与签名都会变。 */
export function issueCredential(value: unknown): CredentialStamp {
  const canonical = canonicalize(value);
  return {
    fingerprint: createHash("sha256").update(canonical, "utf8").digest("hex"),
    signature: createHmac("sha256", credentialSecret())
      .update(canonical, "utf8")
      .digest("hex"),
  };
}

/** 验签：重算后定长比较（长度不同直接判否，避免 `timingSafeEqual` 抛错）。 */
export function verifySignature(value: unknown, signature: string): boolean {
  const expected = createHmac("sha256", credentialSecret())
    .update(canonicalize(value), "utf8")
    .digest("hex");
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
