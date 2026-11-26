# HANSALI — Interactive Digital Classroom

A static-hosting-compatible classroom platform. Frontend: HTML5, CSS3, Vanilla JavaScript ES modules. Backend: Supabase Database, Realtime, Storage and Edge Functions.

## Run locally (no Node.js, npm or package.json)

1. Open this folder in VS Code.
2. Start **Live Server** on `index.html`, or run Python's static server:
   `python -m http.server 8000`
3. Open `http://localhost:8000`.

## Supabase project

Already connected to the HANSALI project:
- URL: `https://ijojwhnwlikdzjlcyxlt.supabase.co`
- Frontend uses the publishable key in `js/config.js`.
- Edge Functions deployed: `hansali-api`, `hansali-teacher-data`.
- Database tables, RLS, Realtime and `hansali-media` Storage bucket have been provisioned.

## Teacher access

Enter the private teacher secret code supplied separately. The code is validated by an Edge Function; the browser stores only a short-lived random session token. Lock the studio to revoke the current session.

## Student access

Students join using the room code and may leave their name blank. No accounts or Supabase Auth are used.

## Important notes / current scope

- PowerPoint files are displayed using Microsoft's Office web viewer, which requires the uploaded file to be publicly reachable and an internet connection. PDF and PowerPoint compatibility depends on the viewer.
- Media uploads are limited to 15 MB and supported MIME types by the Storage bucket.
- Static hosting is supported. Supabase Edge Functions are hosted by Supabase; no local backend server is needed.
- For production launch, add stronger abuse protection (rate limiting/CAPTCHA), private signed media uploads, custom domain/CSP, backups, and end-to-end browser testing.
- Do not publish any Supabase secret/service-role key.
