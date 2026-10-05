/**
 * 模块定制的点评 rubric 追加段
 *
 * 为什么在 skills 层、为什么是「追加」而不是新 Skill
 * ------------------------------------------------
 * 复刻模块（platform-replica）的点评对象是最终交付（agent-loop.ts 全文 +
 * route.ts 一句话说明），评价标准应该是概念页「动手任务：最终验收」的七条
 * 清单，而不是 validate-code 的通用四维 —— 通用四维评不出「这台车能不能跑」。
 *
 * 但运行时对 Skill 有编译期注册表（`./index.ts` 的 `satisfies`）与运行期
 * `allowedSkills` 白名单双重收敛（铁律 3）：新造一个 `validate-code-replica`
 * 之类的 id，两处都要动，还会在 7 个 Skill 的设计文档之外多出一份口径。
 * 所以采用**追加段**：skill id 不变、白名单不动，评分指令作为
 * `skillSupplement` 拼在 Skill 内容尾部（拼接点在 `../runtime.ts`）。
 *
 * 清单正文不在这里：wiki 是唯一事实源（铁律「文档即课程」），题面由
 * `/api/agent/validate` 路由从概念页「动手任务」节现读（`readPracticeTask`），
 * 经 question_text 交给点评 Agent。本段只写「怎么按清单评」，不复制清单内容
 * —— 否则清单就有了第三份拷贝，必然漂移。
 */

/** 拥有定制点评 rubric 的模块。目前只有复刻模块（最终验收）。 */
export const REPLICA_ACCEPTANCE_MODULE = "platform-replica";

const REPLICA_RUBRIC_SUPPLEMENT = `## 模块定制：教学平台复刻（最终交付检验单）

module_id 为 platform-replica 时，这次点评是复刻模块的**最终验收**，题面是
question_text 里的「动手任务：最终验收」（七条验收清单与交付要求），不是普通的
核心代码校验。评分方式改为：

1. 维度跟着验收清单走：从提交文本里能找到证据的清单条目，各设一个维度（维度名用
   清单条目的短语），权重自行分配但合计必须为 1；另设「代码质量」一个维度，按通用
   四维（参数使用/返回值/边界处理/可读性）综合评价交付文本本身。
2. 提交文本里找不到证据的清单条目：**不得给分、不得扣分、不设维度**，在 suggestions
   里写明「清单第 N 条需要在你自己的运行环境里验证，并与导师在对话中核对」。宁可
   少一个维度，不可编一个分数。
3. route.ts 的一句话说明可以当线索引用，但「说明了」不等于「验证了」，不能据此给
   运行期才能验证的条目打分。
4. 严重错误的判定标准不变（参数缺失、逻辑错误、安全漏洞必须拦下）。
5. 若 question_text 里没有验收清单（异常情况），按通用四维评分，并在 progress_note
   里注明「本次未取得验收清单，按通用标准评分」。`;

/**
 * 按模块取点评 rubric 追加段。
 *
 * 返回 `undefined` 表示该模块没有定制（调用方不传 `skillSupplement`，
 * prompt 与改造前逐字符一致）。纯函数：是否定制、追加段的关键条款，
 * 必须能脱离模型直接断言（见 validate-wiring-spec）。
 */
export function moduleRubricSupplement(moduleId: string): string | undefined {
  if (moduleId !== REPLICA_ACCEPTANCE_MODULE) return undefined;
  return REPLICA_RUBRIC_SUPPLEMENT;
}
