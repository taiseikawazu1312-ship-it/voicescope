"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AudioPlayer } from "@/lib/audio/player";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useDeepgram } from "@/hooks/useDeepgram";

// ────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────

export interface InterviewMessage {
  role: "ai" | "respondent";
  content: string;
  timestamp: number;
  audioUrl?: string;
}

export type InterviewPhase =
  | "idle"
  | "connecting"
  | "interviewing"
  | "processing"
  | "completed"
  | "error";

export interface InterviewState {
  phase: InterviewPhase;
  messages: InterviewMessage[];
  currentTranscript: string;
  elapsedTime: number;
  turnCount: number;
  isAISpeaking: boolean;
  isUserSpeaking: boolean;
  error: string | null;
}

export interface UseInterviewEngineReturn {
  state: InterviewState;
  startInterview: () => Promise<void>;
  endInterview: () => Promise<void>;
}

// ────────────────────────────────────────────
// 定数
// ────────────────────────────────────────────

/** インタビューの最大時間（ミリ秒）: 5分 */
const MAX_INTERVIEW_DURATION_MS = 5 * 60 * 1000;

/** 沈黙検出閾値（ミリ秒）: 2秒間文字起こしが更新されなければ発話終了とみなす */
const SILENCE_THRESHOLD_MS = 2000;

// ────────────────────────────────────────────
// フック実装
// ────────────────────────────────────────────

