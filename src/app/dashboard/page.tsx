import Link from "next/link";
import { Plus, Mic, BarChart3, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectListItem, ProjectStatus } from "@/types";

const statusConfig: Record<
  ProjectStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  DRAFT: { label: "下書き", variant: "secondary" },
  ACTIVE: { label: "実施中", variant: "default" },
  COMPLETED: { label: "完了", variant: "outline" },
  ARCHIVED: { label: "アーカイブ", variant: "secondary" },
};

async function getProjects(): Promise<ProjectListItem[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/projects`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch projects");
    return res.json();
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const projects = await getProjects();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#1A1A2E] to-[#4A3AFF]">
              <Mic className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#1A1A2E]">
              VoiceScope
            </h1>
          </div>
          <Link href="/projects/new">
            <Button className="bg-gradient-to-r from-[#1A1A2E] to-[#4A3AFF] text-white hover:opacity-90">
              <Plus className="h-4 w-4" />
              新規調査
            </Button>
          </Link>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* 統計カード */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 pt-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">総プロジェクト数</p>
                <p className="text-2xl font-bold">{projects.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50">
                <Mic className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">総セッション数</p>
                <p className="text-2xl font-bold">
                  {projects.reduce((sum, p) => sum + p.sessionCount, 0)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">平均品質スコア</p>
                <p className="text-2xl font-bold">
                  {(() => {
                    const scores = projects
                      .map((p) => p.averageScore)
                      .filter((s): s is number => s != null);
                    if (scores.length === 0) return "--";
                    return (
                      scores.reduce((a, b) => a + b, 0) / scores.length
                    ).toFixed(1);
                  })()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* プロジェクト一覧 */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">プロジェクト一覧</h2>
        </div>

        {projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <Mic className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-700">
                まだプロジェクトがありません
              </h3>
              <p className="mb-6 text-sm text-muted-foreground">
                最初のAIインタビュー調査を作成しましょう
              </p>
              <Link href="/projects/new">
                <Button className="bg-gradient-to-r from-[#1A1A2E] to-[#4A3AFF] text-white">
                  <Plus className="h-4 w-4" />
                  新規調査を作成
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const config = statusConfig[project.status];
              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{project.title}</CardTitle>
                        <Badge variant={config.variant}>{config.label}</Badge>
                      </div>
                      {project.description && (
                        <CardDescription className="line-clamp-2">
                          {project.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Mic className="h-4 w-4" />
                          <span>{project.sessionCount} セッション</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {project.averageScore != null
                              ? project.averageScore.toFixed(1)
                              : "--"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// ローディング用のスケルトン
export function DashboardSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-12" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
