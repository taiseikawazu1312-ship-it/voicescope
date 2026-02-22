import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// POST /api/ai/tts - テキスト音声合成（OpenAI TTS）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body as { text: string };

    if (!text) {
      return NextResponse.json(
        { error: "textは必須です" },
        { status: 400 }
      );
    }

    if (text.length > 4096) {
      return NextResponse.json(
        { error: "テキストが長すぎます（最大4096文字）" },
        { status: 400 }
      );
    }

    const openai = new OpenAI();

    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: text,
      response_format: "mp3",
    });

    // レスポンスをバイナリで返す
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("POST /api/ai/tts error:", error);
    return NextResponse.json(
      { error: "音声合成に失敗しました" },
      { status: 500 }
    );
  }
}
