/**
 * TypeScript types for Prompt Experimentation System
 */

export interface ExperimentScores {
  avg_pro_score: number;
  avg_con_score: number;
  overall_relevance: string;
  pro_wins: number;
  con_wins: number;
}

export interface ExperimentImprovements {
  pro_score_delta: number;
  con_score_delta: number;
  decisiveness_delta: number;
  relevance_changed: boolean;
  relevance_upgraded: boolean;
  is_improvement: boolean;
  original_difference: number;
  new_difference: number;
  more_decisive: boolean;
}

export interface ExperimentResult {
  experiment_id: string;
  version_id: string;
  original_scores: ExperimentScores;
  new_scores: ExperimentScores;
  improvements: ExperimentImprovements;
}

export interface Experiment {
  experiment_id: string;
  doc_id: string;
  user_email: string;
  experiment_date: string;
  prompt_type: 'pro' | 'con' | 'judge';
  prompt_content: string;

  avg_pro_score: number;
  avg_con_score: number;
  score_difference: number;
  overall_relevance: string;
  pro_wins: number;
  con_wins: number;

  score_delta_pro: number;
  score_delta_con: number;
  decisiveness_delta: number;
  relevance_changed: number;
  is_improvement: number;

  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;

  created_at: string;
  updated_at: string;
}

export interface ExperimentStatistics {
  total_experiments: number;
  pending: number;
  approved: number;
  rejected: number;
  improvements_found: number;
  avg_score_improvement: number;
}

export interface ExperimentsListResponse {
  total: number;
  experiments: Experiment[];
  statistics: ExperimentStatistics;
}
