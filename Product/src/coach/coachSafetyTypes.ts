export type CoachSafetySeverity = 'info' | 'warning' | 'error';

export type CoachSafetyCategory =
  | 'privacy'
  | 'unsupported_claim'
  | 'missing_evidence'
  | 'low_confidence'
  | 'data_quality'
  | 'export_safety'
  | 'prompt_context';

export interface CoachSafetyFinding {
  id: string;
  severity: CoachSafetySeverity;
  category: CoachSafetyCategory;
  message: string;
  card_id?: string;
  field?: string;
  recommendation: string;
}

export interface CoachSafetySummary {
  total_findings: number;
  info: number;
  warning: number;
  error: number;
}

export interface CoachSafetyReport {
  passed: boolean;
  generated_at: string;
  findings: CoachSafetyFinding[];
  summary: CoachSafetySummary;
  checked_cards: number;
  checked_exports: {
    markdown: boolean;
    json: boolean;
  };
  checked_context: boolean;
}
