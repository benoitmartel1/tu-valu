# Quick Start Guide - Supabase Authentication Setup

## Step 1: Get Your Supabase Credentials

1. Go to https://supabase.com/dashboard
2. Sign in or create an account
3. Create a new project (or select your existing DEV project)
4. Go to **Project Settings** → **API**
5. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

## Step 2: Configure Your .env File

Open `.env` and replace the placeholder values:

```env
VITE_SUPABASE_URL=https://your-actual-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
```

**Important:** Make sure there are no quotes around the values!

## Step 3: Apply Database Migration

You need to enable Row Level Security (RLS) on your tables. Choose one method:

### Method A: Supabase Dashboard (Easiest)

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Open the file `supabase/migrations/20260820000000_enable_rls_with_app_isolation.sql` in VS Code
4. Copy ALL the content
5. Paste it into the SQL Editor
6. Click **Run** (or press Ctrl+Enter)
7. You should see "Success. No rows returned"

### Method B: Using Supabase CLI (if installed)

```bash
# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

## Step 4: Fix Email Issues

### Option A: Disable Email Confirmation (Recommended for Development)

This is the quickest way to test signup without waiting for emails:

1. Go to **Authentication** → **Providers** → **Email**
2. Scroll down to **Confirm email**
3. Toggle it **OFF**
4. Click **Save**

Now users can sign up and immediately log in without email confirmation!

### Option B: Use Test Email Service

If you want to keep email confirmation enabled:

1. Go to **Authentication** → **Email Templates**
2. Check that templates are configured
3. For testing, use a service like Mailtrap or check spam folder

## Step 5: Configure OAuth Providers (Optional)

### GitHub OAuth Setup

1. Go to https://github.com/settings/developers
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: Tu-Valu (or your app name)
   - **Homepage URL**: `http://localhost:5173` (or your dev URL)
   - **Authorization callback URL**: `https://your-project-id.supabase.co/auth/v1/callback`
4. Click **Register application**
5. Copy **Client ID** and generate **Client Secret**
6. Back in Supabase dashboard:
   - Go to **Authentication** → **Providers** → **GitHub**
   - Toggle **Enable** ON
   - Paste Client ID and Client Secret
   - Click **Save**

### Google OAuth Setup

1. Go to https://console.cloud.google.com/apis/credentials
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. If prompted, configure consent screen first
4. Application type: **Web application**
5. Name: Tu-Valu
6. Authorized redirect URIs: `https://your-project-id.supabase.co/auth/v1/callback`
7. Click **Create**
8. Copy **Client ID** and **Client Secret**
9. Back in Supabase dashboard:
   - Go to **Authentication** → **Providers** → **Google**
   - Toggle **Enable** ON
   - Paste Client ID and Client Secret
   - Click **Save**

## Step 6: Fix Magic Link Redirect

The magic link should redirect back to YOUR app, not another app:

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to: `http://localhost:5173` (or your actual URL)
3. Under **Redirect URLs**, add:
   - `http://localhost:5173/*`
   - `http://localhost:5173`
4. Click **Save**

The magic link will now redirect back to your tu-valu app!

## Step 7: Test Everything

1. Restart your dev server if it's running:

   ```bash
   npm run dev
   ```

2. Try signing up with email/password:
   - Use any email (e.g., test@example.com)
   - Use a password (min 6 characters)
   - Should work immediately if email confirmation is disabled

3. Try magic link:
   - Enter your email
   - Check your inbox (or spam)
   - Click the link - should redirect back to your app

4. Once OAuth is configured, test GitHub/Google login

## Troubleshooting

### "Invalid API key" error

- Double-check your `.env` file has correct values
- Make sure there are no extra spaces or quotes
- Restart the dev server after changing `.env`

### Can't access database after enabling RLS

- Make sure you ran the migration SQL script
- Verify all policies were created successfully in SQL Editor

### Magic link redirects to wrong URL

- Check Site URL in Authentication → URL Configuration
- Make sure your redirect URL is in the allowed list

### Social login doesn't work

- Verify OAuth credentials are correct
- Check that callback URL matches exactly
- Look for errors in browser console

## Next Steps

Once everything is working:

1. ✅ Test creating classes, students, evaluations
2. ✅ Verify data persists after logout/login
3. ✅ Test that other apps in same project can't access your data
4. Consider enabling email confirmation for production
5. Add more OAuth providers if needed

Need help? Check:

- `SUPABASE_SETUP.md` for detailed setup instructions
- `AUTHENTICATION_IMPLEMENTATION.md` for implementation details
- Supabase docs: https://supabase.com/docs
