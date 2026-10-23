# Phase 5 平台 · MCP 翻译层规范（v1.0）

> **一句话总结：** Phase 5 平台 · MCP 翻译层规范（v1.0）：完整定义连接器 YAML Schema（service/gateway/auth/responseFormat/tools/params/preSteps）与环境变量替换规则，是翻译层的配置契约。

> **前置文档**
>
> - `07-平台-工具Provider接入规范`（`07-平台治理与交付/`）—— 工具注册规范前置。

> **后置文档**
>
> - `07-平台-MCP翻译层教学`（`07-平台治理与交付/`）—— 本文"下一篇"，理解三层架构与配置驱动。

> 上一篇：无　|　下一篇：[07-平台-MCP翻译层教学.md](07-平台-MCP翻译层教学.md)　（MCP翻译层链路）

> **前置文档：** `07-平台-MCP翻译层教学.md`（必须先读，理解三层架构和配置驱动思路）、`07-平台-工具Provider接入规范.md`（工具注册规范，前置）
> **定位：** 连接器 YAML 配置的完整 Schema + 框架组件契约 + 扩展点定义。这是"配置驱动通用翻译层"的**工程落点**——教学篇讲了"为什么"，本文件定义"做什么"，实操篇教"怎么做"。
> **AI角色：老师。** 你不是编码者，你是出题者+批改者+讲解者。目标是让学习者掌握 YAML 配置的完整规范，理解框架组件的契约边界，知道"哪些可以配置、哪些需要扩展、哪些不能动"。

---

## 1. 连接器配置规范（YAML Schema）

### 1.1 顶层结构

```yaml
service: string # 服务标识（必填，唯一，用于 SERVICE 环境变量切换）
version: string # 配置版本号（必填，语义化版本，如 "1.0.0"）
gateway: string # 业务网关地址（必填，支持环境变量替换）
description: string # 服务描述（选填，用于日志和文档）

auth: AuthConfig # 鉴权配置（必填）
responseFormat: ResponseFormatConfig # 响应格式配置（必填）
tools: ToolConfig[] # 工具清单（必填，至少1个）
```

**校验规则：**

- `service` 必须是合法的 DNS 子域名格式（小写字母+数字+连字符）
- `gateway` 必须是合法的 HTTP/HTTPS URL
- `tools` 至少包含1个工具定义

### 1.2 auth 配置

```yaml
auth:
  type: string # 鉴权类型（必填，枚举：login | oauth2 | apikey | none）
  url: string # 鉴权端点 URL（login/oauth2 时必填）
  method: string # HTTP 方法（login 时必填，默认 POST）
  body: object # 请求体（login 时必填）
  headers: object # 额外请求头（选填）
  tokenField: string # 从响应中提取 token 的路径（必填）
  tokenHeader: string # 发送 token 时用的请求头名（必填，默认 "authorization"）
  tokenPrefix: string # token 前缀（选填，如 "Bearer "）
  tokenTTL: number # token 缓存时间（秒，选填，默认 3300）
```

**四种鉴权类型：**

| type     | 适用场景                  | tokenField 示例                                 |
| -------- | ------------------------- | ----------------------------------------------- |
| `login`  | 用户名+密码登录换 token   | `response.text`（天机学堂：响应体直接是 token） |
| `oauth2` | OAuth2 client_credentials | `response.data.access_token`                    |
| `apikey` | 固定 API Key              | 无需提取，直接使用配置中的 key                  |
| `none`   | 无需鉴权                  | 无                                              |

**tokenField 路径语法：**

- `response.text`：响应体原始文本
- `response.data.access_token`：JSON 响应中的嵌套字段
- `response.headers.x-token`：响应头中的字段

**环境变量替换：**

```yaml
auth:
  type: login
  url: ${TJXT_AUTH_URL:http://localhost:8081}/accounts/login
  body:
    type: 1
    cellPhone: ${TJXT_LOGIN_PHONE}
    password: ${TJXT_LOGIN_PASSWORD}
  tokenField: response.text
  tokenHeader: authorization
  tokenTTL: 3300
```

语法：`${ENV_VAR:default}`，`default` 可省略（省略时若环境变量不存在则报错）。

### 1.3 responseFormat 配置

