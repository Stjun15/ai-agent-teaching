"use client";

import { useState, useCallback } from "react";
import { Lightbulb, RefreshCw } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// 内容池 — 全部写死，零请求零流量
// ---------------------------------------------------------------------------

type FunItem = { emoji: string; text: string; hint?: string };

const FUN_ITEMS: FunItem[] = [
  // ── 脑筋急转弯 ──────────────────────────────────────────
  { emoji: "🧠", text: "什么东西越洗越脏？", hint: "水" },
  { emoji: "🧠", text: "小明在房间里看见了四个人，为什么他说只看见三个？", hint: "小明自己就是第四个" },
  { emoji: "🧠", text: "什么书买不到？", hint: "秘书" },
  { emoji: "🧠", text: "哪一个月有 28 天？", hint: "每个月都有 28 天" },
  { emoji: "🧠", text: "什么东西往上升了就不会掉下来？", hint: "年龄" },
  { emoji: "🧠", text: "动物园里大象的鼻子最长，第二长的是谁？", hint: "小象" },
  { emoji: "🧠", text: "有一种东西，买的人知道，卖的人知道，用的人不知道，是什么？", hint: "棺材" },
  { emoji: "🧠", text: "什么人始终不敢洗澡？", hint: "泥人" },
  { emoji: "🧠", text: "阿美长得最漂亮，为什么她说自己不是最漂亮的人？", hint: "因为她说的不是自己" },
  { emoji: "🧠", text: "有一个字，人人见了都会念错，这是什么字？", hint: "「错」字" },

  // ── 程序员笑话 ──────────────────────────────────────────
  { emoji: "😂", text: "程序员最讨厌康熙的哪个儿子？—— 胤禩，因为他是八阿哥（bug）。" },
  { emoji: "😂", text: "一个测试工程师走进酒吧，要了 -1 杯啤酒，酒吧炸了。" },
  { emoji: "😂", text: "SQL 语句走进酒吧，看到两张表，它问：能 join 一下吗？" },
  { emoji: "😂", text: "程序员：我的代码跑起来了！……怎么停不下来？" },
  { emoji: "😂", text: "产品经理：这个需求很简单。程序员：这个代码写不了。" },
  { emoji: "😂", text: "为什么程序员喜欢用深色模式？因为光会吸引 bug。" },
  { emoji: "😂", text: "键盘上最悲伤的键是什么？—— Ctrl + Z，因为回不去了。" },
  { emoji: "😂", text: "Git commit message 写「fix bug」的真正含义：我不知道怎么修，但试试这次。" },
  { emoji: "😂", text: "如果编程语言是交通工具，Python 是电动车，Rust 是坦克，JavaScript 是共享单车。" },
  { emoji: "😂", text: "程序员去面试，面试官问：你有几年经验？答：五年。面试官：可 Python 才出来三年…" },

  // ── 科技冷知识 ──────────────────────────────────────────
  { emoji: "💡", text: "第一只电脑鼠标是木头做的，1964 年由 Douglas Engelbart 发明。" },
  { emoji: "💡", text: "世界上第一个网站 still online，网址 info.cern.ch，诞生于 1991 年。" },
  { emoji: "💡", text: "NASA 的登月计算机只有 4KB 内存，比你现在用的键盘芯片还小。" },
  { emoji: "💡", text: "每天有超过 350 亿个 emoji 被发送，😂 是最常用的。" },
  { emoji: "💡", text: "世界上第一封垃圾邮件发给了 393 台 ARPANET 计算机，时间是 1978 年。" },
  { emoji: "💡", text: "Google 的名字是拼写错误——本来想叫 Googol（10 的 100 次方）。" },
  { emoji: "💡", text: "CAPTCHA 验证码每天被全球用户输入超过 2 亿次。" },
  { emoji: "💡", text: "蓝牙的名字来源于 10 世纪的丹麦国王 Harald Bluetooth。" },
  { emoji: "💡", text: "Wi-Fi 这个名字没有任何实际含义，是广告公司造的（听着像 Hi-Fi）。" },
  { emoji: "💡", text: "世界上第一条短信是 1992 年发的，内容只有「Merry Christmas」。" },
];

// ---------------------------------------------------------------------------
// 组件
// ---------------------------------------------------------------------------

export function FunBreak() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * FUN_ITEMS.length));
  const [showHint, setShowHint] = useState(false);

  const next = useCallback(() => {
    let i: number;
    do {
      i = Math.floor(Math.random() * FUN_ITEMS.length);
    } while (i === index && FUN_ITEMS.length > 1);
    setIndex(i);
    setShowHint(false);
  }, [index]);

  const item = FUN_ITEMS[index];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Lightbulb className="size-4 text-amber-500" />
          课间小憩
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed">
          <span className="mr-1.5">{item.emoji}</span>
          {item.text}
        </p>
        {item.hint ? (
          <p
            role="button"
            tabIndex={0}
            onClick={() => setShowHint((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setShowHint((v) => !v);
            }}
            className="mt-1 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showHint ? `答案：${item.hint}` : "点击查看答案"}
          </p>
        ) : null}
        <button
          onClick={next}
          className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <RefreshCw className="size-3" />
          换一条
        </button>
      </CardContent>
    </Card>
  );
}