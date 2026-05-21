<?php
require_once 'config.php';

header('Content-Type: application/json');

// Read JSON input or form POST data
$inputData = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$action = $inputData['action'] ?? $_GET['action'] ?? '';

switch ($action) {
    case 'login':
        $email = $inputData['email'] ?? '';
        $password = $inputData['password'] ?? '';
        
        if (empty($email) || empty($password)) {
            echo json_encode(['data' => null, 'error' => ['message' => 'Email and password are required.']]);
            exit;
        }
        
        // Find user
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        
        if (!$user || !password_verify($password, $user['password_hash'])) {
            echo json_encode(['data' => null, 'error' => ['message' => 'Invalid email or password.']]);
            exit;
        }
        
        // Get user profile
        $stmt = $pdo->prepare("SELECT * FROM profiles WHERE id = ?");
        $stmt->execute([$user['id']]);
        $profile = $stmt->fetch();
        
        // Generate mock session using the user ID
        $token = $user['id'];
        
        // Set cookies (expire in 30 days)
        setcookie('sb-access-token', $token, [
            'expires' => time() + 30 * 24 * 60 * 60,
            'path' => '/',
            'httponly' => false, // Accessible by Next.js middleware and client
            'samesite' => 'Lax'
        ]);
        
        setcookie('fizza-role', $user['role'], [
            'expires' => time() + 30 * 24 * 60 * 60,
            'path' => '/',
            'httponly' => false,
            'samesite' => 'Lax'
        ]);
        
        echo json_encode([
            'data' => [
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'role' => $user['role']
                ],
                'session' => [
                    'access_token' => $token,
                    'user' => [
                        'id' => $user['id'],
                        'email' => $user['email']
                    ]
                ]
            ],
            'error' => null
        ]);
        break;

    case 'register':
        $email = $inputData['email'] ?? '';
        $password = $inputData['password'] ?? '';
        $fullName = $inputData['fullName'] ?? '';
        $phone = $inputData['phone'] ?? '';
        
        if (empty($email) || empty($password) || empty($fullName)) {
            echo json_encode(['data' => null, 'error' => ['message' => 'Email, password, and full name are required.']]);
            exit;
        }
        
        // Check if user already exists
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            echo json_encode(['data' => null, 'error' => ['message' => 'User with this email already exists.']]);
            exit;
        }
        
        // Begin transaction
        $pdo->beginTransaction();
        try {
            $userId = generate_uuid();
            $passwordHash = password_hash($password, PASSWORD_BCRYPT);
            
            // Insert user
            $stmt = $pdo->prepare("INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, 'parent')");
            $stmt->execute([$userId, $email, $passwordHash]);
            
            // Insert profile
            $stmt = $pdo->prepare("INSERT INTO profiles (id, role, full_name, phone) VALUES (?, 'parent', ?, ?)");
            $stmt->execute([$userId, $fullName, $phone]);
            
            // Create a wallet for the user
            $walletId = generate_uuid();
            $stmt = $pdo->prepare("INSERT INTO wallets (id, user_id, balance_sar) VALUES (?, ?, 0.00)");
            $stmt->execute([$walletId, $userId]);
            
            $pdo->commit();
            
            echo json_encode([
                'data' => [
                    'user' => [
                        'id' => $userId,
                        'email' => $email,
                    ]
                ],
                'error' => null
            ]);
        } catch (Exception $e) {
            $pdo->rollBack();
            echo json_encode(['data' => null, 'error' => ['message' => 'Registration failed: ' . $e->getMessage()]]);
        }
        break;

    case 'logout':
        // Clear cookies by setting negative expiration
        setcookie('sb-access-token', '', time() - 3600, '/');
        setcookie('fizza-role', '', time() - 3600, '/');
        echo json_encode(['data' => true, 'error' => null]);
        break;

    case 'reset-password':
        $email = $inputData['email'] ?? '';
        echo json_encode(['data' => true, 'error' => null]);
        break;

    default:
        echo json_encode(['data' => null, 'error' => ['message' => 'Invalid action: ' . $action]]);
        break;
}
