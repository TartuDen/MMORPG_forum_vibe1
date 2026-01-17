# Project Status Summary (MMORPG_forum_vibe1)

## Snapshot
- Full-stack forum (React + Vite frontend, Node/Express backend, Postgres DB).
- Authentication: JWT access + refresh tokens, login via email OR username, register via email.
- Roles: admin/moderator/user; admin-only actions enforced in backend and UI.
- Demo seed: games, forums, admin user (pomogA/Plot123123), regular user (pomogB/Plot123123).

## Core Features Implemented
- Forums and threads with comments; admin-only forum creation/deletion.
- Game management (admin): create/update/delete games; tags are required; default forum auto-created.
- Search: threads, comments, users, forums; matches text, usernames, game/forum names, and tags.
- Moderation: ban/unban users, promote role; moderation_log entries recorded.
- Admin can delete threads, comments, forums, and games.

## Images
- Avatars: upload as base64 data URL, max 100KB; stored in users.avatar_url.
- Thread images: upload as base64 data URL, max 300KB; stored in threads.image_url.
- Game icons: icon_url used as background on game cards and forum header banner.
- Express body size limit increased to 512KB; oversized payload returns 413.

## UI Highlights
- Home: Game hub cards (by game with tags) + single “General Discussion” hero card.
- Forum page: game banner with icon, admin buttons (Manage Forum, Delete Forum).
- Thread page: admin can delete; shows avatar badge + thread image.
- Create Thread: optional image upload, stays on new thread after create.
- Create/Manage Games: checkbox tag selection, update form; Create Game shown only from home Manage Games button.

## Search Notes
- /search route added.
- Search page now has Threads/Comments/Users/Forums tabs; auto-select Forums if only forums match.
- Query examples: `aion`, `pvp`, `pomogA`, `general discussion`.

## Deployment Considerations
- DB: PostgreSQL via pg client; pgAdmin optional for viewing tables.
- Rate limiting (in-memory): general (120/min), auth (20/min), write (40/min).
- In-memory GET cache (short TTL): forums, games, search, user endpoints.
- Limit enforcement: max limit=50 for list/search endpoints.

## Environment Vars
- Backend .env: DB_HOST/PORT/NAME/USER/PASSWORD, PORT, NODE_ENV, JWT_SECRET, JWT_REFRESH_SECRET, SUPPORT_EMAIL.
- Frontend .env: VITE_API_BASE_URL.

## Schema Changes
- users.avatar_url
- users.is_banned/banned_at/banned_reason
- threads.image_url
- games.tags (TEXT[])
- games.auto_forum_enabled

## Migrations
- backend/migrations/001_add_user_ban_and_fk_restrict.sql (ban fields + FK restrict)
- init.js also applies “ALTER TABLE ... ADD COLUMN IF NOT EXISTS” for new columns

## Admin Credentials (seeded when NODE_ENV != production)
- Admin: pomogA / Plot123123
- User: pomogB / Plot123123

## Tests
- `backend/tests/auth.test.js` covers registration, login (email/username), admin game CRUD, role updates, ban, user actions, admin-only thread deletion.
- Run: `npm test` in backend.

## Known Behavior
- Errors for negative tests show in console (expected).
- Image uploads are base64 stored in DB (ok for demo, not ideal for production).

## Next Possible Improvements
- Migrate image storage to object storage (S3/Cloudinary).
- Persistent cache/ratelimits using Redis.
- Add dedicated “Manage Forum” panel (per-forum settings).
- Add search filters in UI (tags, game, author).