```yaml
responseFormat:
  codeField: string # 业务状态码字段路径（必填）
  msgField: string # 错误消息字段路径（选填）
  dataField: string # 业务数据字段路径（必填）
  successCode: any # 成功状态码（必填，类型与 codeField 对应）
  errorCode: any # 错误状态码（选填，用于框架自动判断是否失败）
```

**常见格式对照：**

| 业务系统  | 响应格式                                     | responseFormat 配置                                                       |
| --------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| 天机学堂  | `{"code":200,"msg":"ok","data":{...}}`       | `codeField: code, msgField: msg, dataField: data, successCode: 200`       |
| hmall     | `{"status":200,"message":"ok","data":{...}}` | `codeField: status, msgField: message, dataField: data, successCode: 200` |
| 第三方API | `{"success":true,"result":{...}}`            | `codeField: success, dataField: result, successCode: true`                |

### 1.4 tools 配置

```yaml
tools:
  - name: string # 工具名（必填，唯一，对应 MCP tools/list 的 name）
    description: string # 工具描述（必填，给 LLM 看的，越清楚越好）
    method: string # HTTP 方法（必填，枚举：GET | POST | PUT | DELETE | PATCH）
    path: string # API 路径（必填，支持路径参数，如 /cs/courses/{courseId}/catalogs）
    sensitive: boolean # 是否敏感操作（选填，默认 false）
    hitl: boolean # 是否需要人工审批（选填，默认 false，通常 sensitive=true 时也设 true）
    params: ParamConfig[] # 参数清单（必填，至少1个）
    preSteps: PreStepConfig[] # 前置步骤（选填）
    headers: object # 额外请求头（选填）
    timeout: number # 超时时间（毫秒，选填，默认 30000）
```

### 1.5 params 配置

```yaml
params:
  - name: string # 参数名（必填）
    in: string # 参数位置（必填，枚举：path | query | body | header）
    type: string # 参数类型（必填，枚举：number | string | boolean | array | object）
    items: string # 数组元素类型（type=array 时必填）
    required: boolean # 是否必填（选填，默认 true）
    default: any # 默认值（选填）
    description: string # 参数描述（选填，给 LLM 看的）
```

**参数位置对照：**

| in 值    | 含义         | 示例                                              |
| -------- | ------------ | ------------------------------------------------- |
| `path`   | URL 路径参数 | `/cs/courses/{courseId}/catalogs` 中的 `courseId` |
| `query`  | URL 查询参数 | `?page=1&size=10` 中的 `page`、`size`             |
| `body`   | 请求体参数   | `{"courseIds":[1,2]}` 中的 `courseIds`            |
| `header` | 请求头参数   | `X-User-Id`                                       |

**路径参数替换规则：**

- `path` 类型的参数会自动替换路径中的 `{paramName}` 占位符
- 例如 `path: /cs/courses/{courseId}/catalogs` + `params[0].name: courseId` → 实际请求 `/cs/courses/1001/catalogs`

### 1.6 preSteps 配置

```yaml
preSteps:
  - name: string # 步骤名（必填）
    type: string # 步骤类型（必填，枚举：timestamp | uuid | api）
    targetField: string # 结果写入哪个字段（必填）
    # type=timestamp 时：无额外配置，生成当前时间戳
    # type=uuid 时：无额外配置，生成 UUID
    # type=api 时：
    url: string # API 地址（必填）
    method: string # HTTP 方法（必填）
    body: object # 请求体（选填）
    resultField: string # 从响应中提取结果的路径（必填）
```

**示例：placeOrder 的 preSteps**

```yaml
tools:
  - name: placeOrder
    method: POST
    path: /ts/orders/placeOrder
    sensitive: true
    hitl: true
    params:
      - name: courseIds
        in: body
        type: array
        items: number
        required: true
      - name: couponIds
        in: body
        type: array
        items: number
        required: false
      - name: orderId
        in: body
        type: number
        required: true
    preSteps:
      - name: generateOrderId
        type: timestamp
        targetField: orderId
```

**执行逻辑**：框架在调用 placeOrder 之前，先执行 `generateOrderId`（生成时间戳），将结果写入 `orderId` 字段，然后再发送 HTTP 请求。

---

## 2. 框架组件契约

### 2.1 组件总览

