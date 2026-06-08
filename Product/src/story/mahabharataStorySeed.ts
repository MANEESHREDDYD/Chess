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
  },
  {
    id: 'ch4_direct_path',
    chapter_number: 4,
    title: 'The Direct Path',
    subtitle: 'The Mace\'s Strike',
    character: 'Bhima',
    location: 'The Practice Grounds',
    required_previous_chapter_id: 'ch3_fork_in_field',
    intro_dialogue: [
      { speaker: 'Bhima', text: 'Subtlety is for cowards! When the enemy exposes their king, you strike with full force.', tone: 'teacher' },
      { speaker: 'Bhima', text: 'But even a mace requires aim. Show me you can channel your power into a calculating blow.', tone: 'narrator' }
    ],
    win_dialogue: [
      { speaker: 'Bhima', text: 'A crushing victory! Power and precision, perfectly aligned.', tone: 'reflection' }
    ],
    loss_dialogue: [
      { speaker: 'Bhima', text: 'You swung wild and missed the mark. Focus!', tone: 'teacher' }
    ],
    encounter: {
      type: 'clue_puzzle',
      side: 'white',
      objective: 'Deliver a forcing checkmate.',
      puzzle_id: 'seed-mate-bhima'
    },
    theme: 'mahabharata'
  },
  {
    id: 'ch5_teachers_position',
    chapter_number: 5,
    title: 'The Teacher\'s Position',
    subtitle: 'Seeing the Whole Board',
    character: 'Drona',
    location: 'The Royal Armoury',
    required_previous_chapter_id: 'ch4_direct_path',
    intro_dialogue: [
      { speaker: 'Drona', text: 'You stare so intently at the center that you ignore the flanks. A commander must possess eyes everywhere.', tone: 'teacher' },
      { speaker: 'Drona', text: 'Look across the entire field. The enemy has left a flank exposed, but you must notice it to exploit it.', tone: 'narrator' }
    ],
    win_dialogue: [
      { speaker: 'Drona', text: 'Good. Awareness is the first defense, and the greatest weapon.', tone: 'reflection' }
    ],
    loss_dialogue: [
      { speaker: 'Drona', text: 'Your vision is too narrow. Broaden your gaze and try again.', tone: 'teacher' }
    ],
    encounter: {
      type: 'clue_puzzle',
      side: 'white',
      objective: 'Find the hanging piece across the board.',
      puzzle_id: 'seed-defense-drona'
    },
    theme: 'mahabharata'
  },
  {
    id: 'ch6_risk_of_fire',
    chapter_number: 6,
    title: 'The Risk of Fire',
    subtitle: 'Courage and Calculation',
    character: 'Karna',
    location: 'The Riverbank',
    required_previous_chapter_id: 'ch5_teachers_position',
    intro_dialogue: [
      { speaker: 'Karna', text: 'They call it bravery to charge into the flames. I call it foolishness if you have not counted the cost.', tone: 'teacher' },
      { speaker: 'Karna', text: 'The enemy offers a tempting target. Strike blindly, and you will find nothing but ash.', tone: 'narrator' }
    ],
    win_dialogue: [
      { speaker: 'Karna', text: 'You saw through the illusion. A warrior\'s true strength is his mind, not just his bow.', tone: 'reflection' }
    ],
    loss_dialogue: [
      { speaker: 'Karna', text: 'You let pride dictate your move. Calculation must guide your courage.', tone: 'teacher' }
    ],
    encounter: {
      type: 'clue_puzzle',
      side: 'white',
      objective: 'Avoid the stalemate trap and find the correct forcing move.',
      puzzle_id: 'seed-tactics-karna'
    },
    theme: 'mahabharata'
  },
  {
    id: 'ch7_difficult_choice',
    chapter_number: 7,
    title: 'The Difficult Choice',
    subtitle: 'Sacrifice and Duty',
    character: 'Krishna',
    location: 'The Chariot',
    required_previous_chapter_id: 'ch6_risk_of_fire',
    intro_dialogue: [
      { speaker: 'Krishna', text: 'The board is a mirror of choices. Sometimes, the piece you value most must be surrendered to secure the outcome.', tone: 'teacher' },
      { speaker: 'Krishna', text: 'Do not mourn the loss of material if it fulfills the greater design. Make the difficult choice.', tone: 'narrator' }
    ],
    win_dialogue: [
      { speaker: 'Krishna', text: 'You understand. The right move is rarely the comfortable one.', tone: 'reflection' }
    ],
    loss_dialogue: [
      { speaker: 'Krishna', text: 'You clung to what you should have let go. Look deeper.', tone: 'teacher' }
    ],
    encounter: {
      type: 'clue_puzzle',
      side: 'white',
      objective: 'Sacrifice the queen to force checkmate.',
      puzzle_id: 'seed-multi-mate-1'
    },
    theme: 'mahabharata'
  }
];
