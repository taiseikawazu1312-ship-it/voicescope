"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Lightbulb,
  Mic,
  Play,
  TrendingUp,
  Users,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionCard } from "@/components/dashboard/SessionCard";
import type {
  ProjectDetail,
  ProjectStatus,
  InterviewSessionStatus,
  CreateSessionResponse,
} from "@/types";

const statusConfig: Record<
  ProjectStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  DRAFT: { label: "下書き", variant: "secondary" },
  ACTIVE: { label: "実施中", variant: "default" },
  COMPLETED: { label: "完了", variant: "outline" },
  ARCHIVED: { label: "アーカイブ", variant: "secondary" },
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ダイアログ関連
  const [dialogOpen, setDialogOpen] = useState(false);
  const [respondentName, setRespondentName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("プロジェクトの取得に失敗しました");
      const data = await res.json();
      setProject(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "エラーが発生しました"
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleStartInterview = async () => {
    if (isCreating) return;
    setIsCreating(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: respondentName.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "セッションの作成に失敗しました");
      }

      const data: CreateSessionResponse = await res.json();
      setDialogOpen(false);
      router.push(`/interview/${data.token}`);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "セッションの作成に失敗しました"
      );
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-6 w-48" />
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-0">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent>
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center py-8">
            <p className="mb-4 text-red-500">{error || "プロジェクトが見つかりません"}</p>
            <Link href="/dashboard">
              <Button variant="outline">ダッシュボードに戻る</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = statusConfig[project.status];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
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
                  {project.title}
                </h1>
              </div>
            </div>
            <Badge variant={config.variant}>{config.label}</Badge>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-[#1A1A2E] to-[#4A3AFF] text-white hover:opacity-90">
                <Play className="h-4 w-4" />
                新規インタビュー開始
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新規インタビューを開始</DialogTitle>
                <DialogDescription>
                  回答者の名前を入力してください（任意）
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="respondentName">回答者名</Label>
                  <Input
                    id="respondentName"
                    placeholder="例: 田中太郎"
                    value={respondentName}
                    onChange={(e) => setRespondentName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleStartInterview();
                    }}
                    autoFocus
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  キャンセル
                </Button>
                <Button
                  onClick={handleStartInterview}
                  disabled={isCreating}
                  className="bg-gradient-to-r from-[#1A1A2E] to-[#4A3AFF] text-white"
                >
                  {isCreating ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      作成中...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      開始
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* プロジェクト説明 */}
        {project.description && (
          <p className="mb-6 text-sm text-muted-foreground">
            {project.description}
          </p>
        )}

        {/* メトリクスカード */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 pt-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">完了セッション</p>
                <p className="text-2xl font-bold">
                  {project.stats.completedSessions}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    / {project.stats.totalSessions}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">平均品質スコア</p>
                <p className="text-2xl font-bold">
                  {project.stats.averageScore != null
                    ? project.stats.averageScore.toFixed(1)
                    : "--"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
                <Lightbulb className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">質問数</p>
                <p className="text-2xl font-bold">
                  {project.questions.length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* セッション一覧 */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            セッション一覧
          </h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            品質スコア順
          </div>
        </div>

        {project.aiSessions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <Mic className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-700">
                まだセッションがありません
              </h3>
              <p className="mb-6 text-center text-sm text-muted-foreground">
                「新規インタビュー開始」ボタンからAIインタビューを始めましょう
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {project.aiSessions
              .sort((a, b) => {
                const scoreA = a.qualityScore?.overallScore ?? -1;
                const scoreB = b.qualityScore?.overallScore ?? -1;
                return scoreB - scoreA;
              })
              .map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  projectId={projectId}
                />
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
