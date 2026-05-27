import { describe, expect, it } from 'vitest';
import { pickVyasaLine, vyasaLines, type VyasaSnapshot } from './vyasaLines';

const cases: Array<{ snapshot: VyasaSnapshot; trigger: (typeof vyasaLines)[number]['trigger'] }> = [
  { snapshot: { materialBalance: 0, moveCount: 0, phase: 'opening', timePressure: false, afterBlunder: false, afterBrilliancy: false, queensExchanged: false, gameOver: false }, trigger: 'opening_phase' },
  { snapshot: { materialBalance: 1, moveCount: 9, phase: 'middlegame', timePressure: false, afterBlunder: false, afterBrilliancy: false, queensExchanged: false, gameOver: false }, trigger: 'middlegame_opening' },
  { snapshot: { materialBalance: 2, moveCount: 12, phase: 'middlegame', timePressure: false, afterBlunder: false, afterBrilliancy: false, queensExchanged: false, gameOver: false }, trigger: 'ahead_in_material' },
  { snapshot: { materialBalance: -3, moveCount: 12, phase: 'middlegame', timePressure: false, afterBlunder: false, afterBrilliancy: false, queensExchanged: false, gameOver: false }, trigger: 'behind_in_material' },
  { snapshot: { materialBalance: 0, moveCount: 12, phase: 'middlegame', timePressure: false, afterBlunder: false, afterBrilliancy: false, queensExchanged: false, gameOver: false }, trigger: 'balanced' },
  { snapshot: { materialBalance: 0, moveCount: 30, phase: 'winning_endgame', timePressure: false, afterBlunder: false, afterBrilliancy: false, queensExchanged: false, gameOver: false }, trigger: 'winning_endgame' },
  { snapshot: { materialBalance: 0, moveCount: 30, phase: 'losing_endgame', timePressure: false, afterBlunder: false, afterBrilliancy: false, queensExchanged: false, gameOver: false }, trigger: 'losing_endgame' },
  { snapshot: { materialBalance: 0, moveCount: 20, phase: 'middlegame', timePressure: true, afterBlunder: false, afterBrilliancy: false, queensExchanged: false, gameOver: false }, trigger: 'time_pressure' },
  { snapshot: { materialBalance: 0, moveCount: 20, phase: 'middlegame', timePressure: false, afterBlunder: true, afterBrilliancy: false, queensExchanged: false, gameOver: false }, trigger: 'after_blunder' },
  { snapshot: { materialBalance: 0, moveCount: 20, phase: 'middlegame', timePressure: false, afterBlunder: false, afterBrilliancy: true, queensExchanged: false, gameOver: false }, trigger: 'after_brilliancy' },
  { snapshot: { materialBalance: 0, moveCount: 20, phase: 'middlegame', timePressure: false, afterBlunder: false, afterBrilliancy: false, queensExchanged: true, gameOver: false }, trigger: 'queens_exchanged' },
  { snapshot: { materialBalance: 0, moveCount: 20, phase: 'middlegame', timePressure: false, afterBlunder: false, afterBrilliancy: false, queensExchanged: false, gameOver: true }, trigger: 'match_end' },
];

describe('pickVyasaLine', () => {
  it.each(cases)('selects the correct line for $trigger', ({ snapshot, trigger }) => {
    expect(pickVyasaLine(snapshot).trigger).toBe(trigger);
  });

  it('treats game over as the highest priority', () => {
    const line = pickVyasaLine({
      materialBalance: 0,
      moveCount: 50,
      phase: 'middlegame',
      timePressure: true,
      afterBlunder: true,
      afterBrilliancy: true,
      queensExchanged: true,
      gameOver: true,
    });

    expect(line.trigger).toBe('match_end');
  });
});
