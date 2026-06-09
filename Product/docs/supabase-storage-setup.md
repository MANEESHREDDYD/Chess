# Supabase Storage Setup for MIRROR Backups

To enable cloud backups in MIRROR, you must set up a Supabase Storage bucket. This allows users to manually back up their local IndexedDB data to their own private cloud path.

## Requirements
- **VITE_SUPABASE_URL** and **VITE_SUPABASE_ANON_KEY** must be set in your `.env` file.
- Do NOT expose any service-role keys in the frontend.

## Bucket Configuration
- **Bucket Name**: `mirror-backups`
- **Public**: **NO**. The bucket must be strictly private.
- **Allowed MIME types**: `application/json` (optional but recommended restriction).

## RLS & Policies
Because the bucket is private, you must apply Row Level Security (RLS) policies so that users can only upload to, download from, and list files inside their own dedicated path:
`users/{uid}/*`

See the associated SQL file for the necessary commands:
[`supabase/policies/mirror_backups_storage.sql`](../supabase/policies/mirror_backups_storage.sql)

## Security
- No public URLs can be generated.
- Automatic uploads are NOT performed.
- Currently, backups are plain JSON and **not end-to-end encrypted**, so only authorized users should access their paths. The UI requires explicit consent from the user prior to uploading.
