/**
 * 场景目录 —— 9 个可视化场景的步骤定义（**纯数据**，不含 JSX）
 *
 * 为什么不写成 `Record<SceneId, SceneDefinition>`
 * -------------------------------------------
 * 那样从第一个场景开始就要求 9 个齐全，而场景是一个一个交付的。这里用
 * `satisfies Partial<Record<SceneId, SceneContent>>`：键必须是合法场景 id
 * （键名拼错立即编译报错），但允许**先缺着**，缺的那个在界面上显示
 * 「场景待交付」而不是给一个能点却没反应的播放按钮。
 *
 * 为什么用 `satisfies` 而不是 `:` 类型标注
 * --------------------------------------
 * `satisfies` 会保留字面量键的联合类型。`scene-stage.tsx` 里的组件映射正是
 * 用它约束的：`keyof typeof SCENE_CATALOG` 只包含**已注册**的场景，
 * 于是「目录里加了场景却忘了写组件」会直接编译失败，不必靠人记。
 * 换成 `:` 标注会把键 widen 成 `SceneId`，这道检查就没了。
 *
 * 为什么还要一份 `LOOKUP`
 * ---------------------
 * 上面那个「保留字面量键」的代价，是这个常量的类型就是它自己的字面量类型 ——
 * 目录为空时它是 `{}`，用任意场景 id 去索引都会报「不能用该键索引 `{}`」。
 * 写入侧要的是窄类型（编译期查错），读取侧要的是宽类型（运行时查表），
 * 两者需求相反，所以显式并存：`SCENE_CATALOG` 给写入与 `keyof` 用，
 * `LOOKUP` 给查表用。
 *
 * 顺序由 `SCENE_IDS` 决定，不由本文件的书写顺序决定
 * ---------------------------------------------
 * `listSceneDefinitions()` 按 `SCENE_IDS` 过滤，所以界面上的场景顺序与
 * `01-teaching-system.md` 的表格一致。在这里调整条目位置不会改到界面顺序，
 * 也就不会出现「看着像排好了、其实界面上是另一个顺序」。
 */

import { SCENE_IDS, SCENE_LABELS, isSceneId } from "@/lib/agent/scene-ids";
import type { SceneId } from "@/lib/agent/scene-ids";
import type { SceneContent, SceneDefinition } from "./scene-types";

