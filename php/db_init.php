<?php
require_once 'config.php';

header('Content-Type: application/json');

try {
    // Check if tables already exist by checking for 'users'
    $stmt = $pdo->query("SHOW TABLES LIKE 'users'");
    $tableExists = $stmt->fetch();
    
    if (!$tableExists) {
        $schemaFile = __DIR__ . '/schema.sql';
        if (!file_exists($schemaFile)) {
            throw new Exception("schema.sql not found at " . $schemaFile);
        }
        
        $sql = file_get_contents($schemaFile);
        
        // Execute the multi-statement schema query
        $pdo->exec($sql);
        
        echo json_encode([
            'success' => true,
            'message' => 'MySQL database schema initialized successfully.'
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'message' => 'MySQL database is already initialized.'
        ]);
    }
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Database initialization failed: ' . $e->getMessage()
    ]);
}
