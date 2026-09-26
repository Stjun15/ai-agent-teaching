"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Web Speech API 的 TypeScript 接口声明。
 * `SpeechRecognition` 不在标准 lib.dom 中，此处最小化补全。
 */
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

/** 用户停止说话后等待多久自动结束（ms） */
const SILENCE_TIMEOUT = 2500;

export interface UseSpeechRecognitionOptions {
  /** 识别语言，默认 zh-CN */
  lang?: string;
  /** 最终结果回调 */
  onResult?: (text: string) => void;
}

export interface UseSpeechRecognitionReturn {
  /** 当前浏览器是否支持语音识别 */
  isSupported: boolean;
  /** 是否正在收音 */
  isListening: boolean;
  /** 错误信息（无错误时 = null） */
  error: string | null;
  /** 开始收音 */
  start: () => void;
  /** 手动停止 */
  stop: () => void;
  /** toggle 开关 */
  toggle: () => void;
}

/**
 * 语音输入 hook —— 基于浏览器内置 Web Speech API。
 *
 * 为什么不用第三方 STT 服务？
 * ---
 * 教学平台目标浏览器是 Chrome / Edge，这两个浏览器内置的 SpeechRecognition
 * 对中文识别准确率已经很高（≥ 95%），不需要额外付费服务。
 * 如果未来需要 Firefox / Safari 支持，再考虑接入火山方舟 ASR。
 *
 * 使用方式：
 * @example
 * const { isSupported, isListening, toggle } = useSpeechRecognition({
 *   onResult: (text) => setInput(text),
 * });
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const { lang = "zh-CN", onResult } = options;

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onResultRef = useRef(onResult);
  // 渲染期不许写 ref：放到 effect 里同步最新回调（latest-ref 惯用法）。
  useEffect(() => {
    onResultRef.current = onResult;
  });

  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    (typeof window.SpeechRecognition !== "undefined" ||
      typeof window.webkitSpeechRecognition !== "undefined");

  // 错误 3 秒后自动清除
  useEffect(() => {
    if (error === null) return;
    const timer = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(timer);
  }, [error]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (silenceTimerRef.current !== null) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  /** 重置静默定时器：用户还在说话就推迟自动结束 */
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(() => {
      recognitionRef.current?.stop();
    }, SILENCE_TIMEOUT);
  }, []);

  /** 清理静默定时器 */
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearSilenceTimer();
    recognitionRef.current?.stop();
    setIsListening(false);
  }, [clearSilenceTimer]);

  const start = useCallback(() => {
    if (!isSupported) {
      setError("当前浏览器不支持语音输入，请使用 Chrome 或 Edge。");
      return;
    }

    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      resetSilenceTimer();
      // 取最新（final === true）的结果；
      // 如果还没有 final，取当前 interim 结果用于实时预览。
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        if (result.isFinal) {
          finalText += result[0]!.transcript;
        } else {
          interimText += result[0]!.transcript;
        }
      }

      // 优先给 final；无 final 时给 interim 做实时预览
      const text = finalText || interimText;
      if (text) {
        onResultRef.current?.(text);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      clearSilenceTimer();
      setIsListening(false);

      switch (event.error) {
        case "no-speech":
          // 没检测到语音，不算错误
          break;
        case "aborted":
          break;
        case "not-allowed":
          setError("麦克风权限被拒绝，请在浏览器设置中允许。");
          break;
        case "network":
          setError("语音识别需要网络连接，请检查网络。");
          break;
        default:
          setError(`语音识别出错：${event.message || event.error}`);
      }
    };

    recognition.onend = () => {
      clearSilenceTimer();
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    resetSilenceTimer();
  }, [isSupported, lang, resetSilenceTimer, clearSilenceTimer]);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  return { isSupported, isListening, error, start, stop, toggle };
}
