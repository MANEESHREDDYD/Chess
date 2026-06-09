# M-ACCOUNT-AUTH-LOCAL-BRIDGE Report

**Date**: June 2026
**Version**: `v1.17.0-account-auth-local-bridge`
**Milestone**: M-ACCOUNT-AUTH-LOCAL-BRIDGE

## Overview
This milestone establishes the initial authentication layer for MIRROR without compromising its local-first architecture. We've introduced a Supabase authentication wrapper that allows users to optionally sign in and link their local `player_id` to a cloud account.

## Changes Made
1. **Database Schema (`v8`)**: Added `account_links` store to track relationships between local player IDs and cloud user IDs.
2. **Auth Service (`src/auth/authService.ts`)**: 
   - Wrapped Supabase JS client.
   - Handled missing environment variables gracefully, ensuring local functionality remains intact without crashing.
   - Provided Magic Link and OTP flows.
3. **Account UI (`src/routes/Account.tsx`)**: 
   - Created a dedicated page to sign in, verify OTP, and link/unlink the active local profile.
   - Included clear privacy disclosures emphasizing that no data is currently uploaded.
4. **Local Backup Integration (`src/backup/backupService.ts`)**:
   - `account_links` are securely exported to JSON.
   - `account_links` are safely imported and merged (by `updated_at`) back into local IndexedDB.
5. **Dev Inspector**: Added visibility into auth configuration, current cloud user, and `account_links`.
6. **Tests**: Added unit tests for the auth abstraction (`authService.test.ts`) and updated database/backup tests.

## Security & Privacy Considerations
- **No Uploads**: No gameplay history, puzzle reviews, or StyleVectors leave the device.
- **Optional**: Missing env vars simply degrade to a "Cloud not configured" UI state; players can still use 100% of the game locally.
- **Magic Link Only**: We chose passwordless email OTP logic. No passwords are handled by the client.

## Next Steps
With the cloud identity link established, future milestones can begin incrementally syncing specific IndexedDB stores to the Supabase backend based on these `account_links`.
