import { getSupabaseClient, getCurrentAuthUser } from '../auth/authService';
import { 
  exportMirrorBackup, 
  validateBackupFile, 
  importMirrorBackup,
  type ImportOptions 
} from '../backup/backupService';
import type { CloudBackupManifest } from './cloudBackupTypes';
import type { MirrorBackupFile } from '../backup/backupTypes';

const BUCKET_NAME = 'mirror-backups';

export function isCloudBackupConfigured(): boolean {
  return getSupabaseClient() !== null;
}

function getCloudUserPath(): string {
  const user = getCurrentAuthUser();
  if (!user) throw new Error("User must be signed in for cloud backup.");
  return `users/${user.id}/backups`;
}

export async function uploadCloudBackup({ 
  mode, 
  playerId 
}: { 
  mode: 'active_player' | 'all_data', 
  playerId?: string 
}): Promise<CloudBackupManifest> {
  const supabase = getSupabaseClient();
  const user = getCurrentAuthUser();
  if (!supabase || !user) {
    throw new Error("Cloud backup is not configured or user is signed out.");
  }

  // 1. Generate local backup JSON
  // exportMirrorBackup uses playerId if passed, otherwise exports all data
  const backupData = await exportMirrorBackup(mode === 'active_player' ? playerId : undefined);
  
  // 2. Format filename
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const prefix = mode === 'active_player' ? 'active-player' : 'all-data';
  const filename = `mirror-cloud-backup-${prefix}-${dateStr}.json`;
  
  const basePath = getCloudUserPath();
  const storagePath = `${basePath}/${filename}`;

  // 3. Upload JSON
  const fileBlob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
  
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBlob, {
      contentType: 'application/json',
      upsert: true
    });

  if (error) {
    throw new Error(`Failed to upload cloud backup: ${error.message}`);
  }

  return {
    id: data.path,
    cloud_user_id: user.id,
    player_id: mode === 'active_player' ? playerId : undefined,
    filename,
    storage_path: data.path,
    created_at: new Date().toISOString(),
    backup_schema_version: backupData.schema_version,
    size_bytes: fileBlob.size,
    encrypted: false, // Plain JSON for this milestone
    mode
  };
}

export async function listCloudBackups(): Promise<CloudBackupManifest[]> {
  const supabase = getSupabaseClient();
  const user = getCurrentAuthUser();
  if (!supabase || !user) return [];

  const basePath = getCloudUserPath();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(basePath, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' }
    });

  if (error) {
    throw new Error(`Failed to list cloud backups: ${error.message}`);
  }

  // Map to Manifest
  return data
    .filter(file => file.name.endsWith('.json'))
    .map(file => {
      const isAll = file.name.includes('all-data');
      return {
        id: `${basePath}/${file.name}`,
        cloud_user_id: user.id,
        filename: file.name,
        storage_path: `${basePath}/${file.name}`,
        created_at: file.created_at || new Date().toISOString(),
        backup_schema_version: 1, // Assumed, will be strictly validated on download
        size_bytes: file.metadata?.size || 0,
        encrypted: false,
        mode: isAll ? 'all_data' : 'active_player'
      };
    });
}

export async function downloadCloudBackup(storagePath: string): Promise<MirrorBackupFile> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Cloud backup is not configured.");

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (error || !data) {
    throw new Error(`Failed to download cloud backup: ${error?.message}`);
  }

  const text = await data.text();
  let rawJson;
  try {
    rawJson = JSON.parse(text);
  } catch {
    throw new Error("Downloaded file is not valid JSON.");
  }

  // Validation ensures it matches our local DB structure
  return validateBackupFile(rawJson);
}

export async function restoreCloudBackup(storagePath: string, options: ImportOptions): Promise<void> {
  // 1. Download and validate
  const backup = await downloadCloudBackup(storagePath);
  
  // 2. Delegate to local import logic
  // UI layer should default to { mode: 'merge' } and warn heavily if 'replace'
  await importMirrorBackup(backup, options);
}

export async function deleteCloudBackup(storagePath: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Cloud backup is not configured.");

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Failed to delete cloud backup: ${error.message}`);
  }
}
