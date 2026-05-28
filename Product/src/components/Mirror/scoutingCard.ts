import type { MirrorMatchRecord } from '../../data/db';
import type { StyleVector } from '../../ml/styleVector';

export interface MirrorRecordSummary {
  playerWins: number;
  mirrorWins: number;
  draws: number;
}

export interface ScoutingCardInput {
  vector: StyleVector;
  record: MirrorRecordSummary;
  line: string;
}

export function getScoutingTraits(vector: StyleVector): string[] {
  return [
    exchangeTrait(vector),
    pressureTrait(vector),
    phaseTrait(vector),
    swindleTrait(vector),
  ];
}

export function summarizeMirrorRecord(matches: MirrorMatchRecord[]): MirrorRecordSummary {
  return matches.reduce<MirrorRecordSummary>(
    (record, match) => {
      if (match.result === 'You won') return { ...record, playerWins: record.playerWins + 1 };
      if (match.result === 'Mirror won') return { ...record, mirrorWins: record.mirrorWins + 1 };
      if (match.result === 'Draw') return { ...record, draws: record.draws + 1 };
      return record;
    },
    { playerWins: 0, mirrorWins: 0, draws: 0 }
  );
}

export function scoutingCardShareText(input: ScoutingCardInput): string {
  return `MIRROR scouting card: ${getScoutingTraits(input.vector).join(' / ')}. Record ${recordText(input.record)}. ${input.line}`;
}

export async function renderScoutingCardPng(input: ScoutingCardInput): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create scouting card canvas.');

  ctx.fillStyle = '#f5f0e6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1e3a5f';
  ctx.fillRect(0, 0, canvas.width, 165);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(0, 165, canvas.width, 8);

  ctx.fillStyle = '#f5f0e6';
  ctx.font = '600 68px serif';
  ctx.fillText('MIRROR', 72, 104);
  ctx.font = '28px serif';
  ctx.fillText('Chess personality scouting card', 72, 145);

  ctx.fillStyle = '#1f1a17';
  ctx.font = '600 54px serif';
  ctx.fillText('Read from your style vector', 72, 260);

  const traits = getScoutingTraits(input.vector);
  ctx.font = '38px serif';
  let y = 350;
  traits.forEach((trait) => {
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(72, y - 38, 12, 54);
    ctx.fillStyle = '#1f1a17';
    wrapText(ctx, trait, 110, y, 860, 46);
    y += 104;
  });

  ctx.fillStyle = '#efe4cf';
  roundRect(ctx, 72, 760, 936, 150, 8);
  ctx.fill();
  ctx.fillStyle = '#1f1a17';
  ctx.font = '600 34px serif';
  ctx.fillText('Mirror record', 112, 820);
  ctx.font = '46px serif';
  ctx.fillText(recordText(input.record), 112, 875);

  ctx.fillStyle = '#1e3a5f';
  ctx.font = '600 38px serif';
  ctx.fillText('Screenshot line', 72, 1000);
  ctx.fillStyle = '#1f1a17';
  ctx.font = '36px serif';
  wrapText(ctx, input.line, 72, 1060, 920, 46);

  ctx.fillStyle = '#6b5b4b';
  ctx.font = '26px serif';
  ctx.fillText('Generated locally by MIRROR', 72, 1268);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not encode scouting card PNG.');
  return blob;
}

function exchangeTrait(vector: StyleVector): string {
  if (vector.exchange_willingness >= 0.7) return 'Accepts trades readily';
  if (vector.exchange_willingness <= 0.3) return 'Avoids equal trades';
  return 'Trades selectively';
}

function pressureTrait(vector: StyleVector): string {
  if (vector.time_pressure_blunder_rate >= 0.65) return 'Vulnerable when the clock tightens';
  if (vector.time_pressure_blunder_rate <= 0.35) return 'Stable under time pressure';
  return 'Mixed under time pressure';
}

function phaseTrait(vector: StyleVector): string {
  if (vector.endgame_strength >= 0.7) return 'Strongest when the board thins out';
  if (vector.endgame_strength <= 0.35) return 'Endgame is still the weak square';
  return 'Endgame technique is usable, not certain';
}

function swindleTrait(vector: StyleVector): string {
  if (vector.swindle_preference === 'swindle') return 'Keeps messy counterplay alive';
  if (vector.swindle_preference === 'principled') return 'Prefers the clean line over the trap';
  if (vector.preferred_minor === 'bishop') return 'Leans toward bishops';
  if (vector.preferred_minor === 'knight') return 'Leans toward knights';
  return 'Minor-piece preference is neutral';
}

function recordText(record: MirrorRecordSummary): string {
  return `${record.playerWins}-${record.mirrorWins}-${record.draws}`;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): void {
  const words = text.split(/\s+/);
  let line = '';
  let cursorY = y;

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
      return;
    }
    line = testLine;
  });

  if (line) ctx.fillText(line, x, cursorY);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
