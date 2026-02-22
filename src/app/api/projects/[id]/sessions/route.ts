import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/projects/:id/sessions - セッション一覧（品質スコア順、respondent情報含む）
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json(
        { error: "プロジェクトが見つかりません" },
        { status: 404 }
      );
    }

    const sessions = await prisma.aIInterviewSession.findMany({
      where: { projectId: id },
      include: {
        respondent: true,
        qualityScore: true,
        _count: {
          select: { transcripts: true },
        },
      },
      orderBy: [
        { qualityScore: { overallScore: "desc" } },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error("GET /api/projects/[id]/sessions error:", error);
    return NextResponse.json(
      { error: "セッション一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST /api/projects/:id/sessions - 新規セッション作成
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, metadata } = body as {
      name?: string;
      email?: string;
      metadata?: Record<string, unknown>;
    };

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json(
        { error: "プロジェクトが見つかりません" },
        { status: 404 }
      );
    }

    // respondentを作成
    const respondent = await prisma.respondent.create({
      data: {
        name,
        email,
        metadata: metadata ? (metadata as Record<string, string>) : undefined,
      },
    });

    // セッションを作成（ユニークなトークンを生成）
    const token = randomBytes(32).toString("hex");
    const session = await prisma.aIInterviewSession.create({
      data: {
        projectId: id,
        respondentId: respondent.id,
        token,
      },
      include: {
        respondent: true,
      },
    });

    return NextResponse.json(
      {
        sessionId: session.id,
        token: session.token,
        respondent: session.respondent,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects/[id]/sessions error:", error);
    return NextResponse.json(
      { error: "セッションの作成に失敗しました" },
      { status: 500 }
    );
  }
}
