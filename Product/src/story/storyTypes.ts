export type StoryChapterStatus = 'locked' | 'available' | 'complete';
export type DialogueTone = 'narrator' | 'teacher' | 'rival' | 'reflection' | 'hostile' | 'mocking' | 'angry';
export type EncounterType = 'fixed_position' | 'play_engine' | 'clue_puzzle';

export interface StoryDialogueLine {
  speaker: string;
  text: string;
  tone?: DialogueTone;
}

export interface StoryEncounter {
  type: EncounterType;
  fen?: string;
  side: 'white' | 'black';
  objective: string;
  engine_difficulty?: 'Beginner' | 'Casual' | 'Club' | 'Strong';
  puzzle_id?: string;
  max_moves?: number; // E.g., survive N moves
}

export interface StoryChapter {
  id: string;
  act_number?: number;
  act_title?: string;
  chapter_number: number;
  title: string;
  subtitle?: string;
  character: string;
  location: string;
  required_previous_chapter_id?: string;
  intro_dialogue: StoryDialogueLine[];
  win_dialogue?: StoryDialogueLine[];
  loss_dialogue?: StoryDialogueLine[];
  draw_dialogue?: StoryDialogueLine[];
  encounter: StoryEncounter;
  theme?: 'classic' | 'mahabharata';
}

export interface StoryProgressRecord {
  id: string; // usually `${playerId}_${chapterId}`
  player_id: string;
  chapter_id: string;
  status: StoryChapterStatus;
  best_result?: 'win' | 'loss' | 'draw';
  attempts: number;
  completed_at?: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}
