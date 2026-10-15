# Resume Career Analysis

## Local setup

Requirements: Node.js 24+, npm, and a Supabase project.

1. In Supabase, create a project and open **Project Settings > API**.
2. Copy `client/.env.example` to `client/.env` and fill in the project URL and
   anon/publishable key.
3. Copy `backend/.env.example` to `backend/.env` and fill in the same project
   URL and the service-role/secret key. Never expose this key to the client.
4. In the Supabase SQL editor, run the files under `supabase/migrations` in
   filename order.
5. Under **Authentication > URL Configuration**, set the site URL to
   `http://localhost:5173` and add it as an allowed redirect URL.
6. Install and run both applications:

   ```powershell
   cd backend
   npm ci
   npm run dev
   ```

   In a second terminal:

   ```powershell
   cd client
   npm ci
   npm run dev
   ```

Email magic-link authentication works once Supabase email authentication is
enabled. The Google button additionally requires its provider to be configured
under **Authentication > Providers**.

The frontend runs at `http://localhost:5173` and the API at
`http://localhost:3001` by default.
