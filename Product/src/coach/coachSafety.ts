import type { CoachCard, MirrorCoachContext } from './coachTypes';
import type { CoachSafetyFinding, CoachSafetyReport, CoachSafetySummary } from './coachSafetyTypes';
import {
  containsRawChessText,
  containsSecretLikeText,
  safeStringify,
  validatePromptContext,
} from './promptContextValidator';

export interface BuildCoachSafetyReportInput {
  cards: CoachCard[];
  context: MirrorCoachContext;
  markdown?: string;
  json?: string;
  filenames?: string[];
}

const EXACT_STAT_PATTERN = /\b\d+(?:\.\d+)?(?:%| percent| cp| elo| reviews?| attempts?| mistakes?| blunders?| games?| matches?| chapters?| achievements?| days?)\b/i;
const MEDICAL_OR_PSYCH_PATTERN = /\b(depressed|depression|anxiety|adhd|autis(?:m|tic)|bipolar|trauma|narcissis(?:m|t)|psychopath|personality disorder|mental illness|diagnos(?:e|is|ed))\b/i;
const UNSUPPORTED_SKILL_PATTERN = /\b(guaranteed|permanent|always|never|master strength|grandmaster|you are a \d{3,4}\s*elo|your real rating is|you are terrible|you are a genius)\b/i;
const PRIVATE_FIELD_PATTERN = /\b(raw_pgn|raw_fen|pgn|fen|move_history|moves|line_attempts|solution_moves|attempted_moves|account_links|cloud_user_id|email|backup_json|local_matches|saved_analyses)\b/i;

export function evaluateCoachCards(cards: CoachCard[], context: MirrorCoachContext): CoachSafetyFinding[] {
  const findings: CoachSafetyFinding[] = [];
  const knownCardIds = new Set<string>();

  for (const card of cards) {
    knownCardIds.add(card.id);
    const text = cardText(card);
    const insufficientData = text.toLowerCase().includes('insufficient data');

    if (card.type !== 'data_quality' && card.evidence.length === 0) {
      findings.push(finding(
        'card-missing-evidence',
        'error',
        'missing_evidence',
        'Non-data-quality coach cards must include evidence.',
        'Attach evidence from local summaries or mark the card as data_quality.',
        card.id,
        'evidence'
      ));
    }

    if (EXACT_STAT_PATTERN.test(text) && (card.evidence.length === 0 || !card.source)) {
      findings.push(finding(
        'card-stat-without-source',
        'error',
        'unsupported_claim',
        'Card appears to claim exact statistics without enough evidence/source metadata.',
        'Include evidence and source fields for every exact statistic.',
        card.id,
        'summary'
      ));
    }

    if (card.priority <= 3 && card.confidence === 'low' && !insufficientData) {
      findings.push(finding(
        'card-high-priority-low-confidence',
        'warning',
        'low_confidence',
        'High-priority card has low confidence without insufficient-data framing.',
        'Lower the priority or include a clear insufficient-data explanation.',
        card.id,
        'confidence'
      ));
    }

    if (insufficientData && card.confidence !== 'low') {
      findings.push(finding(
        'card-insufficient-overconfident',
        'warning',
        'low_confidence',
        'Insufficient-data card should not use medium or high confidence.',
        'Set confidence to low until more local evidence exists.',
        card.id,
        'confidence'
      ));
    }

    if (insufficientData && /\b(guaranteed|definitely|certainly|will fix|will solve)\b/i.test(card.recommendation)) {
      findings.push(finding(
        'card-insufficient-overpromises',
        'warning',
        'unsupported_claim',
        'Insufficient-data card makes an overconfident recommendation.',
        'Use cautious data-gathering language when evidence is thin.',
        card.id,
        'recommendation'
      ));
    }

    if (MEDICAL_OR_PSYCH_PATTERN.test(text)) {
      findings.push(finding(
        'card-medical-psych-claim',
        'error',
        'unsupported_claim',
        'Coach card contains medical, psychological, or diagnostic wording.',
        'Keep coaching language to chess behavior and local evidence.',
        card.id
      ));
    }

    if (containsSacredParody(text)) {
      findings.push(finding(
        'card-sacred-parody',
        'error',
        'unsupported_claim',
        'Coach card contains sacred/religious parody or mocking wording.',
        'Keep Mahabharata-inspired content respectful and chess-focused.',
        card.id
      ));
    }

    if (UNSUPPORTED_SKILL_PATTERN.test(text)) {
      findings.push(finding(
        'card-unsupported-skill-claim',
        'error',
        'unsupported_claim',
        'Coach card contains unsupported rating, skill, or permanent-trait language.',
        'Use current local evidence and avoid permanent player labels.',
        card.id
      ));
    }
  }

  if (cards.length !== context.coach_cards.length) {
    findings.push(finding(
      'cards-context-count-mismatch',
      'warning',
      'data_quality',
      'Evaluated card count differs from the context card count.',
      'Evaluate the same card list that will be rendered or exported.',
      undefined,
      'coach_cards'
    ));
  }

  for (const card of context.coach_cards) {
    if (!knownCardIds.has(card.id)) {
      findings.push(finding(
        'cards-context-missing-card',
        'warning',
        'data_quality',
        `Context card ${card.id} was not included in the evaluated cards.`,
        'Pass the full context.coach_cards list into evaluateCoachCards.',
        card.id,
        'coach_cards'
      ));
    }
  }

  return findings;
}

