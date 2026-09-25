/**
 * JSDOM 环境初始化 —— 在所有测试导入之前跑。
 *
 * ESM 中 import 先于模块体执行，`globalThis.document = ...` 写在测试
 * 文件里时 @testing-library/react 已经读过了（为 undefined）。
 * 用 --import 让这个文件在所有模块加载前注入。
 */

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost:3000",
});

globalThis.document = dom.window.document;
globalThis.window = dom.window;
globalThis.localStorage = dom.window.localStorage;
globalThis.sessionStorage = dom.window.sessionStorage;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLButtonElement = dom.window.HTMLButtonElement;
globalThis.HTMLDivElement = dom.window.HTMLDivElement;
globalThis.HTMLParagraphElement = dom.window.HTMLParagraphElement;
globalThis.HTMLHeadingElement = dom.window.HTMLHeadingElement;
globalThis.HTMLSpanElement = dom.window.HTMLSpanElement;
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
globalThis.HTMLLabelElement = dom.window.HTMLLabelElement;
globalThis.Node = dom.window.Node;
globalThis.Text = dom.window.Text;
globalThis.Element = dom.window.Element;
globalThis.Event = dom.window.Event;
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.DocumentFragment = dom.window.DocumentFragment;
globalThis.SVGElement = dom.window.SVGElement;
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.FocusEvent = dom.window.FocusEvent;
globalThis.Range = dom.window.Range;
globalThis.getSelection = dom.window.getSelection.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// fetch 模拟（测试中不调真实网络）
globalThis.fetch = (async (url) => {
  const urlStr = String(url);
  if (urlStr.includes("/api/module-content")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ content: "# 测试概念页\n\n正文内容用于验证渲染。" }),
    };
  }
  return { ok: false, status: 404, json: async () => ({}) };
});