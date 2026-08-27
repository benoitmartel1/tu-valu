# CORS Configuration Fix for Photo Uploads

## Problem

When uploading photos from the production site (`https://dev.benoitmartel.com`), users encountered CORS errors:

```
Access to fetch at 'https://young-blackett.s3.bhs.io.cloud.ovh.net/' from origin
'https://dev.benoitmartel.com' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Root Cause

The browser uploads photos directly to OVH S3 (bypassing the backend), but the S3 bucket didn't have proper CORS rules configured to allow requests from the production domain.

## Solution

Applied CORS configuration to the OVH S3 bucket using AWS CLI.

### CORS Rules Applied

- **Allowed Origins:**
  - `http://localhost:5173` (local development)
  - `https://dev.benoitmartel.com` (production)
- **Allowed Methods:** POST, PUT, GET, HEAD
- **Allowed Headers:** \* (all headers)
- **Exposed Headers:** ETag, x-amz-version-id
- **Max Age:** 3000 seconds

### How to Apply

Run the provided script:

```bash
.\apply-cors.bat
```

This script:

1. Loads credentials from `api/.env`
2. Uses AWS CLI to apply the CORS configuration from `cors.json`
3. Verifies the configuration was applied successfully

### Files Involved

- `cors.json` - CORS configuration definition
- `apply-cors.bat` - Script to apply CORS rules
- `api/generate-presigned-url.php` - Backend endpoint (already had CORS headers)

## Verification

After applying the CORS configuration:

1. Clear browser cache
2. Try uploading a photo from `https://dev.benoitmartel.com`
3. Check browser console - no CORS errors should appear
4. Photo should upload successfully to OVH S3

## Technical Details

The upload flow works as follows:

1. Frontend calls `/api/generate-presigned-url.php` (has CORS headers ✅)
2. Backend generates presigned URL with policy and signature
3. Frontend uploads directly to OVH S3 using POST with multipart/form-data
4. **OVH S3 must have CORS rules to accept this direct browser upload** ← This was missing

## Future Maintenance

If you need to add new domains or modify CORS rules:

1. Edit `cors.json`
2. Run `.\apply-cors.bat` again
3. Changes take effect immediately (no restart needed)
