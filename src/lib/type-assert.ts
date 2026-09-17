/**
 * 编译期断言工具（纯类型，无运行时代码）
 *
 * 为什么需要它，以及**为什么不能省**
 * --------------------------------
 * 在类型层面表达「这两份定义必须保持一致」时，很自然会写成：
 *
 * ```ts
 * export type __Assert = [A extends B ? true : never][0];
 * ```
 *
 * **这个写法是空的。** 条件不成立时它只是把类型静默解析成 `never`，
 * `tsc` 不报任何错 —— 一个永远不报警的断言等于没有断言，比不写更糟：
 * 它会让人以为有护栏。
 *
 * 有效写法必须让条件不成立时**违反一个泛型约束**。`Expect` 就是那个约束：
 * 传入 `false` 时得到 `Type 'false' does not satisfy the constraint 'true'`。
 *
 * ```ts
 * type _Check = Expect<A extends B ? true : false>;
 * ```
 *
 * ⚠️ 两个易错点
 * ------------
 * 1. 条件分支必须写 `? true : false`，**不是** `? true : never`（见上）。
 * 2. 断言结果必须被 tsc 检查到。`type X = ...` 形式是可以的 ——
 *    泛型约束在**声明处**即被校验，不需要有人引用 `X`。
 *
 * 本项目有两处在用：`src/lib/learning-steps.ts`（步骤表是否覆盖全部 `StepType`）
 * 与 `src/schemas/sse.ts`（SSE 类型与 Zod schema 是否双向兼容）。
 * 后者在把空断言修活之后，立刻暴露出一个真实的类型不兼容 —— 见该文件说明。
 */

/** 编译期断言：条件不成立时传入的 `false` 不满足 `true` 约束，tsc 直接报错。 */
export type Expect<T extends true> = T;
