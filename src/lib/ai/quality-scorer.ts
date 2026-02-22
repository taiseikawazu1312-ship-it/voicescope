/**
 * 品質スコアリングモジュール
 *
 * インタビューセッション全体の会話履歴を分析し、
 * 5軸で品質を評価してスコアを算出する。
 *
 * 5軸評価（各0-5）:
 *   - 具体性 (25%): エピソード・数値・固有名詞の含有率
 *   - 深さ   (25%): 「なぜ」に対する掘り下げ度合い
 *   - 一貫性 (20%): 回答間の論理的整合性
 *   - 情報量 (15%): 文字数・情報密度
 *   - 独自性 (15%): 他にない視点・経験
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ConversationMessage } from "./interviewer";

// ============================================================
// 型定義
// ============================================================

export interface QualityScoreResult {
  /** 総合スコア (0-5) */
  overallScore: number;
  /** 具体性スコア (0-5) */
  specificityScore: number;
  /** 深さスコア (0-5) */
  depthScore: number;
  /** 一貫性スコア (0-5) */
  consistencyScore: number;
  /** 情報量スコア (0-5) */
  informationScore: number;
  /** 独自性スコア (0-5) */
  uniquenessScore: number;
  /** 総合評価コメント */
  summary: string;
}

export interface ProjectContext {
  title: string;
  description?: string;
}

// ============================================================
// Claude APIクライアント
// ============================================================

function getClient(): Anthropic {
  return new Anthropic();
}

// ============================================================
// スコアリングプロンプト
// ============================================================

const QUALITY_SCORING_PROMPT = `あなたはインタビュー品質評価の専門家です。インタビューの会話履歴を分析し、回答者の回答品質を5つの軸で評価してください。

## 評価軸（各0〜5点、小数点第1位まで）

### 1. 具体性 (specificityScore)
回答に具体的なエピソード、数値、固有名詞、時期、場所が含まれているか。
- 5: 豊富な具体例・数値データ・実名を含む詳細な回答
- 3: ある程度の具体例はあるが、一般的な表現も多い
- 1: 抽象的・一般的な回答のみ
- 0: ほとんど回答がない

### 2. 深さ (depthScore)
「なぜそう思うのか」「どのような背景があるのか」への掘り下げ度合い。
- 5: 根本原因や背景まで深く掘り下げた回答
- 3: 表面的な理由は述べているが、深い考察は少ない
- 1: 理由や背景への言及がほとんどない
- 0: ほとんど回答がない

### 3. 一貫性 (consistencyScore)
複数の回答間の論理的整合性。矛盾がないか。
- 5: すべての回答が論理的に一貫している
- 3: 概ね一貫しているが、一部不整合がある
- 1: 矛盾する回答が多い
- 0: 判定不能（回答が少なすぎる）

### 4. 情報量 (informationScore)
回答の文字数と情報密度。
- 5: 豊富な情報量で密度が高い
- 3: 適度な情報量
- 1: 回答が短く情報が乏しい
- 0: ほとんど回答がない

### 5. 独自性 (uniquenessScore)
他の人にはない独自の視点、経験、洞察が含まれているか。
- 5: 非常にユニークな視点や経験が含まれる
- 3: 一般的な回答の中に時々独自の視点がある
- 1: よくある一般的な回答のみ
- 0: ほとんど回答がない

## 応答形式
必ず以下のJSON形式で回答してください。JSON以外のテキストは含めないでください。

\`\`\`json
{
  "specificityScore": 3.5,
  "depthScore": 4.0,
  "consistencyScore": 4.5,
  "informationScore": 3.0,
  "uniquenessScore": 2.5,
  "summary": "総合評価コメント（2〜3文で）"
}
\`\`\``;

// ============================================================
// メイン関数
// ============================================================

/**
 * セッション全体の会話履歴を分析して品質スコアを算出する。
 *
 * @param conversationHistory - 会話履歴
 * @param projectContext - プロジェクトのコンテキスト情報
 * @returns 5軸スコアと総合スコア
 */
