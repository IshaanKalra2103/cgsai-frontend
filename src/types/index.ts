export type RelevanceStatus = 'RELEVANT' | 'NON_RELEVANT' | 'BORDERLINE' | 'NOT_SPECIFIED';

export interface PipelineStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  duration?: number;
}

export interface DocumentMetadata {
  title: string;
  authors: string[];
  doi?: string;
  publicationDate?: string;
  abstract?: string;
}

export interface DebateResponse {
  question: string;
  proArgument: string;
  conArgument: string;
}

export interface JudgeVerdict {
  judgeId: string;
  proScore: number;
  conScore: number;
  reasoning: string;
  quotes?: string[];
}

export interface QuestionResult {
  question: string;
  winner: 'pro' | 'con' | 'tie';
  proScore: number;
  conScore: number;
  kappa: number;
  summary: string;
  judges: JudgeVerdict[];
}

export interface EvaluationResult {
  id: string;
  documentId: string;
  overallRelevance: RelevanceStatus;
  avgProScore: number;
  avgConScore: number;
  proWins: number;
  conWins: number;
  ties: number;
  questions: QuestionResult[];
  summary: string;
  createdAt: string;
}

export interface Document {
  id: string;
  title: string;
  authors: string[];
  doi?: string;
  predictedRelevance: RelevanceStatus;
  goldRelevance: RelevanceStatus;
  avgProScore: number;
  avgConScore: number;
  processedAt: string;
  abstract?: string;
  filePath?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { page: number; text: string }[];
  timestamp: string;
}

export interface Feedback {
  id: string;
  documentId: string;
  reviewerName: string;
  proStrengths: string;
  proWeaknesses: string;
  conStrengths: string;
  conWeaknesses: string;
  judgeBalance: string;
  observedBehavior: string;
  verdictCorrectness: 'correct' | 'incorrect' | 'partially_correct';
  suggestedVerdict: RelevanceStatus;
  suggestions: string;
  createdAt: string;
}

export interface PromptVersion {
  id: string;
  version: number;
  promptType: 'pro' | 'con' | 'judge' | 'metadata';
  content: string;
  isActive: boolean;
  changeNotes: string;
  createdAt: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';
  message: string;
  source: string;
}
