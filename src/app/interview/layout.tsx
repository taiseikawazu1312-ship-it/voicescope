import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AIインタビュー - VoiceScope",
  description: "AIが自動でインタビューを実施します",
};

export default function InterviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
