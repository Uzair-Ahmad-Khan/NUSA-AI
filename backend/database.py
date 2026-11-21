#!/usr/bin/env python3
"""
NUSA AI — SQLite Database Module
Manages conversation history, message turns, Q&A records, and memory facts.
"""

import sqlite3
import os
import json
import time
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "nusa_ai.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn

def init_db():
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Conversations Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                model TEXT DEFAULT 'NUSA Assistant',
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL,
                memory_summary TEXT DEFAULT ''
            )
        """)
        
        # Messages Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                tokens INTEGER DEFAULT 0,
                created_at REAL NOT NULL,
                FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            )
        """)
        
        # Questions & Answers Records Table (Permanent Question-Answer Data Hub)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS qa_records (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                model TEXT NOT NULL,
                latency_ms INTEGER DEFAULT 0,
                tokens INTEGER DEFAULT 0,
                memory_context TEXT DEFAULT '',
                tags TEXT DEFAULT '',
                created_at REAL NOT NULL,
                FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            )
        """)
        
        # Dynamic Memory Context Table (Stores long-term facts extracted from conversations)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS memory_facts (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                fact_key TEXT NOT NULL,
                fact_value TEXT NOT NULL,
                confidence REAL DEFAULT 1.0,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL,
                FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            )
        """)
        
        # Users Table (User accounts & RBAC roles)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                avatar_url TEXT DEFAULT '',
                status TEXT DEFAULT 'active',
                created_at REAL NOT NULL,
                last_login REAL
            )
        """)

        # System Configuration Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at REAL NOT NULL
            )
        """)
        
        # Create indexes for fast searches
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_qa_conv ON qa_records(conversation_id, created_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_memory_conv ON memory_facts(conversation_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        
        # Seed default Admin and Demo user if not present
        now = time.time()
        import hashlib
        def _hash_pw(pw: str) -> str:
            return hashlib.sha256(f"nusa_salt_{pw}".encode("utf-8")).hexdigest()

        # Seed admin: admin@nusa.ai / admin123#
        cursor.execute("SELECT id FROM users WHERE email = ?", ("admin@nusa.ai",))
        if not cursor.fetchone():
            cursor.execute("""
                INSERT INTO users (id, name, email, password_hash, role, avatar_url, status, created_at, last_login)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, ("usr_admin_default", "NUSA Master Admin", "admin@nusa.ai", _hash_pw("admin123#"), "admin", "", "active", now, now))

        # Seed regular user: user@nusa.ai / user123#
        cursor.execute("SELECT id FROM users WHERE email = ?", ("user@nusa.ai",))
        if not cursor.fetchone():
            cursor.execute("""
                INSERT INTO users (id, name, email, password_hash, role, avatar_url, status, created_at, last_login)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, ("usr_user_default", "NUSA Standard User", "user@nusa.ai", _hash_pw("user123#"), "user", "", "active", now, now))

        # Seed initial system configuration
        cursor.execute("SELECT key FROM system_config WHERE key = 'default_model'")
        if not cursor.fetchone():
            cursor.execute("INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?)", ("default_model", "NUSA Assistant", now))
            cursor.execute("INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?)", ("system_prompt", "You are NUSA AI, a premier intelligent AI assistant.", now))
            cursor.execute("INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?)", ("temperature", "0.7", now))
            cursor.execute("INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?)", ("allow_registration", "true", now))

        conn.commit()

def save_conversation(conv_id: str, title: str, model: str = "NUSA Assistant") -> Dict[str, Any]:
    now = time.time()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO conversations (id, title, model, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                model = excluded.model,
                updated_at = excluded.updated_at
        """, (conv_id, title, model, now, now))
        conn.commit()
    return {"id": conv_id, "title": title, "model": model, "created_at": now, "updated_at": now}

def get_conversations() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT c.*,
                   (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count,
                   (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
            FROM conversations c
            ORDER BY c.updated_at DESC
        """)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_conversation(conv_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM conversations WHERE id = ?", (conv_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def delete_conversation(conv_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM messages WHERE conversation_id = ?", (conv_id,))
        cursor.execute("DELETE FROM qa_records WHERE conversation_id = ?", (conv_id,))
        cursor.execute("DELETE FROM memory_facts WHERE conversation_id = ?", (conv_id,))
        cursor.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
        conn.commit()
    return True

def clear_all_conversations() -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM messages")
        cursor.execute("DELETE FROM qa_records")
        cursor.execute("DELETE FROM memory_facts")
        cursor.execute("DELETE FROM conversations")
        conn.commit()
    return True

def save_message(msg_id: str, conv_id: str, role: str, content: str, tokens: int = 0) -> Dict[str, Any]:
    now = time.time()
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # Ensure conversation exists
        cursor.execute("SELECT id, title FROM conversations WHERE id = ?", (conv_id,))
        conv_row = cursor.fetchone()
        if not conv_row:
            clean_title = (content or "New conversation").replace("\n", " ").strip()[:40] or "New conversation"
            cursor.execute("""
                INSERT INTO conversations (id, title, model, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            """, (conv_id, clean_title, "NUSA Assistant", now, now))
        else:
            cursor.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conv_id))
            
        cursor.execute("""
            INSERT INTO messages (id, conversation_id, role, content, tokens, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                content = excluded.content,
                tokens = excluded.tokens
        """, (msg_id, conv_id, role, content, tokens, now))
        conn.commit()
    return {"id": msg_id, "conversation_id": conv_id, "role": role, "content": content, "tokens": tokens, "created_at": now}

