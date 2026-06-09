import type { CoachSafetyFinding } from './coachSafetyTypes';

export interface PromptContextValidationOptions {
  allowRawPgnFen?: boolean;
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 64_000;

const SECRET_PATTERNS = [
  /\baccess_token\b/i,
  /\brefresh_token\b/i,
  /\bservice_role\b/i,
  /\bapi[_-]?key\b/i,
  /\bsecret[_-]?key\b/i,
  /\bjwt\b/i,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
];

const RAW_PGN_PATTERN = /\b\d+\.\s*(?:\.\.\.\s*)?[KQRNB]?[a-h][1-8]?[x-]?[a-h][1-8]|(?:1-0|0-1|1\/2-1\/2)\b/;
const RAW_FEN_PATTERN = /\b(?:[prnbqkPRNBQK1-8]+\/){7}[prnbqkPRNBQK1-8]+\s+[wb]\s+(?:K?Q?k?q?|-)\s+(?:[a-h][36]|-)\s+\d+\s+\d+\b/;

export function validatePromptContext(
  context: unknown,
  options: PromptContextValidationOptions = {}
): CoachSafetyFinding[] {
  const findings: CoachSafetyFinding[] = [];
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const serialized = safeStringify(context);
  const lowered = serialized.toLowerCase();

  if (serialized.length > maxBytes) {
    findings.push(makeFinding(
      'prompt-context-too-large',
      'error',
      'prompt_context',
      `Prompt context is ${serialized.length} bytes, above the ${maxBytes} byte bound.`,
      'Reduce the context to summaries before any optional LLM adapter sees it.',
      'size'
    ));
  }

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(serialized)) {
      findings.push(makeFinding(
        'prompt-context-secret-like-field',
        'error',
        'privacy',
        'Prompt context contains a token, secret, JWT, service-role, or credential-like value.',
        'Remove secrets and auth material from the context.',
        'secrets'
      ));
      break;
    }
  }

  if (lowered.includes('backup_json') || lowered.includes('"local_matches"') || lowered.includes('"saved_analyses"')) {
    findings.push(makeFinding(
      'prompt-context-backup-like-data',
      'error',
      'privacy',
      'Prompt context appears to contain raw backup-like records.',
      'Send summarized features only; keep full backup JSON local-private.',
      'backup'
    ));
  }

  if (lowered.includes('account_links') || lowered.includes('cloud_user_id') || lowered.includes('"email"')) {
    findings.push(makeFinding(
      'prompt-context-account-data',
      'error',
      'privacy',
      'Prompt context contains account-link or identity fields.',
      'Remove account links, cloud user IDs, and email addresses.',
      'account'
    ));
  }

  if (!options.allowRawPgnFen && (RAW_PGN_PATTERN.test(serialized) || RAW_FEN_PATTERN.test(serialized))) {
    findings.push(makeFinding(
      'prompt-context-raw-chess-data',
      'error',
      'privacy',
      'Prompt context contains raw PGN or FEN-like chess data.',
      'Use aggregate analysis summaries unless the user explicitly enables local-only raw review.',
      'raw_chess'
    ));
  }

  const maybeRecord = isRecord(context) ? context : {};
  if (!isRecord(maybeRecord.privacy_flags)) {
    findings.push(makeFinding(
      'prompt-context-missing-privacy-flags',
      'error',
      'prompt_context',
      'Prompt context is missing privacy_flags.',
      'Include privacy_flags before any future prompt context can be considered.',
      'privacy_flags'
    ));
  }

  if (!Array.isArray(maybeRecord.source_files) || maybeRecord.source_files.length === 0) {
    findings.push(makeFinding(
      'prompt-context-missing-source-files',
      'warning',
      'prompt_context',
      'Prompt context is missing source_files.',
      'List local stores or analytics artifacts used to build the context.',
      'source_files'
    ));
  }

  if (!hasInsufficientDataBehavior(maybeRecord)) {
    findings.push(makeFinding(
      'prompt-context-missing-insufficient-data-behavior',
      'warning',
      'prompt_context',
      'Prompt context does not expose insufficient-data behavior.',
      'Include insufficient data flags or cards so future prompts do not invent facts.',
      'insufficient_data'
    ));
  }

  return dedupeFindings(findings);
}

export function containsSecretLikeText(text: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

export function containsRawChessText(text: string): boolean {
  return RAW_PGN_PATTERN.test(text) || RAW_FEN_PATTERN.test(text);
}

export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) || '';
  } catch {
    return String(value);
  }
}

function hasInsufficientDataBehavior(context: Record<string, unknown>): boolean {
  const coachSummary = context.coach_summary;
  if (isRecord(coachSummary) && Array.isArray(coachSummary.insufficient_data_flags)) return true;

  const cards = context.coach_cards;
  if (Array.isArray(cards)) {
    return cards.some((card) => isRecord(card) && safeStringify(card).toLowerCase().includes('insufficient data'));
  }

  return false;
}

function makeFinding(
  id: string,
  severity: CoachSafetyFinding['severity'],
  category: CoachSafetyFinding['category'],
  message: string,
  recommendation: string,
  field?: string
): CoachSafetyFinding {
  return { id, severity, category, message, recommendation, field };
}

function dedupeFindings(findings: CoachSafetyFinding[]): CoachSafetyFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.id}:${finding.field || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
