"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Mic, MicOff, MessageSquare, X, Play, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AIAvatar } from "@/components/interview/AIAvatar";
import { TranscriptPanel } from "@/components/interview/TranscriptPanel";
import { Timer } from "@/components/interview/Timer";
import {
  useInterviewEngine,
  type InterviewMessage as EngineMessage,
} from "@/hooks/useInterviewEngine";
import type { InterviewMessage } from "@/types";

// =================================================================
// トークン解決レスポンスの型
// =================================================================
interface TokenInfo {
  sessionId: string;
  token: string;
  status: string;
  project: {
    id: string;
    title: string;
    description: string | null;
  };
  respondent: {
    id: string;
    name: string | null;
  };
}

type PageStatus = "loading" | "ready" | "completed" | "expired" | "error";

// =================================================================
// EngineMessage → TranscriptPanel用のInterviewMessage変換
// =================================================================
function toTranscriptMessages(messages: EngineMessage[]): InterviewMessage[] {
  return messages.map((m, i) => ({
    id: `msg-${i}-${m.timestamp}`,
    speaker: m.role === "ai" ? ("ai" as const) : ("user" as const),
    text: m.content,
    timestamp: m.timestamp / 1000, // ms → sec
  }));
}

// =================================================================
// メインページコンポーネント
// =================================================================
const TOTAL_INTERVIEW_TIME_MS = 300_000; // 5分

export default function InterviewPage() {
  const params = useParams();
  const token = params.token as string;

  const [pageStatus, setPageStatus] = useState<PageStatus>("loading");
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // トークンからセッション情報を取得
  useEffect(() => {
    async function resolveToken() {
      try {
        const res = await fetch(`/api/interviews/token/${token}`);

        if (res.status === 410) {
          const data = await res.json();
          if (data.sessionStatus === "COMPLETED") {
            setPageStatus("completed");
          } else {
            setPageStatus("expired");
          }
          setErrorMessage(data.error);
          return;
        }

        if (!res.ok) {
          const data = await res.json();
          setErrorMessage(data.error || "セッション情報の取得に失敗しました");
          setPageStatus("error");
          return;
        }

        const data: TokenInfo = await res.json();
        setTokenInfo(data);
        setPageStatus("ready");
      } catch {
        setErrorMessage("ネットワークエラーが発生しました");
        setPageStatus("error");
      }
    }

    resolveToken();
  }, [token]);

  // ローディング画面
  if (pageStatus === "loading") {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-[#0a0a1a] via-[#1A1A2E] to-[#16213E]">
        <AIAvatar state="idle" />
        <div className="mt-6 flex items-center gap-3 text-white/60">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
          <span className="text-sm">読み込み中...</span>
        </div>
      </div>
    );
  }

  // 完了済み画面
  if (pageStatus === "completed") {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-gradient-to-br from-[#0a0a1a] via-[#1A1A2E] to-[#16213E] px-6">
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
            インタビュー完了済み
          </h2>
          <p className="text-sm text-white/60">
            このインタビューは既に完了しています。ご協力ありがとうございました。
          </p>
        </div>
      </div>
    );
  }

  // エラー / 無効な状態
  if (pageStatus === "error" || pageStatus === "expired") {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-gradient-to-br from-[#0a0a1a] via-[#1A1A2E] to-[#16213E] px-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
          <AlertCircle className="h-10 w-10 text-red-400" />
        </div>
        <div className="text-center">
          <h2 className="mb-2 text-xl font-bold text-white">
            {pageStatus === "expired" ? "リンクが無効です" : "エラーが発生しました"}
          </h2>
          <p className="text-sm text-white/60">
            {errorMessage || "予期しないエラーが発生しました"}
          </p>
        </div>
      </div>
    );
  }

  // インタビュー準備完了
  return <InterviewRoom tokenInfo={tokenInfo!} />;
}

// =================================================================
// インタビュールームコンポーネント（実際のAIインタビュー）
// =================================================================
function InterviewRoom({ tokenInfo }: { tokenInfo: TokenInfo }) {
  const { state, startInterview, stopListening, endInterview } = useInterviewEngine(
    tokenInfo.sessionId
  );

  const [showTranscript, setShowTranscript] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  const handleStart = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicPermissionDenied(true);
      return;
    }
    startInterview();
  }, [startInterview]);

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
            <h1 className="mb-1 text-2xl font-bold text-white">
              AIインタビュー
            </h1>
            <p className="mb-1 text-sm font-medium text-purple-300">
              {tokenInfo.project.title}
            </p>
            {tokenInfo.respondent.name && (
              <p className="mb-6 text-xs text-white/50">
                {tokenInfo.respondent.name}さん
              </p>
            )}
            <p className="mb-8 max-w-md text-sm text-white/60">
              マイクを使って、AIインタビュアーと会話します。
              約5分間のインタビューです。準備ができたら「開始」ボタンを押してください。
            </p>
            {micPermissionDenied && (
              <p className="mb-4 text-sm text-amber-400">
                マイクの許可が必要です。ブラウザの設定からマイクを許可してください。
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
                  size="sm"
                  onClick={() => setShowTranscript(false)}
                  className="absolute right-4 top-0 h-7 w-7 p-0 text-white/40 hover:text-white hover:bg-white/10"
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
              onClick={state.isUserSpeaking ? stopListening : undefined}
              disabled={state.isAISpeaking || state.phase === "processing" || !state.isUserSpeaking}
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full transition-all",
                "focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-transparent",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                state.isUserSpeaking
                  ? "bg-red-500 shadow-lg shadow-red-500/50 animate-mic-pulse hover:bg-red-600 cursor-pointer"
                  : "bg-white/20"
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
                ? "話し終わったらマイクボタンを押してください"
                : state.isAISpeaking
                  ? "AIが話しています..."
                  : state.phase === "processing"
                    ? "AI応答を生成中..."
                    : "マイクに向かってお話しください"}
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
              ご協力ありがとうございました。
            </p>
            <p className="text-sm text-white/60">
              回答は安全に記録されました。このページを閉じていただいて大丈夫です。
            </p>
          </div>
        </div>
      )}

      {/* ===== エラー画面 ===== */}
      {state.phase === "error" && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
            <AlertCircle className="h-10 w-10 text-red-400" />
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
