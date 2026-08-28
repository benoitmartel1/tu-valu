<?php
/**
 * Generate a presigned URL for viewing a private student photo.
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

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit();
}

$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            [$key, $value] = explode('=', $line, 2);
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

$endpoint = getenv('OVH_S3_ENDPOINT') ?: 'https://s3.bhs.io.cloud.ovh.net';
$bucket = getenv('OVH_S3_BUCKET') ?: 'young-blackett';
$region = getenv('OVH_S3_REGION') ?: 'bhs';
$accessKey = getenv('OVH_S3_ACCESS_KEY');
$secretKey = getenv('OVH_S3_SECRET_KEY');

if (!$accessKey || !$secretKey) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'S3 credentials not configured']);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$key = trim((string) ($input['key'] ?? ''));
$photoUrl = trim((string) ($input['photo_url'] ?? ''));

if (!$key && $photoUrl) {
    $url = parse_url($photoUrl);
    $path = $url['path'] ?? '';
    $prefix = '/' . $bucket . '/';
    $endpointHost = parse_url($endpoint, PHP_URL_HOST);
    $virtualHost = $bucket . '.s3.' . $region . '.io.cloud.ovh.net';
    if (($url['host'] ?? '') === $endpointHost && str_starts_with($path, $prefix)) {
        $key = rawurldecode(substr($path, strlen($prefix)));
    } elseif (($url['host'] ?? '') === $virtualHost) {
        $key = rawurldecode(ltrim($path, '/'));
    }
}

if ($key === '' || str_contains($key, '..') || str_starts_with($key, '/')) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing or invalid photo key']);
    exit();
}

try {
    $s3 = new S3Client([
        'version' => 'latest',
        'region' => $region,
        'endpoint' => $endpoint,
        'credentials' => ['key' => $accessKey, 'secret' => $secretKey],
        'use_path_style_endpoint' => true,
    ]);

    $command = $s3->getCommand('GetObject', [
        'Bucket' => $bucket,
        'Key' => $key,
    ]);
    $request = $s3->createPresignedRequest($command, '+1 hour');

    echo json_encode([
        'success' => true,
        'presignedUrl' => (string) $request->getUri(),
        'expiresIn' => 3600,
    ]);
} catch (Throwable $error) {
    error_log('Failed to generate S3 image URL: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Unable to generate image URL']);
}
