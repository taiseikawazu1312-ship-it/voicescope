import { NextResponse } from "next/server";
import { createClient } from "@deepgram/sdk";

// GET /api/stt/token - Deepgram一時トークン取得
export async function GET() {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Deepgram APIキーが設定されていません" },
        { status: 500 }
      );
    }

    try {
      // Deepgram SDKで一時キーを生成
      const deepgram = createClient(apiKey);
      const { result } = await deepgram.manage.createProjectKey(
        process.env.DEEPGRAM_PROJECT_ID ?? "",
        {
          comment: "Temporary STT token",
          scopes: ["usage:write"],
          time_to_live_in_seconds: 600, // 10分間有効
        }
      );

      return NextResponse.json({
        token: result?.key ?? apiKey,
        url: "wss://api.deepgram.com/v1/listen",
      });
    } catch {
      // SDKでのトークン生成が失敗した場合、APIキーを直接返す（簡易実装）
      console.warn(
        "Deepgram一時トークン生成に失敗しました。APIキーを直接使用します。"
      );
      return NextResponse.json({
        token: apiKey,
        url: "wss://api.deepgram.com/v1/listen",
      });
    }
  } catch (error) {
    console.error("GET /api/stt/token error:", error);
    return NextResponse.json(
      { error: "STTトークンの取得に失敗しました" },
      { status: 500 }
    );
  }
}
