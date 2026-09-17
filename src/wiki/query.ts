/**
 * `query`：基于 Wiki 回答问题
 *
 * 对应 wiki-schema.md「六、LLM Wiki 操作接口」里的 `query`。
 *
 * **实现策略（推断）**：这是纯文件系统实现，没有向量库、没有 embedding 调用。
 * 打分用「中文 2-gram + 英文单词」的字符匹配，按字段加权排序。理由：
 *
 * - 文档只要求「实现 RAG 架构、检索策略合理」，没有强制向量检索；RAG 与向量库
 *   的排期按决策 14 推到 Phase 7（CloudBase PostgreSQL + pgvector）。
 * - 当前 wiki 只有几十个页面，全量扫描的代价可以忽略；引入向量库只会先引入
 *   一个必须运维的依赖。
 * - 打分规则全部可解释、可复现，适合教学场景 —— 学生能看懂「为什么这一页排第一」。
 *
 * 接口刻意保持与未来向量实现一致（`hits` + `score`），届时只换本文件内部实现。
 */

import { WikiError, WikiPageNotFoundError } from "./errors";
import {
  RELATION_FIELDS,
  buildRefIndex,
  collectRelationRefs,
  extractWikiLinks,
  listPages,
  resolveRef,
} from "./page";
import type { WikiHit, WikiPage, WikiQueryResult } from "./types";

export const DEFAULT_TOP_K = 5;

/** 各字段的权重：越接近「页面的身份」，命中越说明相关。 */
const FIELD_WEIGHT = {
  identity: 8,
  tags: 5,
  heading: 3,
  body: 1,
} as const;

/** 单个词在同一字段里最多计几次 —— 防止一页靠堆词压过真正相关的页。 */
const MAX_HITS_PER_FIELD = 5;
const EXCERPT_WINDOW_LINES = 3;
const PHRASE_BONUS = 20;

export interface WikiQueryOptions {
  /** 把检索范围限定到该页面及其直接邻居（出链 + 入链） */
  related?: string;
  /** 返回条数上限，默认 5 */
  topK?: number;
}

export async function query(
  question: string,
  options: WikiQueryOptions = {},
): Promise<WikiQueryResult> {
  const topK = options.topK ?? DEFAULT_TOP_K;
  if (!Number.isInteger(topK) || topK <= 0) {
    throw new WikiError(`topK 必须是正整数，收到：${String(options.topK)}`);
  }

  const pages = await listPages();
  const refIndex = buildRefIndex(pages);
  const scope = options.related
    ? buildScope(options.related, pages, refIndex)
    : null;
  const candidates = scope
    ? pages.filter((page) => scope.has(page.path))
    : pages;

  const tokens = tokenize(question);
  const scored = candidates
    .map((page) => ({ page, score: scorePage(page, tokens, question) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);

  return {
    question,
    scope: scope ? [...scope].sort() : null,
    scanned: candidates.length,
    hits: scored.map(({ page, score }) => toHit(page, score, tokens)),
  };
}

/**
 * 分词：英文/数字按单词切，中文按 2-gram 切。
 *
 * 不做中文分词是刻意选择 —— 分词词典既引入依赖又引入歧义，而 2-gram 对
 * 「工具调用」「检索增强」这类术语的召回已经足够，且完全可解释。
 */
export function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const tokens = new Set<string>();

  for (const match of lower.matchAll(/[a-z0-9_]+/g)) {
    tokens.add(match[0]);
  }
  for (const match of lower.matchAll(/[\u4e00-\u9fff]+/g)) {
    const run = match[0];
    if (run.length === 1) tokens.add(run);
    for (let index = 0; index + 1 < run.length; index += 1) {
      tokens.add(run.slice(index, index + 2));
    }
  }

  return [...tokens];
}

function countOccurrences(text: string, token: string): number {
  if (token.length === 0) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const at = text.indexOf(token, from);
    if (at === -1) return count;
    count += 1;
    from = at + token.length;
  }
}

