import React from 'react';
import { useNavigate } from 'react-router-dom';

export const AboutProject: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-bg text-ink p-8 font-serif">
      <div className="max-w-3xl mx-auto space-y-12">
        <header className="space-y-4">
          <button 
            onClick={() => navigate('/')}
            className="text-ink-faded hover:text-ink transition-colors font-mono text-sm mb-8"
          >
            ← Back to Home
          </button>
          <h1 className="text-4xl font-bold">About MIRROR</h1>
          <p className="text-xl text-ink-soft">
            A data-driven, offline-first progressive web application combining behavioral AI, 
            analytics, and creative narrative.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold border-b border-rule pb-2">AI Personalization (StyleVector)</h2>
          <p>
            Unlike traditional platforms that rely purely on ELO ratings, MIRROR uses a proprietary
            <strong> StyleVector</strong> with 11 behavioral/profile fields plus schema metadata to build a behavioral fingerprint of your playstyle. It tracks opening preferences,
            motif blindness, time-pressure risk, exchange decisions, and more. When you face your "Mirror" opponent, a custom algorithmic
            layer reranks top Stockfish engine evaluations to simulate your specific human tendencies.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold border-b border-rule pb-2">Local-First Data Architecture</h2>
          <p>
            All telemetry, match history, and progression state are stored securely in your browser's 
            <strong> IndexedDB</strong>. The relational schema is engineered for atomic exports, robust migrations, 
            and conflict-aware merges. This guarantees zero latency and offline capability.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold border-b border-rule pb-2">Chess Analytics & Progression</h2>
          <p>
            Every move generates deep telemetry. The analytics pipeline processes Centipawn (CP) loss to estimate 
            match accuracy, detect specific motif weaknesses (e.g., missed forks), and calculate RPG-style XP. 
            Training puzzles are fed through a SuperMemo-inspired spaced repetition queue to optimize learning velocity.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold border-b border-rule pb-2">Cloud Backup & Security</h2>
          <p>
            While fundamentally local-first, MIRROR integrates securely with <strong>Supabase</strong>. Players can 
            link their accounts via Magic Link and securely upload structured JSON backups to a private Supabase Storage 
            bucket protected by strict Row Level Security (RLS) policies.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold border-b border-rule pb-2">Skills Demonstrated</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Data Engineering</strong>: IndexedDB data modeling, migrations, JSON serialization.</li>
            <li><strong>Data Science</strong>: Engine analytics, move classification, spaced repetition math.</li>
            <li><strong>AI / ML</strong>: Behavioral vectors, custom evaluation reranking.</li>
            <li><strong>Full-Stack</strong>: React, Zustand, Web Workers (Stockfish), Supabase Auth/Storage.</li>
            <li><strong>Creative UI/UX</strong>: Narrative-driven design, fluid transitions, and cohesive themes.</li>
          </ul>
        </section>

        <footer className="pt-8 border-t border-rule text-sm text-ink-faded font-mono">
          <p>Powered by React, Vite, TypeScript, and Stockfish 16.1</p>
        </footer>
      </div>
    </div>
  );
};
