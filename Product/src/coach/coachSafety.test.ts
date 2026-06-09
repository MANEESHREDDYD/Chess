import { describe, expect, it } from 'vitest';
import type { CoachCard, MirrorCoachContext } from './coachTypes';
import {
  buildCoachSafetyReport,
  evaluateCoachCards,
  evaluateCoachContext,
  evaluateCoachExportFilename,
  evaluateCoachJsonExport,
  evaluateCoachMarkdownExport,
} from './coachSafety';
import * as coachSafetyModule from './coachSafety';
import * as promptContextValidatorModule from './promptContextValidator';
import { validatePromptContext } from './promptContextValidator';

describe('deterministic coach safety evaluator', () => {
  it('flags coach cards with missing evidence', () => {
    const card = makeCard({ evidence: [] });

    const findings = evaluateCoachCards([card], makeContext({ coach_cards: [card] }));

    expect(findings.some((finding) => finding.id === 'card-missing-evidence')).toBe(true);
  });

  it('flags overconfident insufficient-data cards', () => {
    const card = makeCard({
      id: 'analysis-insufficient',
      summary: 'Insufficient data: no completed analyses exist yet.',
      confidence: 'high',
    });

    const findings = evaluateCoachCards([card], makeContext({ coach_cards: [card] }));

    expect(findings.some((finding) => finding.id === 'card-insufficient-overconfident')).toBe(true);
  });

  it('flags medical or psychological diagnosis wording', () => {
    const card = makeCard({
      summary: 'Your chess anxiety diagnosis explains this pattern.',
    });

    const findings = evaluateCoachCards([card], makeContext({ coach_cards: [card] }));

    expect(findings.some((finding) => finding.id === 'card-medical-psych-claim')).toBe(true);
  });

  it('flags sacred or religious parody wording', () => {
    const card = makeCard({
      summary: 'This sacred/religious parody mocks Vyasa instead of coaching chess.',
    });

    const findings = evaluateCoachCards([card], makeContext({ coach_cards: [card] }));

    expect(findings.some((finding) => finding.id === 'card-sacred-parody')).toBe(true);
  });

  it('blocks Markdown exports containing access tokens', () => {
    const findings = evaluateCoachMarkdownExport('access_token=abc123');

    expect(findings.some((finding) => finding.id === 'markdown-export-secret-like-text')).toBe(true);
  });

  it('blocks exports containing Supabase service role key text', () => {
    const findings = evaluateCoachJsonExport(JSON.stringify({
      schema: 'mirror_local_coach_context_v2',
      context: makeContext(),
      service_role: 'secret',
    }));

    expect(findings.some((finding) => finding.id === 'json-export-secret-like-text')).toBe(true);
  });

  it('flags unsafe export filenames', () => {
    const findings = evaluateCoachExportFilename('../mirror-coach-context.json');

    expect(findings.some((finding) => finding.id === 'export-filename-unsafe')).toBe(true);
  });

  it('flags raw PGN or FEN in coach context', () => {
    const context = {
      ...makeContext(),
      pgn: '1. e4 e5 1-0',
      fen: '8/8/8/8/8/8/8/8 w - - 0 1',
    } as MirrorCoachContext;

    const findings = evaluateCoachContext(context);

    expect(findings.some((finding) => finding.id === 'prompt-context-raw-chess-data')).toBe(true);
  });

  it('lets safe summarized context pass with no errors', () => {
    const context = makeContext();
    const report = buildCoachSafetyReport({ cards: context.coach_cards, context });

    expect(report.passed).toBe(true);
    expect(report.summary.error).toBe(0);
  });

  it('fails future prompt context when privacy_flags are missing', () => {
    const findings = validatePromptContext({
      source_files: ['IndexedDB:players'],
      coach_summary: { insufficient_data_flags: [] },
    });

    expect(findings.some((finding) => finding.id === 'prompt-context-missing-privacy-flags')).toBe(true);
  });

  it('sets safety report passed false when errors exist', () => {
    const card = makeCard({ evidence: [] });
    const context = makeContext({ coach_cards: [card] });

    const report = buildCoachSafetyReport({ cards: [card], context });

    expect(report.passed).toBe(false);
    expect(report.summary.error).toBeGreaterThan(0);
  });

  it('does not include LLM, agent framework, or paid API dependencies', () => {
    const source = [
      ...Object.values(coachSafetyModule),
      ...Object.values(promptContextValidatorModule),
    ]
      .filter((value) => typeof value === 'function')
      .map((value) => value.toString())
      .join('\n')
      .toLowerCase();

    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('openai');
    expect(source).not.toContain('anthropic');
    expect(source).not.toContain('gemini');
    expect(source).not.toContain('langchain');
    expect(source).not.toContain('llamaindex');
    expect(source).not.toContain('apikey');
    expect(source).not.toContain('api_key');
    expect(source).not.toContain('supabase');
  });
});

