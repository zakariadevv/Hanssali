# HANSALI — Interactive Digital Classroom

HANSALI is a static-hosted classroom app built with HTML, CSS and Vanilla JavaScript ES modules. It uses Supabase Database, Realtime, Storage and Edge Functions. The frontend does not require Node.js, npm, React or a build step.

## Run locally

1. Open this folder in VS Code.
2. Start Live Server on `index.html`, or run Python's static server:
   `python -m http.server 8000`
3. Open `http://localhost:8000`.

## Supabase configuration

- Project URL: `https://luqbascwacfyhlfyvvgo.supabase.co`
- Frontend configuration: `config.js` (repository root).
- The browser uses the Supabase publishable key. Never put a service-role key or other server secret in frontend files.
- Edge Function used by the frontend: `hansali-api`.
- Storage bucket: `hanssali-media`.

## Teacher access

Teacher access uses a private secret validated by the `hansali-api` Edge Function. The browser stores a short-lived session token. Use **Lock studio** to revoke the current session.

## Student access

Students join with a room code and may leave their display name blank. Student accounts and Supabase Auth registration are not required.

## Current capabilities

- Teacher-created classrooms and shareable student links.
- Realtime classroom controls, questions and student answers.
- Multi-slide freeform canvas editor.
- Text, image, video, link, PDF and PowerPoint publishing (viewer support depends on file type and hosting).
- Media uploads are limited to 15 MB by the frontend.

## Production checklist

- Configure rate limiting and abuse protection on Edge Functions.
- Review RLS policies, Storage policies and signed URL expiry.
- Configure backups and monitor Supabase usage.
- Test teacher and student flows on desktop and mobile browsers.
- Configure a custom domain and a suitable Content Security Policy when ready.
