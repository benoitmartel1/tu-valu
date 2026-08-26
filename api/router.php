<?php
/**
 * Router script for PHP built-in server
 * This handles URL rewriting for the API endpoints
 */

// Get the request URI
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Remove leading slash
$requestUri = ltrim($requestUri, '/');

// Map the request to the actual PHP file
$scriptFile = __DIR__ . '/' . $requestUri;

// Check if the file exists
if (file_exists($scriptFile) && pathinfo($scriptFile, PATHINFO_EXTENSION) === 'php') {
    // Serve the PHP file
    require_once $scriptFile;
    return true;
}

// File not found
http_response_code(404);
echo json_encode(['error' => 'File not found: ' . $requestUri]);
return false;