function headingText(body: string): string {
  return body
    .split("\n")
    .filter((line) => /^#{1,6}\s/.test(line))
    .join("\n")
    .toLowerCase();
}

function identityText(page: WikiPage): string {
  const id = typeof page.frontmatter.id === "string" ? page.frontmatter.id : "";
  const name =
    typeof page.frontmatter.name === "string" ? page.frontmatter.name : "";
  return `${id} ${name}`.toLowerCase();
}

function tagText(page: WikiPage): string {
  const parts: string[] = [];
  for (const field of ["tags", ...RELATION_FIELDS]) {
    const value = page.frontmatter[field];
    if (Array.isArray(value)) parts.push(...value);
  }
  return parts.join(" ").toLowerCase();
}

function scorePage(page: WikiPage, tokens: string[], question: string): number {
  const identity = identityText(page);
  const tags = tagText(page);
  const headings = headingText(page.body);
  const body = page.body.toLowerCase();

  let score = 0;
  for (const token of tokens) {
    score += capped(countOccurrences(identity, token), FIELD_WEIGHT.identity);
    score += capped(countOccurrences(tags, token), FIELD_WEIGHT.tags);
    score += capped(countOccurrences(headings, token), FIELD_WEIGHT.heading);
    score += capped(countOccurrences(body, token), FIELD_WEIGHT.body);
  }

  // 整句命中：问句本身就是页面里的一句话时，明显强于零散命中
  const phrase = question.trim().toLowerCase();
  if (
    phrase.length > 0 &&
    (identity.includes(phrase) || body.includes(phrase))
  ) {
    score += PHRASE_BONUS;
  }

  return score;
}

function capped(count: number, weight: number): number {
  return Math.min(count, MAX_HITS_PER_FIELD) * weight;
}

/** 取正文中得分最高的一段连续行作为摘录。 */
function pickExcerpt(
  body: string,
  tokens: string[],
): { excerpt: string; line: number } {
  const lines = body.split("\n");
  const lineScores = lines.map((line) => {
    const lower = line.toLowerCase();
    let sum = 0;
    for (const token of tokens)
      sum += Math.min(countOccurrences(lower, token), 3);
    return sum;
  });

  let bestStart = 0;
  let bestScore = -1;
  for (let start = 0; start < lines.length; start += 1) {
    let sum = 0;
    for (
      let offset = 0;
      offset < EXCERPT_WINDOW_LINES && start + offset < lines.length;
      offset += 1
    ) {
      sum += lineScores[start + offset];
    }
    if (sum > bestScore) {
      bestScore = sum;
      bestStart = start;
    }
  }

  let from = bestStart;
  let to = Math.min(lines.length, bestStart + EXCERPT_WINDOW_LINES);
  while (from < to && lines[from].trim() === "") from += 1;
  while (to > from && lines[to - 1].trim() === "") to -= 1;

  return { excerpt: lines.slice(from, to).join("\n"), line: from + 1 };
}

function toHit(page: WikiPage, score: number, tokens: string[]): WikiHit {
  const { excerpt, line } = pickExcerpt(page.body, tokens);
  return {
    path: page.path,
    id: typeof page.frontmatter.id === "string" ? page.frontmatter.id : null,
    name:
      typeof page.frontmatter.name === "string" ? page.frontmatter.name : null,
    type: page.type,
    score,
    excerpt,
    line,
  };
}

/** `related` 的检索范围：该页 + 它的出链目标 + 指向它的页面（单跳）。 */
function buildScope(
  related: string,
  pages: WikiPage[],
  refIndex: Map<string, string[]>,
): Set<string> {
  const matches = resolveRef(refIndex, related);
  if (matches.length === 0) {
    throw new WikiPageNotFoundError(`related 指定的页面不存在：${related}`);
  }
  if (matches.length > 1) {
    throw new WikiError(
      `related 命中了多个页面，请写得更具体：${matches.join("、")}`,
    );
  }

  const center = matches[0];
  const scope = new Set<string>([center]);
  const neighbours = new Map<string, Set<string>>();

  for (const page of pages) {
    const linked = new Set<string>();
    for (const link of extractWikiLinks(page.body)) {
      for (const target of resolveRef(refIndex, link)) linked.add(target);
    }
    for (const ref of collectRelationRefs(page)) {
      for (const target of resolveRef(refIndex, ref)) linked.add(target);
    }
    neighbours.set(page.path, linked);
  }

  for (const target of neighbours.get(center) ?? []) scope.add(target);
  for (const [path, linked] of neighbours) {
    if (linked.has(center)) scope.add(path);
  }

  return scope;
}