```
mcp-gateway/src/
├── index.ts          ← MCP 协议入口（46行，通用，不动）
├── gateway.ts        ← 核心网关：读配置 → 生成 tools/list + tools/call
├── auth.ts           ← 鉴权适配器：按 type 分派
├── normalizer.ts     ← 响应格式统一：按 responseFormat 配置适配
├── config.ts         ← 配置加载：读 YAML + 校验 + 环境变量替换
└── mock.ts           ← mock 数据（保留）
```

### 2.2 ConfigLoader（config.ts）

**职责**：读取 YAML 配置文件 → 校验 schema → 替换环境变量 → 返回运行时配置对象

**接口**：

```typescript
interface RuntimeConfig {
  service: string;
  gateway: string;
  auth: AuthRuntimeConfig;
  responseFormat: ResponseFormatRuntimeConfig;
  tools: ToolRuntimeConfig[];
}

function loadConfig(serviceName: string): RuntimeConfig;
```

**校验规则**：

- 启动时校验所有必填字段
- `tools` 中不能有重复的 `name`
- `params` 中 `in=path` 的参数必须在 `path` 中有对应的 `{name}` 占位符
- `auth.type` 必须是 `login | oauth2 | apikey | none` 之一

### 2.3 AuthAdapter（auth.ts）

**职责**：按 `auth.type` 分派鉴权逻辑，返回有效的 token

**接口**：

```typescript
interface AuthAdapter {
  getToken(): Promise<string>;
}

function createAuthAdapter(config: AuthRuntimeConfig): AuthAdapter;
```

**内置适配器**：

| type     | 实现                                                 | token 来源 |
| -------- | ---------------------------------------------------- | ---------- |
| `login`  | POST auth.url + auth.body → 提取 tokenField          | 响应体/头  |
| `oauth2` | POST auth.url + client_credentials → 提取 tokenField | 响应体     |
| `apikey` | 直接返回配置中的 key                                 | 配置文件   |
| `none`   | 返回空字符串                                         | 无         |

**token 缓存**：所有适配器都内置 token 缓存（TTL 由 `auth.tokenTTL` 控制），避免每次调用工具都重新鉴权。

### 2.4 ToolDiscovery（gateway.ts 的一部分）

**职责**：从配置自动生成 `tools/list` 响应

**逻辑**：

```typescript
function listTools(config: RuntimeConfig) {
  return config.tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: buildSchema(t.params),
  }));
}
```

**buildSchema 规则**：

- 从 `params` 自动生成 JSON Schema `inputSchema`
- `required: true` 的参数加入 `inputSchema.required` 数组
- `type: array` 的参数自动生成 `{type: "array", items: {type: items}}`

### 2.5 ToolExecutor（gateway.ts 的一部分）

**职责**：从配置自动映射 `tools/call` → HTTP 请求

**逻辑**：

```typescript
async function callTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  config: RuntimeConfig,
): Promise<string> {
  const tool = config.tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool not found: ${name}`);

  // 1. 执行 preSteps（如有）
  const enrichedArgs = await executePreSteps(tool, args);

  // 2. 构建 HTTP 请求
  const path = renderPath(tool.path, enrichedArgs);
  const token = await createAuthAdapter(config.auth).getToken();
  const response =
    tool.method === "GET"
      ? await fetch(`${config.gateway}${path}`, {
          headers: { [config.auth.tokenHeader]: token },
        })
      : await fetch(`${config.gateway}${path}`, {
          method: "POST",
          headers: {
            [config.auth.tokenHeader]: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildBody(tool.params, enrichedArgs)),
        });

  // 3. 统一响应格式
  return normalizeResponse(await response.json(), config.responseFormat);
}
```

### 2.6 ResponseNormalizer（normalizer.ts）

**职责**：按 `responseFormat` 配置统一响应格式

**逻辑**：

```typescript
function normalizeResponse(
  raw: unknown,
  format: ResponseFormatRuntimeConfig,
): string {
  const code = getNestedValue(raw, format.codeField);
  if (code === format.successCode) {
    const data = getNestedValue(raw, format.dataField);
    return JSON.stringify({ code: 0, msg: "ok", data });
  } else {
    const msg = format.msgField
      ? getNestedValue(raw, format.msgField)
      : "Unknown error";
    return JSON.stringify({ code: -1, msg });
  }
}
```

**统一输出格式**（所有业务统一）：

```json
// 成功
{ "code": 0, "msg": "ok", "data": { ... } }
// 失败
{ "code": -1, "msg": "错误描述" }
```

---

## 3. 扩展点

### 3.1 自定义鉴权策略

如果内置的 3 种适配器（login/oauth2/apikey）不满足需求，可以实现自定义适配器：

```typescript
// connectors/tjxt.custom.ts
import { AuthAdapter } from "../src/auth.js";

