import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { usePlayerStore } from './state/playerStore';
import { useSettingsStore } from './state/settingsStore';
import About from './routes/About';
import { AboutProject } from './routes/AboutProject';
import { Account } from './routes/Account';
import AnalyticsDashboard from './routes/AnalyticsDashboard';
import Backup from './routes/Backup';
import Calibration from './routes/Calibration';
import ClueChess from './routes/ClueChess';
import CoachPreview from './routes/CoachPreview';
import DevInspector from './routes/DevInspector';
import DevMirrorVerification from './routes/DevMirrorVerification';
import GameReview from './routes/GameReview';
import Home from './routes/Home';
import Mirror from './routes/Mirror';
import { Onboarding } from './routes/Onboarding';
import PgnImport from './routes/PgnImport';
import Play from './routes/Play';
import { Progress } from './routes/Progress';
import StockfishDiagnostics from './routes/StockfishDiagnostics';
import Story from './routes/Story';

export default function App() {
  const loadActivePlayer = usePlayerStore((s) => s.loadActivePlayer);
  const {
    activeTheme,
    setActiveTheme,
    audioEnabled,
    setAudioEnabled,
    audioVolume,
    setAudioVolume,
  } = useSettingsStore();

  useEffect(() => {
    void loadActivePlayer();
  }, [loadActivePlayer]);

  return (
    <AppShell
      activeTheme={activeTheme}
      audioEnabled={audioEnabled}
      audioVolume={audioVolume}
      setActiveTheme={setActiveTheme}
      setAudioEnabled={setAudioEnabled}
      setAudioVolume={setAudioVolume}
    >
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/calibration" element={<Calibration />} />
        <Route path="/mirror" element={<Mirror />} />
        <Route path="/story" element={<Story />} />
        <Route path="/clue-chess" element={<ClueChess />} />
        <Route path="/play" element={<Play />} />
        <Route path="/import-pgn" element={<PgnImport />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
        <Route path="/review/:sourceType/:sourceId" element={<GameReview />} />
        <Route path="/stockfish-diagnostics" element={<StockfishDiagnostics />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/coach-preview" element={<CoachPreview />} />
        <Route path="/backup" element={<Backup />} />
        <Route path="/account" element={<Account />} />
        <Route path="/about" element={<About />} />
        <Route path="/about-project" element={<AboutProject />} />
        {import.meta.env.DEV ? (
          <>
            <Route path="/dev/mirror-verification" element={<DevMirrorVerification />} />
            <Route path="/dev/inspector" element={<DevInspector />} />
          </>
        ) : null}
      </Routes>
    </AppShell>
  );
}