export function evaluateCoachContext(context: MirrorCoachContext): CoachSafetyFinding[] {
  const findings: CoachSafetyFinding[] = [];

  if (!context.privacy_flags) {
    findings.push(finding(
      'context-missing-privacy-flags',
      'error',
      'privacy',
      'Coach context is missing privacy_flags.',
      'Include privacy_flags before rendering, exporting, or future prompt use.',
      undefined,
      'privacy_flags'
    ));
  } else {
    if (context.privacy_flags.safe_to_send_to_llm !== false) {
      findings.push(finding(
        'context-safe-to-send-llm-not-false',
        'error',
        'privacy',
        'safe_to_send_to_llm must default to false.',
        'Keep future LLM adapters consent-gated and disabled by default.',
        undefined,
        'privacy_flags.safe_to_send_to_llm'
      ));
    }
    if (context.privacy_flags.contains_raw_pgn || context.privacy_flags.contains_raw_fen) {
      findings.push(finding(
        'context-raw-flags-present',
        'error',
        'privacy',
        'Coach context privacy flags indicate raw PGN or FEN is present.',
        'Remove raw chess data from the summarized coach context.',
        undefined,
        'privacy_flags'
      ));
    }
  }

  if (context.player_profile_summary?.player_id || context.player_profile_summary?.display_name) {
    findings.push(finding(
      'context-raw-identifiers-flagged',
      'info',
      'privacy',
      'Coach context includes local player identifiers and is not LLM-safe by default.',
      'Keep safe_to_send_to_llm false unless a future consent and redaction step removes identifiers.',
      undefined,
      'player_profile_summary'
    ));
  }

  const serialized = safeStringify(context);
  if (PRIVATE_FIELD_PATTERN.test(serialized)) {
    findings.push(finding(
      'context-private-field-reference',
      'info',
      'privacy',
      'Coach context references local-private fields or source names in privacy metadata.',
      'Keep these references as warnings only; do not include raw records in prompt contexts.',
      undefined,
      'privacy_metadata'
    ));
  }

  findings.push(...validatePromptContext(context));
  return dedupeFindings(findings);
}

export function evaluateCoachMarkdownExport(markdown: string): CoachSafetyFinding[] {
  const findings: CoachSafetyFinding[] = [];

  if (containsSecretLikeText(markdown)) {
    findings.push(finding(
      'markdown-export-secret-like-text',
      'error',
      'export_safety',
      'Markdown export contains token, JWT, service-role, or credential-like text.',
      'Remove secrets and auth material before export.',
      undefined,
      'markdown'
    ));
  }

  if (containsRawChessText(markdown)) {
    findings.push(finding(
      'markdown-export-raw-chess',
      'error',
      'export_safety',
      'Markdown export contains raw PGN or FEN-like chess data.',
      'Export summary metrics and cards, not raw chess records.',
      undefined,
      'markdown'
    ));
  }

  if (looksLikeRawBackup(markdown)) {
    findings.push(finding(
      'markdown-export-backup-json',
      'error',
      'export_safety',
      'Markdown export appears to contain raw backup JSON.',
      'Keep backup JSON local-private and export only summaries.',
      undefined,
      'markdown'
    ));
  }

  return findings;
}

