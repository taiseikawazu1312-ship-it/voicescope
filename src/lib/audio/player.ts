/**
 * AudioPlayer - 音声再生管理クラス
 *
 * Web Audio APIを使用してArrayBufferの音声データをキュー再生する。
 * AudioContextはユーザーインタラクション後に初期化する必要がある（autoplay policy対応）。
 */

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private audioQueue: ArrayBuffer[] = [];
  private isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private aborted = false;

  /**
   * AudioContextを初期化する。
   * ユーザーインタラクション（クリック等）のイベントハンドラ内で呼び出すこと。
   */
  init(): void {
    if (this.audioContext) return;

    this.audioContext = new AudioContext();
    this.aborted = false;

    // AudioContextがsuspendedの場合はresumeする
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {
        // resume失敗は無視（次回のユーザーインタラクションで再試行される）
      });
    }
  }

  /**
   * ArrayBuffer（音声データ）をキューに追加して再生する。
   * 既に再生中の場合はキューに追加され、現在の再生が終わった後に順次再生される。
   */
  async play(audioData: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      this.init();
    }

    this.audioQueue.push(audioData);

    if (!this.isPlaying) {
      await this.processQueue();
    }
  }

  /**
   * キュー内の音声データを順次再生する内部メソッド。
   */
  private async processQueue(): Promise<void> {
    if (!this.audioContext) return;

    this.isPlaying = true;

    while (this.audioQueue.length > 0 && !this.aborted) {
      const data = this.audioQueue.shift();
      if (!data) continue;

      // AudioContextがsuspendedの場合はresumeを試行
      if (this.audioContext.state === "suspended") {
        try {
          await this.audioContext.resume();
        } catch {
          // resume失敗時はスキップ
          continue;
        }
      }

      try {
        await this.playBuffer(data);
      } catch (err) {
        // デコードエラー等はスキップしてキューの次のアイテムへ
        console.warn("AudioPlayer: 音声データの再生に失敗しました", err);
      }
    }

    this.isPlaying = false;
  }

  /**
   * 1つのArrayBufferをデコードして再生し、再生完了まで待機する。
   */
  private playBuffer(data: ArrayBuffer): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      if (!this.audioContext || this.aborted) {
        resolve();
        return;
      }

      try {
        const audioBuffer = await this.audioContext.decodeAudioData(
          data.slice(0)
        );
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);

        this.currentSource = source;

        source.onended = () => {
          this.currentSource = null;
          resolve();
        };

        source.start(0);
      } catch (err) {
        this.currentSource = null;
        reject(err);
      }
    });
  }

  /**
   * 再生を停止し、キューをクリアする。
   */
  stop(): void {
    this.aborted = true;
    this.audioQueue = [];

    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // 既に停止済みの場合は無視
      }
      this.currentSource = null;
    }

    this.isPlaying = false;

    // 次回再生時のためにフラグをリセット
    // （少し遅延させてprocessQueueのwhileループが終了する時間を確保）
    setTimeout(() => {
      this.aborted = false;
    }, 0);
  }

  /**
   * 再生中かどうかを返す。
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * リソースを解放する。
   * AudioContextをクローズし、すべての状態をリセットする。
   */
  destroy(): void {
    this.stop();

    if (this.audioContext) {
      this.audioContext.close().catch(() => {
        // close失敗は無視
      });
      this.audioContext = null;
    }
  }
}
