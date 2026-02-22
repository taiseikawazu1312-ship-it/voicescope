import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ sessionId: string }> };

// GET /api/interviews/:sessionId - セッション詳細
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;

    const session = await prisma.aIInterviewSession.findUnique({
      where: { id: sessionId },
      include: {
        project: {
          include: {
            questions: {
              orderBy: { orderIndex: "asc" },
            },
          },
        },
        respondent: true,
        transcripts: {
          orderBy: { startTime: "asc" },
        },
        qualityScore: true,
        recording: true,
        emotions: {
          orderBy: { timestamp: "asc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "セッションが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error("GET /api/interviews/[sessionId] error:", error);
    return NextResponse.json(
      { error: "セッション詳細の取得に失敗しました" },
      { status: 500 }
    );
  }
}
