import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ sessionId: string }> };

// POST /api/interviews/:sessionId/complete - セッション完了
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;

    const session = await prisma.aIInterviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: "セッションが見つかりません" },
        { status: 404 }
      );
    }

    if (session.status === "COMPLETED") {
      return NextResponse.json(
        { error: "このセッションは既に完了しています" },
        { status: 400 }
      );
    }

    // duration計算（startedAtがある場合）
    const now = new Date();
    const duration = session.startedAt
      ? Math.floor((now.getTime() - session.startedAt.getTime()) / 1000)
      : null;

    await prisma.aIInterviewSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        completedAt: now,
        duration,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/interviews/[sessionId]/complete error:", error);
    return NextResponse.json(
      { error: "セッションの完了に失敗しました" },
      { status: 500 }
    );
  }
}
