"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AudioRecorder } from "@/lib/audio/recorder";

/**
 * useAudioRecorder - 録音用Reactフック
 *
 * AudioRecorderクラスをラップし、Reactの状態管理とライフサイクルに統合する。
 * リアルタイムSTT用のチャンクコールバックもサポート。
 */

export interface UseAudioRecorderReturn {
  /** 現在録音中かどうか */
  isRecording: boolean;
  /** 最後に録音した音声のBlob */
  audioBlob: Blob | null;
  /** エラーメッセージ */
  error: string | null;
  /** 録音を開始する */
  startRecording: () => Promise<void>;
  /** 録音を停止し、Blobを返す */
  stopRecording: () => Promise<Blob | null>;
  /** リアルタイムSTT用チャンクコールバックを設定する */
  onChunkAvailable: (cb: (chunk: Blob) => void) => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const chunkCallbackRef = useRef<((chunk: Blob) => void) | null>(null);

  // コンポーネントアンマウント時にリソースを解放
  useEffect(() => {
    return () => {
      recorderRef.current?.destroy();
      recorderRef.current = null;
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);

    try {
      // 既存のRecorderがあれば破棄
      if (recorderRef.current) {
        recorderRef.current.destroy();
      }

      const recorder = new AudioRecorder();

      // チャンクコールバックが設定されていれば登録
      if (chunkCallbackRef.current) {
        recorder.onDataAvailable(chunkCallbackRef.current);
      }

      await recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "録音の開始に失敗しました";
      setError(message);
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!recorderRef.current || !recorderRef.current.isRecording()) {
      return null;
    }

    try {
      const blob = await recorderRef.current.stop();
      setAudioBlob(blob);
      setIsRecording(false);
      return blob;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "録音の停止に失敗しました";
      setError(message);
      setIsRecording(false);
      return null;
    }
  }, []);

  const onChunkAvailable = useCallback((cb: (chunk: Blob) => void) => {
    chunkCallbackRef.current = cb;

    // 既にRecorderが存在する場合はコールバックを差し替え
    if (recorderRef.current) {
      recorderRef.current.onDataAvailable(cb);
    }
  }, []);

  return {
    isRecording,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    onChunkAvailable,
  };
}