function makeCard(overrides: Partial<CoachCard> = {}): CoachCard {
  return {
    id: 'weakness-primary',
    type: 'weakness',
    title: 'Practice pin patterns',
    summary: 'Pin solved rate is 40 percent from local clue attempts.',
    evidence: ['Pin solved rate: 40 percent.', 'Source rows: clue attempts.'],
    recommendation: 'Practice pin motifs in Clue Chess.',
    priority: 3,
    confidence: 'medium',
    source: 'IndexedDB:clue_attempts',
    ...overrides,
  };
}

function makeContext(overrides: Partial<MirrorCoachContext> = {}): MirrorCoachContext {
  const card = makeCard();
  return {
    player_profile_summary: {
      player_id: 'local-player',
      display_name: 'Local Player',
      player_found: true,
      calibration_status: 'complete',
      total_games: 2,
      mirror_matches: 1,
      analyses_completed: 1,
      achievements_count: 1,
      level: 2,
    },
    player_progress_summary: {
      total_xp: 120,
      level: 2,
      current_streak_days: 1,
      best_streak_days: 3,
      total_games: 2,
      mirror_matches: 1,
      clue_attempts: 5,
      clue_solved: 3,
      story_chapters_complete: 1,
      story_total_chapters: 16,
      due_reviews_count: 0,
      next_action: 'Practice pin motifs in Clue Chess.',
    },
    style_vector_summary: {
      available: true,
      behavioral_field_count: 11,
      dimensionality_note: 'StyleVector has 11 behavioral/profile fields plus schema_version metadata.',
      opening_white_top3: ['e4'],
      opening_black_top3: ['c5'],
      avg_move_time_ms: 12000,
      time_pressure_blunder_rate: 0.2,
      exchange_willingness: 0.4,
      preferred_minor: 'knight',
      motif_blindness: { pin: 0.6 },
      endgame_strength: 0.5,
      swindle_preference: null,
      detected_elo: 1300,
      elo_band: 'initiate',
    },
    recent_performance_summary: {
      total_games: 2,
      mirror_matches: 1,
      analyses_completed: 1,
      clue_attempts: 5,
      clue_solve_rate: 60,
      multi_move_solve_rate: 50,
      current_streak_days: 1,
      best_streak_days: 3,
    },
    puzzle_weakness_summary: {
      has_history: true,
      weakest_motif: 'pin',
      strongest_motif: 'fork',
      motif_stats: [
        {
          motif: 'pin',
          attempts: 5,
          solved: 2,
          failed: 3,
          solved_rate: 40,
          review_lapses: 1,
          due_reviews: 0,
        },
      ],
    },
    analysis_quality_summary: {
      analyses_completed: 1,
      average_cp_loss: 42,
      accuracy_estimate: 80,
      blunder_count: 0,
      mistake_count: 1,
      trend: 'insufficient_data',
    },
    spaced_repetition_summary: {
      total_reviews: 2,
      due_reviews_count: 0,
      due_motifs: [],
      lapse_count: 1,
    },
    story_progress_summary: {
      has_progress: true,
      completed_chapters: 1,
      total_chapters: 16,
      current_story_chapter: 'ch2_honest_move',
      current_story_title: 'The Honest Move',
      current_story_act: 'Act I',
      status: 'available',
      recommendation: 'Continue Story Mode: Act I - The Honest Move.',
    },
    coach_summary: {
      recommended_focus_area: 'Practice pin motifs',
      confidence_level: 'high',
      insufficient_data_flags: [],
      weakest_motif: 'pin',
      strongest_motif: 'fork',
      review_due_count: 0,
      recent_analysis_quality: {
        analyses_completed: 1,
        average_cp_loss: 42,
        accuracy_estimate: 80,
        blunder_count: 0,
        mistake_count: 1,
        trend: 'insufficient_data',
      },
      story_progress_status: 'available',
      achievement_count: 1,
      style_vector_available: true,
    },
    coach_cards: [card],
    recommended_next_actions: ['Practice pin motifs in Clue Chess.'],
    privacy_flags: {
      local_only: true,
      contains_raw_pgn: false,
      contains_raw_fen: false,
      uploads_private_data: false,
      safe_to_send_to_llm: false,
      local_private_by_default: ['raw PGN', 'raw FEN', 'backup JSON files'],
    },
    generated_at: '2026-06-10T00:00:00.000Z',
    source_files: ['IndexedDB:players', 'IndexedDB:clue_attempts'],
    ...overrides,
  };
}
