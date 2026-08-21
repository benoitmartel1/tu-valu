# Magic Link Authentication Troubleshooting Guide

## Problem

Magic link emails are received, but clicking the link doesn't authenticate the user. The redirect URL in the email points to `https://dev.benoitmartel.com/` instead of `https://dev.benoitmartel.com/tu-valu`.

## Root Cause

The application is deployed in a subdirectory (`/tu-valu`) but the authentication redirect URLs were not configured to include this path. This causes Supabase to redirect users to the wrong location after they click the magic link.

## Solutions Applied

### 1. Code Changes Made

- ✅ Added explicit `emailRedirectTo` parameter to magic link function
- ✅ Added detailed console logging for debugging
- ✅ Enhanced error handling with try-catch blocks

### 2. Required Supabase Configuration

#### Step 1: Configure Redirect URLs

1. Go to your Supabase project dashboard
2. Navigate to **Authentication > URL Configuration**
3. Under **Site URL**, keep your shared domain (if multiple apps use this Supabase project): `https://dev.benoitmartel.com/`
4. Under **Redirect URLs**, add the specific paths for each app:
   - `https://dev.benoitmartel.com/tu-valu/**` (your tu-valu app)
   - `http://localhost:5173/**` (for local development)
   - Add similar patterns for other apps using the same Supabase project

**Important**: Even though the Site URL is shared across multiple apps, you must explicitly add each app's subdirectory path to the Redirect URLs list. This allows Supabase to accept redirect URLs to those specific paths.

#### Step 2: Verify Email Template

1. Go to **Authentication > Email Templates**
2. Select **Magic Link** template
3. Ensure the template uses the correct redirect URL
4. The default template should work if redirect URLs are configured correctly

### 3. GitHub Secrets Configuration

Ensure these secrets are set in your GitHub repository:

1. Go to **Settings > Secrets and variables > Actions**
2. Add/update these secrets:
   - `VITE_SUPABASE_URL`: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon/public key

**How to find these values:**

- Go to your Supabase dashboard
- Navigate to **Project Settings > API**
- Copy the URL and anon key

### 4. Deployment Steps

After making changes:

```bash
# Commit the code changes
git add .
git commit -m "Fix magic link authentication with proper redirect handling"
git push origin main
```

The GitHub Actions workflow will automatically:

1. Build the application with the correct environment variables
2. Deploy to your OVH server via FTP

Wait for the deployment to complete (check the Actions tab in GitHub).

## Testing the Fix

### Test Locally First

```bash
npm run dev
```

1. Open browser console (F12)
2. Try sending a magic link
3. Check console logs for:
   - "Sending magic link to: [email]"
   - "Redirect URL: http://localhost:5173"
   - "Magic link sent successfully"

### Test Online After Deployment

1. Clear browser cache or use incognito mode
2. Open browser console (F12)
3. Request a magic link
4. Check console for logs
5. Click the link in the email
6. Verify you're redirected back and authenticated

## Debugging Checklist

If it still doesn't work after deployment:

- [ ] Check browser console for errors when sending magic link
- [ ] Check browser console for errors when clicking the link
- [ ] Verify the redirect URL in the email matches your domain
- [ ] Check Supabase dashboard > Authentication > Logs for errors
- [ ] Verify GitHub secrets are correctly set (no typos, no extra spaces)
- [ ] Check that the deployment completed successfully
- [ ] Try clearing browser cookies and cache
- [ ] Test with a different email address

## Common Issues

### Issue: "Invalid redirect URL"

**Solution**: Add your domain to the allowed redirect URLs in Supabase dashboard

### Issue: Email not received

**Solution**: Check spam folder, verify email address is correct, check Supabase email logs

### Issue: Link expires too quickly

**Solution**: Magic links expire after a certain time (default is usually sufficient). Request a new link if needed.

### Issue: Console shows CORS errors

**Solution**: Ensure your domain is added to Supabase redirect URLs

## Next Steps

After fixing magic links, we can troubleshoot other authentication methods:

- Email/Password login
- Social login (GitHub, Google)
- Password reset

Would you like to proceed with testing the magic link fix, or shall we move on to troubleshooting another authentication method?
