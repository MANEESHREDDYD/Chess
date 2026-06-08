import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../state/playerStore';
import { getAllLocalPlayers, createLocalPlayer } from '../data/db';
import type { PlayerRecord } from '../data/db';

export function Onboarding() {
  const [name, setName] = useState('');
  const [existingPlayers, setExistingPlayers] = useState<PlayerRecord[]>([]);
  const { setActivePlayer, loadActivePlayer, activePlayerId } = usePlayerStore();
  const navigate = useNavigate();

  useEffect(() => {
    void loadActivePlayer();
    void getAllLocalPlayers().then(setExistingPlayers);
  }, [loadActivePlayer]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const player = await createLocalPlayer(name.trim());
    await setActivePlayer(player.id);
    navigate('/calibration');
  };

  const handleSelect = async (playerId: string) => {
    await setActivePlayer(playerId);
    navigate('/');
  };

  return (
    <div className="layout">
      <main className="content" style={{ maxWidth: '600px', margin: '4rem auto', padding: '2rem', background: '#fff', borderRadius: '8px' }}>
        <h1 style={{ marginBottom: '1.5rem' }}>Welcome to MIRROR</h1>
        <p style={{ marginBottom: '2rem', color: '#666' }}>
          Create a local player profile to track your style vector and match history.
        </p>

        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '1rem', marginBottom: '3rem' }}>
          <input
            type="text"
            className="input"
            placeholder="Enter display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            Create Profile
          </button>
        </form>

        {existingPlayers.length > 0 && (
          <div>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Or continue as:</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {existingPlayers.map(p => (
                <button
                  key={p.id}
                  className="btn btn-ghost"
                  style={{ textAlign: 'left', padding: '1rem', border: '1px solid #eee' }}
                  onClick={() => handleSelect(p.id)}
                >
                  <span style={{ fontWeight: 'bold' }}>{p.display_name}</span>
                  {p.id === activePlayerId && <span style={{ marginLeft: '1rem', color: 'green', fontSize: '0.8rem' }}>(Active)</span>}
                  <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>
                    Status: {p.calibration_status}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
