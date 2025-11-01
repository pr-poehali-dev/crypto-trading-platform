-- Создание таблицы тарифных планов прокси
CREATE TABLE IF NOT EXISTS proxy_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    price_per_month DECIMAL(10, 2) NOT NULL,
    max_connections INTEGER,
    speed VARCHAR(50),
    locations TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы заказов прокси
CREATE TABLE IF NOT EXISTS proxy_orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    plan_id INTEGER REFERENCES proxy_plans(id),
    location VARCHAR(100) NOT NULL,
    quantity INTEGER DEFAULT 1,
    duration_months INTEGER DEFAULT 1,
    total_price DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создание таблицы выданных прокси
CREATE TABLE IF NOT EXISTS proxy_credentials (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES proxy_orders(id),
    proxy_host VARCHAR(255) NOT NULL,
    proxy_port INTEGER NOT NULL,
    proxy_username VARCHAR(100),
    proxy_password VARCHAR(100),
    location VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Вставка тестовых тарифных планов
INSERT INTO proxy_plans (name, type, description, price_per_month, max_connections, speed, locations) VALUES
('Базовый', 'public', 'Публичные прокси для начинающих', 5.99, 3, '10 Mbps', ARRAY['Russia', 'USA', 'Germany']),
('Премиум', 'private', 'Приватные прокси с высокой скоростью', 15.99, 10, '100 Mbps', ARRAY['Russia', 'USA', 'Germany', 'France', 'Japan']),
('Профессионал', 'dedicated', 'Выделенные прокси для профи', 29.99, 50, '1 Gbps', ARRAY['Russia', 'USA', 'Germany', 'France', 'Japan', 'Singapore'])
ON CONFLICT DO NOTHING;

-- Создание индексов
CREATE INDEX IF NOT EXISTS idx_proxy_orders_user_id ON proxy_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_proxy_orders_status ON proxy_orders(status);
CREATE INDEX IF NOT EXISTS idx_proxy_credentials_order_id ON proxy_credentials(order_id);