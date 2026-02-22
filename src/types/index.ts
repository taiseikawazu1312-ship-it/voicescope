// =====================================================
// VoiceScope - 型定義
// =====================================================

// プロジェクト一覧APIレスポンス
export interface ProjectListItem {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  _count: { aiSessions: number };
  sessionCount: number;
  averageScore: number | null;
}

// プロジェクト詳細APIレスポンス
export interface ProjectDetail {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  questions: InterviewQuestion[];
  aiSessions: SessionWithRelations[];
  stats: {
    totalSessions: number;
    completedSessions: number;
    averageScore: number | null;
  };
}

export type ProjectStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
export type InterviewSessionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface InterviewQuestion {
  id: string;
  projectId: string;
  text: string;
  orderIndex: number;
  followUpPrompt: string | null;
  createdAt: string;
}

export interface Respondent {
  id: string;
  name: string | null;
  email: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface QualityScore {
  id: string;
  sessionId: string;
  overallScore: number;
  specificityScore: number | null;
  depthScore: number | null;
  consistencyScore: number | null;
  informationScore: number | null;
  uniquenessScore: number | null;
  summary: string | null;
  createdAt: string;
}

export interface Transcript {
  id: string;
  sessionId: string;
  speaker: string; // "ai" | "user"
  text: string;
  startTime: number;
  endTime: number;
  createdAt: string;
}

export interface SessionWithRelations {
  id: string;
  projectId: string;
  respondentId: string;
  token: string;
  status: InterviewSessionStatus;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  turnCount: number | null;
  createdAt: string;
  respondent: Respondent;
  qualityScore: QualityScore | null;
  _count?: { transcripts: number };
}

// セッション詳細（transcriptsなど全て含む）
export interface SessionDetail extends SessionWithRelations {
  project: ProjectDetail;
  transcripts: Transcript[];
  recording: {
    id: string;
    url: string | null;
    duration: number | null;
  } | null;
  emotions: EmotionDataPoint[];
}

export interface EmotionDataPoint {
  id: string;
  sessionId: string;
  timestamp: number;
  label: string;
  confidence: number;
}

// インタビューエンジン関連の型
export type InterviewPhase =
  | "idle"
  | "starting"
  | "active"
  | "processing"
  | "completed"
  | "error";

export interface InterviewMessage {
  id: string;
  speaker: "ai" | "user";
  text: string;
  timestamp: number;
}

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

// セッション作成レスポンス
export interface CreateSessionResponse {
  sessionId: string;
  token: string;
  respondent: Respondent;
}
