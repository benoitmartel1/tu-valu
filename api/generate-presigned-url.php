<?php
/**
 * Generate a presigned URL for an OVHcloud S3 upload.
 */

header('Content-Type: application/json');
$allowedOrigins = ['http://localhost:5173', 'https://dev.benoitmartel.com'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
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
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
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

$autoloadFile = __DIR__ . '/vendor/autoload.php';
if (!is_file($autoloadFile)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server dependencies are not installed']);
    exit();
}
require $autoloadFile;

use Aws\S3\S3Client;

// OVHcloud S3 configuration is kept on the server.
define('OVH_S3_ENDPOINT', getenv('OVH_S3_ENDPOINT') ?: 'https://s3.bhs.io.cloud.ovh.net');
define('OVH_S3_BUCKET', getenv('OVH_S3_BUCKET') ?: 'young-blackett');
define('OVH_S3_REGION', getenv('OVH_S3_REGION') ?: 'bhs');
define('OVH_S3_ACCESS_KEY', getenv('OVH_S3_ACCESS_KEY'));
define('OVH_S3_SECRET_KEY', getenv('OVH_S3_SECRET_KEY'));

// Validate that credentials are set
if (!OVH_S3_ACCESS_KEY || !OVH_S3_SECRET_KEY) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'S3 credentials not configured']);
    exit();
}

// Accept multipart/form-data from the browser, with JSON retained for API clients.
$input = $_POST;
if (!$input) {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
}

if (!isset($input['studentId'], $input['filename'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields: studentId, filename']);
    exit();
}

$studentId = trim((string) $input['studentId']);
$originalFilename = basename((string) $input['filename']);
$contentType = trim((string) ($input['content_type'] ?? 'application/octet-stream'));

if (!preg_match('/^[a-f0-9-]{36}$/i', $studentId) || $originalFilename === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid upload metadata']);
    exit();
}

if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]{0,126}\/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]{0,126}$/', $contentType)) {
    $contentType = 'application/octet-stream';
}

// Keep the original extension while making every object key unique.
$extension = pathinfo($originalFilename, PATHINFO_EXTENSION);
$safeExtension = preg_replace('/[^a-z0-9]/i', '', $extension);
$filename = $studentId . '-' . uniqid('', true) . ($safeExtension ? '.' . strtolower($safeExtension) : '.dat');

try {
    $s3 = new S3Client([
        'version' => 'latest',
        'region' => OVH_S3_REGION,
        'endpoint' => OVH_S3_ENDPOINT,
        'credentials' => [
            'key' => OVH_S3_ACCESS_KEY,
            'secret' => OVH_S3_SECRET_KEY,
        ],
        'use_path_style_endpoint' => true,
    ]);

    $command = $s3->getCommand('PutObject', [
        'Bucket' => OVH_S3_BUCKET,
        'Key' => $filename,
        'ContentType' => $contentType,
    ]);
    $request = $s3->createPresignedRequest($command, '+15 minutes');
    $url = (string) $request->getUri();
    $publicUrl = rtrim(OVH_S3_ENDPOINT, '/') . '/' . rawurlencode(OVH_S3_BUCKET) . '/' . rawurlencode($filename);

    echo json_encode([
        'success' => true,
        'url' => $url,
        'filename' => $filename,
        'publicUrl' => $publicUrl,
    ]);
} catch (Throwable $error) {
    error_log('Failed to generate S3 presigned URL: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to generate upload URL']);
}
