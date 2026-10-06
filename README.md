# Physics Lab Group Registration System — Fall 2026

**Department:** BS Software Engineering  
**Instructor:** Engr. Jawad Sager  
**Institution:** Ibadat International University Islamabad (IIUI)  
**Developed by:** CR. M ABBAS  

## Features
- **Individual & Team Registration:** Register as an individual (1 person) or a team (2 to 5 members).
- **Group Labeling:** Automatically assigns groups as G-1, G-2, G-3, etc.
- **Duplicate Prevention:** Live check and backend validation preventing students from registering in multiple groups.
- **Countdown Timer:** Live countdown to the deadline (7th Oct 2026, 9:00 AM PKT) with auto-locking.
- **Welcome Notice:** Popup reminder with class rules.
- **Crown Badge:** Crown indicator on team leaders in group cards.
- **SweetAlert2 Notifications:** Clean modal alerts on successful registration.
- **Vercel & Node.js Ready:** Configured for instant deployment to Vercel or running locally.

## Local Setup
```bash
npm install
npm start
```
Open `http://localhost:3000` in your browser.

## Vercel Deployment & Permanent Database Setup

On Vercel Serverless, local disk storage (`/tmp`) is ephemeral and resets during cold starts. To keep student registrations permanently saved:

### 1-Click Vercel KV Setup (Recommended - 100% Free):
1. Open your project on [vercel.com](https://vercel.com/dashboard).
2. Go to the **Storage** tab at the top.
3. Click **Create** or **Connect Store** → Select **KV**.
4. Click **Create & Connect**. Vercel will automatically connect `KV_REST_API_URL` and `KV_REST_API_TOKEN` to your project!

### Alternative: Free Upstash Redis:
1. Create a free database on [upstash.com](https://upstash.com).
2. Under the **REST API** section, copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. Add them under Vercel → **Project Settings** → **Environment Variables**, then redeploy.

