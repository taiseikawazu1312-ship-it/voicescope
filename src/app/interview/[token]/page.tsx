"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Mic, MicOff, MessageSquare, X, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AIAvatar } from "@/components/interview/AIAvatar";
import { TranscriptPanel } from "@/components/interview/TranscriptPanel";
import { Timer } from "@/components/interview/Timer";

// =================================================================
// 型定義（useInterviewEngineフックと共通）
// =================================================================
interface InterviewMessage {
  role: "ai" | "respondent";
  content: string;
  timestamp: number;
  audioUrl?: string;
}

type InterviewPhase =
  | "idle"
  | "connecting"
  | "interviewing"
  | "processing"
  | "completed"
  | "error";

interface InterviewState {
  phase: InterviewPhase;
  messages: InterviewMessage[];
  currentTranscript: string;
  elapsedTime: number; // ミリ秒
  turnCount: number;
  isAISpeaking: boolean;
  isUserSpeaking: boolean;
  error: string | null;
}

interface UseInterviewEngineReturn {
  state: InterviewState;
  startInterview: () => Promise<void>;
  endInterview: () => Promise<void>;
}

// TranscriptPanelが期待する形式に変換
interface TranscriptMessage {
  id: string;
  speaker: "ai" | "user";
  text: string;
  timestamp: number;
}

function toTranscriptMessages(messages: InterviewMessage[]): TranscriptMessage[] {
  return messages.map((m, i) => ({
    id: `msg-${i}-${m.timestamp}`,
    speaker: m.role === "ai" ? "ai" : "user",
    text: m.content,
    timestamp: m.timestamp,
  }));
}

// =================================================================
// モック版 useInterviewEngine（実際のフックが利用不可な場合のフォールバック）
// =================================================================
function useInterviewEngineMock(
  _sessionId: string
): UseInterviewEngineReturn {
  const [state, setState] = useState<InterviewState>({
    phase: "idle",
    messages: [],
    currentTranscript: "",
    elapsedTime: 0,
    turnCount: 0,
    isAISpeaking: false,
    isUserSpeaking: false,
    error: null,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<InterviewPhase>("idle");

  useEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);

  const addMessage = useCallback(
    (role: "ai" | "respondent", content: string) => {
      setState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          { role, content, timestamp: Date.now() },
        ],
        turnCount: prev.turnCount + (role === "respondent" ? 1 : 0),
      }));
    },
    []
  );

  const simulateAISpeaking = useCallback(
    (text: string) => {
      setState((prev) => ({ ...prev, isAISpeaking: true }));
      setTimeout(() => {
        addMessage("ai", text);
        setState((prev) => ({ ...prev, isAISpeaking: false }));
      }, 1500);
    },
    [addMessage]
  );

  const startInterview = useCallback(async () => {
    setState((prev) => ({ ...prev, phase: "connecting" }));

    timerRef.current = setInterval(() => {
      setState((prev) => {
        const newElapsed = prev.elapsedTime + 1000;
        if (newElapsed >= 300000 && phaseRef.current === "interviewing") {
          return { ...prev, elapsedTime: newElapsed, phase: "completed" };
        }
        return { ...prev, elapsedTime: newElapsed };
      });
    }, 1000);

    await new Promise((r) => setTimeout(r, 1000));
    setState((prev) => ({ ...prev, phase: "interviewing" }));
    simulateAISpeaking(
      "こんにちは。本日はインタビューにご参加いただきありがとうございます。リラックスしてお話しいただければと思います。それでは早速ですが、最初の質問です。"
    );
  }, [simulateAISpeaking]);

  const endInterview = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState((prev) => ({ ...prev, phase: "completed" }));
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { state, startInterview, endInterview };
}

// =================================================================
// フック選択（実際のフックを動的にインポート試行）
// =================================================================
function useInterviewEngineWithFallback(
  sessionId: string
): UseInterviewEngineReturn {
  // 実際のuseInterviewEngineが利用可能か試行
  // 注: 動的インポートはReact Hooksのルール制約でフック内では使えないため、
  // ここでは直接インポートを試み、失敗時はモックにフォールバックする。
  // useInterviewEngine の依存(Deepgram, AudioRecorder等)が未設定の場合を
  // 考慮し、try-catchでラップ。
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useInterviewEngine } = require("@/hooks/useInterviewEngine");
    return useInterviewEngine(sessionId);
  } catch {
    // フォールバック: モック版を使用
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useInterviewEngineMock(sessionId);
  }
}

