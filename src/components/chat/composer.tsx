"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Code2,
  CornerDownLeft,
  ImagePlus,
  Loader2,
  Mic,
  MicOff,
  Send,
  Square,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useChatStream } from "@/hooks/useChatStream";
import { useElapsed } from "@/hooks/use-elapsed";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useCodeStore, useSessionStore } from "@/stores";
import type { StepType } from "@/lib/db";
import { cn } from "@/lib/utils";

/** 图片上传限制 */
const MAX_IMAGES = 3;
const MAX_IMAGE_DIMENSION = 4096;
const JPEG_QUALITY = 0.75;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp";

/**
 * 客户端图片压缩：超过尺寸上限时等比缩小，全部转 JPEG 以控制体积。
 * 纯 Canvas 实现，不依赖外部库。
 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          const ratio = Math.min(
            MAX_IMAGE_DIMENSION / width,
            MAX_IMAGE_DIMENSION / height,
          );
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("无法创建 Canvas 上下文。"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.onerror = () => reject(new Error("图片加载失败。"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("文件读取失败。"));
    reader.readAsDataURL(file);
  });
}

/**
 * 输入区（模块页中栏底部）。
 *
 * 依据 `04-frontend.md`：底部输入区含「输入框（文本/语音/截图/发送）」。
 * 文本与发送已接；语音需要相应能力（语音识别），分在后续 Phase。
 *
 * 「提交图片」为什么在这里（2026-09-26）
 * ---------------------------------
 * 学生要把代码截图、终端报错、作品效果发出来让导师看。图片走后端的视觉评审
 * 管线（`vision-review.ts`），用多模态模型 `doubao-seed-2-1-pro-260915`
 * 做点评。前端只负责采集 + 压缩 + 预览 —— 不调模型、不做 OCR。
 *
 * 「附带代码」为什么放在这里
 * ----------------------
 * 教学流程第 3 步「动手模仿」要求学生写 Prompt / 工具定义 / 核心逻辑，
 * 第 4 步才是 AI 校验。学生写完要能让导师看到，代码就必须能随消息发出去。
 *
 * step（2026-09-19 新增）
 * ----------------------
 * 学习页随每条消息携带当前步骤（`step`），后端据此决定用讲解导师还是
 * 通用答疑口径回答。由模块工作区（知道当前步骤）传入；演练场不传。
 */
