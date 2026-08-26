<?php
/**
 * Generate presigned URL for viewing private S3 images
 * 
 * This endpoint generates a temporary signed URL that allows reading
 * a private image from OVHcloud Object Storage (S3-compatible).
 * 
 * Usage: POST /api/get-image-presigned-url.php
 * Body: { "studentId": "uuid" }
 * Response: { "presignedUrl": "...", "expiresIn": 3600 }
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// Load environment variables from .env file (for local development)
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue; // Skip comments
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            putenv(trim($key) . '=' . trim($value));
        }
    }
}

// OVHcloud S3 Configuration
define('OVH_S3_ENDPOINT', getenv('OVH_S3_ENDPOINT') ?: 'https://s3.bhs.io.cloud.ovh.net');
define('OVH_S3_BUCKET', getenv('OVH_S3_BUCKET') ?: 'young-blackett');
define('OVH_S3_REGION', getenv('OVH_S3_REGION') ?: 'bhs');
define('OVH_S3_ACCESS_KEY', getenv('OVH_S3_ACCESS_KEY'));
define('OVH_S3_SECRET_KEY', getenv('OVH_S3_SECRET_KEY'));

// Validate that credentials are set
if (!OVH_S3_ACCESS_KEY || !OVH_S3_SECRET_KEY) {
    http_response_code(500);
    echo json_encode(['error' => 'S3 credentials not configured']);
    exit();
}

// Get request body
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['studentId'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required field: studentId']);
    exit();
}

$studentId = $input['studentId'];

// Construct the object key (filename)
$key = $studentId . '.jpg';

// Generate presigned URL using AWS Signature Version 4
$expires = 3600; // URL expires in 1 hour
$timestamp = time();
$date = gmdate('Ymd', $timestamp);
$datetime = gmdate('Ymd\THis\Z', $timestamp);
$expiration = gmdate('Y-m-d\TH:i:s\Z', $timestamp + $expires);

// Canonical request - DO NOT urlencode the key in canonical URI
$canonicalUri = '/' . $key;
$canonicalQueryString = http_build_query([
    'X-Amz-Algorithm' => 'AWS4-HMAC-SHA256',
    'X-Amz-Credential' => OVH_S3_ACCESS_KEY . '/' . $date . '/' . OVH_S3_REGION . '/s3/aws4_request',
    'X-Amz-Date' => $datetime,
    'X-Amz-Expires' => $expires,
    'X-Amz-SignedHeaders' => 'host'
]);

$canonicalHeaders = "host:" . OVH_S3_BUCKET . ".s3." . OVH_S3_REGION . ".io.cloud.ovh.net\n";
$signedHeaders = "host";

$payloadHash = hash('sha256', ''); // Empty payload for GET request

$canonicalRequest = implode("\n", [
    'GET',
    $canonicalUri,
    $canonicalQueryString,
    $canonicalHeaders,
    $signedHeaders,
    $payloadHash
]);

// String to sign
$stringToSign = implode("\n", [
    'AWS4-HMAC-SHA256',
    $datetime,
    $date . '/' . OVH_S3_REGION . '/s3/aws4_request',
    hash('sha256', $canonicalRequest)
]);

// Calculate signature
$kDate = hash_hmac('sha256', $date, 'AWS4' . OVH_S3_SECRET_KEY, true);
$kRegion = hash_hmac('sha256', OVH_S3_REGION, $kDate, true);
$kService = hash_hmac('sha256', 's3', $kRegion, true);
$kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
$signature = hash_hmac('sha256', $stringToSign, $kSigning);

// Build the presigned URL
$presignedUrl = sprintf(
    'https://%s.s3.%s.io.cloud.ovh.net/%s?%s&X-Amz-Signature=%s',
    OVH_S3_BUCKET,
    OVH_S3_REGION,
    $key,
    $canonicalQueryString,
    $signature
);

// Debug logging (remove in production)
error_log("Generated presigned URL for student: " . $studentId);
error_log("Key: " . $key);
error_log("Signature: " . $signature);

echo json_encode([
    'presignedUrl' => $presignedUrl,
    'expiresIn' => $expires,
    'expiresAt' => $expiration,
    'studentId' => $studentId
]);
