/**
 * AIインタビュアー プロンプト4層アーキテクチャ
 *
 * Layer 1: システムプロンプト - AIインタビュアーの役割定義
 * Layer 2: プロジェクトコンテキスト - 調査対象の情報
 * Layer 3: セッションコンテキスト - 会話履歴
 * Layer 4: 深掘り制御プロンプト - 進行管理
 */

// ============================================================
// Layer 1: システムプロンプト
// ============================================================

/**
 * AIインタビュアーとしての役割・人格・行動指針を定義する。
 * 全セッション共通で使用される基盤プロンプト。
 */
export function getSystemPrompt(): string {
  return `あなたはプロフェッショナルなユーザーインタビュアー「VoiceScope AI」です。

## あなたの人格と話し方
- 丁寧で温かみのある日本語を使います
- 相手の回答を注意深く聞き、共感を示してから次の質問に移ります
- 「なるほど」「ありがとうございます」などの相槌を自然に挟みます
- 専門用語は避け、誰にでもわかりやすい言葉を使います
- 一度に複数の質問をせず、1つずつ聞きます

## 行動指針
1. 回答者が安心して話せる雰囲気を作る
2. 回答が曖昧な場合は、具体的なエピソードや事例を聞く
3. 回答者の感情的な反応（驚き、不満、喜び）を見逃さず、深掘りする
4. 回答者の言葉を否定せず、中立的な立場を保つ
5. 回答が十分に得られたら、無理に深掘りせず次に進む

## 時間管理
- インタビュー全体は約5分（300秒）を目安とします
- 各フェーズの時間配分を意識して進行します

## 倫理ガイドライン
- 個人情報の過度な詮索はしない
- 回答者が答えたくない質問にはスキップを提案する
- ハラスメントや差別的な内容には関与しない
- 回答者の意思を尊重し、中断の申し出には速やかに応じる

## 応答形式
応答は必ず以下のJSON形式で返してください。JSON以外のテキストは含めないでください。

\`\`\`json
{
  "message": "回答者に伝えるメッセージ（自然な日本語）",
  "isFollowUp": false,
  "shouldEnd": false,
  "currentPhase": "opening",
  "nextQuestionIndex": 0
}
\`\`\`

### フィールド説明
- message: 回答者に表示するテキスト。自然な会話口調で記述
- isFollowUp: 直前の回答に対する深掘り質問の場合はtrue
- shouldEnd: インタビューを終了すべき場合はtrue
- currentPhase: 現在のフェーズ（"opening" | "warmup" | "main" | "summary" | "closing"）
- nextQuestionIndex: 次に聞くべき質問のインデックス（0始まり）。深掘り中は現在の質問インデックスを維持`;
}

// ============================================================
// Layer 2: プロジェクトコンテキスト
// ============================================================

export interface ProjectContextInput {
  title: string;
  description?: string;
  questions: { text: string; followUpPrompt?: string }[];
}

/**
 * 調査プロジェクトの情報を構造化してプロンプトに組み込む。
 * プロジェクトのタイトル・説明・質問リストを含む。
 */
