/**
 * 学生身份的常量与形状校验 —— 浏览器与服务端共用的一份口径
 *
 * 为什么从 `api-auth.ts` 里搬出来单独成文件
 * --------------------------------------
 * `api-auth.ts` 要查库（`studentDb`），它的 import 链会拉到 `node:sqlite`。
 * 浏览器组件一旦 import 它，打包器会把整个数据层追进客户端产物 —— 哪怕
 * 只是想要一个请求头名字符串。本文件**不 import 任何模块**，是真正的叶子，
 * 两端都能安全引用。
 *
 * 常量只有一份：`api-auth.ts` 从这里 import 再按原样导出给服务端用。
 * 否则迟早会出现「服务端读 `x-student-id`、客户端发 `X-Student-Id`」——
 * 这类错不报错、只是每个请求都 401，查起来很花时间。
 */

/** 学生身份的请求头名。服务端从它读身份，客户端用它发身份。 */
export const STUDENT_ID_HEADER = "x-student-id";

/** query 参数名（SSE 端点用，因为 `EventSource` 发不出自定义 header）。 */
export const STUDENT_ID_QUERY = "studentId";

/** 浏览器里记学生 id 用的存储键。 */
export const STUDENT_ID_STORAGE_KEY = "ai-teaching:studentId";

/**
 * 合法学生 id 的形状。
 *
 * 必须与 `api-spec.md` 第八节的 `z.string().uuid()` 对齐：库里只有这种形式，
 * 手搓的 `stu_test` 会被所有端点 400 挡掉。前端先挡一道的理由很具体 ——
 * 本地存了一个脏值之后，每个请求都 400，现象看起来是「接口全坏了」，
 * 而不是「本地存错了」。
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 是否是合法形状的学生 id。前后空白不算错，会先 trim。 */
export function isStudentId(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}
