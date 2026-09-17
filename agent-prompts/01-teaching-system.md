# A 阶段：教学系统

## 目标

实现 9 个教学模块的完整内容和流程。

## 9 个模块

| 顺序 | 模块 | 难度 | 训练子能力 | 项目 |

|---|---|---|---|---|

| 1 | llm-api | 1/5 | 意图表达、理解 AI 行为 | 聊天机器人 |

| 2 | system-prompt | 2/5 | 意图表达、上下文管理 | 加人格 |

| 3 | agent-loop | 3/5 | 理解 AI 行为、任务分解 | 单工具 Agent |

| 4 | tool-calling | 3/5 | 意图表达、质量判断 | 多工具 Agent |

| 5 | rag | 4/5 | 上下文管理、质量判断 | 知识问答 Agent |

| 6 | llm-wiki | 4/5 | 上下文管理、迭代调优 | 会学习的 Agent |

| 7 | multi-agent | 5/5 | 任务分解、上下文管理 | 多 Agent 系统 |

| 8 | mcp | 4/5 | 意图表达、质量判断 | 接 MCP 工具 |

| 9 | ai-safety | 4/5 | 质量判断、理解 AI 行为 | 加安全机制 |

## 每个模块的 10 个部分

| 部分 | 内容 |

|---|---|

| 1. 模块元信息 | ID、名称、前置、训练子能力、时长、难度 |

| 2. 概念页面 | 定义、关键点、常见误解、相关概念 |

| 3. 可视化设计 | 动画步骤、交互方式 |

| 4. 教学流程 | 导师展示 → 学生完成 → AI 校验 → 可视化 → 变式 |

| 5. 导师展示代码 | 预设的可运行简单 Agent |

| 6. 学生任务 | 场景描述、需要填写的部分 |

| 7. 校验规则 | 评分维度、扣分规则、通过条件 |

| 8. 掌握度标准 | 0-5 分每个等级的定义 |

| 9. 四个 Agent 行为 | 讲解、点评、出题、答疑各自做什么 |

| 10. LLM Wiki 交互 | 读哪些页面、写哪些页面 |

## 详细规格

见 `references/module-specs.md`。

## 可视化场景（9 个）

| 模块 | 场景 ID | 动画内容 |

|---|---|---|

| llm-api | scene-request-response | 请求-响应流程 |

| system-prompt | scene-role-filter | 角色滤镜对比 |

| agent-loop | scene-loop-weather | Agent Loop 天气查询 |

| tool-calling | scene-tool-chain | 工具调用链 |

| rag | scene-retrieve-generate | 检索-生成流程 |

| llm-wiki | scene-rag-vs-wiki | RAG vs Wiki 对比 |

| multi-agent | scene-orchestration | 多 Agent 通信 |

| mcp | scene-mcp-flow | MCP 调用流程 |

| ai-safety | scene-attack-defense | 攻击-防护对比 |

## 预设工具（5 个，按教学顺序）

1. 计算器（calculator）

2. 天气查询（getWeather）

3. 文件读写（readFile/writeFile）

4. 网络搜索（webSearch）

5. 数据库查询（queryDB）

## 交付物

- `llm-wiki/concepts/*.md`：9 个概念页面

- `llm-wiki/projects/*/`：9 个项目模板（TS + Python）

- `docs/module-specs/`：9 个模块详细规格

- 可视化场景定义文件

## 验收标准

- 9 个概念页面完整，交叉引用正确

- 9 个项目模板可运行

- 每个模块有完整的 10 个部分

- 掌握度标准清晰可判定

## 执行顺序

按模块 1→9 顺序实现，每个模块完成后测试再进入下一个。
