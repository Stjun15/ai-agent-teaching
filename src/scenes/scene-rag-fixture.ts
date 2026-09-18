/**
 * 检索-生成场景的样本数据与拼装逻辑
 *
 * 为什么单独成文件
 * ------------
 * 它有两个理由同时成立：
 *   1. **纯逻辑**：场景里唯一「算出结果」的部分就是这里 —— 检索取前 topK 条、
 *      由检索结果拼出回答、再由检索结果拼出要发给模型的新 Prompt。放进 `.ts`
 *      才能被回归测试直接 import（测试用 `node --experimental-strip-types`，
 *      不编译 JSX），否则这几条只能靠肉眼看动画。
 *   2. **场景文件只留视觉**：`scene-retrieve-generate.tsx` 本来要塞下样本、拼装
 *      与七八块 JSX，一个文件里三种东西；拆开后那边只剩「怎么画」。
 *
 * 回答是拼出来的，不是写死的
 * ----------------------
 * `buildAnswer` 只把**检索到的**高相关片段的要点接起来。所以只给 1 条资料时，
 * 回答里就只有那一个要点，另两个压根不出现 —— 这正是模块 5 要讲的「知识边界」：
 * AI 只会基于检索到的内容说。若这里写死一段完整回答，拖 topK 就只是「片段变多
 * 变少、回答照旧」，反而教错了。
 */

/** 知识库里的一条片段。 */
export interface RagChunk {
  id: string;
  /** 是否与本次提问高相关。低相关片段用来演示 topK 调过大的代价。 */
  relevant: boolean;
  /** 片段原文。 */
  text: string;
  /** 这条片段能支撑回答里的哪一句；低相关片段为空串。 */
  claim: string;
}

/**
 * 样本片段（按相关度排序，顺序即检索结果顺序）。
 *
 * 三条高相关各含一个要点，且都能在最终回答里找到对应的一句 —— 学生拖 topK 时是
 * 按**要点数**看到回答变短变长的，而不是看到一段文字被截断。
 */
export const RAG_CHUNKS: readonly RagChunk[] = [
  {
    id: "deadline",
    relevant: true,
    text: "作业须在 2026-09-30 23:59 前提交到教学平台。",
    claim: "提交截止日期是 2026 年 9 月 30 日 23:59",
  },
  {
    id: "late",
    relevant: true,
    text: "逾期提交每天扣 10%，最多扣到 60%。",
    claim: "逾期提交每天扣 10%",
  },
  {
    id: "entry",
    relevant: true,
    text: "提交入口在课程页右上角的「作业」标签下。",
    claim: "入口在课程页右上角的「作业」标签下",
  },
  {
    id: "office-hour",
    relevant: false,
    text: "课程答疑每周三晚 19:00 在直播间进行。",
    claim: "",
  },
  {
    id: "env",
    relevant: false,
    text: "上机实验需要提前装好 Python 3.13。",
    claim: "",
  },
];

/** 高相关片段总数 —— 用于判断「回答是不是缺了要点」。 */
export const RELEVANT_COUNT = RAG_CHUNKS.filter(
  (chunk) => chunk.relevant,
).length;

/** 向量检索：取前 `topK` 条（样本已按相关度排序）。 */
export function retrieve(topK: number): RagChunk[] {
  return RAG_CHUNKS.slice(0, Math.max(0, topK));
}

/**
 * 由检索结果拼出回答。
 *
 * 一条高相关片段都没检索到时**不编**：如实说「我不确定」。这类句子最容易被
 * 当成废话跳过，但它正是「知识边界」这个概念的落点。
 */
export function buildAnswer(retrieved: readonly RagChunk[]): string {
  const claims = retrieved
    .filter((chunk) => chunk.relevant)
    .map((chunk) => chunk.claim);
  if (claims.length === 0) {
    return "没检索到相关资料，这一问只能回答「我不确定」。";
  }
  return `作业${claims.join("；")}。`;
}

/** 把检索到的片段与原问题拼成要发给模型的新 Prompt。 */
export function buildPrompt(
  retrieved: readonly RagChunk[],
  question: string,
): string {
  return [
    "[system] 只根据下面的资料回答，并在句末标注引用编号。",
    ...retrieved.map((chunk, index) => `[资料 ${index + 1}] ${chunk.text}`),
    `[问题] ${question}`,
  ].join("\n");
}
