"use client";

import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SpoilerCover({
  children,
  forceRevealed = false,
}: {
  children: ReactNode;
  forceRevealed?: boolean;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [manualRevealed, setManualRevealed] = useState(false);

  if (forceRevealed || manualRevealed) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {showConfirm ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-lg border bg-card/95 backdrop-blur-sm">
          <EyeOff className="size-8 text-muted-foreground" />
          <p className="text-center text-sm font-medium text-foreground">
            下面的内容是具体做法答案
          </p>
          <p className="max-w-xs text-center text-xs text-muted-foreground">
            建议先自己做，实在卡住了再打开。要打开吗？
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfirm(false)}
            >
              不，我先自己来
            </Button>
            <Button size="sm" onClick={() => setManualRevealed(true)}>
              打开答案
            </Button>
          </div>
        </div>
      ) : null}

      {!showConfirm ? (
        <button
          type="button"
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-card/60 backdrop-blur-[2px] transition-all hover:border-primary/40 hover:bg-card/40 cursor-pointer"
          onClick={() => setShowConfirm(true)}
        >
          <div className="flex flex-col items-center gap-2">
            <EyeOff className="size-6 text-muted-foreground/60" />
            <span className="text-sm font-medium text-muted-foreground/80">
              非必要不看
            </span>
            <span className="text-xs text-muted-foreground/50">
              点击打开
            </span>
          </div>
        </button>
      ) : null}

      <div className="select-none overflow-hidden opacity-20 blur-[3px] pointer-events-none">
        {children}
      </div>
    </div>
  );
}