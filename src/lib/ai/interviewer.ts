/**
 * AIインタビュアーエンジン
 *
 * Claude APIを使った動的会話フローで、AIインタビューを実行する。
 * 5分間で最大10回の深掘りフォローアップを行い、回答者から深い洞察を引き出す。
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  getSystemPrompt,
  getProjectContext,
  getSessionContext,
  getControlPrompt,
  type ProjectContextInput,
} from "./prompts";

// ============================================================
// 型定義
// ============================================================

export interface InterviewConfig {
  projectTitle: string;
  projectDescription?: string;
  questions: { text: string; orderIndex: number; followUpPrompt?: string }[];
  maxDurationSeconds?: number;
  maxFollowUps?: number;
}

export interface ConversationMessage {
  role: "ai" | "respondent";
  content: string;
  timestamp: number;
}

export interface InterviewerResponse {
  message: string;
  isFollowUp: boolean;
  shouldEnd: boolean;
  currentPhase: "opening" | "warmup" | "main" | "summary" | "closing";
  nextQuestionIndex: number;
}

// ============================================================
// AIInterviewerクラス
// ============================================================

export class AIInterviewer {
  private config: InterviewConfig;
  private history: ConversationMessage[] = [];
  private startTime: number = 0;
  private turnCount: number = 0;
  private currentQuestionIndex: number = 0;
  private client: Anthropic;
  private maxDuration: number;
  private maxFollowUps: number;

  constructor(config?: InterviewConfig) {
    this.config = config ?? {
      projectTitle: "",
      questions: [],
    };
    this.maxDuration = this.config.maxDurationSeconds ?? 300;
    this.maxFollowUps = this.config.maxFollowUps ?? 10;
    this.client = new Anthropic();
  }

  /**
   * セッション情報からインタビューを開始する
   */
  async start(session?: {
    project?: {
      title: string;
      description?: string | null;
      questions?: { text: string; orderIndex: number; followUpPrompt?: string | null }[];
    };
  }): Promise<InterviewerResponse> {
    // セッション情報があればconfigを更新
    if (session?.project) {
      this.config = {
        projectTitle: session.project.title,
        projectDescription: session.project.description ?? undefined,
        questions: (session.project.questions ?? []).map((q) => ({
          text: q.text,
          orderIndex: q.orderIndex,
          followUpPrompt: q.followUpPrompt ?? undefined,
        })),
        maxDurationSeconds: this.maxDuration,
        maxFollowUps: this.maxFollowUps,
      };
    }

    this.startTime = Date.now();
    this.history = [];
    this.turnCount = 0;
    this.currentQuestionIndex = 0;

    return this.generateResponse();
  }

  /**
   * 回答者の発言に対してAIが応答する
   */
  async respond(params?: {
    session?: unknown;
    message?: string;
    turnCount?: number;
    elapsedSeconds?: number;
  }): Promise<InterviewerResponse> {
    const message = params?.message ?? "";

    if (message) {
      this.history.push({
        role: "respondent",
        content: message,
        timestamp: Date.now(),
      });
    }

    if (params?.turnCount !== undefined) {
      this.turnCount = params.turnCount;
    }

    return this.generateResponse();
  }

  /**
   * Claude APIを呼び出してAI応答を生成する
   */
  private async generateResponse(): Promise<InterviewerResponse> {
    const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    const projectContext: ProjectContextInput = {
      title: this.config.projectTitle,
      description: this.config.projectDescription,
      questions: this.config.questions.map((q) => ({
        text: q.text,
        followUpPrompt: q.followUpPrompt,
      })),
    };

    const systemPrompt = getSystemPrompt();
    const projectPrompt = getProjectContext(projectContext);
    const sessionPrompt = getSessionContext(
      this.history.map((m) => ({ role: m.role, content: m.content }))
    );
    const controlPrompt = getControlPrompt({
      currentTurn: this.turnCount,
      maxTurns: this.maxFollowUps,
      elapsedSeconds,
      maxSeconds: this.maxDuration,
      currentQuestionIndex: this.currentQuestionIndex,
      totalQuestions: this.config.questions.length || 1,
    });

    const fullSystem = [systemPrompt, projectPrompt, controlPrompt].join(
      "\n\n---\n\n"
    );

    try {
      const response = await this.client.messages.create({
        model: "claude-sonnet-4-6-20250514",
        max_tokens: 1024,
        system: fullSystem,
        messages: [
          {
            role: "user",
            content:
              sessionPrompt +
              "\n\n上記の会話履歴と進行状況を踏まえて、次の応答をJSON形式で生成してください。",
          },
        ],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      const parsed = this.parseResponse(text);

      // 履歴に追加
      this.history.push({
        role: "ai",
        content: parsed.message,
        timestamp: Date.now(),
      });

      this.turnCount++;
      this.currentQuestionIndex = parsed.nextQuestionIndex;

      return parsed;
    } catch (error) {
      console.error("[AIInterviewer] Claude API呼び出しエラー:", error);
      const fallback: InterviewerResponse = {
        message:
          "申し訳ございません、少し問題が発生しました。もう一度お話しいただけますか？",
        isFollowUp: false,
        shouldEnd: false,
        currentPhase: "main",
        nextQuestionIndex: this.currentQuestionIndex,
      };

      this.history.push({
        role: "ai",
        content: fallback.message,
        timestamp: Date.now(),
      });

      return fallback;
    }
  }

  /**
   * Claude APIのレスポンスをパースする
   */
  private parseResponse(text: string): InterviewerResponse {
    try {
      const jsonMatch =
        text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1].trim());
        return {
          message: parsed.message || "お話しいただけますか？",
          isFollowUp: Boolean(parsed.isFollowUp),
          shouldEnd: Boolean(parsed.shouldEnd),
          currentPhase: parsed.currentPhase || "main",
          nextQuestionIndex:
            typeof parsed.nextQuestionIndex === "number"
              ? parsed.nextQuestionIndex
              : this.currentQuestionIndex,
        };
      }
    } catch {
      // パース失敗時はテキスト全体をメッセージとして使用
    }

    return {
      message: text || "お話しいただけますか？",
      isFollowUp: false,
      shouldEnd: false,
      currentPhase: "main",
      nextQuestionIndex: this.currentQuestionIndex,
    };
  }

  /**
   * 会話履歴を取得する
   */
  getHistory(): ConversationMessage[] {
    return [...this.history];
  }

  /**
   * 現在のステータスを取得する
   */
  getStatus(): { phase: string; turnCount: number; elapsedSeconds: number } {
    return {
      phase:
        this.turnCount === 0
          ? "opening"
          : this.turnCount >= this.maxFollowUps
            ? "closing"
            : "main",
      turnCount: this.turnCount,
      elapsedSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}