def get_messages(conv_id: str) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
        """, (conv_id,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def save_qa_record(qa_id: str, conv_id: str, question: str, answer: str, model: str,
                   latency_ms: int = 0, tokens: int = 0, memory_context: str = "", tags: str = "") -> Dict[str, Any]:
    now = time.time()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO qa_records (id, conversation_id, question, answer, model, latency_ms, tokens, memory_context, tags, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                question = excluded.question,
                answer = excluded.answer,
                latency_ms = excluded.latency_ms,
                tokens = excluded.tokens
        """, (qa_id, conv_id, question, answer, model, latency_ms, tokens, memory_context, tags, now))
        conn.commit()
    return {
        "id": qa_id,
        "conversation_id": conv_id,
        "question": question,
        "answer": answer,
        "model": model,
        "latency_ms": latency_ms,
        "tokens": tokens,
        "memory_context": memory_context,
        "tags": tags,
        "created_at": now
    }

def get_qa_records(search: str = "", model_filter: str = "", limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        query = "SELECT q.*, c.title as conversation_title FROM qa_records q LEFT JOIN conversations c ON q.conversation_id = c.id WHERE 1=1"
        params = []
        
        if search:
            query += " AND (q.question LIKE ? OR q.answer LIKE ? OR q.tags LIKE ?)"
            s_param = f"%{search}%"
            params.extend([s_param, s_param, s_param])
            
        if model_filter and model_filter != "all":
            query += " AND q.model = ?"
            params.append(model_filter)
            
        query += " ORDER BY q.created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_stats() -> Dict[str, Any]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM conversations")
        conv_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM messages")
        msg_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*), AVG(latency_ms) FROM qa_records")
        qa_row = cursor.fetchone()
        qa_count = qa_row[0] or 0
        avg_latency = round(qa_row[1] or 0, 1)
        
        cursor.execute("SELECT COUNT(*) FROM memory_facts")
        memory_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]

        return {
            "total_conversations": conv_count,
            "total_messages": msg_count,
            "total_qa_pairs": qa_count,
            "avg_latency_ms": avg_latency,
            "total_memory_facts": memory_count,
            "total_users": user_count,
            "database_file": os.path.basename(DB_PATH),
            "status": "online"
        }

# ================= USER AUTHENTICATION & RBAC FUNCTIONS =================

import hashlib
import uuid

def hash_password(password: str) -> str:
    return hashlib.sha256(f"nusa_salt_{password}".encode("utf-8")).hexdigest()

