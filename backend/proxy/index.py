'''
Business: Покупка прокси, получение тарифов и управление заказами
Args: event - dict с httpMethod, body, queryStringParameters, headers
      context - объект с request_id, function_name
Returns: HTTP response dict с данными прокси или результатом операции
'''
import json
import os
from typing import Dict, Any
from decimal import Decimal
from datetime import datetime, timedelta
import random
from pydantic import BaseModel, Field
import psycopg2
from psycopg2.extras import RealDictCursor

class PurchaseRequest(BaseModel):
    user_id: int
    plan_id: int
    location: str
    quantity: int = Field(..., gt=0, le=100)
    duration_months: int = Field(..., gt=0, le=12)

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    return psycopg2.connect(dsn, cursor_factory=RealDictCursor)

def generate_proxy_credentials(location: str, quantity: int):
    proxies = []
    base_ips = {
        'Russia': '45.141.',
        'USA': '192.168.',
        'Germany': '195.201.',
        'France': '51.158.',
        'Japan': '103.75.',
        'Singapore': '128.199.'
    }
    
    base_ip = base_ips.get(location, '192.168.')
    
    for _ in range(quantity):
        proxy = {
            'host': f'{base_ip}{random.randint(1, 255)}.{random.randint(1, 255)}',
            'port': random.randint(8000, 9999),
            'username': f'user_{random.randint(1000, 9999)}',
            'password': f'pass_{random.randint(10000, 99999)}'
        }
        proxies.append(proxy)
    
    return proxies

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            params = event.get('queryStringParameters', {})
            action = params.get('action', 'plans')
            
            if action == 'plans':
                cur.execute('SELECT * FROM proxy_plans ORDER BY price_per_month')
                plans = cur.fetchall()
                
                result = []
                for plan in plans:
                    result.append({
                        'id': plan['id'],
                        'name': plan['name'],
                        'type': plan['type'],
                        'description': plan['description'],
                        'price_per_month': float(plan['price_per_month']),
                        'max_connections': plan['max_connections'],
                        'speed': plan['speed'],
                        'locations': plan['locations']
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps(result)
                }
            
            elif action == 'orders':
                user_id = params.get('user_id')
                
                cur.execute('''
                    SELECT po.*, pp.name as plan_name, pp.type as plan_type
                    FROM proxy_orders po
                    JOIN proxy_plans pp ON po.plan_id = pp.id
                    WHERE po.user_id = %s
                    ORDER BY po.created_at DESC
                ''', (user_id,))
                orders = cur.fetchall()
                
                result = []
                for order in orders:
                    cur.execute(
                        'SELECT * FROM proxy_credentials WHERE order_id = %s',
                        (order['id'],)
                    )
                    credentials = cur.fetchall()
                    
                    result.append({
                        'id': order['id'],
                        'plan_name': order['plan_name'],
                        'plan_type': order['plan_type'],
                        'location': order['location'],
                        'quantity': order['quantity'],
                        'duration_months': order['duration_months'],
                        'total_price': float(order['total_price']),
                        'status': order['status'],
                        'expires_at': order['expires_at'].isoformat() if order['expires_at'] else None,
                        'created_at': order['created_at'].isoformat() if order['created_at'] else None,
                        'proxies': [
                            {
                                'host': cred['proxy_host'],
                                'port': cred['proxy_port'],
                                'username': cred['proxy_username'],
                                'password': cred['proxy_password'],
                                'location': cred['location'],
                                'status': cred['status']
                            }
                            for cred in credentials
                        ]
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps(result)
                }
        
        elif method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            req = PurchaseRequest(**body_data)
            
            cur.execute('SELECT * FROM proxy_plans WHERE id = %s', (req.plan_id,))
            plan = cur.fetchone()
            
            if not plan:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': False, 'error': 'Plan not found'})
                }
            
            cur.execute('SELECT balance_usd FROM users WHERE id = %s', (req.user_id,))
            user = cur.fetchone()
            
            if not user:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': False, 'error': 'User not found'})
                }
            
            total_price = Decimal(str(plan['price_per_month'])) * req.quantity * req.duration_months
            
            if Decimal(str(user['balance_usd'])) < total_price:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': False, 'error': 'Insufficient balance'})
                }
            
            expires_at = datetime.now() + timedelta(days=30 * req.duration_months)
            
            cur.execute(
                '''INSERT INTO proxy_orders 
                   (user_id, plan_id, location, quantity, duration_months, total_price, expires_at) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id''',
                (req.user_id, req.plan_id, req.location, req.quantity, req.duration_months, 
                 float(total_price), expires_at)
            )
            order_id = cur.fetchone()['id']
            
            cur.execute(
                'UPDATE users SET balance_usd = balance_usd - %s WHERE id = %s',
                (float(total_price), req.user_id)
            )
            
            proxies = generate_proxy_credentials(req.location, req.quantity)
            
            for proxy in proxies:
                cur.execute(
                    '''INSERT INTO proxy_credentials 
                       (order_id, proxy_host, proxy_port, proxy_username, proxy_password, location) 
                       VALUES (%s, %s, %s, %s, %s, %s)''',
                    (order_id, proxy['host'], proxy['port'], proxy['username'], 
                     proxy['password'], req.location)
                )
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'order_id': order_id,
                    'message': 'Proxy purchased successfully',
                    'proxies': proxies
                })
            }
    
    finally:
        cur.close()
        conn.close()
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }
