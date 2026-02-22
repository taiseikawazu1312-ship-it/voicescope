"use client";

import { cn } from "@/lib/utils";

interface TimerProps {
  elapsedTime: number;
  totalTime: number; // 秒
  className?: string;
}

export function Timer({ elapsedTime, totalTime, className }: TimerProps) {
  const remaining = Math.max(0, totalTime - elapsedTime);
  const progress = Math.min((elapsedTime / totalTime) * 100, 100);
  const isWarning = remaining <= 60; // 残り1分で警告

  const minutes = Math.floor(remaining / 60);
  const seconds = Math.floor(remaining % 60);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {/* 残り時間表示 */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "font-mono text-2xl font-bold tabular-nums transition-colors",
            isWarning ? "text-red-400" : "text-white/90"
          )}
        >
          {minutes}:{seconds.toString().padStart(2, "0")}
        </span>
        <span className="text-sm text-white/40">
          / {Math.floor(totalTime / 60)}:{(totalTime % 60)
            .toString()
            .padStart(2, "0")}
        </span>
      </div>

      {/* プログレスバー */}
      <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000 ease-linear",
            isWarning
              ? "bg-gradient-to-r from-red-500 to-red-400"
              : "bg-gradient-to-r from-[#4A3AFF] to-[#7B68EE]"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
