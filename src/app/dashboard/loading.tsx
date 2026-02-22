import { Mic } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
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
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* 統計カード */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 pt-0">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-12" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* プロジェクト一覧ヘッダー */}
        <div className="mb-6">
          <Skeleton className="h-6 w-32" />
        </div>

        {/* プロジェクトカード */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
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
      </main>
    </div>
  );
}
