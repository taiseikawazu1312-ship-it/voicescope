import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

type RouteParams = { params: Promise<{ sessionId: string }> };

// POST /api/interviews/:sessionId/start - インタビュー開始
export async function POST(request: NextRequest, { params }: RouteParams) {
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
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "セッションが見つかりません" },
        { status: 404 }
      );
    }

    if (session.status !== "PENDING") {
      return NextResponse.json(
        { error: "このセッションは既に開始されているか、完了しています" },
        { status: 400 }
      );
    }

    // セッションステータスをIN_PROGRESSに更新
    await prisma.aIInterviewSession.update({
      where: { id: sessionId },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });

    // AI初期メッセージを生成
    let message: string;
    try {
      // src/lib/ai/interviewer.ts が利用可能か試行
      const { AIInterviewer } = await import("@/lib/ai/interviewer");
      const interviewer = new AIInterviewer();
      const result = await interviewer.start(session);
      message = result.message;
    } catch {
      // フォールバック: Claude APIを直接呼び出し
      const anthropic = new Anthropic();
      const questionsText = session.project.questions
        .map((q, i) => `${i + 1}. ${q.text}`)
        .join("\n");

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: `あなたはユーザーインタビューを行うAIインタビュアーです。
プロジェクト「${session.project.title}」のインタビューを担当します。
${session.project.description ? `プロジェクト説明: ${session.project.description}` : ""}

質問リスト:
${questionsText}

あなたの役割:
- 回答者に親しみやすく話しかけ、リラックスした雰囲気を作る
- 質問を自然な会話の流れで投げかける
- 深掘りの質問で具体的なエピソードや感情を引き出す
- 日本語で会話する`,
        messages: [
          {
            role: "user",
            content:
              "インタビューの冒頭の挨拶と最初の質問をお願いします。回答者の名前は" +
              (session.respondent.name || "参加者") +
              "さんです。",
          },
        ],
      });

      const textBlock = response.content.find((block) => block.type === "text");
      message = textBlock ? textBlock.text : "こんにちは。インタビューを始めましょう。";
    }

    // AI発言をTranscriptに記録
    await prisma.transcript.create({
      data: {
        sessionId,
        speaker: "ai",
        text: message,
        startTime: 0,
        endTime: 0,
      },
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error("POST /api/interviews/[sessionId]/start error:", error);
    return NextResponse.json(
      { error: "インタビューの開始に失敗しました" },
      { status: 500 }
    );
  }
}
