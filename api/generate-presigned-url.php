<?php
/**
 * Generate presigned URL for OVHcloud S3 upload
 * 
 * This endpoint generates a presigned URL that allows direct browser upload
 * to OVHcloud Object Storage (S3-compatible).
 * 
 * Usage: POST /api/generate-presigned-url.php
 * Body: { "studentId": "uuid", "filename": "original.jpg" }
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

if (!$input || !isset($input['studentId']) || !isset($input['filename'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: studentId, filename']);
    exit();
}

$studentId = $input['studentId'];
$originalFilename = $input['filename'];

// Extract file extension
$extension = pathinfo($originalFilename, PATHINFO_EXTENSION);
if (!$extension) {
    $extension = 'jpg';
}

// Generate secure filename using student ID
$filename = $studentId . '.' . strtolower($extension);

// Generate POST Policy and Signature for browser upload
$expires = 3600; // Policy expires in 1 hour
$timestamp = time();
$expiration = gmdate('Y-m-d\TH:i:s.000\Z', $timestamp + $expires);
$date = gmdate('Ymd', $timestamp);
$datetime = gmdate('Ymd\THis\Z', $timestamp);

// Create POST Policy
$policy = [
    'expiration' => $expiration,
    'conditions' => [
        ['bucket' => OVH_S3_BUCKET],
        ['starts-with', '$key', ''],
        ['eq', '$x-amz-algorithm', 'AWS4-HMAC-SHA256'],
        ['eq', '$x-amz-credential', OVH_S3_ACCESS_KEY . '/' . $date . '/' . OVH_S3_REGION . '/s3/aws4_request'],
        ['eq', '$x-amz-date', $datetime],
        ['eq', '$content-type', 'image/jpeg'],
        ['eq', '$acl', 'public-read'],
        ['content-length-range', 1, 10485760] // 1 byte to 10 MB
    ]
];

// Base64 encode the policy
$policyJson = json_encode($policy);
$policyBase64 = base64_encode($policyJson);

// Calculate SigV4 signature
$kDate = hash_hmac('sha256', $date, 'AWS4' . OVH_S3_SECRET_KEY, true);
$kRegion = hash_hmac('sha256', OVH_S3_REGION, $kDate, true);
$kService = hash_hmac('sha256', 's3', $kRegion, true);
$kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
$signature = hash_hmac('sha256', $policyBase64, $kSigning);

// Build the upload URL (virtual-hosted style)
$uploadUrl = 'https://' . OVH_S3_BUCKET . '.s3.' . OVH_S3_REGION . '.io.cloud.ovh.net/';

// Return the policy, signature, and upload details
echo json_encode([
    'uploadUrl' => $uploadUrl,
    'policy' => $policyBase64,
    'signature' => $signature,
    'key' => $filename,
    'algorithm' => 'AWS4-HMAC-SHA256',
    'credential' => OVH_S3_ACCESS_KEY . '/' . $date . '/' . OVH_S3_REGION . '/s3/aws4_request',
    'date' => $datetime,
    'publicUrl' => 'https://' . OVH_S3_BUCKET . '.s3.' . OVH_S3_REGION . '.io.cloud.ovh.net/' . $filename,
    'filename' => $filename,
    'expiresIn' => $expires
]);
