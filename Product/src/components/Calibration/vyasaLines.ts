export type VyasaTrigger =
  | 'ahead_in_material'
  | 'behind_in_material'
  | 'balanced'
  | 'winning_endgame'
  | 'losing_endgame'
  | 'time_pressure'
  | 'after_blunder'
  | 'after_brilliancy'
  | 'opening_phase'
  | 'middlegame_opening'
  | 'queens_exchanged'
  | 'match_end';

export type VyasaLine = {
  trigger: VyasaTrigger;
  line: string;
};

export type VyasaSnapshot = {
  materialBalance: number;
  moveCount: number;
  phase: 'opening' | 'middlegame' | 'winning_endgame' | 'losing_endgame';
  timePressure: boolean;
  afterBlunder: boolean;
  afterBrilliancy: boolean;
  queensExchanged: boolean;
  gameOver: boolean;
};

export const vyasaLines: VyasaLine[] = [
  { trigger: 'ahead_in_material', line: 'You are ahead. This is when most apprentices throw the game away.' },
  { trigger: 'behind_in_material', line: 'Material is against you. The position need not be.' },
  { trigger: 'balanced', line: 'Even, still. We are honest with each other today.' },
  { trigger: 'winning_endgame', line: 'You have arrived. Do not stumble at the door.' },
  { trigger: 'losing_endgame', line: 'I am ahead now. I will not show mercy out of politeness.' },
  { trigger: 'time_pressure', line: 'Your clock runs faster than your thinking. Slow the one, or the other will.' },
  { trigger: 'after_blunder', line: 'An expensive move. We learn from these, or we are condemned to repeat them.' },
  { trigger: 'after_brilliancy', line: 'That, I did not see. I will need to think tonight about how.' },
  { trigger: 'opening_phase', line: 'We are still arranging our houses. The fight comes later.' },
  { trigger: 'middlegame_opening', line: 'Now you tell me what kind of game we are playing.' },
  { trigger: 'queens_exchanged', line: 'Without the queens, the position breathes differently. Or it suffocates. We shall see.' },
  { trigger: 'match_end', line: 'Enough. Close the board.' },
];

export function pickVyasaLine(snapshot: VyasaSnapshot): VyasaLine {
  if (snapshot.gameOver) return byTrigger('match_end');
  if (snapshot.afterBlunder) return byTrigger('after_blunder');
  if (snapshot.afterBrilliancy) return byTrigger('after_brilliancy');
  if (snapshot.timePressure) return byTrigger('time_pressure');
  if (snapshot.phase === 'opening' || snapshot.moveCount < 8) return byTrigger('opening_phase');
  if (snapshot.phase === 'winning_endgame') return byTrigger('winning_endgame');
  if (snapshot.phase === 'losing_endgame') return byTrigger('losing_endgame');
  if (snapshot.queensExchanged) return byTrigger('queens_exchanged');
  if (snapshot.materialBalance >= 2) return byTrigger('ahead_in_material');
  if (snapshot.materialBalance <= -2) return byTrigger('behind_in_material');
  if (snapshot.materialBalance === 0) return byTrigger('balanced');
  if (snapshot.phase === 'middlegame' && snapshot.materialBalance === 1) return byTrigger('middlegame_opening');
  return byTrigger('middlegame_opening');
}

function byTrigger(trigger: VyasaTrigger): VyasaLine {
  const line = vyasaLines.find((entry) => entry.trigger === trigger);
  if (!line) {
    throw new Error(`Missing Vyasa line for trigger ${trigger}`);
  }
  return line;
}
