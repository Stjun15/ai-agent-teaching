/**
 * 可视化场景 ID 的权威定义
 *
 * 为什么单独放一个文件
 * -------------------
 * 同一张「模块 → 场景 ID」映射表**现存三份**，任何一处改了另外两处不会知道：
 *   1. `01-teaching-system.md`「可视化场景（9 个）」—— 设计源头；
 *   2. `agent-prompts-lib.md`「trigger-visualization」—— 模型点播场景时读的提示词；
 *   3. `src/lib/modules.ts` 的 `MODULE_SCENE_IDS` —— 前端真正渲染场景时查的表。
 *
 * 漂移的后果很具体：模型输出一个前端不认识的 `scene_id`，界面就是一块空白，
 * 而且**没有任何报错** —— 提示词里写错了，运行时才发现不了。
 *
 * 所以这里把 9 个场景 ID 定为唯一权威联合 `SceneId`，并让前端的
 * `MODULE_SCENE_IDS` 用 `satisfies Record<string, SceneId>` 受它约束：
 * 提示词表与前端表只要有一处对不上，tsc 就报错。
 *
 * 为什么是 `satisfies` 而不是类型标注
 * --------------------------------
 * `MODULE_SCENE_IDS` 的键是**模块 id**（来自 wiki frontmatter，运行时才知道），
 * 不能写成字面量联合；用 `Record<string, SceneId>` 标注会把值 widen 成
 * `SceneId`（这没问题，值本来就该是联合），而 `satisfies` 还能同时保留
 * 「键是具体字面量」这点，将来若改成枚举键也不会丢精度。
 */

/** 9 个可视化场景的 ID，顺序与 `01-teaching-system.md` 的表格一致。 */
export const SCENE_IDS = [
  "scene-request-response",
  "scene-role-filter",
  "scene-loop-weather",
  "scene-tool-chain",
  "scene-retrieve-generate",
  "scene-rag-vs-wiki",
  "scene-orchestration",
  "scene-mcp-flow",
  "scene-attack-defense",
] as const;

/** 单个场景 ID。 */
export type SceneId = (typeof SCENE_IDS)[number];

/** 场景 ID → 中文动画内容，与 `01-teaching-system.md` 表格逐条对应。 */
export const SCENE_LABELS: Record<SceneId, string> = {
  "scene-request-response": "请求-响应流程",
  "scene-role-filter": "角色滤镜对比",
  "scene-loop-weather": "Agent Loop 天气查询",
  "scene-tool-chain": "工具调用链",
  "scene-retrieve-generate": "检索-生成流程",
  "scene-rag-vs-wiki": "RAG vs Wiki 对比",
  "scene-orchestration": "多 Agent 通信",
  "scene-mcp-flow": "MCP 调用流程",
  "scene-attack-defense": "攻击-防护对比",
};

/**
 * 类型守卫：把任意字符串收窄成 `SceneId`。
 *
 * 模型的输出是 `string`，必须过这一道才能用 `SceneId` 类型的字段承载 ——
 * 这是「模型输出不可信」这条原则在类型层面的体现。
 */
export function isSceneId(value: string): value is SceneId {
  return (SCENE_IDS as readonly string[]).includes(value);
}
