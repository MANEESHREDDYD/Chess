# Deployment Runbook

MIRROR is built to be a robust, zero-configuration PWA out of the box, with optional backend capabilities. This runbook details how to configure, verify, and deploy the application.

## Local Setup

```bash
git clone https://github.com/MANEESHREDDYD/Chess.git
cd Chess/Product
npm install
npm run dev
```
By default, MIRROR runs entirely locally in the browser. No Supabase configuration is required to play.

## Environment Variables

For cloud backup and auth, copy `.env.example` to `.env`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**No-Secret Policy**: The frontend ONLY utilizes the `ANON_KEY`. We never store `SUPABASE_SERVICE_ROLE` keys or raw JWTs in the repository.

## Supabase Configuration

### 1. Supabase Auth Setup
Enable Email/Password authentication in the Supabase dashboard. MIRROR uses Supabase Magic Links (OTP) for frictionless login.

### 2. Supabase Storage Setup
Create a bucket named `mirror_backups`.
**Important**: The bucket MUST be Private.

### 3. RLS Policy References
Ensure your Storage Bucket is protected with Row Level Security:
- **Select**: `auth.uid() = owner`
- **Insert**: `auth.uid() = owner`
- **Update**: `auth.uid() = owner`

*(Reference `supabase/policies/mirror_backups_storage.sql` for exact definitions)*

## Build & Verification Commands

MIRROR uses strict quality gates to ensure production readiness:

```bash
# Type checking
npm run typecheck

# Code linting
npm run lint

# Unit tests
npm test

# Production build
npm run build

# Verify puzzle data schemas
npx tsx scripts/validate-puzzles.ts

# Verify Mirror Engine integration
node scripts/run-mirror-verification.mjs
```

## Production Deployment Checklist

1. [ ] Ensure all verification scripts pass locally.
2. [ ] Ensure `.env` is omitted from version control (`.gitignore` verified).
3. [ ] Set environment variables in the hosting provider (e.g., Vercel, Netlify).
4. [ ] Trigger a production build.
5. [ ] Verify PWA manifest and service workers are correctly served.

## Rollback Checklist
- If a build fails in production, revert the Git commit to the previous stable release tag.
- If IndexedDB schema migrations fail, increment the DB version and supply an emergency downgrade migration block in `src/db/migrations.ts`.

## Security Checklist
- [ ] No `SERVICE_ROLE` keys exposed.
- [ ] Local backups clearly marked as unencrypted JSON.
- [ ] Supabase Auth configured with secure redirects.
- [ ] Storage RLS strictly enforces user-isolation.
