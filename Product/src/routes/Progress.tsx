import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../state/playerStore';
import { 
  getPlayerProgressSummary, 
  scanAndGrantAchievements, 
  type PlayerProgressSummary 
} from '../progression/progression';

export const Progress: React.FC = () => {
  const navigate = useNavigate();
  const activePlayer = usePlayerStore(s => s.activePlayer);
  const [summary, setSummary] = useState<PlayerProgressSummary | null>(null);

  useEffect(() => {
    if (!activePlayer) {
      navigate('/');
      return;
    }

    let isMounted = true;
    const load = async () => {
      await scanAndGrantAchievements(activePlayer.id);
      const data = await getPlayerProgressSummary(activePlayer.id);
      if (isMounted) setSummary(data);
    };

    load();

    return () => { isMounted = false; };
  }, [activePlayer, navigate]);

  if (!activePlayer || !summary) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--surface-color)] text-[var(--text-color)]">
        <p>Loading Progression...</p>
      </div>
    );
  }

  const nextLevelXp = Math.pow(summary.level, 2) * 100;
  const currentLevelBaseXp = Math.pow(summary.level - 1, 2) * 100;
  const xpInCurrentLevel = summary.total_xp - currentLevelBaseXp;
  const xpRequiredForNext = nextLevelXp - currentLevelBaseXp;
  const progressPercent = Math.min(100, Math.max(0, (xpInCurrentLevel / xpRequiredForNext) * 100));

  return (
    <div className="min-h-screen bg-[var(--surface-color)] text-[var(--text-color)] p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-end border-b border-[var(--border-color)] pb-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--primary-color)]">Player Progression</h1>
            <p className="text-sm opacity-80 mt-1">{activePlayer.display_name}</p>
          </div>
          <button 
            onClick={() => navigate('/')} 
            className="px-4 py-2 border border-[var(--border-color)] rounded hover:bg-[var(--primary-color)] hover:text-white transition-colors"
          >
            Back Home
          </button>
        </div>

        {/* Level and XP */}
        <section className="bg-[var(--surface-color-alt)] border border-[var(--border-color)] rounded-lg p-6 flex flex-col md:flex-row items-center gap-6">
          <div className="flex-shrink-0 text-center">
            <div className="text-5xl font-bold text-[var(--primary-color)]">{summary.level}</div>
            <div className="text-xs uppercase tracking-widest opacity-70 mt-1">Level</div>
          </div>
          <div className="flex-grow w-full">
            <div className="flex justify-between text-sm mb-2">
              <span>{summary.total_xp} XP</span>
              <span className="opacity-70">{nextLevelXp} XP</span>
            </div>
            <div className="h-4 bg-[var(--surface-color)] rounded-full overflow-hidden border border-[var(--border-color)]">
              <div 
                className="h-full bg-[var(--primary-color)] transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <div className="flex-shrink-0 text-center border-l border-[var(--border-color)] pl-6 min-w-[120px]">
            <div className="text-3xl font-bold text-orange-400">{summary.current_streak_days}</div>
            <div className="text-xs uppercase tracking-widest opacity-70 mt-1">Day Streak</div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Activity Stats */}
          <div className="bg-[var(--surface-color-alt)] border border-[var(--border-color)] rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 border-b border-[var(--border-color)] pb-2">Activity</h2>
            <ul className="space-y-3">
              <li className="flex justify-between"><span>Games Played</span> <strong>{summary.total_games}</strong></li>
              <li className="flex justify-between"><span>Mirror Matches</span> <strong>{summary.total_mirror_matches}</strong></li>
              <li className="flex justify-between"><span>Analyses Saved</span> <strong>{summary.total_analyses}</strong></li>
              <li className="flex justify-between"><span>Story Chapters</span> <strong>{summary.story_chapters_complete} / {summary.story_total_chapters}</strong></li>
            </ul>
          </div>

          {/* Clue Stats */}
          <div className="bg-[var(--surface-color-alt)] border border-[var(--border-color)] rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 border-b border-[var(--border-color)] pb-2">Tactics</h2>
            <ul className="space-y-3">
              <li className="flex justify-between"><span>Puzzles Solved</span> <strong>{summary.clue_solved} / {summary.clue_attempts}</strong></li>
              <li className="flex justify-between"><span>Solve Rate</span> <strong>{summary.clue_solved_rate.toFixed(1)}%</strong></li>
              <li className="flex justify-between"><span>Multi-Move Solved</span> <strong>{summary.multi_move_solved}</strong></li>
              {summary.weakest_motif && (
                <li className="flex justify-between text-red-400"><span>Weakest Motif</span> <strong className="capitalize">{summary.weakest_motif.replace(/_/g, ' ')}</strong></li>
              )}
            </ul>
          </div>
        </section>

        {/* Next Action */}
        <section className="bg-[var(--primary-color)] text-white rounded-lg p-6 text-center shadow-lg">
          <h2 className="text-sm uppercase tracking-widest opacity-80 mb-2">Recommended Next Action</h2>
          <p className="text-xl font-bold">{summary.next_action}</p>
        </section>

        {/* Achievements */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Achievements</h2>
          {summary.achievements.length === 0 ? (
            <p className="opacity-70 italic">No achievements earned yet. Keep playing!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.achievements.map(a => (
                <div key={a.id} className="bg-[var(--surface-color-alt)] border border-[var(--border-color)] rounded p-4 flex flex-col">
                  <span className="font-bold text-[var(--primary-color)]">{a.title}</span>
                  <span className="text-sm opacity-80 mt-1">{a.description}</span>
                  <span className="text-xs opacity-50 mt-auto pt-4 text-right">
                    {new Date(a.earned_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
};