export function Composer({
  step,
  moduleId,
  phaseContext,
}: {
  step?: StepType;
  moduleId?: string;
  /** 复刻项目当前阶段上下文（仅复刻工作区携带），随消息带给导师。 */
  phaseContext?: string;
}) {
  const { send, abort } = useChatStream();

  const status = useSessionStore((state) => state.status);
  const code = useCodeStore((state) => state.code);
  const language = useCodeStore((state) => state.language);
  const setCode = useCodeStore((state) => state.setCode);

  const [text, setText] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);

  // 语音输入状态由 hook 自身管理；error/state 透传给 UI。
  // 同时暴露 start/stop 供空格键 PTT（Push-to-Talk）控制。
  const {
    isSupported: micSupported,
    isListening,
    error: speechError,
    start: startMic,
    stop: stopMic,
    toggle: toggleMic,
  } = useSpeechRecognition({
    onResult: (spoken) => {
      // 语音识别结果直接填入输入框，替换而非追加
      // （追加会在修修补补时产生大量冗余文本）
      setText(spoken);
    },
  });

  // 空格键 PTT（Push-to-Talk）：按住空格开始收音，松开即停止。
  // 仅在输入框未聚焦时生效，避免干扰正常打字。
  // 这里用的是 DOM 原生 addEventListener，回调参数类型由 DOM 自动推断，
  // 不能标注 React.KeyboardEvent（会和原生 KeyboardEvent 冲突）。
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== " " || e.repeat) return;
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      )
        return;
      e.preventDefault();
      if (!isListening) {
        startMic();
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key !== " ") return;
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      )
        return;
      if (isListening) {
        stopMic();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [isListening, startMic, stopMic]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const streaming = status === "streaming";
  const canSend = (text.trim() !== "" || images.length > 0) && !streaming;
  const elapsed = useElapsed(streaming);

  useEffect(() => {
    if (imageError === null) return;
    const timer = setTimeout(() => setImageError(null), 3000);
    return () => clearTimeout(timer);
  }, [imageError]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setImageError(`最多 ${MAX_IMAGES} 张图片`);
      resetFileInput();
      return;
    }

    const selected = Array.from(files).slice(0, remaining);

    void (async () => {
      for (const file of selected) {
        if (file.size > MAX_FILE_BYTES) {
          setImageError(`${file.name} 超过 5 MB，已跳过`);
          continue;
        }
        if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
          setImageError(`${file.name} 不是支持的图片格式，已跳过`);
          continue;
        }
        try {
          const dataUrl = await compressImage(file);
          setImages((prev) => [...prev, dataUrl]);
        } catch {
          setImageError(`${file.name} 处理失败，已跳过`);
        }
      }
      resetFileInput();
    })();
  }

  function resetFileInput(): void {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeImage(index: number): void {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function openFilePicker(): void {
    fileInputRef.current?.click();
  }

  function sendContent(content: string): void {
    void send(
      {
        content,
        ...(step !== undefined ? { step } : {}),
        ...(moduleId ? { moduleId } : {}),
        ...(phaseContext ? { phaseContext } : {}),
        ...(showCode && code.trim() !== ""
          ? { code: code.trim(), language }
          : {}),
        ...(images.length > 0 ? { images } : {}),
      },
      { moduleId },
    );
    setText("");
    setImages([]);
  }

  function submit(): void {
    if (!canSend) return;
    sendContent(text.trim());
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ): void {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  }

  return (
    <div className="flex flex-col gap-2">
      {showCode ? (
        <textarea
          value={code}
          onChange={(event) => setCode(event.target.value)}
          spellCheck={false}
          rows={6}
          placeholder="把你的 Prompt / 工具定义 / 核心逻辑贴在这里，导师会按评分标准逐项点评。"
          className="w-full resize-y rounded-md border bg-background p-2.5 font-mono text-xs leading-relaxed transition-colors duration-200 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      ) : null}

      {images.length > 0 ? (
        <div className="flex flex-wrap items-start gap-2">
          {images.map((dataUrl, i) => (
            <div
              key={i}
              className="group relative size-16 shrink-0 overflow-hidden rounded-md border"
            >
              <img
                src={dataUrl}
                alt={`截图 ${i + 1}`}
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="移除图片"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {imageError !== null ? (
        <p role="alert" className="text-xs text-destructive">
          {imageError}
        </p>
      ) : null}

      {speechError !== null ? (
        <p role="alert" className="text-xs text-destructive">
          {speechError}
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        onChange={handleFileChange}
        className="hidden"
        aria-label="选择截图"
      />

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder={
            isListening
              ? "正在聆听…松开空格键停止收音"
              : images.length > 0
                ? "想对截图说什么？（可选，直接发图也行）"
                : "说说你的思路，或问一个具体的问题…（空格键语音，Enter 发送）"
          }
          className={cn(
            "min-h-[60px] flex-1 resize-y rounded-md border bg-background p-2.5 text-sm leading-relaxed transition-colors duration-200 outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            isListening && "border-primary ring-[3px] ring-primary/30",
          )}
        />

        <div className="flex flex-col gap-2">
          <div className="flex gap-1">
            {micSupported ? (
              <Button
                type="button"
                variant={isListening ? "default" : "outline"}
                size="sm"
                onClick={toggleMic}
                aria-label={isListening ? "停止录音" : "语音输入"}
              >
                {isListening ? (
                  <MicOff className="size-4 animate-pulse" />
                ) : (
                  <Mic className="size-4" />
                )}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openFilePicker}
              disabled={images.length >= MAX_IMAGES}
              aria-label="提交截图"
            >
              <ImagePlus className="size-4" />
              {images.length > 0 ? images.length : ""}
            </Button>
            <Button
              type="button"
              variant={showCode ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowCode((value) => !value)}
              aria-pressed={showCode}
              aria-label={showCode ? "收起代码" : "附带代码"}
              title={showCode ? "收起代码" : "附带代码"}
              className={cn(showCode && "border-ring")}
            >
              <Code2 className="size-4" />
            </Button>
          </div>

          {streaming ? (
            <Button type="button" variant="outline" size="sm" onClick={abort}>
              <Square className="size-3.5" />
              停止
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={submit}
              disabled={!canSend}
            >
              {status === "idle" ? (
                <Send className="size-4" />
              ) : (
                <CornerDownLeft className="size-4" />
              )}
              发送
            </Button>
          )}
        </div>
      </div>

      {streaming ? (
        <p
          className={cn(
            "flex items-center gap-1.5 text-xs",
            elapsed >= 30 ? "text-amber-600" : "text-muted-foreground",
          )}
        >
          <Loader2 className="size-3 animate-spin" />
          {elapsed < 15
            ? "导师推了推眼镜，准备开口……"
            : elapsed < 25
              ? "正在整理措辞，马上就好 ✍️"
              : elapsed < 40
                ? "这个问题不简单，导师多想了会儿 🧠"
                : elapsed < 60
                  ? "还在写，思考得越久回答越靠谱 👀"
                  : "这个话题可不小，导师键盘快敲出火星了 🔥"}
        </p>
      ) : null}
    </div>
  );
}
