"use client";

import Link from "next/link";
import { Calendar, Star, User } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SessionWithRelations, InterviewSessionStatus } from "@/types";

const sessionStatusConfig: Record<
  InterviewSessionStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; color: string }
> = {
  PENDING: { label: "待機中", variant: "secondary", color: "text-slate-500" },
  IN_PROGRESS: { label: "進行中", variant: "default", color: "text-blue-600" },
  COMPLETED: { label: "完了", variant: "outline", color: "text-green-600" },
  FAILED: { label: "失敗", variant: "destructive", color: "text-red-600" },
  CANCELLED: { label: "キャンセル", variant: "secondary", color: "text-slate-400" },
};

function getScoreColor(score: number): string {
  if (score >= 4) return "text-green-600 bg-green-50";
  if (score >= 3) return "text-blue-600 bg-blue-50";
  if (score >= 2) return "text-amber-600 bg-amber-50";
  return "text-red-600 bg-red-50";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface SessionCardProps {
  session: SessionWithRelations;
  projectId: string;
}

export function SessionCard({ session, projectId }: SessionCardProps) {
  const config = sessionStatusConfig[session.status];
  const score = session.qualityScore?.overallScore;

  return (
    <Link href={`/projects/${projectId}/sessions/${session.id}`}>
      <Card className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                <User className="h-4 w-4 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {session.respondent.name || "匿名"}
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDate(session.createdAt)}
                </div>
              </div>
            </div>
            <Badge variant={config.variant}>{config.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            {score != null ? (
              <div
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold ${getScoreColor(score)}`}
              >
                <Star className="h-4 w-4" />
                {score.toFixed(1)}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                スコア未算出
              </span>
            )}
            {session.duration != null && (
              <span className="text-xs text-muted-foreground">
                {Math.floor(session.duration / 60)}分{session.duration % 60}秒
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