/** 写入侧视图：键必须是合法场景 id，值必须结构完整。 */
export const SCENE_CATALOG = {
  "scene-request-response": {
    steps: [
      {
        id: "typed",
        title: "用户输入框打字",
        description:
          "学生在输入框里敲下一句话 —— 它稍后会变成消息数组里的一条。",
        durationMs: 1600,
      },
      {
        id: "messages-in",
        title: "system 从上、user 从下飞入",
        description:
          "两张卡片是数组里的两个位置，不是两种说话方式：一个定角色，一个提问题。",
        durationMs: 1500,
      },
      {
        id: "messages-array",
        title: "收进消息数组",
        description:
          "两段文本被一对中括号括起来，成为这次请求要带上的全部上下文。",
        durationMs: 1400,
      },
      {
        id: "to-cloud",
        title: "数据包飞向云端",
        description: "整份数组一次性发出去；模型在云端算完，再把结果送回来。",
        durationMs: 1300,
      },
      {
        id: "tokens",
        title: "Token 计数器滚动",
        description:
          "输入 12 个 token、输出 45 个 —— 这一次调用花的账，按这两个数算。",
        durationMs: 1500,
      },
      {
        id: "reply",
        title: "打字机显示回复",
        description:
          "开了 stream 字是一个一个回来的；关掉就要等整段生成完才看到 —— 这正是两者的差别。",
        durationMs: 2600,
      },
    ],
    defaultParams: {
      system: "你是一个友好的编程学习助手。",
      stream: true,
    },
  },
  "scene-role-filter": {
    steps: [
      {
        id: "left-only",
        title: "左边：无 System Prompt",
        description:
          "同一个问题，模型按最常见的方式回答 —— 直接把答案说了出来。",
        durationMs: 1500,
      },
      {
        id: "right-only",
        title: "右边：有 System Prompt",
        description:
          "换成苏格拉底式提问：先反问你觉得哪里有问题，再顺着给提示。",
        durationMs: 1500,
      },
      {
        id: "filter-in",
        title: "中间出现「滤镜」",
        description:
          "两栏之间多出一个滤镜 —— 它就是那段 system 消息的形象说法。",
        durationMs: 1200,
      },
      {
        id: "filter-applied",
        title: "滤镜滑过去",
        description:
          "滤镜滑到左边，左边那一栏也被过滤了一遍 —— 变的不是模型，是它看问题的方式。",
        durationMs: 1600,
      },
      {
        id: "highlight",
        title: "高亮 System Prompt",
        description:
          "滤镜的本体就是那几行字。换掉它，右边那栏的回答方式就跟着换掉。",
        durationMs: 1800,
      },
    ],
    defaultParams: {
      system:
        '你是一个代码评审员。\n规则：\n1. 不直接给完整答案\n2. 先问学生"你觉得哪里可能有问题"\n3. 给分级提示：方向 → 具体 → 伪代码\n4. 语气鼓励，不打击信心',
      filterOn: true,
    },
  },
  "scene-loop-weather": {
    steps: [
      {
        id: "ask",
        title: "用户提问",
        description: "「北京今天天气怎么样？」—— 模型手里此刻只有这一句话。",
        durationMs: 1400,
      },
      {
        id: "loop1-think",
        title: "Loop 1：先决定要调工具",
        description: "第一轮的产出不是回答，而是一个决定：我需要 getWeather。",
        durationMs: 1700,
      },
      {
        id: "loop1-call",
        title: "Loop 1：发起工具调用",
        description: "按工具声明的参数传进去：city 是「北京」。",
        durationMs: 1500,
      },
      {
        id: "loop1-result",
        title: "Loop 1：拿到工具返回",
        description:
          "温度 25、天气晴 —— 这条数据是回答的唯一依据，模型自己并不知道天气。",
        durationMs: 1600,
      },
      {
        id: "loop2-think",
        title: "Loop 2：手里多了数据",
        description:
          "同一个循环转第二圈，模型这次能给出回答了 —— 这就是为什么要多轮。",
        durationMs: 1700,
      },
      {
        id: "answer",
        title: "Loop 2：打字机输出",
        description: "把工具返回的数据整理成人话，温度用的是返回里的那个数。",
        durationMs: 2400,
      },
    ],
    defaultParams: {
      city: "北京",
    },
  },
  "scene-tool-chain": {
    steps: [
      {
        id: "toolbox",
        title: "工具箱展开",
        description:
          "两个工具各带名称、描述、参数 —— 这份定义就是模型看到的全部内容。",
        durationMs: 1500,
      },
      {
        id: "ask",
        title: "用户提出需要两步的任务",
        description:
          "「查北京天气，再算华氏度」—— 一次请求里要连着用两个工具。",
        durationMs: 1500,
      },
      {
        id: "call-weather",
        title: "Agent 选用 getWeather",
        description:
          "选它的依据是描述，不是名称 —— 描述为空时 Agent 判断不了什么时候该用它。",
        durationMs: 1600,
      },
      {
        id: "weather-back",
        title: "getWeather 返回 25°C",
        description: "第一环拿到数据，但它还不是答案：任务还要求换算。",
        durationMs: 1500,
      },
      {
        id: "call-calc",
        title: "Agent 选用 calculate",
        description: "把刚拿到的 25 代进换算式 25 * 9 / 5 + 32。",
        durationMs: 1600,
      },
      {
        id: "calc-back",
        title: "calculate 返回 77°F",
        description: "第二环返回结果 —— 两个工具的输出接起来才是完整答案。",
        durationMs: 1500,
      },
      {
        id: "chain-lit",
        title: "调用链依次亮起",
        description:
          "两环连起来就是「工具链」：Agent 自己决定先调哪个、再把结果传给下一个。",
        durationMs: 2000,
      },
    ],
    defaultParams: {
      weatherDescription: "查询指定城市的天气",
      selectedTool: "getWeather",
    },
  },
  "scene-retrieve-generate": {
    steps: [
      {
        id: "ask",
        title: "用户提问",
        description:
          "「作业提交截止日期是什么？」—— 这个问题课程资料里有答案。",
        durationMs: 1500,
      },
      {
        id: "vectorize",
        title: "问题变成向量",
        description:
          "检索比对的是数字而不是字面，所以同一句话换个说法也找得到。",
        durationMs: 1700,
      },
      {
        id: "to-index",
        title: "向量飞向知识库",
        description: "拿这段向量去知识库里比相似度，取最接近的几条。",
        durationMs: 1400,
      },
      {
        id: "chunks",
        title: "片段依次亮起",
        description:
          "取几条由 topK 决定：太少会缺要点，太多会把低相关的噪声一起拖进来。",
        durationMs: 2000,
      },
      {
        id: "assemble",
        title: "拼成新的 Prompt",
        description:
          "发给模型的不是原问题，而是「资料 + 问题」拼成的一个新请求。",
        durationMs: 1900,
      },
      {
        id: "answer",
        title: "生成回答并标注引用",
        description:
          "回答里的每一句都要能点回原文 —— 这正是 RAG 与「直接问模型」的差别。",
        durationMs: 2400,
      },
    ],
    defaultParams: {
      topK: 3,
      focused: "",
    },
  },
  "scene-rag-vs-wiki": {
    steps: [
      {
        id: "rag-side",
        title: "左边：传统 RAG",
        description: "解释器模式 —— 每次查询都从零检索一遍全部资料，查完即弃。",
        durationMs: 1800,
      },
      {
        id: "wiki-side",
        title: "右边：LLM Wiki",
        description:
          "编译器模式 —— 资料先编译进 Wiki，树随资料增多长出节点，之后直接读。",
        durationMs: 2000,
      },
      {
        id: "contrast",
        title: "两栏对比",
        description:
          "模式、每次查询、积累、成本四行逐条对照：差别不在快慢，在「有没有积累」。",
        durationMs: 2200,
      },
      {
        id: "compound",
        title: "复利效应",
        description:
          "左边每次查询要读的量随资料线性增长，右边恒定 —— 第 100 份资料的价值建立在前面 99 份的结构上。",
        durationMs: 2400,
      },
    ],
    defaultParams: {
      documents: 20,
      view: "both",
      node: "llm-wiki",
    },
  },
  "scene-orchestration": {
    steps: [
      {
        id: "user-request",
        title: "用户只说了一句话",
        description:
          "「帮我写一个天气 Agent 项目」—— 整个协作只有这一个输入，后面全靠 Agent 之间传递。",
        durationMs: 1700,
      },
      {
        id: "orchestrator",
        title: "编排器出现，任务分裂成三份",
        description:
          "编排器自己不写代码，它决定谁做、按什么顺序做、什么时候停 —— 这是多 Agent 与「一个 Agent 干三件事」的分界。",
        durationMs: 1900,
      },
      {
        id: "team",
        title: "三个 Agent 各就各位",
        description:
          "需求、代码、评审三张卡长得一样，区别全在 System Prompt 里：点开看它们各自的边界。",
        durationMs: 2100,
      },
      {
        id: "to-coder",
        title: "需求 Agent 的输出交给代码 Agent",
        description:
          "上一棒的输出就是下一棒的输入，中间不经过人 —— 信息怎么传是多 Agent 要回答的第二个问题。",
        durationMs: 2000,
      },
      {
        id: "to-reviewer",
        title: "代码 Agent 的输出交给评审 Agent",
        description:
          "评审拿到的是代码本身，不是「代码写好了」这句话 —— 传的是产物，不是结论。",
        durationMs: 1900,
      },
      {
        id: "verdict",
        title: "评审给结论：通过，或打回重做",
        description:
          "打回时箭头掉头走回去：这是个循环。只说「不合格就退回」、不说「怎样算合格」，它就不会停。",
        durationMs: 2300,
      },
    ],
    defaultParams: {
      focused: "requirement",
      passed: true,
    },
  },
} satisfies Partial<Record<SceneId, SceneContent>>;

/** 读取侧视图：查表用，允许任意键查空。 */
const LOOKUP: Partial<Record<SceneId, SceneContent>> = SCENE_CATALOG;

/**
 * 按 id 取场景定义；id 不是合法场景、或该场景尚未交付时返回 `undefined`。
 *
 * 返回 `undefined` 而不是抛错：调用方（播放器）要把「这个场景还没有」显示成
 * 一句诚实的话。抛错会把「某个场景没写完」升级成「整个模块页打不开」，
 * 代价完全不对等。
 */
export function getSceneDefinition(
  id: string | null,
): SceneDefinition | undefined {
  if (id === null || !isSceneId(id)) return undefined;
  const content = LOOKUP[id];
  if (content === undefined) return undefined;
  return { id, title: SCENE_LABELS[id], ...content };
}

/** 已交付的场景定义，按 `SCENE_IDS` 的权威顺序。 */
export function listSceneDefinitions(): SceneDefinition[] {
  return SCENE_IDS.map((id) => getSceneDefinition(id)).filter(
    (definition): definition is SceneDefinition => definition !== undefined,
  );
}
