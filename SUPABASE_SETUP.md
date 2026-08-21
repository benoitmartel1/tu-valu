# Supabase Setup Instructions

## Environment Variables

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Fill in your Supabase credentials in `.env`:
   - `VITE_SUPABASE_URL`: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon/public key

You can find these in your Supabase dashboard under **Project Settings > API**.

## Database Migration

To enable Row Level Security (RLS) and set up authentication policies:

### Option 1: Using Supabase Dashboard (Recommended for quick setup)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/20260820000000_enable_rls_with_app_isolation.sql`
4. Paste and run the SQL script

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

## Authentication Setup

After applying the migration, configure authentication providers in your Supabase dashboard:

1. Go to **Authentication > Providers**
2. Enable the providers you want to use:
   - **Email**: Already enabled by default
   - **GitHub**: Click "Enable" and add your OAuth credentials
   - **Google**: Click "Enable" and add your OAuth credentials

### GitHub OAuth Setup

1. Create a new OAuth app at https://github.com/settings/developers
2. Set Authorization callback URL to: `https://your-project-id.supabase.co/auth/v1/callback`
3. Copy Client ID and Client Secret to Supabase dashboard

### Google OAuth Setup

1. Create credentials at https://console.cloud.google.com/apis/credentials
2. Set Authorized redirect URIs to: `https://your-project-id.supabase.co/auth/v1/callback`
3. Copy Client ID and Client Secret to Supabase dashboard

## Testing

1. Start the development server:

   ```bash
   npm run dev
   ```

2. The app will show the authentication modal on first load
3. Try signing up with email/password
4. Verify that the user's `app_metadata.app_name` is set to 'tu-valu' in the Supabase dashboard under **Authentication > Users**

## Security Notes

- RLS policies ensure only authenticated users from the tu-valu app can access data
- Users from other apps sharing the same Supabase project cannot access tu-valu tables
- All database operations require valid JWT tokens
- Session persistence is handled automatically by the Supabase client
