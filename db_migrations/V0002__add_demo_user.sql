-- Добавление демо пользователя для тестирования
INSERT INTO users (email, password_hash, full_name, balance_usd) 
VALUES ('demo@crypto.com', '6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090', 'Demo User', 50000.00) 
ON CONFLICT (email) DO NOTHING;