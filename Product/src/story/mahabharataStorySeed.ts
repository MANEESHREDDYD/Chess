import type { StoryChapter } from './storyTypes';

export const mahabharataStorySeed: StoryChapter[] = [
  {
    id: 'ch1_apprentice_arrives',
    chapter_number: 1,
    title: 'The Apprentice Arrives',
    subtitle: 'The Frame of the Epic',
    character: 'Vyasa',
    location: 'The Hermitage',
    intro_dialogue: [
      { speaker: 'Vyasa', text: 'You seek to understand the board of Kurukshetra.', tone: 'narrator' },
      { speaker: 'Vyasa', text: 'The pieces are but men, and their moves are dictated by dharma. Or so they believe.', tone: 'reflection' },
      { speaker: 'Vyasa', text: 'Show me you understand the basic flow of the game before we explore its depths. Survive six moves.', tone: 'teacher' }
    ],
    win_dialogue: [
      { speaker: 'Vyasa', text: 'Acceptable. You possess the required patience. Let the true lesson begin.', tone: 'teacher' }
    ],
    loss_dialogue: [
      { speaker: 'Vyasa', text: 'You rush into the fray without observing the board. Try again.', tone: 'narrator' }
    ],
    encounter: {
      type: 'play_engine',
      side: 'white',
      objective: 'Survive 6 moves without losing or making illegal moves.',
      engine_difficulty: 'Beginner',
      max_moves: 6
    },
    theme: 'mahabharata'
  },
  {
    id: 'ch2_honest_move',
    chapter_number: 2,
    title: 'The Honest Move',
    subtitle: 'A Lesson in Principle',
    character: 'Yudhishthira',
    location: 'Indraprastha',
    required_previous_chapter_id: 'ch1_apprentice_arrives',
    intro_dialogue: [
      { speaker: 'Yudhishthira', text: 'Every move we make must be rooted in truth. A deception on the board reflects a deception in the soul.', tone: 'teacher' },
      { speaker: 'Yudhishthira', text: 'I see an opponent laying a trap. Can you find the honest path to victory without falling into falsehood?', tone: 'narrator' }
    ],
    win_dialogue: [
      { speaker: 'Yudhishthira', text: 'A righteous strike. The truth is often the most direct path.', tone: 'reflection' }
    ],
    encounter: {
      type: 'clue_puzzle',
      side: 'white',
      objective: 'Solve the position using principles.',
      puzzle_id: 'seed-mate-1' // Mate in 2, requires precision
    },
    theme: 'mahabharata'
  },
  {
    id: 'ch3_fork_in_field',
    chapter_number: 3,
    title: 'The Fork in the Field',
    subtitle: 'The Archer\'s Dilemma',
    character: 'Arjuna',
    location: 'Kurukshetra Outskirts',
    required_previous_chapter_id: 'ch2_honest_move',
    intro_dialogue: [
      { speaker: 'Arjuna', text: 'An archer must sometimes split his focus, striking two targets with a single thought.', tone: 'teacher' },
      { speaker: 'Arjuna', text: 'Observe the formation. Find the strike that demands an impossible choice from the enemy.', tone: 'narrator' }
    ],
    win_dialogue: [
      { speaker: 'Arjuna', text: 'Flawless precision. A true warrior wastes no motion.', tone: 'reflection' }
    ],
    encounter: {
      type: 'clue_puzzle',
      side: 'white',
      objective: 'Execute a fork tactic.',
      puzzle_id: 'seed-fork-1'
    },
    theme: 'mahabharata'
  }
];
