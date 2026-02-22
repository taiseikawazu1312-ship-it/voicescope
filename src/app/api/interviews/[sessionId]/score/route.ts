import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

type RouteParams = { params: Promise<{ sessionId: string }> };

// POST /api/interviews/:sessionId/score - インタビュー品質スコアリング
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;

    const session = await prisma.aIInterviewSession.findUnique({
      where: { id: sessionId },
      include: {
        project: true,
        transcripts: {
          orderBy: { startTime: "asc" },
        },
        qualityScore: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "セッションが見つかりません" },
        { status: 404 }
      );
    }

    if (session.transcripts.length === 0) {
      return NextResponse.json(
        { error: "トランスクリプトがありません" },
        { status: 400 }
      );
    }

    // 既にスコアがある場合は上書き警告
    if (session.qualityScore) {
      await prisma.qualityScore.delete({
        where: { id: session.qualityScore.id },
      });
    }

    // スコアリング実行
    let scoreResult: {
      overallScore: number;
      specificityScore: number;
      depthScore: number;
      consistencyScore: number;
      informationScore: number;
      uniquenessScore: number;
      summary: string;
    };

    try {
      // src/lib/ai/quality-scorer.ts が利用可能か試行
      const { calculateQualityScore } = await import(
        "@/lib/ai/quality-scorer"
      );
      const conversationHistory = session.transcripts.map((t) => ({
        role: t.speaker as "ai" | "respondent",
        content: t.text,
        timestamp: t.startTime,
      }));
      scoreResult = await calculateQualityScore(conversationHistory, {
        title: session.project.title,
        description: session.project.description ?? undefined,
      });
    } catch {
      // フォールバック: Claude APIで直接スコアリング
      const anthropic = new Anthropic();

      const transcriptText = session.transcripts
        .map((t) => `[${t.speaker}] ${t.text}`)
        .join("\n");

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `あなたはインタビュー品質の評価者です。
以下のインタビューのトランスクリプトを分析し、品質スコアを算出してください。

各スコアは0.0〜1.0の範囲で評価してください：
- specificityScore: 回答の具体性（具体的な数字、事例、エピソードが含まれているか）
- depthScore: 回答の深さ（表面的でなく、本質的な意見や感情が引き出せているか）
- consistencyScore: 一貫性（回答に矛盾がないか、論理的に一貫しているか）
- informationScore: 情報量（十分な情報が得られているか）
- uniquenessScore: ユニークさ（独自の視点や予想外の発見があるか）

必ず以下のJSON形式で出力してください（他のテキストは不要）：
{
  "specificityScore": 0.0,
  "depthScore": 0.0,
  "consistencyScore": 0.0,
  "informationScore": 0.0,
  "uniquenessScore": 0.0,
  "summary": "総合評価の要約（日本語で2-3文）"
}`,
        messages: [
          {
            role: "user",
            content: `プロジェクト「${session.project.title}」のインタビュートランスクリプト:\n\n${transcriptText}`,
          },
        ],
      });

      const textBlock = response.content.find(
        (block) => block.type === "text"
      );
      const responseText = textBlock?.text ?? "{}";

      // JSONをパース（コードブロックで囲まれている場合も考慮）
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);

      scoreResult = {
        specificityScore: Math.min(1, Math.max(0, parsed.specificityScore ?? 0)),
        depthScore: Math.min(1, Math.max(0, parsed.depthScore ?? 0)),
        consistencyScore: Math.min(1, Math.max(0, parsed.consistencyScore ?? 0)),
        informationScore: Math.min(1, Math.max(0, parsed.informationScore ?? 0)),
        uniquenessScore: Math.min(1, Math.max(0, parsed.uniquenessScore ?? 0)),
        summary: parsed.summary ?? "",
        overallScore: 0, // 下で計算
      };

      // overallScoreを各スコアの加重平均で算出
      scoreResult.overallScore =
        scoreResult.specificityScore * 0.25 +
        scoreResult.depthScore * 0.25 +
        scoreResult.consistencyScore * 0.15 +
        scoreResult.informationScore * 0.2 +
        scoreResult.uniquenessScore * 0.15;
    }

    // QualityScoreレコードを作成
    const qualityScore = await prisma.qualityScore.create({
      data: {
        sessionId,
        overallScore: scoreResult.overallScore,
        specificityScore: scoreResult.specificityScore,
        depthScore: scoreResult.depthScore,
        consistencyScore: scoreResult.consistencyScore,
        informationScore: scoreResult.informationScore,
        uniquenessScore: scoreResult.uniquenessScore,
        summary: scoreResult.summary,
      },
    });

    // セッションをCOMPLETEDに更新（まだの場合）
    if (session.status !== "COMPLETED") {
      await prisma.aIInterviewSession.update({
        where: { id: sessionId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });
    }

    return NextResponse.json(qualityScore);
  } catch (error) {
    console.error("POST /api/interviews/[sessionId]/score error:", error);
    return NextResponse.json(
      { error: "品質スコアリングに失敗しました" },
      { status: 500 }
    );
  }
}
