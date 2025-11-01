'''
Business: Покупка и продажа криптовалюты, получение баланса и истории транзакций
Args: event - dict с httpMethod, body, queryStringParameters, headers
      context - объект с request_id, function_name
Returns: HTTP response dict с результатом операции
'''
import json
import os
from typing import Dict, Any
from decimal import Decimal
from pydantic import BaseModel, Field, ValidationError
import psycopg2
from psycopg2.extras import RealDictCursor

class TradeRequest(BaseModel):
    user_id: int
    action: str = Field(..., pattern='^(buy|sell)$')
    symbol: str
    amount: float = Field(..., gt=0)
    price_usd: float = Field(..., gt=0)

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    return psycopg2.connect(dsn, cursor_factory=RealDictCursor)

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
        if method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            req = TradeRequest(**body_data)
            
            total_usd = Decimal(str(req.amount)) * Decimal(str(req.price_usd))
            
            cur.execute("SELECT balance_usd FROM users WHERE id = %s", (req.user_id,))
            user = cur.fetchone()
            
            if not user:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': False, 'error': 'User not found'})
                }
            
            if req.action == 'buy':
                if Decimal(str(user['balance_usd'])) < total_usd:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'success': False, 'error': 'Insufficient balance'})
                    }
                
                cur.execute(
                    "UPDATE users SET balance_usd = balance_usd - %s WHERE id = %s",
                    (float(total_usd), req.user_id)
                )
                
                cur.execute(
                    "INSERT INTO crypto_balances (user_id, symbol, amount) VALUES (%s, %s, %s) ON CONFLICT (user_id, symbol) DO UPDATE SET amount = crypto_balances.amount + %s",
                    (req.user_id, req.symbol, req.amount, req.amount)
                )
            
            elif req.action == 'sell':
                cur.execute(
                    "SELECT amount FROM crypto_balances WHERE user_id = %s AND symbol = %s",
                    (req.user_id, req.symbol)
                )
                balance = cur.fetchone()
                
                if not balance or Decimal(str(balance['amount'])) < Decimal(str(req.amount)):
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'success': False, 'error': 'Insufficient crypto balance'})
                    }
                
                cur.execute(
                    "UPDATE crypto_balances SET amount = amount - %s WHERE user_id = %s AND symbol = %s",
                    (req.amount, req.user_id, req.symbol)
                )
                
                cur.execute(
                    "UPDATE users SET balance_usd = balance_usd + %s WHERE id = %s",
                    (float(total_usd), req.user_id)
                )
            
            cur.execute(
                "INSERT INTO transactions (user_id, type, symbol, amount, price_usd, total_usd) VALUES (%s, %s, %s, %s, %s, %s)",
                (req.user_id, req.action, req.symbol, req.amount, req.price_usd, float(total_usd))
            )
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True, 'message': f'{req.action.capitalize()} successful'})
            }
        
        elif method == 'GET':
            params = event.get('queryStringParameters', {})
            user_id = params.get('user_id')
            action = params.get('action', 'balance')
            
            if action == 'balance':
                cur.execute(
                    "SELECT u.balance_usd, cb.symbol, cb.amount FROM users u LEFT JOIN crypto_balances cb ON u.id = cb.user_id WHERE u.id = %s",
                    (user_id,)
                )
                balances = cur.fetchall()
                
                result = {
                    'usd': 0,
                    'crypto': []
                }
                
                for row in balances:
                    result['usd'] = float(row['balance_usd'])
                    if row['symbol']:
                        result['crypto'].append({
                            'symbol': row['symbol'],
                            'amount': float(row['amount'])
                        })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps(result)
                }
            
            elif action == 'history':
                cur.execute(
                    "SELECT * FROM transactions WHERE user_id = %s ORDER BY created_at DESC LIMIT 50",
                    (user_id,)
                )
                transactions = cur.fetchall()
                
                result = []
                for tx in transactions:
                    result.append({
                        'id': tx['id'],
                        'type': tx['type'],
                        'symbol': tx['symbol'],
                        'amount': float(tx['amount']),
                        'price_usd': float(tx['price_usd']),
                        'total_usd': float(tx['total_usd']),
                        'created_at': tx['created_at'].isoformat() if tx['created_at'] else None
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps(result)
                }
    
    finally:
        cur.close()
        conn.close()
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }
