import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// POST /api/projects/generate-questions - タイトル・説明からインタビュー質問を自動生成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description } = body as {
      title: string;
      description?: string;
    };

    if (!title) {
      return NextResponse.json(
        { error: "タイトルは必須です" },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: 2048,
      system: `あなたはユーザーインタビューの質問設計の専門家です。
与えられた調査テーマに基づき、5分間のAIインタビューに最適な質問セットを生成してください。

## 質問設計のガイドライン
- 5〜7問程度が適切（5分間で深掘り含めて回答可能な量）
- 最初の質問はオープンで答えやすいものにする
- 徐々に核心に迫る質問構成にする
- 各質問には、回答が浅い場合に使う「深掘り指示」を付ける
- 「はい/いいえ」で終わる質問は避け、オープンクエスチョンにする
- 回答者の体験・感情・行動に焦点を当てる

## 出力形式
必ず以下のJSON配列で返してください。JSON以外のテキストは含めないでください。

\`\`\`json
[
  {
    "text": "質問文",
    "followUpPrompt": "深掘り指示（AIへの指示）"
  }
]
\`\`\``,
      messages: [
        {
          role: "user",
          content: `以下の調査テーマに対するインタビュー質問を生成してください。

## 調査タイトル
${title}

${description ? `## 調査の説明・目的\n${description}` : ""}

上記のテーマに最適な質問セット（5〜7問）をJSON形式で生成してください。`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // JSONパース
    const jsonMatch =
      text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\])/);

    if (!jsonMatch) {
      return NextResponse.json(
        { error: "質問の生成に失敗しました" },
        { status: 500 }
      );
    }

    const questions = JSON.parse(jsonMatch[1].trim()) as {
      text: string;
      followUpPrompt: string;
    }[];

    // バリデーション
    const validQuestions = questions
      .filter((q) => q.text && typeof q.text === "string")
      .map((q) => ({
        text: q.text.trim(),
        followUpPrompt:
          typeof q.followUpPrompt === "string"
            ? q.followUpPrompt.trim()
            : "",
      }));

    return NextResponse.json({ questions: validQuestions });
  } catch (error) {
    console.error("POST /api/projects/generate-questions error:", error);
    return NextResponse.json(
      { error: "質問の自動生成に失敗しました" },
      { status: 500 }
    );
  }
}
