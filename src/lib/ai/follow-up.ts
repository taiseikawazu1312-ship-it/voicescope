/**
 * 深掘り判定ロジック
 *
 * 回答者の応答を分析し、さらに深掘りすべきかどうかを判定する。
 * Claude APIを使って回答の具体性・感情・矛盾・新テーマを検出する。
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ConversationMessage } from "./interviewer";

// ============================================================
// 型定義
// ============================================================

export type FollowUpReason =
  | "low_specificity"
  | "emotional_reaction"
  | "contradiction"
  | "new_theme"
  | "sufficient";

export interface FollowUpDecision {
  /** 深掘りすべきかどうか */
  shouldFollowUp: boolean;
  /** 判定理由 */
  reason: FollowUpReason;
  /** 推奨される深掘りアプローチ */
  suggestedApproach?: string;
}

// ============================================================
// Claude APIクライアント
// ============================================================

function getClient(): Anthropic {
  return new Anthropic();
}

// ============================================================
// 深掘り判定プロンプト
// ============================================================

const FOLLOW_UP_ANALYSIS_PROMPT = `あなたはインタビュー分析の専門家です。回答者の応答を分析し、深掘りすべきかどうかを判定してください。

## 判定基準

### 深掘りすべきケース
1. **low_specificity（具体性不足）**: 回答が抽象的・一般的で、具体的なエピソード・数値・固有名詞がない
2. **emotional_reaction（感情反応）**: 強い感情（驚き、不満、喜び、戸惑い）が含まれており、その背景を掘り下げる価値がある
3. **contradiction（矛盾）**: 過去の発言と矛盾する内容が含まれている
4. **new_theme（新テーマ）**: 質問の範囲を超えた新しい興味深いテーマが出てきた

### 深掘り不要のケース
5. **sufficient（十分）**: 具体的で詳細な回答が得られており、これ以上の深掘りは不要

## 応答形式
必ず以下のJSON形式で回答してください。JSON以外のテキストは含めないでください。

\`\`\`json
{
  "shouldFollowUp": true,
  "reason": "low_specificity",
  "suggestedApproach": "具体的なエピソードを聞く質問を提案"
}
\`\`\``;

// ============================================================
// メイン関数
// ============================================================

/**
 * 回答者の応答を分析して、深掘りすべきかを判定する。
 *
 * @param userResponse - 回答者の最新の応答テキスト
 * @param conversationHistory - これまでの会話履歴
 * @param currentQuestion - 現在聞いている質問
 * @returns 深掘り判定結果
 */
export async function analyzeForFollowUp(
  userResponse: string,
  conversationHistory: ConversationMessage[],
  currentQuestion: string
): Promise<FollowUpDecision> {
  const client = getClient();

  // 会話履歴を文字列化
  const historyText = conversationHistory
    .map((msg) => {
      const speaker = msg.role === "ai" ? "インタビュアー" : "回答者";
      return `${speaker}: ${msg.content}`;
    })
    .join("\n");

  const userContent = `## 現在の質問
${currentQuestion}

## 会話履歴
${historyText}

## 回答者の最新の応答
${userResponse}

上記の情報を基に、この回答に対して深掘りすべきかを判定してください。`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: FOLLOW_UP_ANALYSIS_PROMPT,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    return parseFollowUpResponse(text);
  } catch (error) {
    console.error("[FollowUp] Claude API呼び出しエラー:", error);
    // エラー時はデフォルトで深掘りしない
    return {
      shouldFollowUp: false,
      reason: "sufficient",
      suggestedApproach: undefined,
    };
  }
}

// ============================================================
// レスポンスパーサー
// ============================================================

/**
 * Claude APIのレスポンスからFollowUpDecisionを抽出する。
 * JSONパースに失敗した場合はフォールバック値を返す。
 */
function parseFollowUpResponse(text: string): FollowUpDecision {
  try {
    // JSONブロックを抽出（```json ... ``` またはプレーンJSON）
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) {
      console.warn("[FollowUp] JSONを検出できませんでした:", text);
      return {
        shouldFollowUp: false,
        reason: "sufficient",
      };
    }

    const parsed = JSON.parse(jsonMatch[1].trim());

    // バリデーション
    const validReasons: FollowUpReason[] = [
      "low_specificity",
      "emotional_reaction",
      "contradiction",
      "new_theme",
      "sufficient",
    ];

    const reason = validReasons.includes(parsed.reason)
      ? (parsed.reason as FollowUpReason)
      : "sufficient";

    return {
      shouldFollowUp: Boolean(parsed.shouldFollowUp),
      reason,
      suggestedApproach: parsed.suggestedApproach || undefined,
    };
  } catch (error) {
    console.error("[FollowUp] レスポンスパースエラー:", error);
    return {
      shouldFollowUp: false,
      reason: "sufficient",
    };
  }
}
