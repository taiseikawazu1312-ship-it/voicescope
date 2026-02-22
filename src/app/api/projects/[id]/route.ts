import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/projects/:id - プロジェクト詳細
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
        },
        aiSessions: {
          include: {
            respondent: true,
            qualityScore: {
              select: { overallScore: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "プロジェクトが見つかりません" },
        { status: 404 }
      );
    }

    // 統計情報を計算
    const totalSessions = project.aiSessions.length;
    const completedSessions = project.aiSessions.filter(
      (s) => s.status === "COMPLETED"
    ).length;
    const scores = project.aiSessions
      .map((s) => s.qualityScore?.overallScore)
      .filter((s): s is number => s != null);
    const avgScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null;

    return NextResponse.json({
      ...project,
      stats: {
        totalSessions,
        completedSessions,
        averageScore: avgScore,
      },
    });
  } catch (error) {
    console.error("GET /api/projects/[id] error:", error);
    return NextResponse.json(
      { error: "プロジェクト詳細の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/:id - プロジェクト更新
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, status } = body as {
      title?: string;
      description?: string;
      status?: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
    };

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "プロジェクトが見つかりません" },
        { status: 404 }
      );
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
      },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("PATCH /api/projects/[id] error:", error);
    return NextResponse.json(
      { error: "プロジェクトの更新に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/:id - プロジェクト削除
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "プロジェクトが見つかりません" },
        { status: 404 }
      );
    }

    await prisma.project.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/projects/[id] error:", error);
    return NextResponse.json(
      { error: "プロジェクトの削除に失敗しました" },
      { status: 500 }
    );
  }
}
