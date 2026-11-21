#!/usr/bin/env python3
"""
NUSA AI — Memory Management Module
Extracts, maintains, and injects conversational memory and user preferences across chat turns.
"""

import re
import time
import uuid
from typing import List, Dict, Any, Tuple
from database import get_connection

# Common memory extraction patterns
EXTRACTION_PATTERNS = [
    # User's name
    (r"(?:my name is|i am called|call me|i'm)\s+([A-Za-z0-9_-]+)", "user_name"),
    # User's profession/role
    (r"(?:i am a|i work as a|my role is|i'm a)\s+([A-Za-z0-9\s_-]+?)(?:\.|\,|$|\sand)", "user_profession"),
    # Tech stack / preference
    (r"(?:i prefer|i like using|my favorite stack is|i work with|i use)\s+([A-Za-z0-9\s,._+#-]+?)(?:\.|\,|$)", "user_tech_preference"),
    # Project topic
    (r"(?:i am building|we are developing|my project is|i'm working on)\s+([A-Za-z0-9\s_-]+?)(?:\.|\,|$)", "current_project"),
    # Language preference
    (r"(?:speak in|respond in|reply in|answer in)\s+([A-Za-z]+)", "preferred_language"),
]

def extract_and_store_memories(conv_id: str, text: str) -> List[Dict[str, Any]]:
    """Analyzes text for key personal or project facts and stores them."""
    extracted = []
    text_clean = text.strip()
    
    for pattern, key in EXTRACTION_PATTERNS:
        match = re.search(pattern, text_clean, re.IGNORECASE)
        if match:
            value = match.group(1).strip()
            if len(value) > 1 and len(value) < 120:
                saved = save_memory_fact(conv_id, key, value)
                extracted.append(saved)
                
    return extracted

def save_memory_fact(conv_id: str, key: str, value: str, confidence: float = 0.95) -> Dict[str, Any]:
    now = time.time()
    with get_connection() as conn:
        cursor = conn.cursor()
        # Check if fact key already exists for this conversation
        cursor.execute("SELECT id FROM memory_facts WHERE conversation_id = ? AND fact_key = ?", (conv_id, key))
        existing = cursor.fetchone()
        
        if existing:
            fact_id = existing["id"]
            cursor.execute("""
                UPDATE memory_facts
                SET fact_value = ?, confidence = ?, updated_at = ?
                WHERE id = ?
            """, (value, confidence, now, fact_id))
        else:
            fact_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO memory_facts (id, conversation_id, fact_key, fact_value, confidence, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (fact_id, conv_id, key, value, confidence, now, now))
            
        conn.commit()
    return {"id": fact_id, "conversation_id": conv_id, "key": key, "value": value, "confidence": confidence}

def get_memory_facts(conv_id: str) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM memory_facts
            WHERE conversation_id = ?
            ORDER BY updated_at DESC
        """, (conv_id,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def delete_memory_fact(fact_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM memory_facts WHERE id = ?", (fact_id,))
        conn.commit()
    return True

def clear_conversation_memory(conv_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM memory_facts WHERE conversation_id = ?", (conv_id,))
        cursor.execute("UPDATE conversations SET memory_summary = '' WHERE id = ?", (conv_id,))
        conn.commit()
    return True

def build_memory_prompt(conv_id: str) -> str:
    """Builds a structured contextual memory snippet to prepend to AI prompts."""
    facts = get_memory_facts(conv_id)
    if not facts:
        return ""
        
    lines = ["\n[ACTIVE NUSA AI CONVERSATION MEMORY]:"]
    for f in facts:
        key_label = f['fact_key'].replace('_', ' ').capitalize()
        lines.append(f"- {key_label}: {f['fact_value']}")
    lines.append("Use these retained facts naturally whenever relevant without explicitly saying 'According to my memory'.\n")
    return "\n".join(lines)

def optimize_chat_window(messages: List[Dict[str, Any]], max_turns: int = 12) -> List[Dict[str, Any]]:
    """
    Implements sliding window memory management.
    Preserves recent message turns to stay within optimal context length.
    """
    if len(messages) <= max_turns * 2:
        return messages
    # Keep the earliest system/greeting if any, and the last 2 * max_turns messages
    return messages[-(max_turns * 2):]

if __name__ == "__main__":
    test_conv = "test_memory_conv"
    extract_and_store_memories(test_conv, "Hello! My name is Rahul and I work as a Senior Full Stack Engineer. I prefer Python and TypeScript.")
    facts = get_memory_facts(test_conv)
    print("Extracted Facts:", facts)
    print("Memory Prompt:\n", build_memory_prompt(test_conv))
