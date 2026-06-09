import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  isCloudBackupConfigured, 
  uploadCloudBackup, 
  listCloudBackups, 
  downloadCloudBackup, 
  restoreCloudBackup, 
  deleteCloudBackup 
} from './cloudBackupService';
import * as authService from '../auth/authService';
import * as backupService from '../backup/backupService';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('../auth/authService', () => ({
  getSupabaseClient: vi.fn(),
  getCurrentAuthUser: vi.fn(),
}));

vi.mock('../backup/backupService', () => ({
  exportMirrorBackup: vi.fn(),
  validateBackupFile: vi.fn(),
  importMirrorBackup: vi.fn(),
}));

describe('cloudBackupService', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      storage: {
        from: vi.fn().mockReturnThis(),
        upload: vi.fn().mockResolvedValue({ data: { path: 'users/123/backups/test.json' }, error: null }),
        list: vi.fn().mockResolvedValue({ data: [{ name: 'test.json', created_at: '2023-01-01', metadata: { size: 100 } }], error: null }),
        download: vi.fn().mockResolvedValue({ data: new Blob([JSON.stringify({ schema_version: 1 })]), error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      }
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('safely returns false when cloud is not configured', () => {
    vi.mocked(authService.getSupabaseClient).mockReturnValue(null);
    expect(isCloudBackupConfigured()).toBe(false);
  });

  it('signed-out user cannot upload', async () => {
    vi.mocked(authService.getSupabaseClient).mockReturnValue(mockSupabase as SupabaseClient);
    vi.mocked(authService.getCurrentAuthUser).mockReturnValue(undefined);

    await expect(uploadCloudBackup({ mode: 'active_player' }))
      .rejects.toThrow('Cloud backup is not configured or user is signed out.');
  });

  it('upload uses existing local backup logic and paths correctly', async () => {
    vi.mocked(authService.getSupabaseClient).mockReturnValue(mockSupabase as SupabaseClient);
    vi.mocked(authService.getCurrentAuthUser).mockReturnValue({ id: 'user123', email: 'test@test.com' });
    vi.mocked(backupService.exportMirrorBackup).mockResolvedValue({ schema_version: 1, app_name: "MIRROR", players: [] } as any);

    const manifest = await uploadCloudBackup({ mode: 'active_player', playerId: 'p1' });
    
    expect(backupService.exportMirrorBackup).toHaveBeenCalledWith('p1');
    expect(mockSupabase.storage.from).toHaveBeenCalledWith('mirror-backups');
    expect(manifest.cloud_user_id).toBe('user123');
    expect(manifest.filename).toContain('active-player');
    expect(manifest.storage_path).toBe('users/123/backups/test.json'); // From mocked upload response
  });

  it('list handles empty backup list', async () => {
    vi.mocked(authService.getSupabaseClient).mockReturnValue(mockSupabase as SupabaseClient);
    vi.mocked(authService.getCurrentAuthUser).mockReturnValue({ id: 'user123', email: 'test@test.com' });
    
    // Override mock to return empty
    mockSupabase.storage.list.mockResolvedValue({ data: [], error: null });

    const list = await listCloudBackups();
    expect(list).toEqual([]);
  });

  it('download validates backup before restore', async () => {
    vi.mocked(authService.getSupabaseClient).mockReturnValue(mockSupabase as SupabaseClient);
    
    // Simulate blob text() since we mocked a real Blob
    mockSupabase.storage.download.mockResolvedValue({ 
      data: { text: async () => JSON.stringify({ schema_version: 1, app_name: "MIRROR" }) }, 
      error: null 
    });
    vi.mocked(backupService.validateBackupFile).mockReturnValue({ schema_version: 1, app_name: "MIRROR" } as any);

    const backup = await downloadCloudBackup('some/path.json');
    expect(backupService.validateBackupFile).toHaveBeenCalled();
    expect(backup.app_name).toBe("MIRROR");
  });

  it('restore calls importMirrorBackup', async () => {
    vi.mocked(authService.getSupabaseClient).mockReturnValue(mockSupabase as SupabaseClient);
    mockSupabase.storage.download.mockResolvedValue({ 
      data: { text: async () => JSON.stringify({ schema_version: 1, app_name: "MIRROR" }) }, 
      error: null 
    });
    vi.mocked(backupService.validateBackupFile).mockReturnValue({ schema_version: 1, app_name: "MIRROR" } as any);

    await restoreCloudBackup('some/path.json', { mode: 'merge' });
    
    expect(backupService.importMirrorBackup).toHaveBeenCalledWith(
      { schema_version: 1, app_name: "MIRROR" },
      { mode: 'merge' }
    );
  });

  it('invalid downloaded backup is rejected', async () => {
    vi.mocked(authService.getSupabaseClient).mockReturnValue(mockSupabase as SupabaseClient);
    mockSupabase.storage.download.mockResolvedValue({ 
      data: { text: async () => 'Not a json file' }, 
      error: null 
    });

    await expect(downloadCloudBackup('some/path.json'))
      .rejects.toThrow('Downloaded file is not valid JSON.');
  });
  
  it('delete uses storage remove safely', async () => {
    vi.mocked(authService.getSupabaseClient).mockReturnValue(mockSupabase as SupabaseClient);
    
    await deleteCloudBackup('some/path.json');
    
    expect(mockSupabase.storage.remove).toHaveBeenCalledWith(['some/path.json']);
  });
});
