'''
Business: Регистрация, логин и получение данных пользователя (обновлено)
Args: event - dict с httpMethod, body, queryStringParameters, headers
      context - объект с request_id, function_name
Returns: HTTP response dict с токеном или данными пользователя
'''
import json
import os
import hashlib
import secrets
from typing import Dict, Any, Optional
from pydantic import BaseModel, EmailStr, Field, ValidationError
import psycopg2
from psycopg2.extras import RealDictCursor

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=1)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    return psycopg2.connect(dsn, cursor_factory=RealDictCursor)

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def generate_token() -> str:
    return secrets.token_urlsafe(32)

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
    
    if method == 'POST':
        body_data = json.loads(event.get('body', '{}'))
        action = body_data.get('action')
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        try:
            if action == 'register':
                req = RegisterRequest(**body_data)
                password_hash = hash_password(req.password)
                
                cur.execute(
                    "INSERT INTO users (email, password_hash, full_name) VALUES (%s, %s, %s) RETURNING id, email, full_name, balance_usd",
                    (req.email, password_hash, req.full_name)
                )
                user = cur.fetchone()
                conn.commit()
                
                token = generate_token()
                
                user_data = {
                    'id': user['id'],
                    'email': user['email'],
                    'full_name': user['full_name'],
                    'balance_usd': float(user['balance_usd'])
                }
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'success': True,
                        'token': token,
                        'user': user_data
                    })
                }
            
            elif action == 'login':
                req = LoginRequest(**body_data)
                password_hash = hash_password(req.password)
                
                cur.execute(
                    "SELECT id, email, full_name, balance_usd FROM users WHERE email = %s AND password_hash = %s",
                    (req.email, password_hash)
                )
                user = cur.fetchone()
                
                if not user:
                    return {
                        'statusCode': 401,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        'body': json.dumps({'success': False, 'error': 'Invalid credentials'})
                    }
                
                token = generate_token()
                
                user_data = {
                    'id': user['id'],
                    'email': user['email'],
                    'full_name': user['full_name'],
                    'balance_usd': float(user['balance_usd'])
                }
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'success': True,
                        'token': token,
                        'user': user_data
                    })
                }
        
        finally:
            cur.close()
            conn.close()
    
    return {
        'statusCode': 405,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'error': 'Method not allowed'})
    }