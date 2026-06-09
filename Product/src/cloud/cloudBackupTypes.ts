export interface CloudBackupManifest {
  id: string; // The storage path without bucket name
  cloud_user_id: string;
  player_id?: string;
  filename: string;
  storage_path: string; // e.g. "users/{uid}/backups/{filename}"
  created_at: string;
  backup_schema_version: number;
  size_bytes?: number;
  latest_known_tag?: string;
  encrypted: boolean;
  mode: 'active_player' | 'all_data';
}
