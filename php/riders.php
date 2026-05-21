<?php
require_once 'config.php';

header('Content-Type: application/json');

$userId = get_current_user_id();
if (!$userId) {
    echo json_encode(['data' => null, 'error' => ['message' => 'Unauthorized. Please login first.']]);
    exit;
}

$inputData = json_decode(file_get_contents('php://input'), true) ?? $_POST;
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // List riders for the logged-in parent
    try {
        $stmt = $pdo->prepare("SELECT * FROM riders WHERE parent_id = ? ORDER BY created_at DESC");
        $stmt->execute([$userId]);
        $riders = $stmt->fetchAll();
        
        // Map integer/string values back to correct JSON types
        foreach ($riders as &$rider) {
            $rider['special_needs'] = (bool)$rider['special_needs'];
            $rider['is_active'] = (bool)$rider['is_active'];
        }
        
        echo json_encode(['data' => $riders, 'error' => null]);
    } catch (Exception $e) {
        echo json_encode(['data' => null, 'error' => ['message' => $e->getMessage()]]);
    }
} elseif ($method === 'POST') {
    $action = $inputData['action'] ?? $_GET['action'] ?? '';
    
    if ($action === 'update' || isset($inputData['id'])) {
        // Update rider
        $riderId = $inputData['id'] ?? '';
        if (empty($riderId)) {
            echo json_encode(['data' => null, 'error' => ['message' => 'Rider ID is required for update.']]);
            exit;
        }
        
        // Verify ownership
        $stmt = $pdo->prepare("SELECT id FROM riders WHERE id = ? AND parent_id = ?");
        $stmt->execute([$riderId, $userId]);
        if (!$stmt->fetch()) {
            echo json_encode(['data' => null, 'error' => ['message' => 'Rider not found or permission denied.']]);
            exit;
        }
        
        // Extract fields to update
        $fields = ['name', 'relationship', 'school', 'grade', 'phone', 'special_needs', 'notes', 'is_active'];
        $updates = [];
        $params = [];
        
        foreach ($fields as $field) {
            if (isset($inputData[$field])) {
                $updates[] = "`$field` = ?";
                if ($field === 'special_needs' || $field === 'is_active') {
                    $params[] = $inputData[$field] ? 1 : 0;
                } else {
                    $params[] = $inputData[$field];
                }
            }
        }
        
        if (empty($updates)) {
            echo json_encode(['data' => null, 'error' => ['message' => 'No fields to update.']]);
            exit;
        }
        
        $params[] = $riderId;
        $sql = "UPDATE riders SET " . implode(', ', $updates) . " WHERE id = ?";
        
        try {
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            
            // Fetch updated rider
            $stmt = $pdo->prepare("SELECT * FROM riders WHERE id = ?");
            $stmt->execute([$riderId]);
            $updatedRider = $stmt->fetch();
            
            $updatedRider['special_needs'] = (bool)$updatedRider['special_needs'];
            $updatedRider['is_active'] = (bool)$updatedRider['is_active'];
            
            echo json_encode(['data' => $updatedRider, 'error' => null]);
        } catch (Exception $e) {
            echo json_encode(['data' => null, 'error' => ['message' => $e->getMessage()]]);
        }
    } else {
        // Create rider
        $name = $inputData['name'] ?? '';
        $relationship = $inputData['relationship'] ?? '';
        
        if (empty($name) || empty($relationship)) {
            echo json_encode(['data' => null, 'error' => ['message' => 'Name and relationship are required.']]);
            exit;
        }
        
        $riderId = generate_uuid();
        $school = $inputData['school'] ?? null;
        $grade = $inputData['grade'] ?? null;
        $phone = $inputData['phone'] ?? null;
        $specialNeeds = isset($inputData['special_needs']) ? ($inputData['special_needs'] ? 1 : 0) : 0;
        $notes = $inputData['notes'] ?? null;
        
        try {
            $stmt = $pdo->prepare("INSERT INTO riders (id, parent_id, name, relationship, school, grade, phone, special_needs, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$riderId, $userId, $name, $relationship, $school, $grade, $phone, $specialNeeds, $notes]);
            
            // Fetch created rider
            $stmt = $pdo->prepare("SELECT * FROM riders WHERE id = ?");
            $stmt->execute([$riderId]);
            $newRider = $stmt->fetch();
            
            $newRider['special_needs'] = (bool)$newRider['special_needs'];
            $newRider['is_active'] = (bool)$newRider['is_active'];
            
            echo json_encode(['data' => $newRider, 'error' => null]);
        } catch (Exception $e) {
            echo json_encode(['data' => null, 'error' => ['message' => $e->getMessage()]]);
        }
    }
} else {
    echo json_encode(['data' => null, 'error' => ['message' => 'Method not allowed.']]);
}
