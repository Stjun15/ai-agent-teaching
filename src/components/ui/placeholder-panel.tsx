import { cn } from "@/lib/utils";

/**
 * 未实现区域的占位块。
 *
 * 为什么会存在这个东西
 * ------------------
 * Phase 3 按「先搭布局、再逐个填面板」推进，所以中间必然存在「位置留好了、
 * 内容还没写」的时刻。这一段如果留空白，评审（和用户）看到的是「坏了」；
 * 如果随便塞点假数据，那是在演示里撒谎。占位块是第三种选择：**明确说出
 * 这块将放什么、由哪个阶段交付**。
 *
 * 它出现的每一处都应当能对应到 `06-execution-plan.md` 里的一个提交点，
 * 交付后即删除 —— 所以 `note` 要求写明出处。
 */
function PlaceholderPanel({
  title,
  note,
  className,
}: {
  title: string;
  /** 说明这块将由哪个阶段 / 提交点交付。 */
  note: string;
  className?: string;
}) {
  return (
    <div
      data-slot="placeholder-panel"
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-muted-foreground/25 p-6 text-center text-muted-foreground",
        className,
      )}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs leading-relaxed">{note}</p>
    </div>
  );
}

export { PlaceholderPanel };
