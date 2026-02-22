"use client";

import { cn } from "@/lib/utils";

interface AIAvatarProps {
  state: "idle" | "speaking" | "listening";
  className?: string;
}

export function AIAvatar({ state, className }: AIAvatarProps) {
  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {/* 波紋エフェクト (speaking時) */}
      {state === "speaking" && (
        <>
          <div className="absolute h-full w-full rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 animate-avatar-ripple" />
          <div
            className="absolute h-full w-full rounded-full bg-gradient-to-br from-purple-500/15 to-blue-500/15 animate-avatar-ripple"
            style={{ animationDelay: "0.5s" }}
          />
          <div
            className="absolute h-full w-full rounded-full bg-gradient-to-br from-purple-500/10 to-blue-500/10 animate-avatar-ripple"
            style={{ animationDelay: "1s" }}
          />
        </>
      )}

      {/* メインのアバター円 */}
      <div
        className={cn(
          "relative flex h-40 w-40 items-center justify-center rounded-full md:h-48 md:w-48",
          "bg-gradient-to-br from-[#4A3AFF] via-[#7B68EE] to-[#9B59B6]",
          "shadow-[0_0_60px_rgba(74,58,255,0.3)]",
          state === "idle" && "animate-avatar-breathe",
          state === "speaking" && "",
          state === "listening" && "animate-avatar-pulse"
        )}
      >
        {/* 内側のリング */}
        <div className="absolute inset-2 rounded-full border-2 border-white/20" />

        {/* AIアイコン */}
        <div className="flex flex-col items-center gap-1">
          {/* 音声波形風のアイコン */}
          <div className="flex items-end gap-1">
            {[...Array(5)].map((_, i) => {
              const heights =
                state === "speaking"
                  ? [16, 28, 36, 28, 16]
                  : state === "listening"
                    ? [12, 20, 28, 20, 12]
                    : [8, 12, 16, 12, 8];
              return (
                <div
                  key={i}
                  className={cn(
                    "w-1.5 rounded-full bg-white/80 transition-all duration-300",
                    state === "speaking" && "animate-pulse"
                  )}
                  style={{
                    height: `${heights[i]}px`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              );
            })}
          </div>
          <span className="mt-2 text-xs font-medium text-white/70">
            {state === "idle" && "AI"}
            {state === "speaking" && "発話中"}
            {state === "listening" && "聞いています"}
          </span>
        </div>
      </div>

      {/* 外側のグロー */}
      <div
        className={cn(
          "absolute -inset-4 rounded-full transition-opacity duration-500",
          "bg-gradient-to-br from-purple-500/5 to-blue-500/5 blur-xl",
          state === "speaking" ? "opacity-100" : "opacity-50"
        )}
      />
    </div>
  );
}
