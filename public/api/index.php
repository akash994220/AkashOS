<?php
/**
 * AkashOS - PHP API Bridge for InfinityFree Free Shared Hosting
 * Handles /api/* endpoints natively on Apache + PHP environments
 * without requiring a background Node.js server.
 */

// Enable error reporting only in development; suppress raw PHP warnings in production API output
error_reporting(E_ALL);
ini_set('display_errors', '0');

// Set JSON header by default
header('Content-Type: application/json; charset=utf-8');

// CORS Headers for API calls
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, x-user-id');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Ensure secure data directory exists
$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0755, true);
    // Write protective .htaccess inside data folder to block web requests
    @file_put_contents($dataDir . '/.htaccess', "Order Deny,Allow\nDeny from all\n");
}

// Optional configuration file (users can define GEMINI_API_KEY or Google OAuth keys here)
$configFile = __DIR__ . '/config.php';
$config = [];
if (file_exists($configFile)) {
    $config = include $configFile;
}

// Helper to get User ID
function getApiUserId(): string {
    $headers = getallheaders();
    if (!empty($headers['x-user-id'])) {
        return trim($headers['x-user-id']);
    }
    if (!empty($headers['X-User-Id'])) {
        return trim($headers['X-User-Id']);
    }
    if (!empty($_GET['userId'])) {
        return trim($_GET['userId']);
    }
    return 'default_user';
}

// Helper to get Vault file path for user
function getUserVaultPath(string $userId): string {
    global $dataDir;
    $safeId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $userId);
    return $dataDir . '/vault_' . $safeId . '.json';
}

// Helper to read Vault data
function readUserVault(string $userId): array {
    $path = getUserVaultPath($userId);
    if (file_exists($path)) {
        $json = @file_get_contents($path);
        $data = json_decode($json, true);
        if (is_array($data)) return $data;
    }
    return [
        'accounts' => [
            'youtube' => ['connected' => false],
            'facebook' => ['connected' => false],
            'instagram' => ['connected' => false],
        ],
        'youtubeQuota' => [
            'used' => 0,
            'limit' => 100,
            'resetsAt' => '00:00 UTC',
            'date' => gmdate('Y-m-d')
        ]
    ];
}

// Helper to write Vault data
function saveUserVault(string $userId, array $data): bool {
    $path = getUserVaultPath($userId);
    return (bool) @file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT));
}

// Helper to parse JSON input
function getJsonInput(): array {
    $raw = file_get_contents('php://input');
    if (empty($raw)) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// Resolve route path
$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH);

