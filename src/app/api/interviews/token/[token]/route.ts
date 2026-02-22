import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ token: string }> };

// GET /api/interviews/token/:token - トークンからセッション情報を取得
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    const session = await prisma.aIInterviewSession.findUnique({
      where: { token },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
        respondent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "無効なインタビューリンクです" },
        { status: 404 }
      );
    }

    if (session.status === "COMPLETED") {
      return NextResponse.json(
        {
          error: "このインタビューは既に完了しています",
          sessionStatus: "COMPLETED",
        },
        { status: 410 }
      );
    }

    if (session.status === "CANCELLED" || session.status === "FAILED") {
      return NextResponse.json(
        {
          error: "このインタビューは無効です",
          sessionStatus: session.status,
        },
        { status: 410 }
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      token: session.token,
      status: session.status,
      project: session.project,
      respondent: session.respondent,
    });
  } catch (error) {
    console.error("GET /api/interviews/token/[token] error:", error);
    return NextResponse.json(
      { error: "セッション情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}