export class CustomTjxtAuthAdapter implements AuthAdapter {
  async getToken(): Promise<string> {
    // 自定义鉴权逻辑，如：先调验证码接口，再调登录接口
  }
}
```

```yaml
# connectors/tjxt.yaml
auth:
  type: custom
  adapter: ./tjxt.custom.ts#CustomTjxtAuthAdapter
```

### 3.2 自定义响应解析

如果 `responseFormat` 的路径语法不够用（如响应是 XML、嵌套数组等），可以实现自定义解析器：

```typescript
// connectors/tjxt.custom.ts
export function customResponseParser(raw: unknown): {
  code: number;
  msg: string;
  data: unknown;
} {
  // 自定义解析逻辑
}
```

```yaml
# connectors/tjxt.yaml
responseFormat:
  parser: ./tjxt.custom.ts#customResponseParser
```

### 3.3 preSteps 扩展

当前内置两种 preStep 类型：

| type        | 生成值                | 适用场景           |
| ----------- | --------------------- | ------------------ |
| `timestamp` | `Date.now()`          | 生成订单号、请求ID |
| `uuid`      | `crypto.randomUUID()` | 生成唯一标识       |

可扩展的类型：

- `api`：调外部 API 获取值（如预下单接口返回 orderId）
- `transform`：对已有参数做变换（如 MD5 签名）

### 3.4 OpenAPI 导入（未来方向）

```bash
# 从 Swagger JSON 自动生成 YAML 的 tools 段
npx mcp-gateway openapi2yaml http://localhost:8080/v3/api-docs --service tjxt --output connectors/tjxt.yaml
```

生成的 YAML 只包含 `tools` 段，`auth` 和 `responseFormat` 需要手动补充。

---

## 4. 治理

### 4.1 配置校验

启动时校验所有配置，校验失败则拒绝启动：

```
[mcp-gateway] Loading config: connectors/tjxt.yaml
[mcp-gateway] ✅ service: tjxt
[mcp-gateway] ✅ gateway: http://localhost:10010
[mcp-gateway] ✅ auth: login (url=http://localhost:8081/accounts/login)
[mcp-gateway] ✅ responseFormat: code=msg=data= successCode=200
[mcp-gateway] ✅ tools: 2 (getCourseDetail, placeOrder)
[mcp-gateway] ❌ placeOrder.params[2].orderId: required=true but no default and not in args
[mcp-gateway] 💡 Add preSteps to generate orderId, or set required=false with a default
[mcp-gateway] Startup aborted: config validation failed
```

### 4.2 热更新（未来方向）

修改 YAML 后无需重启，框架监听文件变化自动重载：

```
[mcp-gateway] Config changed: connectors/tjxt.yaml
[mcp-gateway] Reloading config...
[mcp-gateway] ✅ Tools updated: 2 → 3 (added: searchCourse)
[mcp-gateway] ⚠️ Auth config changed: token cache cleared
```

### 4.3 版本管理

```yaml
service: tjxt
version: "1.1.0" # 语义化版本
```

- 主版本号（major）：不兼容的配置变更（如删除了必填字段）
- 次版本号（minor）：向后兼容的功能新增（如新增工具）
- 修订号（patch）：向后兼容的问题修正（如修改工具描述）

框架启动时检查配置版本与框架版本的兼容性。

---

## 5. 示例配置

### 5.1 tjxt.yaml（天机学堂完整配置）

```yaml
service: tjxt
version: "1.0.0"
gateway: ${TJXT_GATEWAY_URL:http://localhost:10010}
description: 天机学堂在线教育平台

auth:
  type: login
  url: ${TJXT_AUTH_URL:http://localhost:8081}/accounts/login
  method: POST
  body:
    type: 1
    cellPhone: ${TJXT_LOGIN_PHONE}
    password: ${TJXT_LOGIN_PASSWORD}
  tokenField: response.text
  tokenHeader: authorization
  tokenTTL: 3300

responseFormat:
  codeField: code
  msgField: msg
  dataField: data
  successCode: 200

tools:
  - name: getCourseDetail
    description: 查询课程详情：返回课程基本信息、目录（章节+小节）和学习进度。当用户询问某门课程讲什么、包含哪些章节、课程价格是多少时调用。
    method: GET
    path: /cs/courses/{courseId}/catalogs
    sensitive: false
    hitl: false
    params:
      - name: courseId
        in: path
        type: number
        required: true
        description: 课程ID

  - name: placeOrder
    description: 下单购买课程（敏感操作，需要人工审批后才会真正执行）。当用户明确表达购买某门课程时调用。内部自动完成预下单→正式下单两步流程。
    method: POST
    path: /ts/orders/placeOrder
    sensitive: true
    hitl: true
    params:
      - name: courseIds
        in: body
        type: array
        items: number
        required: true
        description: 课程ID数组（1~10个）
      - name: couponIds
        in: body
        type: array
        items: number
        required: false
        description: 优惠券ID数组（选填）
      - name: x-user-id
        in: header
        type: string
        required: true
        description: 用户身份，由框架透传给业务网关（修复"下单丢用户身份"缺陷）
      - name: orderId
        in: body
        type: number
        required: true
        description: 订单ID（由 preSteps 预下单接口生成，勿手动传）
    preSteps:
      # 真实预下单：先调预下单接口拿 orderId，再正式下单（修复"跳过预下单"缺陷）
      # 预下单接口路径/返回字段以天机后端契约为准，此处为示意
      - name: preOrder
        type: api
        method: POST
        path: /ts/orders/preOrder
        resultField: data.orderId
        targetField: orderId
```

### 5.2 hmall.yaml（电商完整配置）

```yaml
service: hmall
version: "1.0.0"
gateway: ${HMAIL_GATEWAY_URL:http://localhost:8080}
description: HMall 电商平台

auth:
  type: none

responseFormat:
  codeField: status
  msgField: message
  dataField: data
  successCode: 200

tools:
  - name: queryOrder
    description: 查询订单详情：返回订单状态、金额、商品列表。当用户询问订单状态、物流信息时调用。
    method: GET
    path: /orders/{orderId}
    sensitive: false
    hitl: false
    params:
      - name: orderId
        in: path
        type: number
        required: true
        description: 订单ID

  - name: cancelOrder
    description: 取消订单（敏感操作，需要人工审批）。当用户明确要求取消订单时调用。
    method: PUT
    path: /orders/{orderId}/cancel
    sensitive: true
    hitl: true
    params:
      - name: orderId
        in: path
        type: number
        required: true
        description: 订单ID
```

### 5.3 mbti.yaml（测评最小配置）

```yaml
service: mbti
version: "1.0.0"
gateway: ${MBTI_API_URL:http://localhost:3001}
description: MBTI 人格测评

auth:
  type: apikey
  headers:
    X-API-Key: ${MBTI_API_KEY}

responseFormat:
  codeField: success
  dataField: result
  successCode: true

tools:
  - name: startAssessment
    description: 开始 MBTI 人格测评。当用户想要进行人格测试时调用。
    method: POST
    path: /api/assessments
    sensitive: false
    hitl: false
    params:
      - name: type
        in: body
        type: string
        required: true
        description: 测评类型（如 "MBTI", "BigFive"）

  - name: submitAnswer
    description: 提交测评答案。当用户回答了一道测评题目时调用。
    method: POST
    path: /api/assessments/{assessmentId}/answers
    sensitive: false
    hitl: false
    params:
      - name: assessmentId
        in: path
        type: string
        required: true
        description: 测评ID
      - name: questionId
        in: body
        type: number
        required: true
        description: 题目ID
      - name: answer
        in: body
        type: string
        required: true
        description: 答案选项

  - name: getResult
    description: 获取测评结果。当用户完成所有题目后调用，返回人格类型和分析。
    method: GET
    path: /api/assessments/{assessmentId}/result
    sensitive: false
    hitl: false
    params:
      - name: assessmentId
        in: path
        type: string
        required: true
        description: 测评ID
```

---

## 6. 一句话记住本文件

> **"连接器 = 一份 YAML（service + auth + responseFormat + tools），框架从 YAML 自动生成 tools/list + tools/call + 鉴权 + 响应适配；新业务只需写 YAML，框架零改动。"**
