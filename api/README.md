# API Endpoints

## Generate Presigned URL for S3 Upload

**Endpoint:** `POST /api/generate-presigned-url.php`

Generates a presigned URL for direct browser upload to OVHcloud Object Storage (S3-compatible).

### Request

```json
{
  "studentId": "uuid-of-student",
  "filename": "original-filename.jpg"
}
```

### Response

```json
{
  "presignedUrl": "https://s3.bhs.io.cloud.ovh.net/young-blackett/{student-id}.jpg?X-Amz-...",
  "publicUrl": "https://s3.bhs.io.cloud.ovh.net/young-blackett/{student-id}.jpg",
  "filename": "{student-id}.jpg",
  "expiresIn": 3600
}
```

### Configuration

The endpoint uses environment variables for OVHcloud S3 credentials (secure, not committed to Git):

**Required Environment Variables:**

- `OVH_S3_ENDPOINT` - S3 endpoint URL (default: `https://s3.bhs.io.cloud.ovh.net`)
- `OVH_S3_BUCKET` - Bucket name (default: `young-blackett`)
- `OVH_S3_REGION` - Region (default: `bhs`)
- `OVH_S3_ACCESS_KEY` - Your access key ID (required)
- `OVH_S3_SECRET_KEY` - Your secret access key (required)

**Local Development:**

1. Copy `.env.example` to `.env` in the `/api` directory
2. Fill in your credentials in `.env`
3. The `.env` file is gitignored and will not be committed

**Production Deployment:**

Since PHP files are deployed via GitHub, you need to set environment variables on your OVH server:

**Option 1: Apache/Nginx Configuration**
Add to your virtual host configuration:

```apache
SetEnv OVH_S3_ENDPOINT https://s3.bhs.io.cloud.ovh.net
SetEnv OVH_S3_BUCKET young-blackett
SetEnv OVH_S3_REGION bhs
SetEnv OVH_S3_ACCESS_KEY your-access-key-here
SetEnv OVH_S3_SECRET_KEY your-secret-key-here
```

**Option 2: .htaccess (if allowed)**
Create `.htaccess` in the `/api` directory:

```apache
SetEnv OVH_S3_ENDPOINT https://s3.bhs.io.cloud.ovh.net
SetEnv OVH_S3_BUCKET young-blackett
SetEnv OVH_S3_REGION bhs
SetEnv OVH_S3_ACCESS_KEY your-access-key-here
SetEnv OVH_S3_SECRET_KEY your-secret-key-here
```

⚠️ Note: Add `.htaccess` to `.gitignore` if it contains credentials!

**Option 3: Server Control Panel**

- cPanel: Use "MultiPHP INI Editor" or "Environment Variables"
- Plesk: Use "Apache & nginx Settings" → Additional directives
- OVH Manager: Check if they provide environment variable configuration

**Option 4: Create .env on server manually**
After deployment, manually create `/api/.env` on your OVH server with your credentials (via FTP/SSH).

⚠️ **NEVER commit `.env` files or `.htaccess` with credentials to Git!**

### Security Notes

⚠️ **IMPORTANT:** The current implementation has hardcoded credentials for development purposes. For production:

1. Move credentials to environment variables or a secure configuration file
2. Add authentication/authorization to the endpoint
3. Validate that the requesting user has permission to upload photos for the specified student
4. Consider implementing rate limiting
5. Use HTTPS only

### Usage Example

```javascript
// Frontend JavaScript
const response = await fetch("/api/generate-presigned-url.php", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    studentId: "123e4567-e89b-12d3-a456-426614174000",
    filename: "photo.jpg",
  }),
});

const { presignedUrl, publicUrl } = await response.json();

// Upload file directly to S3
await fetch(presignedUrl, {
  method: "PUT",
  body: compressedFile,
  headers: { "Content-Type": "image/jpeg" },
});

// Use publicUrl to display the image
console.log("Photo available at:", publicUrl);
```

### File Naming Convention

Files are stored with the student's Supabase UUID as the filename:

- Format: `{student_id}.{extension}`
- Example: `123e4567-e89b-12d3-a456-426614174000.jpg`
- All files are stored in the root of the bucket (flat structure)
- Uploading a new photo for the same student will overwrite the previous one

### Image Specifications

The frontend compresses images before upload:

- **Width:** 256px (maintains aspect ratio)
- **Format:** JPEG
- **Quality:** 40%
- **Supported input formats:** JPG, PNG