export function evaluateCoachJsonExport(json: string): CoachSafetyFinding[] {
  const findings: CoachSafetyFinding[] = [];

  if (containsSecretLikeText(json)) {
    findings.push(finding(
      'json-export-secret-like-text',
      'error',
      'export_safety',
      'JSON export contains token, JWT, service-role, or credential-like text.',
      'Remove secrets and auth material before export.',
      undefined,
      'json'
    ));
  }

  if (containsRawChessText(json)) {
    findings.push(finding(
      'json-export-raw-chess',
      'error',
      'export_safety',
      'JSON export contains raw PGN or FEN-like chess data.',
      'Export summary context only, not raw games or positions.',
      undefined,
      'json'
    ));
  }

  try {
    const parsed = JSON.parse(json) as unknown;
    const root = isRecord(parsed) ? parsed : {};
    const context = root.context;
    if (!isRecord(root) || !root.schema || !isRecord(context)) {
      findings.push(finding(
        'json-export-not-summary-wrapper',
        'error',
        'export_safety',
        'JSON export is missing the expected summary wrapper schema or context.',
        'Use buildCoachContextJson so exports remain summary-first.',
        undefined,
        'json'
      ));
    }

    if (hasRawRecordCollections(root)) {
      findings.push(finding(
        'json-export-raw-records',
        'error',
        'export_safety',
        'JSON export appears to contain raw database record collections.',
        'Export summarized coach context, not backup tables.',
        undefined,
        'json'
      ));
    }
  } catch {
    findings.push(finding(
      'json-export-invalid-json',
      'error',
      'export_safety',
      'JSON export is not valid JSON.',
      'Generate JSON exports with JSON.stringify.',
      undefined,
      'json'
    ));
  }

  return findings;
}

export function evaluateCoachExportFilename(filename: string): CoachSafetyFinding[] {
  const safe = /^[a-z0-9][a-z0-9._-]*\.(?:json|md)$/i.test(filename)
    && !filename.includes('..')
    && !/[\\/]/.test(filename);

  if (safe) return [];

  return [finding(
    'export-filename-unsafe',
    'error',
    'export_safety',
    `Export filename is unsafe: ${filename}`,
    'Use local filenames such as mirror-coach-report-YYYY-MM-DD.md or mirror-coach-context-YYYY-MM-DD.json.',
    undefined,
    'filename'
  )];
}

export function buildCoachSafetyReport(input: BuildCoachSafetyReportInput): CoachSafetyReport {
  const findings = [
    ...evaluateCoachCards(input.cards, input.context),
    ...evaluateCoachContext(input.context),
    ...(input.markdown !== undefined ? evaluateCoachMarkdownExport(input.markdown) : []),
    ...(input.json !== undefined ? evaluateCoachJsonExport(input.json) : []),
    ...(input.filenames || []).flatMap(evaluateCoachExportFilename),
  ];
  const uniqueFindings = dedupeFindings(findings);
  const summary = summarizeFindings(uniqueFindings);

  return {
    passed: summary.error === 0,
    generated_at: new Date().toISOString(),
    findings: uniqueFindings,
    summary,
    checked_cards: input.cards.length,
    checked_exports: {
      markdown: input.markdown !== undefined,
      json: input.json !== undefined,
    },
    checked_context: true,
  };
}

function summarizeFindings(findings: CoachSafetyFinding[]): CoachSafetySummary {
  return {
    total_findings: findings.length,
    info: findings.filter((finding) => finding.severity === 'info').length,
    warning: findings.filter((finding) => finding.severity === 'warning').length,
    error: findings.filter((finding) => finding.severity === 'error').length,
  };
}

function cardText(card: CoachCard): string {
  return [
    card.title,
    card.summary,
    card.recommendation,
    card.evidence.join(' '),
    card.source,
  ].join(' ');
}

function containsSacredParody(text: string): boolean {
  const lowered = text.toLowerCase();
  if ((lowered.includes('sacred') || lowered.includes('religious')) && lowered.includes('parody')) return true;
  if (lowered.includes('mock') && /\b(krishna|arjuna|vyasa|dharma|god|deity|ritual|sacred)\b/.test(lowered)) return true;
  if (/\b(silly god|fake ritual|holy joke|sacrilegious)\b/.test(lowered)) return true;
  return false;
}

function looksLikeRawBackup(text: string): boolean {
  const lowered = text.toLowerCase();
  const backupKeys = ['"players"', '"local_matches"', '"mirror_matches"', '"saved_analyses"', '"clue_attempts"'];
  return backupKeys.filter((key) => lowered.includes(key)).length >= 2;
}

function hasRawRecordCollections(value: Record<string, unknown>): boolean {
  const text = safeStringify(value).toLowerCase();
  return looksLikeRawBackup(text);
}

function finding(
  id: string,
  severity: CoachSafetyFinding['severity'],
  category: CoachSafetyFinding['category'],
  message: string,
  recommendation: string,
  cardId?: string,
  field?: string
): CoachSafetyFinding {
  return {
    id,
    severity,
    category,
    message,
    recommendation,
    ...(cardId ? { card_id: cardId } : {}),
    ...(field ? { field } : {}),
  };
}

function dedupeFindings(findings: CoachSafetyFinding[]): CoachSafetyFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.id}:${finding.card_id || ''}:${finding.field || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
