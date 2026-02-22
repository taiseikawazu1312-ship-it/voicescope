import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/projects - プロジェクト一覧取得（sessions数、平均スコア含む）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where = status ? { status: status as "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED" } : {};

    const projects = await prisma.project.findMany({
      where,
      include: {
        _count: {
          select: { aiSessions: true },
        },
        aiSessions: {
          include: {
            qualityScore: {
              select: { overallScore: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = projects.map((project) => {
      const scores = project.aiSessions
        .map((s) => s.qualityScore?.overallScore)
        .filter((s): s is number => s != null);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { aiSessions, ...rest } = project;
      return {
        ...rest,
        sessionCount: project._count.aiSessions,
        averageScore: avgScore,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json(
      { error: "プロジェクト一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST /api/projects - プロジェクト新規作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, questions } = body as {
      title: string;
      description?: string;
      questions?: { text: string; followUpPrompt?: string }[];
    };

    if (!title) {
      return NextResponse.json(
        { error: "タイトルは必須です" },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        title,
        description,
        questions: questions
          ? {
              create: questions.map((q, index) => ({
                text: q.text,
                orderIndex: index,
                followUpPrompt: q.followUpPrompt,
              })),
            }
          : undefined,
      },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json(
      { error: "プロジェクトの作成に失敗しました" },
      { status: 500 }
    );
  }
}