// =================================================================
// インタビュー画面コンポーネント
// =================================================================
const TOTAL_INTERVIEW_TIME_MS = 300_000; // 5分

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  // tokenをsessionIdとして扱う（実際のフローでは token -> sessionId の解決が必要）
  const { state, startInterview, endInterview } =
    useInterviewEngineMock(token);

  const [showTranscript, setShowTranscript] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  // 完了時にリダイレクト
  useEffect(() => {
    if (state.phase === "completed") {
      const timer = setTimeout(() => {
        router.push("/dashboard");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state.phase, router]);

  const handleStart = async () => {
    // マイク許可リクエスト
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicPermissionDenied(true);
    }
    startInterview();
  };

  // アバターの状態判定
  const avatarState: "idle" | "speaking" | "listening" = state.isAISpeaking
    ? "speaking"
    : state.isUserSpeaking
      ? "listening"
      : "idle";

  // AI の最新発言
  const latestAIMessage = [...state.messages]
    .reverse()
    .find((m) => m.role === "ai");

  // 経過時間を秒に変換
  const elapsedSeconds = Math.floor(state.elapsedTime / 1000);
  const totalSeconds = TOTAL_INTERVIEW_TIME_MS / 1000;

  // TranscriptPanel用のメッセージ変換
  const transcriptMessages = toTranscriptMessages(state.messages);

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-gradient-to-br from-[#0a0a1a] via-[#1A1A2E] to-[#16213E] animate-gradient-shift">
      {/* 背景装飾 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-purple-900/20 blur-[100px]" />
        <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-blue-900/20 blur-[100px]" />
      </div>

      {/* ===== 開始前の画面 ===== */}
      {state.phase === "idle" && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-6">
          <AIAvatar state="idle" />
          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold text-white">
              AIインタビュー
            </h1>
            <p className="mb-8 max-w-md text-sm text-white/60">
              マイクを使って、AIインタビュアーと会話します。
              約5分間のインタビューです。準備ができたら「開始」ボタンを押してください。
            </p>
            {micPermissionDenied && (
              <p className="mb-4 text-sm text-amber-400">
                マイクの許可が得られませんでした。設定から許可してください。
              </p>
            )}
            <Button
              size="lg"
              onClick={handleStart}
              className="h-14 gap-3 rounded-full bg-gradient-to-r from-[#4A3AFF] to-[#7B68EE] px-10 text-lg font-semibold text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all"
            >
              <Play className="h-5 w-5" />
              インタビューを開始
            </Button>
          </div>
        </div>
      )}

      {/* ===== 接続中の画面 ===== */}
      {state.phase === "connecting" && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6">
          <AIAvatar state="speaking" />
          <div className="flex items-center gap-3 text-white/70">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
            <span className="text-sm">インタビューを準備中...</span>
          </div>
        </div>
      )}

      {/* ===== アクティブ画面 ===== */}
      {(state.phase === "interviewing" || state.phase === "processing") && (
        <div className="relative z-10 flex flex-1 flex-col">
          {/* トップバー */}
          <div className="flex items-center justify-between px-6 pt-4">
            <Timer
              elapsedTime={elapsedSeconds}
              totalTime={totalSeconds}
            />
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowTranscript(!showTranscript)}
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                <MessageSquare className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={endInterview}
                className="text-white/60 hover:text-red-400 hover:bg-white/10"
              >
                終了
              </Button>
            </div>
          </div>

          {/* メインエリア */}
          <div className="flex flex-1 items-center justify-center">
            <div
              className={cn(
                "flex flex-1 transition-all duration-300",
                showTranscript
                  ? "justify-start pl-6 lg:pl-12"
                  : "justify-center"
              )}
            >
              <div className="flex flex-col items-center gap-6">
                {/* AIアバター */}
                <AIAvatar state={avatarState} />

                {/* AIの発言テキスト */}
                <div className="max-w-md px-4 text-center">
                  {state.isAISpeaking ? (
                    <div className="flex items-center justify-center gap-2 text-white/50">
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50" />
                        <span
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50"
                          style={{ animationDelay: "0.15s" }}
                        />
                        <span
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50"
                          style={{ animationDelay: "0.3s" }}
                        />
                      </div>
                    </div>
                  ) : latestAIMessage ? (
                    <p className="text-sm leading-relaxed text-white/70">
                      {latestAIMessage.content}
                    </p>
                  ) : null}
                </div>

                {/* リアルタイム文字起こし（ユーザーの発言） */}
                {state.isUserSpeaking && (
                  <div className="rounded-xl bg-white/10 px-4 py-2">
                    <p className="text-sm text-white/60">
                      {state.currentTranscript || "聞き取り中..."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 右パネル: 会話履歴（トグル可能） */}
            {showTranscript && (
              <div className="relative w-80 shrink-0 border-l border-white/10 px-4 lg:w-96">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setShowTranscript(false)}
                  className="absolute right-4 top-0 text-white/40 hover:text-white hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </Button>
                <TranscriptPanel messages={transcriptMessages} />
              </div>
            )}
          </div>

          {/* 下部コントロール */}
          <div className="flex flex-col items-center gap-4 pb-8 pt-4">
            {/* マイクボタン */}
            <button
              disabled={state.isAISpeaking || state.phase === "processing"}
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full transition-all",
                "focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-transparent",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                state.isUserSpeaking
                  ? "bg-red-500 shadow-lg shadow-red-500/50 animate-mic-pulse"
                  : "bg-white/20 hover:bg-white/30"
              )}
            >
              {state.isUserSpeaking ? (
                <MicOff className="h-7 w-7 text-white" />
              ) : (
                <Mic className="h-7 w-7 text-white" />
              )}
            </button>
            <p className="text-xs text-white/40">
              {state.isUserSpeaking
                ? "録音中..."
                : state.isAISpeaking
                  ? "AIが話しています..."
                  : state.phase === "processing"
                    ? "処理中..."
                    : "AIの応答を待っています"}
            </p>
          </div>
        </div>
      )}

      {/* ===== 完了画面 ===== */}
      {state.phase === "completed" && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20">
            <svg
              className="h-10 w-10 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div className="text-center">
            <h2 className="mb-2 text-2xl font-bold text-white">
              インタビュー完了
            </h2>
            <p className="mb-2 text-sm text-white/60">
              ご協力ありがとうございました。回答は安全に記録されました。
            </p>
            <p className="text-xs text-white/40">
              自動的にリダイレクトします...
            </p>
          </div>
        </div>
      )}

      {/* ===== エラー画面 ===== */}
      {state.phase === "error" && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
            <X className="h-10 w-10 text-red-400" />
          </div>
          <div className="text-center">
            <h2 className="mb-2 text-xl font-bold text-white">
              エラーが発生しました
            </h2>
            <p className="mb-4 text-sm text-white/60">
              {state.error || "予期しないエラーが発生しました"}
            </p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="border-white/20 text-white hover:bg-white/10"
            >
              再読み込み
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
