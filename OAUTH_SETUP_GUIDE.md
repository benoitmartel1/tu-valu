# OAuth Setup Guide for Tu-Valu

## Current Status

- Supabase Project: `https://edmzyjbiamagocfjwrlw.supabase.co`
- App URL: `https://dev.benoitmartel.com/tu-valu`
- Redirect URL in code: `https://dev.benoitmartel.com/tu-valu`

## Required Configuration

### 1. Google OAuth Setup

#### Google Cloud Console (https://console.cloud.google.com/apis/credentials)

1. Create OAuth 2.0 Client ID
2. **Authorized JavaScript origins**:
   - `https://dev.benoitmartel.com`
3. **Authorized redirect URIs** (MUST be exact):
   - `https://edmzyjbiamagocfjwrlw.supabase.co/auth/v1/callback`

#### Supabase Dashboard → Authentication → Providers → Google

1. Enable the provider (toggle ON)
2. Paste Client ID from Google Cloud Console
3. Paste Client Secret from Google Cloud Console
4. Click "Save"

### 2. GitHub OAuth Setup

#### GitHub (https://github.com/settings/developers)

1. Create New OAuth App
2. **Homepage URL**: `https://dev.benoitmartel.com/tu-valu`
3. **Authorization callback URL** (MUST be exact):
   - `https://edmzyjbiamagocfjwrlw.supabase.co/auth/v1/callback`
4. Copy Client ID and generate Client Secret

#### Supabase Dashboard → Authentication → Providers → GitHub

1. Enable the provider (toggle ON)
2. Paste Client ID from GitHub
3. Paste Client Secret from GitHub
4. Click "Save"

### 3. Supabase URL Configuration

#### Supabase Dashboard → Authentication → URL Configuration

1. **Site URL**: `https://dev.benoitmartel.com/` (or keep current for shared domain)
2. **Redirect URLs** (add these patterns):
   - `https://dev.benoitmartel.com/tu-valu/**`
   - `http://localhost:5173/**`

## Troubleshooting Checklist

### If Google OAuth fails with "redirect_uri_mismatch":

- [ ] Verify redirect URI in Google Cloud Console is EXACTLY: `https://edmzyjbiamagocfjwrlw.supabase.co/auth/v1/callback`
- [ ] No trailing slash
- [ ] No extra spaces
- [ ] Wait 2-5 minutes after saving changes in Google Cloud Console
- [ ] Clear browser cache or use incognito mode

### If GitHub OAuth fails with "redirect_uri is not associated":

- [ ] Verify callback URL in GitHub OAuth App is EXACTLY: `https://edmzyjbiamagocfjwrlw.supabase.co/auth/v1/callback`
- [ ] No trailing slash
- [ ] No extra spaces
- [ ] Changes take effect immediately (no waiting period)

### If both fail:

- [ ] Verify providers are ENABLED in Supabase (not just configured)
- [ ] Check browser console for errors
- [ ] Verify Client ID and Secret match between provider and Supabase
- [ ] Try in incognito/private browsing mode
- [ ] Check Supabase logs: Dashboard → Logs → Auth

## Testing Steps

1. Open browser console (F12)
2. Go to `https://dev.benoitmartel.com/tu-valu`
3. Click "GitHub" or "Google" button
4. Check console for:
   - "Signing in with github/google"
   - "Redirect URL: https://dev.benoitmartel.com/tu-valu"
5. Complete OAuth flow
6. Verify you're redirected back and logged in

## Common Issues

### Issue: Provider shows as configured but not enabled

**Solution**: Toggle the provider ON in Supabase dashboard

### Issue: Credentials don't match

**Solution**: Double-check Client ID and Secret in both places (provider dashboard and Supabase)

### Issue: Still getting redirect_uri_mismatch after fixing

**Solution**:

- Wait 5 minutes for Google changes to propagate
- Clear browser cache completely
- Try incognito mode
- Verify no typos in the URL

### Issue: OAuth works but user doesn't have app_name metadata

**Solution**: This is normal for OAuth users. You may want to add a database trigger to set this automatically.

## Next Steps After Setup

Once OAuth is working:

1. Test both providers thoroughly
2. Consider adding a database trigger to set `app_name: "tu-valu"` for OAuth users
3. Update user onboarding flow if needed
4. Document the setup for team members