def register_user(name: str, email: str, password: str, role: str = "user") -> Dict[str, Any]:
    email_clean = email.strip().lower()
    name_clean = name.strip() or "NUSA User"
    
    if not email_clean or "@" not in email_clean:
        return {"error": "Invalid email address."}
    if len(password) < 4:
        return {"error": "Password must be at least 4 characters long."}
        
    # Auto-grant admin role to owner or admin addresses
    if email_clean in ("ahmaduzair1418@gmail.com", "admin@nusa.ai"):
        role = "admin"
    elif role not in ("admin", "user"):
        role = "user"

    now = time.time()
    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    pw_hash = hash_password(password)

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (email_clean,))
        if cursor.fetchone():
            return {"error": "An account with this email already exists."}

        cursor.execute("""
            INSERT INTO users (id, name, email, password_hash, role, avatar_url, status, created_at, last_login)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_id, name_clean, email_clean, pw_hash, role, "", "active", now, now))
        conn.commit()

    return {
        "success": True,
        "user": {
            "id": user_id,
            "name": name_clean,
            "email": email_clean,
            "role": role,
            "avatar_url": "",
            "status": "active",
            "created_at": now,
            "last_login": now
        }
    }

def login_user(email: str, password: str) -> Dict[str, Any]:
    email_clean = email.strip().lower()
    pw_hash = hash_password(password)

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email_clean,))
        row = cursor.fetchone()

        if not row:
            return {"error": "No account found with this email."}

        user = dict(row)
        if user["status"] == "banned":
            return {"error": "This account has been suspended by an administrator."}

        if user["password_hash"] != pw_hash:
            return {"error": "Incorrect password. Please try again."}

        now = time.time()
        cursor.execute("UPDATE users SET last_login = ? WHERE id = ?", (now, user["id"]))
        conn.commit()

        # Sanitize sensitive fields
        del user["password_hash"]
        user["last_login"] = now
        return {"success": True, "user": user}

def google_login_or_register(email: str, name: str, picture: str = "") -> Dict[str, Any]:
    email_clean = email.strip().lower()
    name_clean = name.strip() or "Google User"
    now = time.time()

    # Automatic admin elevation for system owner
    is_owner = email_clean in ("ahmaduzair1418@gmail.com", "admin@nusa.ai")

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email_clean,))
        row = cursor.fetchone()

        if row:
            user = dict(row)
            if user["status"] == "banned":
                return {"error": "This account has been suspended."}

            new_role = "admin" if is_owner else user["role"]
            avatar = picture or user["avatar_url"]
            cursor.execute("""
                UPDATE users SET last_login = ?, avatar_url = ?, role = ?
                WHERE id = ?
            """, (now, avatar, new_role, user["id"]))
            conn.commit()

            del user["password_hash"]
            user["last_login"] = now
            user["avatar_url"] = avatar
            user["role"] = new_role
            return {"success": True, "user": user}
        else:
            user_id = f"usr_g_{uuid.uuid4().hex[:10]}"
            role = "admin" if is_owner else "user"
            dummy_hash = hash_password(f"google_oauth_{uuid.uuid4().hex}")
            cursor.execute("""
                INSERT INTO users (id, name, email, password_hash, role, avatar_url, status, created_at, last_login)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (user_id, name_clean, email_clean, dummy_hash, role, picture, "active", now, now))
            conn.commit()

            return {
                "success": True,
                "user": {
                    "id": user_id,
                    "name": name_clean,
                    "email": email_clean,
                    "role": role,
                    "avatar_url": picture,
                    "status": "active",
                    "created_at": now,
                    "last_login": now
                }
            }

# ================= ADMIN MANAGEMENT FUNCTIONS =================

def get_all_users() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, email, role, avatar_url, status, created_at, last_login
            FROM users
            ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def update_user_role(user_id: str, new_role: str) -> Dict[str, Any]:
    if new_role not in ("admin", "user"):
        return {"error": "Invalid role specified."}
        
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT email FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            return {"error": "User not found."}
        if row["email"] == "admin@nusa.ai" and new_role != "admin":
            return {"error": "Cannot revoke admin rights from master administrator."}

        cursor.execute("UPDATE users SET role = ? WHERE id = ?", (new_role, user_id))
        conn.commit()
    return {"success": True, "user_id": user_id, "role": new_role}

def update_user_status(user_id: str, new_status: str) -> Dict[str, Any]:
    if new_status not in ("active", "banned"):
        return {"error": "Invalid status."}

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT email FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            return {"error": "User not found."}
        if row["email"] == "admin@nusa.ai":
            return {"error": "Cannot suspend master administrator."}

        cursor.execute("UPDATE users SET status = ? WHERE id = ?", (new_status, user_id))
        conn.commit()
    return {"success": True, "user_id": user_id, "status": new_status}

def delete_user(user_id: str) -> Dict[str, Any]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT email FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            return {"error": "User not found."}
        if row["email"] in ("admin@nusa.ai", "ahmaduzair1418@gmail.com"):
            return {"error": "Cannot delete master administrator account."}

        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
    return {"success": True, "deleted_id": user_id}

def get_admin_dashboard_stats() -> Dict[str, Any]:
    base_stats = get_stats()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
        admin_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM users WHERE status = 'active'")
        active_users = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM users WHERE status = 'banned'")
        banned_users = cursor.fetchone()[0]

        # Recent 5 users
        cursor.execute("SELECT id, name, email, role, status, created_at, last_login FROM users ORDER BY created_at DESC LIMIT 5")
        recent_users = [dict(r) for r in cursor.fetchall()]

        # System configs
        cursor.execute("SELECT key, value FROM system_config")
        config_rows = cursor.fetchall()
        configs = {r["key"]: r["value"] for r in config_rows}

    return {
        **base_stats,
        "admin_count": admin_count,
        "active_users": active_users,
        "banned_users": banned_users,
        "recent_users": recent_users,
        "system_config": configs
    }

def get_system_config() -> Dict[str, str]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT key, value FROM system_config")
        return {r["key"]: r["value"] for r in cursor.fetchall()}

def set_system_config(key: str, value: str) -> Dict[str, Any]:
    now = time.time()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO system_config (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        """, (key, str(value), now))
        conn.commit()
    return {"success": True, "key": key, "value": value}

if __name__ == "__main__":
    init_db()
    print("NUSA AI Database initialized successfully:", DB_PATH)
    print("Current Stats:", json.dumps(get_stats(), indent=2))

