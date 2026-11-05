# প্রজেক্ট লাগবে? (React + Express + Supabase)

## Folder structure

- `frontend/` - React application, Vite config, and browser assets
- `backend/` - Express API and production static-file server
- `database/` - Supabase schema and database setup scripts
- `.env` - local secrets (never commit this file)

1. Supabase SQL Editor-এ `database/schema.sql` চালান।
2. Supabase Project Settings > API থেকে URL এবং `service_role` key নিন।
3. এগুলো server-এর environment variables হিসেবে সেট করুন; service role key কখনও frontend-এ দেবেন না।
4. Dev: `npm install && npm run dev` (React: :5173, API: :3000)
5. Prod: `npm install && npm run build && npm start`
6. Render/Railway/VPS: Build `npm install && npm run build`, Start `npm start`.
   Health check: `/health`

### Render deployment

This repository includes `render.yaml`. In Render, choose **New > Blueprint**,
connect the GitHub repository, and apply the blueprint. Fill in the
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, `ADMIN_PASS`, and
`PAY_INFO` values when prompted. Render generates `JWT_SECRET` automatically.

After deployment, verify `/health`, then open `/login` and test the admin
account. Do not commit `.env` or expose the Supabase service-role key.

### Vercel deployment

The project also includes `vercel.json` and `api/index.js` for the Express
API as a Vercel serverless function. Import the repository in Vercel, keep
the build command as `npm run build`, and add the environment variables from
`.env.example` in Project Settings. Do not add `SUPABASE_SERVICE_ROLE_KEY`
to frontend environment variables.
