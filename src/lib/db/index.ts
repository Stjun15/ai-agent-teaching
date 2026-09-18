/**
 * 数据访问层出口
 *
 * 上层（API 路由、Agent 运行时、脚本）统一从这里取 repository，不要直接
 * import ./sqlite —— 那是唯一允许出现数据库驱动名的文件，把它挡住，
 * 将来从 SQLite 切到 CloudBase PostgreSQL 时改动范围才可控。
 *
 * 当前覆盖 7 张表（students、student_profiles、mastery、learning_paths、
 * sessions、messages、agent_traces）—— 即 data-models.md「四、数据访问层设计」
 * 明确给出签名的全部模块。其余表（errors、prompt_history、projects、
 * citations、agent_events、questions、question_results、validation_results）
 * 文档未定义访问方法，按同层风格补齐：其中 question_result_db / validation_result_db
 * 已在此处导出（写入路径在 Phase 7 收口时补齐），其余仍在各自所属 Phase 再补，
 * 不在这里提前发明接口。
 */

export type * from "./types";

export { studentDb } from "./students";
export { masteryDb } from "./mastery";
export { learningPathDb } from "./learning-path";
export { sessionDb } from "./sessions";
export { messageDb } from "./messages";
export { traceDb } from "./traces";
// 这三张表（errors / prompt_history / projects）的 repository 文档未定义签名，
// 按同层风格补齐，供 Phase 5 的学生类端点使用。只有读 —— 写入点在编排层。
export { errorDb } from "./errors";
export { promptHistoryDb } from "./prompt-history";
export { projectDb } from "./projects";
export { questionResultDb } from "./question-results";
export { validationResultDb } from "./validation-results";

// 健康检查。与 repository 一样走本出口，让路由不必碰 ./sqlite。
export { checkDatabaseHealth, EXPECTED_BUSINESS_TABLES } from "./health";
export type { DatabaseHealth } from "./health";
