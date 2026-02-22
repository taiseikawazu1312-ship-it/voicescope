"use client";

import { useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { InterviewMessage } from "@/types";

interface TranscriptPanelProps {
  messages: InterviewMessage[];
  className?: string;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TranscriptPanel({ messages, className }: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 最新メッセージへの自動スクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-white/80">会話履歴</h3>
        <span className="text-xs text-white/50">{messages.length}件</span>
      </div>
      <ScrollArea className="h-[calc(100vh-120px)] rounded-xl bg-white/5 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/30">
              会話が始まると、ここに表示されます
            </p>
          ) : (
            messages.map((msg) => {
              const isAI = msg.speaker === "ai";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${isAI ? "" : "flex-row-reverse"}`}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback
                      className={
                        isAI
                          ? "bg-gradient-to-br from-purple-600 to-blue-600 text-white text-xs"
                          : "bg-white/20 text-white text-xs"
                      }
                    >
                      {isAI ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 ${
                      isAI
                        ? "rounded-tl-sm bg-white/10 text-white/90"
                        : "rounded-tr-sm bg-blue-500/30 text-white/90"
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.text}
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      {formatTimestamp(msg.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
