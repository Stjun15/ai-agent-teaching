/**
 * repository 层共用工具
 *
 * 这里集中处理三件在 6 个 repository 里会反复出现的事：
 *   1. SQLite 的标量值与 TypeScript 类型之间的转换（0/1 ↔ boolean、TEXT ↔ JSON）
 *   2. 时间与主键的生成口径（必须与 001_init.sql 的默认值格式一致）
 *   3. 部分更新的 SET 子句构造 —— 列名不能参数化，只能靠白名单挡注入
 *
 * 不提供通用的 snake_case → camelCase 自动转换：各 repository 里的字段映射
 * 一律手写。多写几行换来的是「哪个列对应哪个字段」永远可读、可搜索，
 * 而 JSON 列与布尔列本来也需要逐列指定编码方式。
 */

/** 数据库查询结果的一行 */
export type Row = Record<string, unknown>;

/** 可以传给 SQLite 的值（对应 node:sqlite 的 SQLInputValue） */
export type SqlValue = null | number | bigint | string | Uint8Array;

/**
 * 当前时间的 ISO 8601 UTC 字符串（毫秒精度，以 Z 结尾）。
 *
 * 必须与 001_init.sql 里 `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` 的格式一致：
 * 两种来源的时间若格式不同，字符串排序就会错乱。
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/** 生成主键。UUID 由应用层生成，使 SQLite 与 PostgreSQL 行为一致 */
export function newId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// 标量转换
// ---------------------------------------------------------------------------

export function asString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

export function asNullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

/** 对应类型里的可选属性（`email?: string`）—— 数据库的 NULL 映射为 undefined */
export function asOptionalString(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : String(value);
}

export function asNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}

export function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : Number(value);
}

/** 对应类型里的可选数字属性（`page?: number`） */
export function asOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  return typeof value === "number" ? value : Number(value);
}

/** SQLite 无布尔类型，统一用 0/1 存储 */
export function asBool(value: unknown): boolean {
  return value === 1 || value === 1n || value === true || value === "1";
}

export function fromBool(value: boolean): number {
  return value ? 1 : 0;
}

// ---------------------------------------------------------------------------
// JSON 列
// ---------------------------------------------------------------------------

/**
 * 解析 JSON 列。
 *
 * 解析失败时返回 fallback 而不是抛错：JSON 列的内容由本层写入，
 * 出现损坏说明历史数据有问题，但让读取方整体崩掉并不能修复它。
 * 调用方若需要严格校验，应在此之上自行断言。
 */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toJson(value: unknown): string {
  return JSON.stringify(value === undefined ? null : value);
}

// ---------------------------------------------------------------------------
// 部分更新的 SET 子句
// ---------------------------------------------------------------------------

/** 某个字段的自定义编码（JSON 列、布尔列等） */
export type ColumnEncoder = (value: unknown) => SqlValue;

export interface UpdateSpec {
  /**
   * 允许被更新的字段：TS 字段名 → 数据库列名。
   *
   * 这张表同时充当白名单。SQL 的列名无法用占位符参数化，只能拼进语句里，
   * 因此必须靠白名单挡注入 —— 凡是不在此表内的字段一律忽略，绝不拼接。
   */
  columns: Record<string, string>;
  /** 需要特殊编码的字段；未列出的字段按原值直接绑定 */
  encode?: Record<string, ColumnEncoder>;
}

export interface UpdateSet {
  /** 形如 `["nickname = ?", "email = ?"]` 的赋值片段 */
  assignments: string[];
  /** 与 assignments 顺序一致的绑定值 */
  values: SqlValue[];
}

/**
 * 依据 Partial<T> 构造 SET 子句片段。
 *
 * 值为 undefined 的字段视为「未提供」并跳过；值为 null 则视为「显式置空」并写入。
 * 调用方负责补上 `updated_at = ?` 与 WHERE 条件。
 */
export function buildUpdateSet(
  spec: UpdateSpec,
  data: Record<string, unknown>,
): UpdateSet {
  const assignments: string[] = [];
  const values: SqlValue[] = [];

  for (const [field, column] of Object.entries(spec.columns)) {
    if (!(field in data)) continue;
    const raw = data[field];
    if (raw === undefined) continue;

    const encode = spec.encode?.[field];
    values.push(encode ? encode(raw) : (raw as SqlValue));
    assignments.push(`${column} = ?`);
  }

  return { assignments, values };
}
