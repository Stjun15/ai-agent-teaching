"use client";

import * as React from "react";

/**
 * 设置页的两块外壳：一节设置、一行「名称 + 值」。
 *
 * 单独成文件的原因很实在：设置页的正文（四个区块）已经贴着提交粒度上限，
 * 而这两个是纯排版件 —— 给什么画什么，与设置内容无关。
 */
export function SettingsSection({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description: string;
  /** 右上角的状态徽标（可用 / 只读 / 未接入）。 */
  badge: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {badge}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

/** 一行「名称 + 值」。用在 `<dl>` 里，所以返回的是 `dt` / `dd` 两个元素。 */
export function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all">{children}</dd>
    </>
  );
}
