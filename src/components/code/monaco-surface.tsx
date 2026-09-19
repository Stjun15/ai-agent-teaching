"use client";

/**
 * Monaco 表面 —— 全项目**唯一** import `@monaco-editor/react` 的地方
 *
 * 为什么单独成文件
 * --------------
 * 1. **换编辑器只改这一个文件**。设计文档（`00-MASTER.md`「技术选型」表：
 *    代码编辑器 = Monaco Editor）把选型钉在了 Monaco，但「用哪个包装库」
 *    不是文档约定的事。把包名收在一处，将来换 `monaco-editor` 直连或别的
 *    包装库，改动面只有这里。
 * 2. **能整体懒加载**。monaco 本体（几十万行）由 CDN 在浏览器里加载，
 *    这个模块负责在**加载成功后**才挂载编辑器（见 `onUnavailable`）。
 *    调用方用 `next/dynamic` + `ssr: false` 引它，服务端不碰它。
 *
 * 资源从 CDN 取，因此必须能失败
 * --------------------------
 * 默认走 jsdelivr 的 `monaco-editor/min/vs`（见 `@monaco-editor/loader` 的
 * 默认 config）。把 monaco 打进仓库要 +70MB 且要给 worker 配打包规则，
 * 对一个演示项目不划算；换来的是**运行时网络依赖** —— 所以离线或被墙时
 * 编辑器必须能降级，而不是留一块空白。降级的具体做法在调用方
 * （`code-editor.tsx` 换成 textarea），这里只负责把「加载失败了」这件事
 * 如实报上去：`loader.init()` 的 promise 拒绝就是唯一的可靠信号，
 * `Editor` 组件本身不会把失败暴露出来（它会一直停在 loading）。
 */

import Editor, { loader, type OnMount } from "@monaco-editor/react";
import { useEffect } from "react";

export interface MonacoSurfaceProps {
  value: string;
  /** monaco 的语言 id。`typescript` / `python` 与 monaco 内置 id 同名。 */
  language: string;
  /** monaco 主题 id：`vs`（浅）或 `vs-dark`。 */
  theme: string;
  onChange: (value: string) => void;
  /** 加载失败（CDN 不可达）时调用一次。调用方据此切到纯文本降级。 */
  onUnavailable: () => void;
}

export function MonacoSurface({
  value,
  language,
  theme,
  onChange,
  onUnavailable,
}: MonacoSurfaceProps) {
  useEffect(() => {
    let cancelled = false;
    // `loader.init()` 是幂等的：`Editor` 自己也会调它，不会重复下载。
    // 这里调它**只为拿到失败信号** —— 成功分支什么都不用做。
    void loader.init().then(
      () => undefined,
      () => {
        // 卸载后再报会触发对已卸载组件的 setState，先挡一道。
        if (!cancelled) onUnavailable();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [onUnavailable]);

  const handleMount: OnMount = (editor) => {
    // 编辑器挂载后把焦点给它：学生点进「动手模仿」这一栏就是要直接敲字。
    //
    // 但抢焦点有个代价：浏览器会把焦点元素滚进视口。动手模仿卡挂在全部
    // 七步页面的中栏下方（对话卡之后），学生刚进讲解/示范步，1~2 秒后
    // Monaco 从 CDN 加载完一挂载就抢焦点，窗口被滚下去 465px —— 讲稿被
    // 顶出视野，看起来像「点观察示范却跳到了动手模仿」（2026-09-19 实测
    // 滚动瞬间 activeElement 落在 monaco 内）。所以只在编辑器**本来就在
    // 视口内**时才要焦点；看不见的编辑器不值得为它动滚动位置。
    const dom = editor.getDomNode();
    if (
      dom !== null &&
      typeof window !== "undefined" &&
      dom.getBoundingClientRect().top < window.innerHeight
    ) {
      editor.focus();
    }
  };

  return (
    <Editor
      height="100%"
      language={language}
      theme={theme}
      value={value}
      onChange={(next) => onChange(next ?? "")}
      onMount={handleMount}
      // 挂载期间显示 loading 文案 —— 由 `MonacoSurface` 的父组件控制何时渲染，
      // 这里给一段最小占位，避免 CDN 慢时出现空白闪烁。
      loading={
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          正在加载编辑器…
        </div>
      }
      options={{
        // 教学场景下关掉的东西：小地图和行内建议会把学生的注意力从
        // 「我写的内容」上引开，而这一栏的目的是让他们看清自己的代码。
        minimap: { enabled: false },
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        // 代码不长，长行折行比横向滚动更好读。
        wordWrap: "on",
        scrollBeyondLastLine: false,
        fontSize: 13,
        tabSize: 2,
        // 父容器尺寸变化（切分栏、响应式断点）时自动重排，否则会画错格。
        automaticLayout: true,
        renderLineHighlight: "line",
        padding: { top: 8, bottom: 8 },
        // 移动端软键盘弹出时不要顶动布局。
        fixedOverflowWidgets: true,
      }}
    />
  );
}
