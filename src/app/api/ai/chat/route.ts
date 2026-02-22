import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

// POST /api/ai/chat - AIチャット（インタビュー応答）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, message, turnCount, elapsedSeconds } = body as {
      sessionId: string;
      message: string;
      turnCount?: number;
      elapsedSeconds?: number;
    };

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: "sessionIdとmessageは必須です" },
        { status: 400 }
      );
    }

    // セッション情報と会話履歴を取得
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
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "セッションが見つかりません" },
        { status: 404 }
      );
    }

    if (session.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "このセッションは進行中ではありません" },
        { status: 400 }
      );
    }

    // respondent発言をTranscriptに記録
    const currentTime = elapsedSeconds ?? 0;
    await prisma.transcript.create({
      data: {
        sessionId,
        speaker: "respondent",
        text: message,
        startTime: currentTime,
        endTime: currentTime,
      },
    });

    // AI応答を生成
    let aiMessage: string;
    let isFollowUp = false;
    let shouldEnd = false;
    let currentPhase = "questioning";

    try {
      // src/lib/ai/interviewer.ts が利用可能か試行
      const { AIInterviewer } = await import("@/lib/ai/interviewer");
      const interviewer = new AIInterviewer();
      const result = await interviewer.respond({
        session,
        message,
        turnCount: turnCount ?? session.turnCount,
        elapsedSeconds: elapsedSeconds ?? 0,
      });
      aiMessage = result.message;
      isFollowUp = result.isFollowUp ?? false;
      shouldEnd = result.shouldEnd ?? false;
      currentPhase = result.currentPhase ?? "questioning";
    } catch {
      // フォールバック: Claude APIを直接呼び出し
      const anthropic = new Anthropic();
      const questionsText = session.project.questions
        .map((q, i) => `${i + 1}. ${q.text}`)
        .join("\n");
      const totalQuestions = session.project.questions.length;
      const currentTurn = turnCount ?? session.turnCount;

      // 会話履歴をメッセージ形式に変換
      const conversationHistory = session.transcripts.map((t) => ({
        role: t.speaker === "ai" ? ("assistant" as const) : ("user" as const),
        content: t.text,
      }));

      // 現在のユーザー発言を追加
      conversationHistory.push({
        role: "user" as const,
        content: message,
      });

      // インタビュー終了判定
      const maxTurns = totalQuestions * 3 + 2; // 質問数 x 3ターン + 開始・終了
      shouldEnd = currentTurn >= maxTurns || (elapsedSeconds ?? 0) > 1800; // 30分超過

      if (shouldEnd) {
        currentPhase = "closing";
      } else if (currentTurn <= 1) {
        currentPhase = "opening";
      } else {
        currentPhase = "questioning";
      }

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        system: `あなたはユーザーインタビューを行うAIインタビュアーです。
プロジェクト「${session.project.title}」のインタビューを担当しています。
${session.project.description ? `プロジェクト説明: ${session.project.description}` : ""}

質問リスト:
${questionsText}

現在のフェーズ: ${currentPhase}
ターン数: ${currentTurn + 1} / 最大${maxTurns}
経過時間: ${Math.floor((elapsedSeconds ?? 0) / 60)}分

インタビューのルール:
- 回答者の発言を受けて、適切にリアクションし次の質問や深掘りを行う
- 具体的なエピソードや数字を引き出すよう深掘りする
- 自然な会話の流れを維持する
- ${shouldEnd ? "インタビューの締めくくりの言葉を述べてください。お礼と感想を伝えてください。" : "まだ聞いていない質問があれば次の質問に移る"}
- 日本語で会話する
- 回答は簡潔に（200文字以内を目安に）`,
        messages: conversationHistory,
      });

      const textBlock = response.content.find((block) => block.type === "text");
      aiMessage = textBlock ? textBlock.text : "なるほど、ありがとうございます。";

      // フォローアップ判定（簡易）
      isFollowUp = aiMessage.includes("具体的") || aiMessage.includes("もう少し") || aiMessage.includes("例えば");
    }

    // AI発言をTranscriptに記録
    await prisma.transcript.create({
      data: {
        sessionId,
        speaker: "ai",
        text: aiMessage,
        startTime: currentTime,
        endTime: currentTime,
      },
    });

    // turnCountを更新
    const updatedSession = await prisma.aIInterviewSession.update({
      where: { id: sessionId },
      data: {
        turnCount: { increment: 1 },
        ...(shouldEnd && {
          status: "COMPLETED",
          completedAt: new Date(),
          duration: elapsedSeconds ?? null,
        }),
      },
    });

    return NextResponse.json({
      message: aiMessage,
      isFollowUp,
      shouldEnd,
      currentPhase,
      turnCount: updatedSession.turnCount,
    });
  } catch (error) {
    console.error("POST /api/ai/chat error:", error);
    return NextResponse.json(
      { error: "AI応答の生成に失敗しました" },
      { status: 500 }
    );
  }
}
