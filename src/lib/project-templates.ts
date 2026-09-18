/**
 * 项目模板注册表 —— **从 LLM Wiki 的 `projects/` 页现读，不在这里抄一份**
 *
 * 与 `src/lib/modules.ts` 同源的逻辑：模板的 id / 名称 / 难度 / 关联模块 /
 * 标签 / 正文，权威来源是 `llm-wiki/projects/*.md` 的 frontmatter 与正文，由
 * `SCHEMA.md` 约束页面类型。在代码里再写一份模板清单会立刻产生第二份数据，
 * 漂移只是时间问题。
 *
 * 为什么用 wiki 页而不是新建数据库表
 * -----------------------------------
 * 路由 stub 早期把模板当成 `project_templates` 数据表（见 `data-models.md` 的
 * `projects.project_template_id` 外键），但那张表从未建立、也没有 repository。
 * 项目模板本质是「知识层内容」，与 `concepts/` 现读同源最干净：不引入无主的表、
 * 不伪造数据，改 wiki 页即生效，还能被 `maintain` 的死链/缺失校验覆盖。
 *
 * ⚠️ 本模块读文件系统，**只能在服务端使用**（Route Handler）。与 `modules.ts`
 * 同一处约束：让误用立刻在构建期暴露，而不是留到运行期白屏。
 */

import { listPages } from "@/wiki";

/** 正文里承载「一句话概述」的小节标题（见 `wiki-schema.md` 项目模板页模板）。 */
const SUMMARY_HEADING = "## 概述";

export interface ProjectTemplate {
  /** frontmatter 的 `id`，同时是路由参数（`/api/project/template/[id]`）。 */
  id: string;
  /** frontmatter 的 `name`，例如「聊天机器人」。 */
  name: string;
  /** 1~5，取自 frontmatter。 */
  difficulty: number;
  /** 例如 `45min`，取自 frontmatter。 */
  estimatedTime: string;
  /** 关联的教学模块 id（与 `concepts/` 的 frontmatter.id 对齐）。 */
  moduleId: string | null;
  tags: string[];
  /** 正文「## 概述」的首段，用作卡片的一句话说明。 */
  summary: string;
  /** 模板正文（起步 Prompt / 检查清单 / 验收要点），供实践步骤直接渲染。 */
  body: string;
  /** 关联模块的学习页路径。 */
  href: string;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * 取出正文「## 概述」下的首段。
 *
 * 与 `modules.ts` 的 `extractDefinition` 同形：按行读到第一个空行为止，行间
 * 不加空格拼接（模板概述常是中文折行）。找不到小节时返回空串而不是抛错——
 * 卡片少一行说明不影响可用性，缺小节的页面该由 `maintain` 报出来。
 */
function extractSummary(body: string): string {
  const lines = body.split(/\r?\n/);
  const headingIndex = lines.findIndex(
    (line) => line.trim() === SUMMARY_HEADING,
  );
  if (headingIndex === -1) return "";

  const paragraph: string[] = [];
  for (const line of lines.slice(headingIndex + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) break;
    if (trimmed === "") {
      if (paragraph.length > 0) break;
      continue;
    }
    paragraph.push(trimmed);
  }
  return paragraph.join("");
}

/** 读取全部项目模板页并组装成列表（按 id 字典序，结果可复验）。 */
export async function loadProjectTemplates(): Promise<ProjectTemplate[]> {
  const pages = await listPages();

  return pages
    .filter((page) => page.type === "project")
    .map((page) => {
      const stem = page.path.replace(/^.*\//, "").replace(/\.md$/, "");
      const id = asString(page.frontmatter.id) || stem;
      const moduleId = asString(page.frontmatter.module_id) || null;
      return {
        id,
        name: asString(page.frontmatter.name, id),
        difficulty: Number(page.frontmatter.difficulty ?? 0),
        estimatedTime: asString(page.frontmatter.estimated_time),
        moduleId,
        tags: asStringArray(page.frontmatter.tags),
        summary: extractSummary(page.body),
        body: page.body,
        href: moduleId ? `/learn/${moduleId}` : `/api/project/template/${id}`,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

/** 按 id 取单个模板；不存在时返回 undefined（由调用方决定 404 还是兜底）。 */
export async function findProjectTemplate(
  id: string,
): Promise<ProjectTemplate | undefined> {
  const templates = await loadProjectTemplates();
  return templates.find((template) => template.id === id);
}
