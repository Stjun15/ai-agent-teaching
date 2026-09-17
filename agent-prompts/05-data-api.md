# E 阶段：数据与接口

## 目标

实现 CloudBase 数据表、API 接口、SSE 协议。

## 15 张数据表

students, student_profiles, mastery, learning_paths, errors,

prompt_history, projects, sessions, messages, citations,

agent_events, validation_results, questions, question_results, agent_traces

## API 路由（18 个）

| 路由 | 方法 | 用途 |

|---|---|---|

| /api/student/profile | GET/PUT | 学生画像 |

| /api/student/mastery | GET | 掌握度 |

| /api/student/learning-path | GET | 学习路径 |

| /api/student/errors | GET | 错题 |

| /api/student/prompts | GET | Prompt 历史 |

| /api/student/projects | GET | 项目 |

| /api/session | POST | 创建会话 |

| /api/session/[id] | GET/DELETE | 会话详情 |

| /api/session/[id]/message | POST | 发送消息（SSE） |

| /api/session/[id]/abort | POST | 中断流式 |

| /api/agent/explain | POST | 讲解 Agent |

| /api/agent/validate | POST | 点评 Agent |

| /api/agent/generate-question | POST | 出题 Agent |

| /api/agent/answer | POST | 答疑 Agent |

| /api/visualization/[sceneId] | GET | 获取可视化场景 |

| /api/project/template/[id] | GET | 项目模板 |

| /api/report | GET | 学习报告 |

| /api/wiki/query | POST | 查询 LLM Wiki |

## 完整数据模型

见 `references/data-models.md`。

## 完整 API 规格

见 `references/api-spec.md`。

## SSE 事件协议

10 种事件类型，见 `references/api-spec.md`。

## 交付物

- `cloudbase/migrations/` 建表 SQL

- `src/app/api/` 所有 Route Handler

- `src/lib/cloudbase.ts` CloudBase 客户端

- `src/lib/sse.ts` SSE 服务端工具

- `src/schemas/` Zod Schema（API 输入输出）

## 验收标准

- 15 张表全部创建，索引正确

- 18 个 API 路由可访问

- SSE 流式返回正常

- 所有输入输出通过 Zod 校验

- API 密钥走环境变量

- 错误处理完备（429/5xx/超时）
