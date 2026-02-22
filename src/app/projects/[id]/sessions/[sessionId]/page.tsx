"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Calendar,
  Clock,
  Mic,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { QualityRadar } from "@/components/dashboard/QualityRadar";
import type { SessionDetail, InterviewSessionStatus } from "@/types";

const sessionStatusConfig: Record<
  InterviewSessionStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  PENDING: { label: "待機中", variant: "secondary" },
  IN_PROGRESS: { label: "進行中", variant: "default" },
  COMPLETED: { label: "完了", variant: "outline" },
  FAILED: { label: "失敗", variant: "destructive" },
  CANCELLED: { label: "キャンセル", variant: "secondary" },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SessionDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/interviews/${sessionId}`);
      if (!res.ok) throw new Error("セッションの取得に失敗しました");
      const data = await res.json();
      setSession(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "エラーが発生しました"
      );
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-6">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-6 w-48" />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <Skeleton className="h-[400px]" />
            <Skeleton className="h-[400px]" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center py-8">
            <p className="mb-4 text-red-500">
              {error || "セッションが見つかりません"}
            </p>
            <Link href={`/projects/${projectId}`}>
              <Button variant="outline">プロジェクトに戻る</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = sessionStatusConfig[session.status];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-6">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#1A1A2E] to-[#4A3AFF]">
              <Mic className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1A1A2E]">
                セッション結果
              </h1>
              <p className="text-xs text-muted-foreground">
                {session.respondent.name || "匿名の回答者"}
              </p>
            </div>
          </div>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* 回答者情報 & メタデータ */}
        <Card className="mb-6">
          <CardContent className="flex flex-wrap items-center gap-6 pt-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                <User className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <p className="font-semibold">
                  {session.respondent.name || "匿名"}
                </p>
                {session.respondent.email && (
                  <p className="text-xs text-muted-foreground">
                    {session.respondent.email}
                  </p>
                )}
              </div>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {formatDate(session.createdAt)}
            </div>
            {session.duration != null && (
              <>
                <Separator orientation="vertical" className="h-8" />
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {Math.floor(session.duration / 60)}分
                  {Math.round(session.duration % 60)}秒
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* 左カラム: 会話ログ + 分析サマリー */}
          <div className="space-y-6">
            {/* 会話ログ */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">会話ログ</CardTitle>
                <CardDescription>
                  {session.transcripts.length}件のメッセージ
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    {session.transcripts.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        会話ログがありません
                      </p>
                    ) : (
                      session.transcripts.map((transcript) => {
                        const isAI = transcript.speaker === "ai";
                        return (
                          <div
                            key={transcript.id}
                            className={`flex gap-3 ${isAI ? "" : "flex-row-reverse"}`}
                          >
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarFallback
                                className={
                                  isAI
                                    ? "bg-gradient-to-br from-[#1A1A2E] to-[#4A3AFF] text-white"
                                    : "bg-blue-100 text-blue-700"
                                }
                              >
                                {isAI ? (
                                  <Bot className="h-4 w-4" />
                                ) : (
                                  <User className="h-4 w-4" />
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <div
                              className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                                isAI
                                  ? "rounded-tl-sm bg-slate-100 text-slate-800"
                                  : "rounded-tr-sm bg-blue-600 text-white"
                              }`}
                            >
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {transcript.text}
                              </p>
                              {transcript.startTime > 0 && (
                                <p
                                  className={`mt-1 text-xs ${
                                    isAI
                                      ? "text-slate-400"
                                      : "text-blue-200"
                                  }`}
                                >
                                  {formatTime(transcript.startTime)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* AI分析サマリー */}
            {session.qualityScore?.summary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">AI分析サマリー</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">
                    {session.qualityScore.summary}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 右カラム: 品質スコア */}
          <div className="space-y-6">
            {session.qualityScore ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">品質スコア</CardTitle>
                </CardHeader>
                <CardContent>
                  <QualityRadar qualityScore={session.qualityScore} />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center py-8">
                  <p className="text-sm text-muted-foreground">
                    品質スコアは未算出です
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
