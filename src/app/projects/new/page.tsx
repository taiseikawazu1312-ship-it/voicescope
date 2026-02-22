"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GripVertical,
  Loader2,
  Mic,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface QuestionItem {
  id: string;
  text: string;
  followUpPrompt: string;
}

const STEPS = [
  { label: "テーマ設定", description: "調査の基本情報" },
  { label: "質問設定", description: "インタビュー質問" },
  { label: "確認", description: "内容の最終確認" },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [questionsGenerated, setQuestionsGenerated] = useState(false);

  // Step 1: テーマ設定
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Step 2: 質問設定
  const [questions, setQuestions] = useState<QuestionItem[]>([]);

  const addQuestion = useCallback(() => {
    setQuestions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: "", followUpPrompt: "" },
    ]);
  }, []);

  const removeQuestion = useCallback((id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const updateQuestion = useCallback(
    (id: string, field: "text" | "followUpPrompt", value: string) => {
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
      );
    },
    []
  );

  const moveQuestion = useCallback((index: number, direction: "up" | "down") => {
    setQuestions((prev) => {
      const next = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }, []);

  const generateQuestions = useCallback(async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/projects/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error("生成に失敗しました");

      const data = await res.json();
      const generated = (data.questions as { text: string; followUpPrompt: string }[]).map(
        (q) => ({
          id: crypto.randomUUID(),
          text: q.text,
          followUpPrompt: q.followUpPrompt || "",
        })
      );
      setQuestions(generated);
      setQuestionsGenerated(true);
    } catch {
      // 生成失敗時は空の質問1つをセット
      setQuestions([{ id: crypto.randomUUID(), text: "", followUpPrompt: "" }]);
    } finally {
      setIsGenerating(false);
    }
  }, [title, description]);

  const handleNextStep = useCallback(async () => {
    if (currentStep === 0) {
      // Step 1→2: 質問を自動生成してから遷移
      if (!questionsGenerated) {
        await generateQuestions();
      }
      setCurrentStep(1);
    } else {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep, questionsGenerated, generateQuestions]);

  const canProceed = () => {
    if (currentStep === 0) return title.trim().length > 0;
    if (currentStep === 1) return questions.some((q) => q.text.trim().length > 0);
    return true;
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const validQuestions = questions
        .filter((q) => q.text.trim().length > 0)
        .map((q) => ({
          text: q.text.trim(),
          followUpPrompt: q.followUpPrompt.trim() || undefined,
        }));

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          questions: validQuestions.length > 0 ? validQuestions : undefined,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "プロジェクトの作成に失敗しました");
      }

      const project = await res.json();
      router.push(`/projects/${project.id}`);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "プロジェクトの作成に失敗しました"
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-4 px-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#1A1A2E] to-[#4A3AFF]">
              <Mic className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-[#1A1A2E]">新規調査作成</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* ステッパー */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {STEPS.map((step, idx) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all ${
                    idx < currentStep
                      ? "bg-gradient-to-br from-[#1A1A2E] to-[#4A3AFF] text-white"
                      : idx === currentStep
                        ? "bg-[#1A1A2E] text-white"
                        : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {idx < currentStep ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <div className="hidden sm:block">
                  <p
                    className={`text-sm font-medium ${
                      idx <= currentStep ? "text-slate-800" : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`h-px w-8 sm:w-16 ${
                    idx < currentStep ? "bg-[#4A3AFF]" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: テーマ設定 */}
        {currentStep === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>テーマ設定</CardTitle>
              <CardDescription>
                調査のタイトルと説明を入力してください
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">
                  タイトル <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="例: 新サービスのユーザビリティ調査"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">説明（任意）</Label>
                <Textarea
                  id="description"
                  placeholder="この調査の目的や背景を記述してください..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: 質問設定 */}
        {currentStep === 1 && isGenerating && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#1A1A2E] to-[#4A3AFF]">
                <Sparkles className="h-8 w-8 animate-pulse text-white" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[#1A1A2E]">
                質問を自動生成中...
              </h3>
              <p className="text-sm text-muted-foreground">
                「{title}」に最適なインタビュー質問をAIが作成しています
              </p>
              <Loader2 className="mt-4 h-6 w-6 animate-spin text-[#4A3AFF]" />
            </CardContent>
          </Card>
        )}
        {currentStep === 1 && !isGenerating && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>質問設定</CardTitle>
                  <CardDescription>
                    AIが自動生成した質問を確認・編集してください。深掘り指示でAIのフォローアップをカスタマイズできます。
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateQuestions}
                  disabled={isGenerating}
                  className="shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                  AI再生成
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="rounded-lg border bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-slate-400" />
                      <Badge variant="secondary" className="text-xs">
                        Q{idx + 1}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled={idx === 0}
                        onClick={() => moveQuestion(idx, "up")}
                      >
                        <ArrowLeft className="h-3 w-3 rotate-90" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled={idx === questions.length - 1}
                        onClick={() => moveQuestion(idx, "down")}
                      >
                        <ArrowRight className="h-3 w-3 rotate-90" />
                      </Button>
                      {questions.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => removeQuestion(q.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Input
                      placeholder="質問文を入力..."
                      value={q.text}
                      onChange={(e) =>
                        updateQuestion(q.id, "text", e.target.value)
                      }
                    />
                    <Textarea
                      placeholder="深掘り指示（任意）: 例) 具体的なエピソードを引き出してください"
                      value={q.followUpPrompt}
                      onChange={(e) =>
                        updateQuestion(q.id, "followUpPrompt", e.target.value)
                      }
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={addQuestion}
                className="w-full border-dashed"
              >
                <Plus className="h-4 w-4" />
                質問を追加
              </Button>
            </CardContent>
          </Card>
        )}


        {/* Step 3: 確認 */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>確認</CardTitle>
              <CardDescription>
                以下の内容でプロジェクトを作成します
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="mb-1 text-sm font-medium text-muted-foreground">
                  タイトル
                </p>
                <p className="text-lg font-semibold">{title}</p>
              </div>
              {description && (
                <div>
                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    説明
                  </p>
                  <p className="text-sm text-slate-600">{description}</p>
                </div>
              )}
              <Separator />
              <div>
                <p className="mb-3 text-sm font-medium text-muted-foreground">
                  質問リスト ({questions.filter((q) => q.text.trim()).length}問)
                </p>
                <div className="space-y-3">
                  {questions
                    .filter((q) => q.text.trim())
                    .map((q, idx) => (
                      <div
                        key={q.id}
                        className="flex items-start gap-3 rounded-lg border p-3"
                      >
                        <Badge variant="secondary" className="mt-0.5 shrink-0 text-xs">
                          Q{idx + 1}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">{q.text}</p>
                          {q.followUpPrompt && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              深掘り: {q.followUpPrompt}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ナビゲーションボタン */}
        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => {
              if (currentStep === 1) setQuestionsGenerated(false);
              setCurrentStep((s) => Math.max(0, s - 1));
            }}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Button>

          {currentStep < STEPS.length - 1 ? (
            <Button
              onClick={handleNextStep}
              disabled={!canProceed() || isGenerating}
              className="bg-gradient-to-r from-[#1A1A2E] to-[#4A3AFF] text-white"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  {currentStep === 0 ? (
                    <>
                      <Sparkles className="h-4 w-4" />
                      AIで質問を生成して次へ
                    </>
                  ) : (
                    <>
                      次へ
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-[#1A1A2E] to-[#4A3AFF] text-white"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  作成中...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  作成
                </>
              )}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
