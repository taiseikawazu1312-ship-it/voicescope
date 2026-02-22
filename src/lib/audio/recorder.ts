/**
 * AudioRecorder - ブラウザ音声録音管理クラス
 *
 * MediaRecorder APIを使用してマイクからの音声をキャプチャする。
 * リアルタイムSTT送信用のチャンクコールバックをサポート。
 */

type DataAvailableCallback = (chunk: Blob) => void;

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private dataCallback: DataAvailableCallback | null = null;
  private recording = false;

  /**
   * 使用可能なMIMEタイプを判定する。
   * 'audio/webm;codecs=opus' を優先し、非対応ブラウザでは 'audio/webm' にフォールバック。
   */
  private getSupportedMimeType(): string {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ) {
      return "audio/webm;codecs=opus";
    }
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported("audio/webm")
    ) {
      return "audio/webm";
    }
    // Safari等ではwebm非対応の場合がある
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported("audio/mp4")
    ) {
      return "audio/mp4";
    }
    return "";
  }

  /**
   * マイクアクセス許可を取得して録音を開始する。
   * timeslice: 250ms で音声チャンクを生成する。
   */
  async start(): Promise<void> {
    if (this.recording) {
      throw new Error("既に録音中です");
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "マイクのアクセスが拒否されました。ブラウザの設定を確認してください。"
          : "マイクへのアクセスに失敗しました。";
      throw new Error(message);
    }

    this.audioChunks = [];

    const mimeType = this.getSupportedMimeType();
    const options: MediaRecorderOptions = mimeType ? { mimeType } : {};

    this.mediaRecorder = new MediaRecorder(this.stream, options);

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
        this.dataCallback?.(event.data);
      }
    };

    this.mediaRecorder.onerror = () => {
      this.recording = false;
    };

    // 250ms毎にチャンクを生成
    this.mediaRecorder.start(250);
    this.recording = true;
  }

  /**
   * 録音を停止し、録音された音声全体をBlobとして返す。
   */
  async stop(): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      if (!this.mediaRecorder || !this.recording) {
        reject(new Error("録音中ではありません"));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType =
          this.mediaRecorder?.mimeType || "audio/webm;codecs=opus";
        const blob = new Blob(this.audioChunks, { type: mimeType });
        this.audioChunks = [];
        this.recording = false;
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * 現在録音中かどうかを返す。
   */
  isRecording(): boolean {
    return this.recording;
  }

  /**
   * 音声チャンクが生成されるたびに呼ばれるコールバックを設定する。
   * リアルタイムSTT送信用。
   */
  onDataAvailable(callback: DataAvailableCallback): void {
    this.dataCallback = callback;
  }

  /**
   * リソースを解放する。
   * MediaRecorderの停止とMediaStreamのトラック解放を行う。
   */
  destroy(): void {
    if (this.mediaRecorder && this.recording) {
      try {
        this.mediaRecorder.stop();
      } catch {
        // 既に停止済みの場合は無視
      }
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.dataCallback = null;
    this.recording = false;
  }
}
