"use client";

import { useState, useCallback, useRef, useEffect } from "react";

/**
 * useDeepgram - Deepgramリアルタイム文字起こしフック
 *
 * WebSocketでDeepgramに接続し、音声チャンクを送信してリアルタイムに文字起こし結果を受信する。
 * APIキーはサーバー側で管理し、/api/stt/token エンドポイントから一時トークンを取得する。
 */

/** Deepgramから返されるWebSocketメッセージの型定義 */
interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuated_word?: string;
}

interface DeepgramAlternative {
  transcript: string;
  confidence: number;
  words: DeepgramWord[];
}

interface DeepgramChannel {
  alternatives: DeepgramAlternative[];
}

interface DeepgramResult {
  type: "Results";
  channel_index: number[];
  duration: number;
  start: number;
  is_final: boolean;
  speech_final: boolean;
  channel: DeepgramChannel;
}

interface DeepgramMessage {
  type: string;
  channel?: DeepgramChannel;
  channel_index?: number[];
  duration?: number;
  start?: number;
  is_final?: boolean;
  speech_final?: boolean;
}

export interface UseDeepgramReturn {
  /** Deepgram WebSocketに接続しているかどうか */
  isConnected: boolean;
  /** 最新の文字起こし結果（interim含む） */
  transcript: string;
  /** 全体の確定済み文字起こし */
  fullTranscript: string;
  /** エラーメッセージ */
  error: string | null;
  /** Deepgramに接続する */
  connect: () => Promise<void>;
  /** 接続を切断する */
  disconnect: () => void;
  /** 音声チャンクを送信する */
  sendAudio: (chunk: Blob) => void;
  /** transcript状態をリセットする（ターン切り替え時に使用） */
  reset: () => void;
}

/** Deepgram接続パラメータ */
const DEEPGRAM_WS_BASE = "wss://api.deepgram.com/v1/listen";
const DEEPGRAM_PARAMS = new URLSearchParams({
  language: "ja",
  model: "nova-2",
  punctuate: "true",
  interim_results: "true",
  endpointing: "300",
});

export function useDeepgram(): UseDeepgramReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [fullTranscript, setFullTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const fullTranscriptRef = useRef("");
  const reconnectAttemptRef = useRef(0);
  const intentionalCloseRef = useRef(false);

  // コンポーネントアンマウント時に接続を切断
  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  /**
   * サーバーから一時トークンを取得する。
   */
  const fetchToken = useCallback(async (): Promise<string> => {
    const response = await fetch("/api/stt/token");

    if (!response.ok) {
      throw new Error("STTトークンの取得に失敗しました");
    }

    const data = await response.json();
    return data.token;
  }, []);

  /**
   * transcript状態をリセットする。ターン間で前回の文字起こしが混在しないようにする。
   */
  const reset = useCallback(() => {
    fullTranscriptRef.current = "";
    setFullTranscript("");
    setTranscript("");
    setError(null);
  }, []);

  /**
   * DeepgramにWebSocket接続する。
   */
  const connect = useCallback(async () => {
    // 既に接続中またはクローズ中の場合は処理する
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        return;
      }
      // CONNECTING or CLOSING状態の場合はクリーンアップ
      if (wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }

    setError(null);
    intentionalCloseRef.current = false;

    try {
      const token = await fetchToken();

      const wsUrl = `${DEEPGRAM_WS_BASE}?${DEEPGRAM_PARAMS.toString()}`;
      const ws = new WebSocket(wsUrl, ["token", token]);

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data: DeepgramMessage = JSON.parse(event.data as string);

          if (data.type === "Results" && data.channel) {
            const result = data as DeepgramResult;
            const alt = result.channel.alternatives[0];
            if (!alt) return;

            const transcriptText = alt.transcript;

            if (result.is_final) {
              // 確定結果を全体トランスクリプトに追加
              if (transcriptText.trim()) {
                fullTranscriptRef.current += transcriptText;
                setFullTranscript(fullTranscriptRef.current);
              }
              // 確定したので最新の中間結果をクリア
              setTranscript("");
            } else {
              // 中間結果を表示用に更新
              setTranscript(transcriptText);
            }
          }
        } catch {
          // JSON解析エラーは無視
        }
      };

      ws.onerror = () => {
        setError("Deepgramへの接続でエラーが発生しました");
        setIsConnected(false);
      };

      ws.onclose = (event: CloseEvent) => {
        setIsConnected(false);
        wsRef.current = null;

        if (!intentionalCloseRef.current && event.code !== 1000) {
          // 異常切断の場合は再接続を試みる（最大3回）
          if (reconnectAttemptRef.current < 3) {
            reconnectAttemptRef.current++;
            const delay = Math.min(
              1000 * Math.pow(2, reconnectAttemptRef.current),
              8000
            );
            setTimeout(() => {
              connect();
            }, delay);
          } else {
            setError(
              "Deepgramへの接続が切断されました。再接続に失敗しました。"
            );
          }
        }
      };

      wsRef.current = ws;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Deepgramへの接続に失敗しました";
      setError(message);
      setIsConnected(false);
    }
  }, [fetchToken]);

  /**
   * 接続を意図的に切断する。
   */
  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;

    if (wsRef.current) {
      // Deepgramに終了シグナルを送信
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
      }
      wsRef.current.close(1000, "Client disconnect");
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  /**
   * 音声チャンクをDeepgramに送信する。
   * BlobをArrayBufferに変換して送信する。
   */
  const sendAudio = useCallback((chunk: Blob) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    chunk.arrayBuffer().then((buffer) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(buffer);
      }
    });
  }, []);

  return {
    isConnected,
    transcript,
    fullTranscript,
    error,
    connect,
    disconnect,
    sendAudio,
    reset,
  };
}
