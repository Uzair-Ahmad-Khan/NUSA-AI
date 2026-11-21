#!/usr/bin/env python3
"""
NUSA AI — Python Backend CLI Bridge
Exposes Python database, memory management, and Q&A records to Node.js backend via JSON-RPC / CLI.
"""

import sys
import json
import os

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import database
import memory_manager

_db_initialized = False

def ensure_db():
    global _db_initialized
    if not _db_initialized:
        database.init_db()
        _db_initialized = True

def handle_request(command: str, payload: dict) -> dict:
    ensure_db()
    
    if command == "init":
        return {"status": "ok", "stats": database.get_stats()}
        
    elif command == "get_conversations":
        return {"conversations": database.get_conversations()}
        
    elif command == "get_conversation":
        conv_id = payload.get("id")
        return {"conversation": database.get_conversation(conv_id)}
        
    elif command == "save_conversation":
        conv_id = payload.get("id")
        title = payload.get("title", "New conversation")
        model = payload.get("model", "NUSA Assistant")
        saved = database.save_conversation(conv_id, title, model)
        return {"conversation": saved}
        
    elif command == "delete_conversation":
        conv_id = payload.get("id")
        success = database.delete_conversation(conv_id)
        return {"success": success}
        
    elif command == "clear_conversations":
        success = database.clear_all_conversations()
        return {"success": success}
        
    elif command == "get_messages":
        conv_id = payload.get("conversation_id")
        return {"messages": database.get_messages(conv_id)}

    elif command == "get_chat_context":
        conv_id = payload.get("conversation_id")
        messages = database.get_messages(conv_id) if conv_id else []
        prompt = memory_manager.build_memory_prompt(conv_id) if conv_id else ""
        return {"messages": messages[-10:], "prompt": prompt}
        
    elif command == "save_turn":
        conv_id = payload.get("conversation_id")
        user_msg = payload.get("user_message") or {}
        assistant_msg = payload.get("assistant_message") or {}
        model = payload.get("model", "NUSA Assistant")
        latency_ms = payload.get("latency_ms", 0)
        tokens = payload.get("tokens", 0)
        tags = payload.get("tags", "")
        
        user_content = (user_msg.get("content") or "").strip()
        conv_title = user_content[:45].replace("\n", " ").strip() if user_content else "New conversation"
        
        # Ensure conversation exists with question title
        existing = database.get_conversation(conv_id)
        if not existing:
            database.save_conversation(conv_id, conv_title or "New conversation", model)
        elif existing.get("title") in ("New conversation", "", None) and conv_title:
            database.save_conversation(conv_id, conv_title, model)
        
        # Save user message
        u_saved = database.save_message(
            user_msg.get("id"), conv_id, "user", user_msg.get("content", ""), 0
        )
        
        # Save assistant message
        a_saved = database.save_message(
            assistant_msg.get("id"), conv_id, "assistant", assistant_msg.get("content", ""), tokens
        )
        
        # Extract and update dynamic memories
        extracted_memories = memory_manager.extract_and_store_memories(conv_id, user_msg.get("content", ""))
        
        # Fetch current memory context
        memory_ctx = memory_manager.build_memory_prompt(conv_id)
        
        # Save Q&A record
        qa_id = payload.get("qa_id") or f"qa-{user_msg.get('id')}"
        qa_saved = database.save_qa_record(
            qa_id=qa_id,
            conv_id=conv_id,
            question=user_msg.get("content", ""),
            answer=assistant_msg.get("content", ""),
            model=model,
            latency_ms=latency_ms,
            tokens=tokens,
            memory_context=memory_ctx,
            tags=tags
        )
        
        return {
            "user_message": u_saved,
            "assistant_message": a_saved,
            "qa_record": qa_saved,
            "extracted_memories": extracted_memories
        }
        
    elif command == "get_memory":
        conv_id = payload.get("conversation_id")
        facts = memory_manager.get_memory_facts(conv_id)
        prompt = memory_manager.build_memory_prompt(conv_id)
        return {"facts": facts, "prompt": prompt}
        
    elif command == "clear_memory":
        conv_id = payload.get("conversation_id")
        success = memory_manager.clear_conversation_memory(conv_id)
        return {"success": success}
        
    elif command == "delete_memory_fact":
        fact_id = payload.get("fact_id")
        success = memory_manager.delete_memory_fact(fact_id)
        return {"success": success}
        
    elif command == "get_qa_records":
        search = payload.get("search", "")
        model_filter = payload.get("model", "")
        limit = payload.get("limit", 50)
        offset = payload.get("offset", 0)
        records = database.get_qa_records(search, model_filter, limit, offset)
        return {"records": records}
        
    elif command == "get_stats":
        return {"stats": database.get_stats()}
        
    # User Authentication Commands
    elif command == "auth_register":
        name = payload.get("name", "")
        email = payload.get("email", "")
        password = payload.get("password", "")
        role = payload.get("role", "user")
        return database.register_user(name, email, password, role)

    elif command == "auth_login":
        email = payload.get("email", "")
        password = payload.get("password", "")
        return database.login_user(email, password)

    elif command == "auth_google":
        email = payload.get("email", "")
        name = payload.get("name", "")
        picture = payload.get("picture", "")
        return database.google_login_or_register(email, name, picture)

    # Admin Management Commands
    elif command == "admin_get_users":
        return {"users": database.get_all_users()}

    elif command == "admin_update_user_role":
        user_id = payload.get("user_id")
        role = payload.get("role")
        return database.update_user_role(user_id, role)

    elif command == "admin_update_user_status":
        user_id = payload.get("user_id")
        status = payload.get("status")
        return database.update_user_status(user_id, status)

    elif command == "admin_delete_user":
        user_id = payload.get("user_id")
        return database.delete_user(user_id)

    elif command == "admin_get_stats":
        return {"stats": database.get_admin_dashboard_stats()}

    elif command == "admin_get_config":
        return {"config": database.get_system_config()}

    elif command == "admin_save_config":
        key = payload.get("key")
        value = payload.get("value")
        return database.set_system_config(key, value)

    else:
        return {"error": f"Unknown command: {command}"}

def run_worker():
    ensure_db()
    # Signal worker readiness
    sys.stdout.write(json.dumps({"ready": True}) + "\n")
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            command = req.get("command", "")
            payload = req.get("payload") or {}
            result = handle_request(command, payload)
            sys.stdout.write(json.dumps({"id": req_id, "result": result}) + "\n")
            sys.stdout.flush()
        except Exception as e:
            sys.stdout.write(json.dumps({"id": req_id, "error": str(e)}) + "\n")
            sys.stdout.flush()

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided"}))
        sys.exit(1)

    if sys.argv[1] == "--worker":
        run_worker()
        return

    command = sys.argv[1]
    payload = {}

    if len(sys.argv) >= 3:
        try:
            payload = json.loads(sys.argv[2])
        except Exception:
            payload = {}

    try:
        result = handle_request(command, payload)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
