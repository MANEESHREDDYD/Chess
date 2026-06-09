import type { StoryChapter } from './storyTypes';

export const mahabharataStorySeed: StoryChapter[] = [
  {
    id: 'ch1_apprentice_arrives',
    act_number: 1,
    act_title: 'Act I',
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
    act_number: 1,
    act_title: 'Act I',
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
    act_number: 1,
    act_title: 'Act I',
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
    act_number: 1,
    act_title: 'Act I',
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
    act_number: 1,
    act_title: 'Act I',
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
    act_number: 1,
    act_title: 'Act I',
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
    act_number: 1,
    act_title: 'Act I',
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
  },
  {
    id: 'ch8_circle_narrows',
    act_number: 2,
    act_title: 'Act II',
    chapter_number: 8,
    title: 'The Circle Narrows',
    subtitle: 'Courage and Awareness',
    character: 'Abhimanyu',
    location: 'The Chakravyuha',
    required_previous_chapter_id: 'ch7_difficult_choice',
    intro_dialogue: [
      { speaker: 'Abhimanyu', text: 'To enter the formation requires courage. To survive it requires sight.', tone: 'teacher' },
      { speaker: 'Abhimanyu', text: 'You are surrounded. Every enemy piece converges on you. Find the precise defense to weather the storm.', tone: 'narrator' }
    ],
    win_dialogue: [
      { speaker: 'Abhimanyu', text: 'You held the line. Courage is nothing without the calculation to sustain it.', tone: 'reflection' }
    ],
    loss_dialogue: [
      { speaker: 'Abhimanyu', text: 'You panicked under pressure. Look calmly at the board.', tone: 'teacher' }
    ],
    encounter: {
      type: 'clue_puzzle',
      side: 'white',
      objective: 'Defend the pinned piece and prepare for the trade.',
      puzzle_id: 'seed-multi-defense-1'
    },
    theme: 'mahabharata'
  },
  {
    id: 'ch9_unbroken_vow',
    act_number: 2,
    act_title: 'Act II',
    chapter_number: 9,
    title: 'The Unbroken Vow',
    subtitle: 'Resilience',
    character: 'Draupadi',
    location: 'The Royal Court',
    required_previous_chapter_id: 'ch8_circle_narrows',
    intro_dialogue: [
      { speaker: 'Draupadi', text: 'There are moments when the position seems utterly lost, when humiliation feels certain.', tone: 'narrator' },
      { speaker: 'Draupadi', text: 'But true resilience is finding the single move that maintains your dignity. Find the exact defensive resource.', tone: 'teacher' }
    ],
    win_dialogue: [
      { speaker: 'Draupadi', text: 'You did not break. The game continues.', tone: 'reflection' }
    ],
    loss_dialogue: [
      { speaker: 'Draupadi', text: 'You yielded too easily. There is always a resource if you look for it.', tone: 'teacher' }
    ],
    encounter: {
      type: 'clue_puzzle',
      side: 'white',
      objective: 'Find the only precise move to block the check.',
      puzzle_id: 'seed-defensive-resource-1'
    },
    theme: 'mahabharata'
  },
  {
    id: 'ch10_night_tactic',
    act_number: 2,
    act_title: 'Act II',
    chapter_number: 10,
    title: 'The Night Tactic',
    subtitle: 'Disruption',
    character: 'Ghatotkacha',
    location: 'The Night Camp',
    required_previous_chapter_id: 'ch9_unbroken_vow',
    intro_dialogue: [
      { speaker: 'Ghatotkacha', text: 'When the enemy feels safe, that is when you tear down their illusions.', tone: 'teacher' },
      { speaker: 'Ghatotkacha', text: 'Sacrifice what you must. Disrupt their lines. Give them no time to breathe.', tone: 'narrator' }
    ],
    win_dialogue: [
      { speaker: 'Ghatotkacha', text: 'A brilliant disruption! The enemy structure is shattered.', tone: 'reflection' }
    ],
    loss_dialogue: [
      { speaker: 'Ghatotkacha', text: 'Too hesitant. In the chaos of night, you must act decisively.', tone: 'teacher' }
    ],
    encounter: {
      type: 'clue_puzzle',
      side: 'white',
      objective: 'Sacrifice the queen for a smothered mate.',
      puzzle_id: 'seed-multi-disrupt-1'
    },
    theme: 'mahabharata'
  },
  {
    id: 'ch11_hidden_file',
    act_number: 2,
    act_title: 'Act II',
    chapter_number: 11,
    title: 'The Hidden File',
    subtitle: 'Discovered Alignments',
    character: 'Shikhandi',
    location: 'Behind the Vanguard',
    required_previous_chapter_id: 'ch10_night_tactic',
    intro_dialogue: [
      { speaker: 'Shikhandi', text: 'The most lethal attack is the one the enemy cannot see until it is too late.', tone: 'narrator' },
      { speaker: 'Shikhandi', text: 'Your pieces align, but the threat is masked. Remove the mask and strike.', tone: 'teacher' }
    ],
    win_dialogue: [
      { speaker: 'Shikhandi', text: 'Perfectly executed. The true threat was there all along.', tone: 'reflection' }
    ],
    loss_dialogue: [
      { speaker: 'Shikhandi', text: 'You revealed your hand without consequence. Look for the double threat.', tone: 'teacher' }
    ],
    encounter: {
      type: 'clue_puzzle',
      side: 'white',
      objective: 'Execute the discovered attack to win material.',
      puzzle_id: 'seed-discovered-attack-1'
    },
    theme: 'mahabharata'
  },
  {
    id: 'ch12_field_before_dawn',
    act_number: 2,
    act_title: 'Act II',
    chapter_number: 12,
    title: 'The Field Before Dawn',
    subtitle: 'Synthesis',
    character: 'Vyasa',
    location: 'The Hermitage',
    required_previous_chapter_id: 'ch11_hidden_file',
    intro_dialogue: [
      { speaker: 'Vyasa', text: 'You have seen defense, sacrifice, disruption, and discovery.', tone: 'narrator' },
      { speaker: 'Vyasa', text: 'Now, synthesize these lessons. The patterns are everywhere if you know how to look.', tone: 'teacher' }
    ],
    win_dialogue: [
      { speaker: 'Vyasa', text: 'You begin to see the board as it truly is. We are ready for the next phase.', tone: 'reflection' }
    ],
    loss_dialogue: [
      { speaker: 'Vyasa', text: 'You have forgotten the lessons. Start again.', tone: 'teacher' }
    ],
    encounter: {
      type: 'clue_puzzle',
      side: 'white',
      objective: 'Deliver the final back-rank mate.',
      puzzle_id: 'seed-mixed-motif-1'
    },
    theme: 'mahabharata'
  },
  {
    id: 'ch13_bhishma_line',
    act_number: 3,
    act_title: 'Act III',
    chapter_number: 13,
    title: 'The Line That Holds',
    subtitle: 'The Patriarch\'s Vow',
    character: 'Bhishma',
    location: 'The Trenches of Kurukshetra',
    required_previous_chapter_id: 'ch12_field_before_dawn',
    intro_dialogue: [
      { speaker: 'Bhishma', text: 'You have come far, but stamina alone will not save you here. The battle has hardened.', tone: 'teacher' },
      { speaker: 'Bhishma', text: 'To survive against an overwhelming force, you must know what lines to hold and what pieces to exchange. Defend your back rank.', tone: 'narrator' }
    ],
    win_dialogue: [
      { speaker: 'Bhishma', text: 'A wise trade. You possess the restraint needed to endure.', tone: 'reflection' }
    ],
    loss_dialogue: [
      { speaker: 'Bhishma', text: 'Your line broke. Restraint is as vital as the attack.', tone: 'narrator' }
    ],
    encounter: {
      type: 'clue_puzzle',
      side: 'white',
      objective: 'Defend against the attack by simplifying the position.',
      puzzle_id: 'seed-act3-defense-line-1'
    },
    theme: 'mahabharata'
  },
  {
    id: 'ch14_duryodhana_poisoned',
    act_number: 3,
    act_title: 'Act III',
    chapter_number: 14,
    title: 'The Poisoned Gain',
    subtitle: 'The Crown Prince\'s Greed',
    character: 'Duryodhana',
    location: 'The Kuru Encampment',
    required_previous_chapter_id: 'ch13_bhishma_line',
    intro_dialogue: [
      { speaker: 'Duryodhana', text: 'You think you are clever, snatching whatever falls into your path. But power is not always what it seems.', tone: 'hostile' },
      { speaker: 'Duryodhana', text: 'Go ahead. Take the prize. Or are you finally learning to see the trap beneath the gold?', tone: 'mocking' }
    ],
    win_dialogue: [
      { speaker: 'Duryodhana', text: 'You refused the bait... and struck where it hurt. I underestimated you.', tone: 'angry' }
    ],
    loss_dialogue: [
      { speaker: 'Duryodhana', text: 'Greed is a predictable master. You fell right into it.', tone: 'hostile' }
    ],
    encounter: {
      type: 'clue_puzzle',
      side: 'white',
      objective: 'Avoid the trap and calculate the winning sequence.',
      puzzle_id: 'seed-act3-poisoned-gain-1'
    },
    theme: 'mahabharata'
  },
  {
    id: 'ch15_satyaki_open_file',
    act_number: 3,
    act_title: 'Act III',
    chapter_number: 15,
    title: 'The Open File',
    subtitle: 'The Untiring Warrior',
    character: 'Satyaki',
    location: 'The Eastern Flank',
    required_previous_chapter_id: 'ch14_duryodhana_poisoned',
    intro_dialogue: [
      { speaker: 'Satyaki', text: 'We do not wait for the enemy to show their weaknesses. We carve them open!', tone: 'teacher' },
      { speaker: 'Satyaki', text: 'Find the hidden alignment. A single sacrifice can tear the battlefield wide open.', tone: 'narrator' }
    ],
    win_dialogue: [
      { speaker: 'Satyaki', text: 'Excellent! The initiative is everything.', tone: 'reflection' }
    ],
    loss_dialogue: [
      { speaker: 'Satyaki', text: 'You were too hesitant. The moment closed as quickly as it appeared.', tone: 'narrator' }
    ],
    encounter: {
      type: 'clue_puzzle',
      side: 'white',
      objective: 'Execute a discovered attack to win material.',
      puzzle_id: 'seed-act3-open-file-1'
    },
    theme: 'mahabharata'
  },
  {
    id: 'ch16_ashwatthama_calculation',
    act_number: 3,
    act_title: 'Act III',
    chapter_number: 16,
    title: 'The Unquiet Calculation',
    subtitle: 'The Night\'s Fury',
    character: 'Ashwatthama',
    location: 'The Shadowed Camp',
    required_previous_chapter_id: 'ch15_satyaki_open_file',
    intro_dialogue: [
      { speaker: 'Ashwatthama', text: 'Everything is lost, and so everything is permitted. I will leave no piece standing.', tone: 'hostile' },
      { speaker: 'Ashwatthama', text: 'Can you see through the chaos? Calculate to the end, or be swept away in the storm.', tone: 'angry' }
    ],
    win_dialogue: [
      { speaker: 'Ashwatthama', text: 'You saw through the blood... your mind remains unclouded.', tone: 'reflection' }
    ],
    loss_dialogue: [
      { speaker: 'Ashwatthama', text: 'Urgency blinded you. The dark takes another.', tone: 'hostile' }
    ],
    encounter: {
      type: 'clue_puzzle',
      side: 'white',
      objective: 'Force a sequence leading to checkmate.',
      puzzle_id: 'seed-act3-calculation-1'
    },
    theme: 'mahabharata'
  }
];

