# M-CLOUD-BACKUP-SYNC-1 Report

## Date
June 9, 2026

## Commit Hash
(Tagged as `v1.18.0-cloud-backup-sync-1`)

## Summary
This milestone introduces optional, user-triggered cloud backup synchronization via Supabase Storage. It allows players to safely store their local MIRROR progress into a private cloud bucket while maintaining strict adherence to our local-first architecture.

## Features Completed
* Cloud backup service (`cloudBackupService.ts`).
* Supabase Storage path strategy (`users/{cloud_user_id}/backups/{filename}`).
* Cloud upload for both active player and all-data backups.
* Cloud backup list retrieval.
* Cloud download and restore functionality.
* Delete cloud backup functionality.
* Backup route integration with a new Cloud Backup section.
* Local-first fallback gracefully handles missing environments.
* Explicit privacy warnings regarding non-E2EE storage.
* Supabase storage setup documentation and SQL policies.

## Cloud Backup Method
* **Difference from Structured Sync**: We do not sync tables row-by-row. Instead, we generate the exact same JSON backup blob used by the local export system and upload it to Supabase Storage. 
* **Schema Reuse**: The existing local backup schema (`exportMirrorBackup`, `importMirrorBackup`) is fully reused. 
* **User Consent**: The system never uploads anything automatically. The user must click to upload and explicitly confirm they understand the privacy implications.
* **Signed-out/Not-configured**: If the user is signed out, the UI prompts them to sign in. If the `.env` variables are missing entirely, it displays "Cloud backup not configured."
* **Restore**: Restoring a cloud backup downloads the JSON, validates it against the existing schema, and merges it safely using `importMirrorBackup`. It does not silently wipe data.
* **Encryption Status**: Currently, backups are plain JSON and **not end-to-end encrypted**. Access is strictly protected via Supabase Auth and Row Level Security (RLS). The user is explicitly warned before uploading.

## Manual Verification
* The app works seamlessly with no Supabase `.env` variables.
* Local backup still works correctly when signed out.
* Signed-in user can successfully upload an active-player backup.
* Signed-in user can list cloud backups.
* Signed-in user can download/restore a backup.
* Invalid backup restore is rejected by the local validation logic.
* Signing out does not affect local IndexedDB data.
* No gameplay data uploads automatically in the background.

## Automated Tests
* `typecheck`: Passed
* `lint`: Passed
* `tests`: Passed
* `build`: Passed
* `puzzle validation`: Passed
* `mirror verification`: Passed

## Known Limitations
* No full structured sync.
* No automatic background sync.
* No row-level gameplay sync.
* No multiplayer.
* No conflict UI beyond the default backup import merge logic.
* End-to-end encryption is deferred.

## Decision
M-CLOUD-BACKUP-SYNC-1 COMPLETE
