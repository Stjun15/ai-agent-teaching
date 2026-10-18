"use client";

import { useEffect, useState } from "react";
import { Copy, Globe, Check } from "lucide-react";

export function TunnelUrlBadge() {
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/tunnel-url.txt")
      .then((res) => {
        if (!res.ok) return null;
        return res.text();
      })
      .then((text) => {
        if (text && text.startsWith("https://")) {
          setTunnelUrl(text.trim());
        }
      })
      .catch(() => {});
  }, []);

  const handleCopy = async () => {
    if (!tunnelUrl) return;
    try {
      await navigator.clipboard.writeText(tunnelUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text manually
    }
  };

  if (!tunnelUrl) return null;

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-xs">
      <Globe className="size-3 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">公网：</span>
      <a
        href={tunnelUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-primary hover:underline truncate max-w-[280px]"
      >
        {tunnelUrl.replace("https://", "")}
      </a>
      <button
        onClick={handleCopy}
        className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        title="复制地址"
      >
        {copied ? (
          <Check className="size-3 text-green-500" />
        ) : (
          <Copy className="size-3" />
        )}
      </button>
    </div>
  );
}