export function useInterviewEngine(
  sessionId: string
): UseInterviewEngineReturn {
  // ----- 状態管理 -----
  const [phase, setPhase] = useState<InterviewPhase>("idle");
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [turnCount, setTurnCount] = useState(0);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ----- Ref -----
  const playerRef = useRef<AudioPlayer | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEndingRef = useRef(false);
  const lastTranscriptRef = useRef("");
  const phaseRef = useRef<InterviewPhase>("idle");

  // phaseRefを同期
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // ----- サブフック -----
  const recorder = useAudioRecorder();
  const deepgram = useDeepgram();

  // ────────────────────────────────────────
  // 経過時間タイマーの管理
  // ────────────────────────────────────────

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setElapsedTime(elapsed);

      // 5分経過で自動終了
      if (elapsed >= MAX_INTERVIEW_DURATION_MS) {
        endInterviewInternal();
      }
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ────────────────────────────────────────
  // TTS: テキストを音声に変換して再生する
  // ────────────────────────────────────────

  const speakText = useCallback(async (text: string): Promise<void> => {
    setIsAISpeaking(true);

    try {
      const response = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error("TTS変換に失敗しました");
      }

      const audioData = await response.arrayBuffer();

      if (!playerRef.current) {
        playerRef.current = new AudioPlayer();
        playerRef.current.init();
      }

      await playerRef.current.play(audioData);
    } catch (err) {
      console.warn("TTS再生エラー:", err);
    } finally {
      setIsAISpeaking(false);
    }
  }, []);

  // ────────────────────────────────────────
  // AI応答を取得して再生する
  // ────────────────────────────────────────

  const getAIResponse = useCallback(
    async (userMessage: string): Promise<void> => {
      if (phaseRef.current !== "interviewing") return;

      setPhase("processing");

      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            message: userMessage,
            messages: messages.map((m) => ({
              role: m.role === "ai" ? "assistant" : "user",
              content: m.content,
            })),
          }),
        });

        if (!response.ok) {
          throw new Error("AI応答の取得に失敗しました");
        }

        const data = await response.json();
        const aiText: string = data.response;
        const shouldEnd: boolean = data.shouldEnd ?? false;

        // AIメッセージを追加
        const aiMessage: InterviewMessage = {
          role: "ai",
          content: aiText,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        setTurnCount((prev) => prev + 1);

        // AI発話
        setPhase("interviewing");
        await speakText(aiText);

        // AIが終了を判断した場合
        if (shouldEnd) {
          await endInterviewInternal();
          return;
        }

        // ユーザーの発話待ちに移行（録音を再開）
        await startListening();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "AI応答の取得に失敗しました";
        setError(message);
        setPhase("error");
      }
    },
    [sessionId, messages, speakText]
  );

  // ────────────────────────────────────────
  // 沈黙検出: ユーザーが話し終えたかを判定する
  // ────────────────────────────────────────

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    silenceTimerRef.current = setTimeout(() => {
      // 沈黙が閾値を超えた場合、ユーザーの発話が終了したとみなす
      if (phaseRef.current === "interviewing" && recorder.isRecording) {
        handleUserFinishedSpeaking();
      }
    }, SILENCE_THRESHOLD_MS);
  }, [recorder.isRecording]);

  // ────────────────────────────────────────
  // ユーザーが話し終わった時の処理
  // ────────────────────────────────────────

  const handleUserFinishedSpeaking = useCallback(async () => {
    setIsUserSpeaking(false);

    // 録音停止
    await recorder.stopRecording();

    // Deepgram切断
    deepgram.disconnect();

    // 確定済みのフルトランスクリプトを取得
    const userText =
      deepgram.fullTranscript.trim() || lastTranscriptRef.current.trim();

    if (!userText) {
      // 何も聞き取れなかった場合は再度リスニング開始
      await startListening();
      return;
    }

    // ユーザーメッセージを追加
    const userMessage: InterviewMessage = {
      role: "respondent",
      content: userText,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setCurrentTranscript("");

    // AI応答を取得
    await getAIResponse(userText);
  }, [recorder, deepgram, getAIResponse]);

  // ────────────────────────────────────────
  // リスニング開始（録音 + Deepgram接続）
  // ────────────────────────────────────────

  const startListening = useCallback(async () => {
    if (phaseRef.current !== "interviewing") return;

    setIsUserSpeaking(true);
    setCurrentTranscript("");

    try {
      // Deepgramに接続
      await deepgram.connect();

      // 録音開始（チャンクをDeepgramに送信）
      recorder.onChunkAvailable((chunk: Blob) => {
        deepgram.sendAudio(chunk);
      });

      await recorder.startRecording();

      // 沈黙タイマーを開始
      resetSilenceTimer();
    } catch (err) {
      console.warn("リスニング開始エラー:", err);
      setIsUserSpeaking(false);
    }
  }, [deepgram, recorder, resetSilenceTimer]);

  // ────────────────────────────────────────
  // DeepgramのtranscriptをcurrentTranscriptに同期
  // ────────────────────────────────────────

  useEffect(() => {
    const combined = deepgram.fullTranscript + deepgram.transcript;
    setCurrentTranscript(combined);

    // 文字起こし結果が更新されたら沈黙タイマーをリセット
    if (combined !== lastTranscriptRef.current && combined.trim()) {
      lastTranscriptRef.current = combined;
      resetSilenceTimer();
    }
  }, [deepgram.transcript, deepgram.fullTranscript, resetSilenceTimer]);

  // Deepgramのエラーを伝搬
  useEffect(() => {
    if (deepgram.error && phaseRef.current === "interviewing") {
      setError(deepgram.error);
    }
  }, [deepgram.error]);

  // Recorderのエラーを伝搬
  useEffect(() => {
    if (recorder.error && phaseRef.current === "interviewing") {
      setError(recorder.error);
    }
  }, [recorder.error]);

  // ────────────────────────────────────────
  // インタビュー開始
  // ────────────────────────────────────────

  const startInterview = useCallback(async () => {
    if (phase !== "idle") return;

    isEndingRef.current = false;
    setPhase("connecting");
    setError(null);
    setMessages([]);
    setCurrentTranscript("");
    setTurnCount(0);
    setElapsedTime(0);

    // AudioPlayerをユーザーインタラクション内で初期化（autoplay policy）
    playerRef.current = new AudioPlayer();
    playerRef.current.init();

    try {
      // セッション開始APIを呼ぶ
      const response = await fetch(
        `/api/interviews/${sessionId}/start`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("インタビューセッションの開始に失敗しました");
      }

      const data = await response.json();
      const firstMessage: string =
        data.message || "こんにちは。インタビューを始めましょう。";

      // フェーズをinterviewingに変更
      setPhase("interviewing");

      // 経過時間タイマー開始
      startTimer();

      // 最初のAIメッセージを追加
      const aiMessage: InterviewMessage = {
        role: "ai",
        content: firstMessage,
        timestamp: Date.now(),
      };
      setMessages([aiMessage]);
      setTurnCount(1);

      // AIの最初の発話を再生
      await speakText(firstMessage);

      // ユーザーのリスニングを開始
      await startListening();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "インタビューの開始に失敗しました";
      setError(message);
      setPhase("error");
    }
  }, [phase, sessionId, startTimer, speakText, startListening]);

  // ────────────────────────────────────────
  // インタビュー終了（内部用）
  // ────────────────────────────────────────

  const endInterviewInternal = useCallback(async () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    setPhase("processing");
    stopTimer();

    // 録音を停止
    if (recorder.isRecording) {
      await recorder.stopRecording();
    }

    // Deepgram切断
    deepgram.disconnect();

    // AudioPlayer停止
    playerRef.current?.stop();

    // 沈黙タイマークリア
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    setIsAISpeaking(false);
    setIsUserSpeaking(false);

    try {
      // 品質スコア計算APIを呼ぶ
      await fetch(`/api/interviews/${sessionId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      setPhase("completed");
    } catch {
      // スコア計算は失敗してもインタビュー自体は完了とする
      setPhase("completed");
    }
  }, [sessionId, messages, recorder, deepgram, stopTimer]);

  /**
   * インタビュー終了（外部公開用）
   */
  const endInterview = useCallback(async () => {
    await endInterviewInternal();
  }, [endInterviewInternal]);

  // ────────────────────────────────────────
  // クリーンアップ
  // ────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopTimer();
      playerRef.current?.destroy();
      playerRef.current = null;

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };
  }, [stopTimer]);

  // ────────────────────────────────────────
  // 戻り値
  // ────────────────────────────────────────

  const state: InterviewState = {
    phase,
    messages,
    currentTranscript,
    elapsedTime,
    turnCount,
    isAISpeaking,
    isUserSpeaking,
    error,
  };

  return {
    state,
    startInterview,
    endInterview,
  };
}