export async function calculateQualityScore(
  conversationHistory: ConversationMessage[],
  projectContext: ProjectContext
): Promise<QualityScoreResult> {
  // 会話履歴が空の場合はゼロスコアを返す
  if (conversationHistory.length === 0) {
    return {
      overallScore: 0,
      specificityScore: 0,
      depthScore: 0,
      consistencyScore: 0,
      informationScore: 0,
      uniquenessScore: 0,
      summary: "会話履歴がないため、評価できませんでした。",
    };
  }

  const client = getClient();

  // 会話履歴を文字列化
  const historyText = conversationHistory
    .map((msg) => {
      const speaker = msg.role === "ai" ? "インタビュアー" : "回答者";
      return `${speaker}: ${msg.content}`;
    })
    .join("\n\n");

  // 回答者の回答のみを抽出（情報量の事前計算に使用）
  const respondentMessages = conversationHistory
    .filter((msg) => msg.role === "respondent")
    .map((msg) => msg.content);
  const totalCharCount = respondentMessages.join("").length;
  const avgCharCount =
    respondentMessages.length > 0
      ? Math.round(totalCharCount / respondentMessages.length)
      : 0;

  const userContent = `## プロジェクト情報
- タイトル: ${projectContext.title}
${projectContext.description ? `- 概要: ${projectContext.description}` : ""}

## 統計情報
- 回答者の発言数: ${respondentMessages.length}
- 回答者の総文字数: ${totalCharCount}
- 回答者の平均文字数: ${avgCharCount}

## 会話履歴
${historyText}

上記のインタビュー会話を分析し、回答者の回答品質を5つの軸で評価してください。`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: QUALITY_SCORING_PROMPT,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    return parseQualityScoreResponse(text);
  } catch (error) {
    console.error("[QualityScorer] Claude API呼び出しエラー:", error);
    return {
      overallScore: 0,
      specificityScore: 0,
      depthScore: 0,
      consistencyScore: 0,
      informationScore: 0,
      uniquenessScore: 0,
      summary: "品質スコアの計算中にエラーが発生しました。",
    };
  }
}

// ============================================================
// レスポンスパーサー
// ============================================================

/**
 * Claude APIのレスポンスからQualityScoreResultを抽出する。
 * overallScoreは重み付き平均で算出する。
 */
function parseQualityScoreResponse(text: string): QualityScoreResult {
  try {
    // JSONブロックを抽出
    const jsonMatch =
      text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) {
      console.warn("[QualityScorer] JSONを検出できませんでした:", text);
      return createFallbackResult("スコア解析に失敗しました。");
    }

    const parsed = JSON.parse(jsonMatch[1].trim());

    // 各スコアのバリデーション（0-5の範囲にクランプ）
    const specificityScore = clampScore(parsed.specificityScore);
    const depthScore = clampScore(parsed.depthScore);
    const consistencyScore = clampScore(parsed.consistencyScore);
    const informationScore = clampScore(parsed.informationScore);
    const uniquenessScore = clampScore(parsed.uniquenessScore);

    // 重み付き平均でoverallScoreを算出
    const overallScore = roundToOneDecimal(
      specificityScore * 0.25 +
        depthScore * 0.25 +
        consistencyScore * 0.2 +
        informationScore * 0.15 +
        uniquenessScore * 0.15
    );

    const summary =
      typeof parsed.summary === "string" && parsed.summary.length > 0
        ? parsed.summary
        : "評価コメントなし";

    return {
      overallScore,
      specificityScore,
      depthScore,
      consistencyScore,
      informationScore,
      uniquenessScore,
      summary,
    };
  } catch (error) {
    console.error("[QualityScorer] レスポンスパースエラー:", error);
    return createFallbackResult("スコア解析中にエラーが発生しました。");
  }
}

// ============================================================
// ユーティリティ
// ============================================================

/** スコアを0-5の範囲にクランプし、小数点第1位に丸める */
function clampScore(value: unknown): number {
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return 0;
  return roundToOneDecimal(Math.max(0, Math.min(5, num)));
}

/** 小数点第1位に丸める */
function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/** エラー時のフォールバック結果を生成 */
function createFallbackResult(summary: string): QualityScoreResult {
  return {
    overallScore: 0,
    specificityScore: 0,
    depthScore: 0,
    consistencyScore: 0,
    informationScore: 0,
    uniquenessScore: 0,
    summary,
  };
}