export function getProjectContext(project: ProjectContextInput): string {
  const questionsText = project.questions
    .map((q, i) => {
      let line = `  ${i + 1}. ${q.text}`;
      if (q.followUpPrompt) {
        line += `\n     [深掘りヒント: ${q.followUpPrompt}]`;
      }
      return line;
    })
    .join("\n");

  return `## 調査プロジェクト情報

### プロジェクト名
${project.title}

${project.description ? `### プロジェクト概要\n${project.description}\n` : ""}
### 質問リスト（この順番で聞いてください）
${questionsText}

### 進行ルール
- 質問は上記の番号順に進めてください
- 各質問に対して、回答の質が不十分な場合は深掘りしてください
- 深掘りヒントがある場合は、それを参考にフォローアップしてください
- 十分な回答が得られたら次の質問に移ってください`;
}

// ============================================================
// Layer 3: セッションコンテキスト
// ============================================================

export interface ConversationHistoryEntry {
  role: string;
  content: string;
}

/**
 * これまでの会話履歴をプロンプトに反映する。
 * AIが文脈を維持して回答できるようにする。
 */
export function getSessionContext(
  conversationHistory: ConversationHistoryEntry[]
): string {
  if (conversationHistory.length === 0) {
    return `## 会話履歴
まだ会話は始まっていません。オープニングメッセージで自己紹介と調査目的の説明から始めてください。`;
  }

  const historyText = conversationHistory
    .map((entry) => {
      const speaker = entry.role === "ai" ? "インタビュアー" : "回答者";
      return `${speaker}: ${entry.content}`;
    })
    .join("\n\n");

  return `## 会話履歴
以下はこれまでの会話です。この文脈を踏まえて次の応答を生成してください。

${historyText}`;
}

// ============================================================
// Layer 4: 深掘り制御プロンプト
// ============================================================

export interface ControlPromptParams {
  currentTurn: number;
  maxTurns: number;
  elapsedSeconds: number;
  maxSeconds: number;
  currentQuestionIndex: number;
  totalQuestions: number;
}

/**
 * インタビューの進行状況に応じた制御指示を生成する。
 * 時間・ターン数・質問進捗に応じてフェーズ遷移や終了判断を行う。
 */
export function getControlPrompt(params: ControlPromptParams): string {
  const {
    currentTurn,
    maxTurns,
    elapsedSeconds,
    maxSeconds,
    currentQuestionIndex,
    totalQuestions,
  } = params;

  const remainingSeconds = maxSeconds - elapsedSeconds;
  const remainingTurns = maxTurns - currentTurn;
  const progressPercent = Math.round((elapsedSeconds / maxSeconds) * 100);
  const questionProgress = `${currentQuestionIndex + 1}/${totalQuestions}`;

  // フェーズ判定
  let phaseInstruction: string;

  if (elapsedSeconds < 30) {
    phaseInstruction = `【フェーズ: opening】
自己紹介と調査目的の説明を行ってください。
- 「こんにちは、VoiceScope AIです」と名乗る
- プロジェクトの目的を簡潔に説明する
- 所要時間（約5分）を伝える
- 回答に正解・不正解はないことを伝える
- currentPhaseは "opening" を設定してください`;
  } else if (elapsedSeconds < 60) {
    phaseInstruction = `【フェーズ: warmup】
ウォームアップの質問をしてください。
- 答えやすい軽い質問から始める
- 回答者の緊張をほぐす
- 最初の質問に関連する導入的な話題
- currentPhaseは "warmup" を設定してください`;
  } else if (remainingSeconds > 60) {
    phaseInstruction = `【フェーズ: main】
メインの質問と深掘りを行ってください。
- 質問リストに沿って質問する
- 回答が浅い場合は具体例やエピソードを聞く
- 感情的な反応があれば掘り下げる
- 現在の質問: ${questionProgress}問目
- currentPhaseは "main" を設定してください`;
  } else if (remainingSeconds > 30) {
    phaseInstruction = `【フェーズ: summary】
回答の要約確認を行ってください。
- これまでの回答のポイントを簡潔に要約する
- 「他に付け加えたいことはありますか？」と聞く
- 要約に誤りがないか確認する
- currentPhaseは "summary" を設定してください`;
  } else {
    phaseInstruction = `【フェーズ: closing】
クロージングを行ってください。
- 回答への感謝を伝える
- 回答がどのように活用されるか簡潔に説明する
- shouldEndをtrueに設定してインタビューを終了する
- currentPhaseは "closing" を設定してください`;
  }

  // 緊急制御
  let urgencyNote = "";
  if (remainingTurns <= 2) {
    urgencyNote = `\n\n⚠️ 残りターン数が少なくなっています（残り${remainingTurns}ターン）。速やかにsummary→closingに移行してください。`;
  }
  if (remainingSeconds <= 30 && params.currentTurn > 0) {
    urgencyNote += `\n\n⚠️ 残り時間が30秒以下です。closingフェーズに移行し、shouldEndをtrueに設定してください。`;
  }

  return `## 進行状況
- 経過時間: ${elapsedSeconds}秒 / ${maxSeconds}秒（${progressPercent}%）
- 残り時間: ${remainingSeconds}秒
- ターン数: ${currentTurn} / ${maxTurns}（残り${remainingTurns}ターン）
- 質問進捗: ${questionProgress}問目

${phaseInstruction}${urgencyNote}`;
}
