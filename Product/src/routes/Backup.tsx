import { useState, useRef, useEffect } from 'react';
import { usePlayerStore } from '../state/playerStore';
import { 
  exportMirrorBackup, 
  downloadBackupJson, 
  validateBackupFile, 
  importMirrorBackup, 
  getBackupSummary,
  type ImportOptions 
} from '../backup/backupService';
import type { MirrorBackupFile } from '../backup/backupTypes';
import { onAuthStateChange } from '../auth/authService';
import type { AuthState } from '../auth/authTypes';
import { 
  isCloudBackupConfigured, 
  uploadCloudBackup, 
  listCloudBackups, 
  downloadCloudBackup, 
  deleteCloudBackup 
} from '../cloud/cloudBackupService';
import type { CloudBackupManifest } from '../cloud/cloudBackupTypes';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function Backup() {
  const { activePlayer } = usePlayerStore();
  
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const [pendingBackup, setPendingBackup] = useState<MirrorBackupFile | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importSettings, setImportSettings] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<'active' | 'all'>('active');

  const [cloudConfigured] = useState(isCloudBackupConfigured());
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' });
  const [cloudBackups, setCloudBackups] = useState<CloudBackupManifest[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!cloudConfigured) return;
    const unsubscribe = onAuthStateChange((state) => {
      setAuthState(state);
      if (state.status === 'signed_in') {
        refreshCloudBackups();
      } else {
        setCloudBackups([]);
      }
    });
    return unsubscribe;
  }, [cloudConfigured]);

  const refreshCloudBackups = async () => {
    try {
      setCloudLoading(true);
      const list = await listCloudBackups();
      setCloudBackups(list);
    } catch (e: unknown) {
      setError(errorMessage(e, 'Failed to list cloud backups.'));
    } finally {
      setCloudLoading(false);
    }
  };

  const handleCloudUpload = async (mode: 'active_player' | 'all_data') => {
    if (mode === 'active_player' && !activePlayer) return;
    const confirmed = window.confirm(
      "Privacy Warning: Cloud backups are stored in your private Supabase Storage path. They are not end-to-end encrypted in this version. Only upload if you are comfortable storing your MIRROR backup in the configured Supabase project.\n\nContinue with upload?"
    );
    if (!confirmed) return;
    
    try {
      setCloudLoading(true);
      setError(null);
      setSuccessMsg(null);
      await uploadCloudBackup({ mode, playerId: activePlayer?.id });
      setSuccessMsg("Cloud backup uploaded successfully.");
      await refreshCloudBackups();
    } catch (e: unknown) {
      setError(errorMessage(e, 'Cloud upload failed.'));
    } finally {
      setCloudLoading(false);
    }
  };

  const handleCloudDownload = async (manifest: CloudBackupManifest) => {
    try {
      setCloudLoading(true);
      setError(null);
      const backup = await downloadCloudBackup(manifest.storage_path);
      setPendingBackup(backup);
    } catch (e: unknown) {
      setError(errorMessage(e, 'Failed to download cloud backup.'));
    } finally {
      setCloudLoading(false);
    }
  };

  const handleCloudDelete = async (manifest: CloudBackupManifest) => {
    if (!window.confirm(`Delete backup ${manifest.filename}?`)) return;
    try {
      setCloudLoading(true);
      setError(null);
      await deleteCloudBackup(manifest.storage_path);
      setSuccessMsg("Cloud backup deleted.");
      await refreshCloudBackups();
    } catch (e: unknown) {
      setError(errorMessage(e, 'Failed to delete cloud backup.'));
    } finally {
      setCloudLoading(false);
    }
  };

  const handleExportActive = async () => {
    try {
      if (!activePlayer) return;
      setError(null);
      setSuccessMsg(null);
      const backup = await exportMirrorBackup(activePlayer.id);
      downloadBackupJson(backup, 'active-player');
      setSuccessMsg("Export successful.");
    } catch (err: unknown) {
      setError(errorMessage(err, 'Export failed.'));
    }
  };

  const handleExportAll = async () => {
    try {
      setError(null);
      setSuccessMsg(null);
      const backup = await exportMirrorBackup(); // no player ID = all data
      downloadBackupJson(backup, 'all-data');
      setSuccessMsg("Full export successful.");
    } catch (err: unknown) {
      setError(errorMessage(err, 'Export failed.'));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        const validated = validateBackupFile(raw);
        setPendingBackup(validated);
      } catch (err: unknown) {
        setError(errorMessage(err, 'Failed to read or validate backup file.'));
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.onerror = () => {
      setError('Failed to read file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const executeImport = async () => {
    if (!pendingBackup) return;
    try {
      setImporting(true);
      setError(null);

      const options: ImportOptions = {
        mode: importMode,
        importSettings,
        replacePlayerId: (importMode === 'replace' && replaceTarget === 'active') ? activePlayer?.id : undefined
      };

      await importMirrorBackup(pendingBackup, options);
      
      setPendingBackup(null);
      setSuccessMsg("Import complete. Refreshing app state...");
      
      // Reload app to ensure all stores re-read from DB
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err: unknown) {
      setError(errorMessage(err, 'Import failed.'));
      setImporting(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ marginBottom: '1rem' }}>Data Backup & Restore</h1>
      
      <div style={{ background: 'var(--surface-sunken)', padding: '1.5rem', borderRadius: 8, marginBottom: '2rem' }}>
        <h4 style={{ margin: '0 0 0.5rem 0' }}>Privacy Warning</h4>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ink-soft)' }}>
          Backup files may contain your local gameplay history and progress. Store them safely. Everything is strictly kept local; there is no cloud sync.
        </p>
      </div>

      {error && <div style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>{error}</div>}
      {successMsg && <div style={{ color: 'var(--primary-color)', marginBottom: '1rem', fontWeight: 'bold' }}>{successMsg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1.5rem', border: '1px solid var(--border-color)', borderRadius: 8 }}>
          <h3>Export</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)' }}>
            Save your progress to a JSON file.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleExportActive}
              disabled={!activePlayer}
              title={!activePlayer ? "Select a player first" : ""}
            >
              Export Active Player
            </button>
            <button className="btn btn-ghost" onClick={handleExportAll}>
              Export All Local Data
            </button>
          </div>
        </div>

        <div style={{ padding: '1.5rem', border: '1px solid var(--border-color)', borderRadius: 8 }}>
          <h3>Import</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)' }}>
            Restore progress from a backup file.
          </p>
          <div style={{ marginTop: '1.5rem' }}>
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }} 
            />
            <button 
              className="btn btn-secondary" 
              onClick={() => fileInputRef.current?.click()}
            >
              Select Backup File...
            </button>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--surface-sunken)', padding: '1.5rem', borderRadius: 8, marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Cloud Backup</h3>
        
        {!cloudConfigured ? (
          <p style={{ color: 'var(--ink-soft)' }}>Cloud backup not configured.</p>
        ) : authState.status !== 'signed_in' ? (
          <p style={{ color: 'var(--ink-soft)' }}>Sign in to use cloud backup.</p>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => handleCloudUpload('active_player')}
                disabled={!activePlayer || cloudLoading}
              >
                Upload Active Player Backup
              </button>
              <button 
                className="btn btn-ghost" 
                onClick={() => handleCloudUpload('all_data')}
                disabled={cloudLoading}
              >
                Upload All Local Data
              </button>
            </div>
            
            {cloudLoading && <p>Loading cloud backups...</p>}
            
            {!cloudLoading && cloudBackups.length === 0 && (
              <p style={{ color: 'var(--ink-soft)' }}>No cloud backups found.</p>
            )}
            
            {!cloudLoading && cloudBackups.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {cloudBackups.map(b => (
                  <li key={b.id} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{b.filename}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
                        {new Date(b.created_at).toLocaleString()} • {Math.round((b.size_bytes || 0) / 1024)} KB
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary" onClick={() => handleCloudDownload(b)} disabled={cloudLoading}>
                        Restore
                      </button>
                      <button className="btn btn-ghost" style={{ color: 'var(--danger-color)' }} onClick={() => handleCloudDelete(b)} disabled={cloudLoading}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {pendingBackup && (
        <div style={{ padding: '2rem', border: '2px solid var(--primary-color)', borderRadius: 8 }}>
          <h3>Confirm Import</h3>
          {(() => {
            const sum = getBackupSummary(pendingBackup);
            return (
              <ul style={{ margin: '1rem 0' }}>
                <li><strong>Players:</strong> {sum.players}</li>
                <li><strong>Matches:</strong> {sum.matches}</li>
                <li><strong>Analyses:</strong> {sum.analyses}</li>
                <li><strong>Clue Attempts:</strong> {sum.clue_attempts}</li>
                <li><strong>Story Progress:</strong> {sum.story_progress} chapters complete</li>
                <li><strong>Achievements:</strong> {sum.achievements}</li>
              </ul>
            );
          })()}

          <div style={{ marginTop: '1.5rem' }}>
            <h4>Import Options</h4>
            <div style={{ display: 'flex', gap: '1.5rem', margin: '0.5rem 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="radio" 
                  checked={importMode === 'merge'} 
                  onChange={() => setImportMode('merge')} 
                />
                Merge (Keep newer local data)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="radio" 
                  checked={importMode === 'replace'} 
                  onChange={() => setImportMode('replace')} 
                />
                Replace (Overwrite local data)
              </label>
            </div>

            {importMode === 'replace' && (
              <div style={{ padding: '1rem', background: '#fff3cd', color: '#856404', borderRadius: 4, marginTop: '1rem' }}>
                <strong>Warning:</strong> Replace mode will delete existing local data before importing.
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      type="radio" 
                      checked={replaceTarget === 'active'}
                      onChange={() => setReplaceTarget('active')}
                      disabled={!activePlayer}
                    />
                    Only Active Player
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      type="radio" 
                      checked={replaceTarget === 'all'}
                      onChange={() => setReplaceTarget('all')}
                    />
                    All Players
                  </label>
                </div>
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <input 
                type="checkbox" 
                checked={importSettings} 
                onChange={(e) => setImportSettings(e.target.checked)} 
              />
              Import App Settings (Theme, Audio)
            </label>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button 
              className="btn btn-primary" 
              onClick={executeImport} 
              disabled={importing}
            >
              {importing ? 'Importing...' : 'Confirm & Import'}
            </button>
            <button 
              className="btn btn-ghost" 
              onClick={() => setPendingBackup(null)} 
              disabled={importing}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
