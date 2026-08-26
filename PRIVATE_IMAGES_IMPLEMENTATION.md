# Private S3 Images Implementation Guide

## Overview

This guide documents the implementation of private S3 image storage with presigned URL access for student photos in the Tu-Valu application.

## What Changed

### Before (Public Access)

- Images uploaded to S3 were set to `public-read` ACL
- Direct URLs like `https://young-blackett.s3.bhs.io.cloud.ovh.net/{student-id}.jpg` worked for anyone
- No authentication required to view images

### After (Private Access)

- Images are stored with **private** ACL (no public access)
- Direct URLs return `403 Forbidden` or `AccessDenied`
- App generates temporary **presigned URLs** (valid for 1 hour) to display images
- Only authenticated users with valid presigned URLs can view images

## Files Modified

### 1. Backend - Upload Policy (`api/generate-presigned-url.php`)

**Change**: Removed `'public-read'` ACL from upload policy

```php
// BEFORE
['eq', '$acl', 'public-read'],

// AFTER
// Removed 'public-read' ACL - files will be private by default
```

**Impact**: New uploads will be private. Existing public files remain public until re-uploaded.

---

### 2. Backend - New Endpoint (`api/get-image-presigned-url.php`)

**Purpose**: Generate presigned URLs for viewing private images

**Usage**:

```javascript
POST /api/get-image-presigned-url.php
Body: { "studentId": "uuid" }

Response: {
  "presignedUrl": "https://...?X-Amz-Algorithm=...&X-Amz-Signature=...",
  "expiresIn": 3600,
  "expiresAt": "2026-08-26T15:30:00Z",
  "studentId": "abc-123"
}
```

**How it works**:

- Uses AWS Signature Version 4 (SigV4)
- Generates time-limited URL (1 hour expiry)
- Includes authentication signature in query parameters
- Only allows GET requests for specific object key

---

### 3. Frontend - Helper Function (`src/supabase.js`)

**Added**: `getStudentPhotoPresignedUrl(studentId)` function

```javascript
export async function getStudentPhotoPresignedUrl(studentId) {
  const response = await fetch("/api/get-image-presigned-url.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId }),
  });

  const data = await response.json();
  return {
    presignedUrl: data.presignedUrl,
    expiresIn: data.expiresIn,
  };
}
```

---

### 4. Frontend - LiveSession Component (`src/components/LiveSession.vue`)

**Changes**:

1. Imported `getStudentPhotoPresignedUrl` helper
2. Added reactive variable `studentDetailPhotoUrl` to store presigned URL
3. Updated `watch(studentDetailId)` to fetch presigned URL when student is selected
4. Updated template to use `studentDetailPhotoUrl` instead of direct `photo_url`

**Flow**:

```
User clicks student →
  watch triggers →
    fetches student data from Supabase →
      if photo_url exists →
        calls getStudentPhotoPresignedUrl() →
          stores presigned URL →
            displays image with signed URL
```

---

## Testing Checklist

### ✅ Test 1: Direct URL Access (Should Fail)

1. Try accessing a student photo directly in browser:
   ```
   https://young-blackett.s3.bhs.io.cloud.ovh.net/{student-id}.jpg
   ```
2. **Expected**: `403 Forbidden` or XML error message

### ✅ Test 2: App Display (Should Work)

1. Open the app and navigate to a student detail view
2. Student should have a photo displayed
3. Check browser DevTools → Network tab
4. **Expected**: Image URL contains `X-Amz-Signature` parameter

### ✅ Test 3: Presigned URL Expiry

1. Copy the presigned URL from DevTools
2. Wait 1+ hour (or modify expiry time for testing)
3. Try accessing the URL directly
4. **Expected**: `403 Forbidden` (signature expired)

### ✅ Test 4: New Photo Upload

1. Use the picture import feature to upload a new photo
2. Check the uploaded file's ACL in OVHcloud console
3. **Expected**: File should NOT have public-read permission

---

## Security Considerations

### Current State

- ✅ Images are private by default
- ✅ Presigned URLs expire after 1 hour
- ✅ URLs are generated server-side with proper credentials
- ⚠️ PHP endpoint has no authentication (relies on CORS)

### Recommended Improvements for Production

1. **Add Authentication to PHP Endpoints**

   ```php
   // Verify user is logged in via Supabase session
   $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
   // Validate JWT token before generating presigned URL
   ```

2. **Implement Rate Limiting**

   ```php
   // Track requests per IP/user
   // Limit to X requests per minute
   ```

3. **Shorten URL Expiry**

   ```php
   $expires = 300; // 5 minutes instead of 1 hour
   ```

4. **Store Credentials Securely**
   - Move OVHcloud credentials to environment variables
   - Use `.env` file (already supported)
   - Never commit credentials to Git

5. **Add Referer Validation**
   ```php
   $referer = $_SERVER['HTTP_REFERER'] ?? '';
   if (!str_contains($referer, 'yourdomain.com')) {
     http_response_code(403);
     exit();
   }
   ```

---

## Migration Path for Existing Public Images

If you have existing public images that need to be made private:

### Option 1: Re-upload All Images

1. Run picture import again for all students
2. New uploads will use private ACL automatically

### Option 2: Batch Update ACL via CLI

```bash
# Using AWS CLI (compatible with OVHcloud S3)
aws s3 cp s3://young-blackett/ s3://young-blackett/ \
  --recursive \
  --acl private \
  --endpoint-url https://s3.bhs.io.cloud.ovh.net
```

### Option 3: Bucket Policy Change

Set bucket policy to block all public access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyPublicAccess",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::young-blackett/*",
      "Condition": {
        "StringNotEquals": {
          "aws:Referer": "https://yourdomain.com"
        }
      }
    }
  ]
}
```

---

## Troubleshooting

### Issue: Images not displaying in app

**Check**:

1. Browser console for errors
2. Network tab - is presigned URL being fetched?
3. PHP endpoint logs for errors
4. Verify OVHcloud credentials are correct

### Issue: Presigned URL returns 403 immediately

**Possible causes**:

1. Incorrect signature calculation
2. Wrong region or bucket name
3. Clock skew (server time vs AWS time)
4. Object doesn't exist

### Issue: Old public images still accessible

**Solution**: These were uploaded with public-read ACL. They remain public until:

- Re-uploaded with new policy, OR
- ACL manually changed via OVHcloud console/CLI

---

## Future Enhancements

1. **Cache Presigned URLs**: Store in memory/localStorage with expiry tracking
2. **Batch URL Generation**: Fetch multiple presigned URLs at once for class views
3. **Image Proxy**: Create a proxy endpoint that serves images without exposing S3 URLs
4. **CDN Integration**: Use CloudFront with signed cookies for better performance
5. **Thumbnail Generation**: Generate smaller versions for list views

---

## References

- [AWS SigV4 Documentation](https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-authenticating-requests.html)
- [OVHcloud Object Storage](https://help.ovhcloud.com/csp/en-us/public-cloud-storage-object-storage/)
- [S3 Presigned URLs Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html)