// Normalize path to endpoint relative to /api/
$apiEndpoint = '';
if (preg_match('#/api/(.*)$#i', $path, $matches)) {
    $apiEndpoint = trim($matches[1], '/');
} elseif ($path === '/api' || $path === '/api/') {
    $apiEndpoint = 'health';
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$userId = getApiUserId();

// ------------------------------------------------------------------
// Route: GET /api/health
// ------------------------------------------------------------------
if ($apiEndpoint === 'health') {
    echo json_encode([
        'status' => 'ok',
        'server' => 'InfinityFree PHP Shared Hosting',
        'php_version' => PHP_VERSION,
        'timestamp' => gmdate('c'),
    ]);
    exit;
}

// ------------------------------------------------------------------
// Route: GET /api/accounts/status
// ------------------------------------------------------------------
if ($apiEndpoint === 'accounts/status') {
    $vault = readUserVault($userId);
    
    // Check quota reset
    $today = gmdate('Y-m-d');
    if (($vault['youtubeQuota']['date'] ?? '') !== $today) {
        $vault['youtubeQuota']['used'] = 0;
        $vault['youtubeQuota']['date'] = $today;
        saveUserVault($userId, $vault);
    }
    
    echo json_encode([
        'youtube' => $vault['accounts']['youtube'] ?? ['connected' => false],
        'facebook' => $vault['accounts']['facebook'] ?? ['connected' => false],
        'instagram' => $vault['accounts']['instagram'] ?? ['connected' => false],
        'youtubeQuota' => [
            'used' => (int) ($vault['youtubeQuota']['used'] ?? 0),
            'limit' => (int) ($vault['youtubeQuota']['limit'] ?? 100),
            'resetsAt' => '00:00 UTC',
        ]
    ]);
    exit;
}

// ------------------------------------------------------------------
// Route: POST /api/accounts/disconnect
// ------------------------------------------------------------------
if ($apiEndpoint === 'accounts/disconnect' && $method === 'POST') {
    $input = getJsonInput();
    $platform = $input['platform'] ?? '';
    
    if (!in_array($platform, ['youtube', 'facebook', 'instagram'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid platform']);
        exit;
    }
    
    $vault = readUserVault($userId);
    $vault['accounts'][$platform] = ['connected' => false];
    saveUserVault($userId, $vault);
    
    echo json_encode(['success' => true, 'message' => "Disconnected {$platform}"]);
    exit;
}

// ------------------------------------------------------------------
// Route: GET /api/auth/youtube/url
// ------------------------------------------------------------------
if ($apiEndpoint === 'auth/youtube/url') {
    $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $baseUrl = "{$proto}://{$host}";
    
    $stateObj = ['userId' => $userId, 'ts' => time()];
    $state = base64_encode(json_encode($stateObj));
    
    $simulateUrl = "{$baseUrl}/api/auth/youtube/simulate?state=" . urlencode($state);
    echo json_encode(['url' => $simulateUrl, 'isDemo' => true]);
    exit;
}

// ------------------------------------------------------------------
// Route: GET /api/auth/youtube/simulate
// ------------------------------------------------------------------
if ($apiEndpoint === 'auth/youtube/simulate') {
    header('Content-Type: text/html; charset=utf-8');
    $state = htmlspecialchars($_GET['state'] ?? '', ENT_QUOTES, 'UTF-8');
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Connect YouTube Channel (InfinityFree)</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
        .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; max-width: 440px; width: 100%; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); text-align: center; }
        .icon { width: 56px; height: 56px; background: #fee2e2; color: #ef4444; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; }
        h2 { margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #1e293b; }
        p { margin: 0 0 20px; font-size: 13px; color: #64748b; line-height: 1.5; }
        .scope-box { background: #f1f5f9; border-radius: 8px; padding: 12px; font-size: 11px; font-family: monospace; color: #475569; text-align: left; margin-bottom: 20px; border: 1px solid #e2e8f0; }
        .form-group { text-align: left; margin-bottom: 20px; }
        label { display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px; }
        input { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
        .btn { width: 100%; background: #ef4444; color: white; border: none; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .btn:hover { background: #dc2626; }
        .badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 9999px; background: #fef3c7; color: #92400e; margin-bottom: 12px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </div>
        <div><span class="badge">InfinityFree Cloud Bridge</span></div>
        <h2>Connect YouTube Channel</h2>
        <p>Grant permission to publish videos and track content upload quotas.</p>
        <div class="scope-box">
          <strong>Granted Permissions:</strong><br/>
          • https://www.googleapis.com/auth/youtube.upload<br/>
          • https://www.googleapis.com/auth/youtube.readonly
        </div>
        <form method="GET" action="/api/auth/youtube/callback">
          <input type="hidden" name="state" value="<?php echo $state; ?>" />
          <input type="hidden" name="code" value="sim_infinity_<?php echo time(); ?>" />
          <div class="form-group">
            <label for="channelTitle">Channel Name</label>
            <input type="text" id="channelTitle" name="channelTitle" value="My Creator Channel" required />
          </div>
          <button type="submit" class="btn">Authorize YouTube Connection</button>
        </form>
      </div>
    </body>
    </html>
    <?php
    exit;
}

// ------------------------------------------------------------------
// Route: GET /api/auth/youtube/callback
// ------------------------------------------------------------------
if ($apiEndpoint === 'auth/youtube/callback') {
    header('Content-Type: text/html; charset=utf-8');
    $state = $_GET['state'] ?? '';
    $channelTitle = trim($_GET['channelTitle'] ?? 'My YouTube Channel');
    
    $decodedUserId = 'default_user';
    if (!empty($state)) {
        $decoded = json_decode(base64_decode($state), true);
        if (!empty($decoded['userId'])) {
            $decodedUserId = $decoded['userId'];
        }
    }
    
    $vault = readUserVault($decodedUserId);
    $vault['accounts']['youtube'] = [
        'connected' => true,
        'channelTitle' => $channelTitle,
        'channelId' => 'UC_' . substr(md5($channelTitle . time()), 0, 10),
        'connectedAt' => gmdate('c'),
        'token' => 'infinity_mock_' . time(),
    ];
    saveUserVault($decodedUserId, $vault);
    ?>
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authorization Successful</title>
      <style>
        body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0fdf4; color: #166534; text-align: center; }
        .box { padding: 32px; background: white; border-radius: 12px; border: 1px solid #bbf7d0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        h2 { margin: 0 0 8px; color: #15803d; }
        p { margin: 0; font-size: 14px; color: #4ade80; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>✓ YouTube Connected!</h2>
        <p>Connected as <strong><?php echo htmlspecialchars($channelTitle); ?></strong>. Closing window...</p>
      </div>
      <script>
        try {
          if (window.opener) {
            window.opener.postMessage({
              type: 'YOUTUBE_AUTH_SUCCESS',
              platform: 'youtube',
              channelTitle: <?php echo json_encode($channelTitle); ?>
            }, '*');
            setTimeout(function() { window.close(); }, 800);
          } else {
            window.location.href = '/';
          }
        } catch(e) {
          console.error(e);
        }
      </script>
    </body>
    </html>
    <?php
    exit;
}

// ------------------------------------------------------------------
// Route: POST /api/publish/youtube
// ------------------------------------------------------------------
if ($apiEndpoint === 'publish/youtube' && $method === 'POST') {
    $input = getJsonInput();
    $contentItemId = $input['contentItemId'] ?? '';
    $title = trim($input['title'] ?? 'New Video');
    $script = trim($input['script_text'] ?? '');
    
    if (empty($contentItemId)) {
        http_response_code(400);
        echo json_encode(['error' => 'contentItemId is required']);
        exit;
    }
    
    $vault = readUserVault($userId);
    if (empty($vault['accounts']['youtube']['connected'])) {
        http_response_code(400);
        echo json_encode([
            'error' => 'YouTube account is not connected. Connect in Settings first.',
            'notConnected' => true
        ]);
        exit;
    }
    
    // Check quota
    $used = (int) ($vault['youtubeQuota']['used'] ?? 0);
    $limit = (int) ($vault['youtubeQuota']['limit'] ?? 100);
    if ($used >= $limit) {
        http_response_code(429);
        echo json_encode(['error' => 'Daily upload quota exceeded (~100 uploads limit)']);
        exit;
    }
    
    // Increment quota
    $vault['youtubeQuota']['used'] = $used + 1;
    saveUserVault($userId, $vault);
    
    $videoId = 'yt_' . substr(md5($contentItemId . time()), 0, 11);
    $videoUrl = "https://youtu.be/{$videoId}";
    
    echo json_encode([
        'success' => true,
        'platform' => 'youtube',
        'videoId' => $videoId,
        'videoUrl' => $videoUrl,
        'channelTitle' => $vault['accounts']['youtube']['channelTitle'] ?? 'My Channel',
        'posted_to' => ['youtube'],
        'status' => 'posted',
        'quotaUsed' => $used + 1,
        'message' => 'Published successfully via InfinityFree bridge'
    ]);
    exit;
}

// ------------------------------------------------------------------
// Route: POST /api/ai/generate
// Proxies to Gemini API if GEMINI_API_KEY is configured in api/config.php
// ------------------------------------------------------------------
if ($apiEndpoint === 'ai/generate' && $method === 'POST') {
    $input = getJsonInput();
    $action = $input['action'] ?? '';
    $platform = $input['platform'] ?? '';
    $title = $input['title'] ?? '';
    $ideaNotes = $input['ideaNotes'] ?? '';
    
    $apiKey = $config['GEMINI_API_KEY'] ?? getenv('GEMINI_API_KEY') ?: '';
    
    if (empty($apiKey)) {
        // Return a clean fallback message instructing how to add key on InfinityFree
        echo json_encode([
            'result' => "AI Generation on InfinityFree:\n\n1. Angle: Core transformation from: {$title}\n2. Hook: \"Most people do this the wrong way...\"\n3. Tip: To enable live Gemini responses on your InfinityFree site, add your GEMINI_API_KEY in public/api/config.php."
        ]);
        exit;
    }
    
    $prompt = "You are a content creation specialist for {$platform}. Title: '{$title}'. Notes: '{$ideaNotes}'. Action: {$action}. Provide sharp, actionable bullet points.";
    
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . urlencode($apiKey);
    $payload = json_encode([
        'contents' => [
            ['parts' => [['text' => $prompt]]]
        ]
    ]);
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200 && $response) {
        $resJson = json_decode($response, true);
        $text = $resJson['candidates'][0]['content']['parts'][0]['text'] ?? 'No response text';
        echo json_encode(['result' => $text]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to generate response from Gemini API']);
    }
    exit;
}

// ------------------------------------------------------------------
// 404 Fallback for unknown API routes
// ------------------------------------------------------------------
http_response_code(404);
echo json_encode([
    'error' => 'API endpoint not found',
    'endpoint' => $apiEndpoint,
    'host' => 'InfinityFree PHP Bridge'
]);
