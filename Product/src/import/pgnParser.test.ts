import { describe, expect, it } from 'vitest';
import { parseHeaders, parsePgnText, splitPgnGames } from './pgnParser';

const VALID_PGN = `[Event "Friendly import"]
[Site "Local"]
[White "Local Player"]
[Black "Opponent"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0`;

const COMMENTED_PGN = `[Event "Commented import"]
[White "Local Player"]
[Black "Opponent"]
[Result "1/2-1/2"]

1. d4 {Queen pawn start} d5 $1 2. c4 e6 1/2-1/2`;

const INVALID_PGN = `[Event "Broken import"]
[White "Local Player"]
[Black "Opponent"]
[Result "1-0"]

1. e4 e5 2. Nf3 BadMove 1-0`;

describe('PGN parser', () => {
  it('parses a single valid PGN with headers and final FEN', () => {
    const preview = parsePgnText(VALID_PGN);

    expect(preview.detected_count).toBe(1);
    expect(preview.valid_count).toBe(1);
    expect(preview.games[0].headers.White).toBe('Local Player');
    expect(preview.games[0].move_count).toBe(6);
    expect(preview.games[0].final_fen).not.toContain(' w KQkq - 0 1');
  });

  it('parses multi-game PGN input without one game swallowing the next', () => {
    const preview = parsePgnText(`${VALID_PGN}\n\n${COMMENTED_PGN}`);

    expect(splitPgnGames(`${VALID_PGN}\n\n${COMMENTED_PGN}`)).toHaveLength(2);
    expect(preview.detected_count).toBe(2);
    expect(preview.valid_count).toBe(2);
    expect(preview.games[1].result).toBe('1/2-1/2');
  });

  it('preserves headers and handles comments and NAGs without crashing', () => {
    const preview = parsePgnText(COMMENTED_PGN);

    expect(parseHeaders(COMMENTED_PGN).Event).toBe('Commented import');
    expect(preview.games[0].legal_status).toBe('valid');
    expect(preview.games[0].raw_pgn).toContain('{Queen pawn start}');
    expect(preview.games[0].normalized_pgn).toContain('1. d4');
  });

  it('rejects malformed moves safely', () => {
    const preview = parsePgnText(INVALID_PGN);

    expect(preview.detected_count).toBe(1);
    expect(preview.invalid_count).toBe(1);
    expect(preview.games[0].validation_errors.length).toBeGreaterThan(0);
  });

  it('keeps valid games when another game in the same import is invalid', () => {
    const preview = parsePgnText(`${VALID_PGN}\n\n${INVALID_PGN}`);

    expect(preview.detected_count).toBe(2);
    expect(preview.valid_count).toBe(1);
    expect(preview.invalid_count).toBe(1);
  });
});

