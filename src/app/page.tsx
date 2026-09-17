import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        AI Native 编程教学助手
      </h1>
      <p className="text-muted-foreground text-base">用 Agent 教 Agent。</p>
      <div className="flex gap-2">
        <Button>开始学习</Button>
        <Button variant="outline" size="sm">
          了解项目
        </Button>
      </div>
    </main>
  );
}
