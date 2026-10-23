"""
Owner Matching Component for CommitFlow
Matches transcript-extracted owner names against real registered users in Neon PostgreSQL.
Enforces ground-truth validation: never creates phantom accounts or assigns tasks to random users.
"""

import re
import logging
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger("commitflow.owner_matcher")

def normalize_text(text: str) -> str:
    """Lowercase and strip non-alphanumeric characters for robust comparison."""
    if not text:
        return ""
    return re.sub(r'[^a-z0-9\s]', '', text.lower()).strip()

def match_owner_to_user(extracted_name: Optional[str], active_users: List[Dict]) -> Dict:
    """
    Match an extracted owner string to an active registered user from PostgreSQL.
    
    Returns:
        {
            "matched": bool,
            "assignee_id": Optional[str],
            "owner": str,
            "owner_status": "confirmed" | "ambiguous",
            "confidence": float,
            "match_reason": str
        }
    """
    if not extracted_name:
        return {
            "matched": False,
            "assignee_id": None,
            "owner": "Unassigned",
            "owner_status": "ambiguous",
            "confidence": 0.0,
            "match_reason": "No owner mentioned in transcript"
        }

    clean_input = extracted_name.strip()
    norm_input = normalize_text(clean_input)

    # Obvious unassigned designations
    unassigned_tokens = {"unassigned", "unknown", "none", "tbd", "someone", "anyone", "team", "all", "qa", "devs"}
    if norm_input in unassigned_tokens or not norm_input:
        return {
            "matched": False,
            "assignee_id": None,
            "owner": "Unassigned",
            "owner_status": "ambiguous",
            "confidence": 0.0,
            "match_reason": f"Vague or unassigned owner placeholder: '{clean_input}'"
        }

    input_words = norm_input.split()
    first_word = input_words[0] if input_words else ""

    candidates: List[Tuple[float, Dict, str]] = []

    for u in active_users:
        u_name = u.get("name", "")
        norm_u_name = normalize_text(u_name)
        u_words = norm_u_name.split()
        u_first = u_words[0] if u_words else ""
        u_last = u_words[-1] if len(u_words) > 1 else ""

        # 1. Exact full name match
        if norm_input == norm_u_name:
            candidates.append((1.0, u, f"Exact full name match with {u_name}"))
            continue

        # 2. User's full name is contained in the text (e.g. "Bhoomi Tiple will verify...")
        if norm_u_name in norm_input:
            candidates.append((0.98, u, f"Full name found in text: {u_name}"))
            continue

        # 3. Exact first name match (e.g. "Swapnil" -> "Swapnil Ingole", "Aniket" -> "Aniket Bhujad")
        if first_word == u_first and len(first_word) >= 3:
            if len(input_words) == 1:
                candidates.append((0.95, u, f"First name matched registered user {u_name}"))
            elif len(input_words) > 1 and u_last and input_words[-1] == u_last:
                candidates.append((0.98, u, f"First and last name matched {u_name}"))
            else:
                candidates.append((0.90, u, f"Leading name matched registered user {u_name}"))
            continue

        # 4. User's first name is mentioned inside the text words
        if u_first and u_first in input_words and len(u_first) >= 3:
            candidates.append((0.90, u, f"First name '{u_first}' found in text: {u_name}"))
            continue

        # 5. Exact last name match (e.g. "Ingole" or "Bhujad" or "Desai")
        if norm_input == u_last and len(u_last) >= 3:
            candidates.append((0.90, u, f"Last name matched registered user {u_name}"))
            continue

        # 6. Email username match (e.g. "aniket" in aniket@commitflow.dev)
        email_prefix = u.get("email", "").split("@")[0].lower()
        if norm_input == email_prefix:
            candidates.append((0.92, u, f"Email handle matched registered user {u_name}"))
            continue

        # 7. Full name contains input token
        if norm_input in u_words:
            candidates.append((0.88, u, f"Name token matched registered user {u_name}"))
            continue

    if not candidates:
        return {
            "matched": False,
            "assignee_id": None,
            "owner": clean_input,
            "owner_status": "ambiguous",
            "confidence": 0.3,
            "match_reason": f"Name '{clean_input}' not found in registered database users"
        }

    # Sort descending by score
    candidates.sort(key=lambda x: x[0], reverse=True)
    top_score, best_user, reason = candidates[0]

    # Check for ambiguity: if another candidate has the same top score
    ties = [c for c in candidates if c[0] == top_score]
    if len(ties) > 1:
        tied_names = ", ".join(c[1]["name"] for c in ties)
        return {
            "matched": False,
            "assignee_id": None,
            "owner": clean_input,
            "owner_status": "ambiguous",
            "confidence": 0.5,
            "match_reason": f"Ambiguous name '{clean_input}' matches multiple users: {tied_names}"
        }

    if top_score >= 0.85:
        return {
            "matched": True,
            "assignee_id": best_user["id"],
            "owner": best_user["name"],
            "owner_status": "confirmed",
            "confidence": top_score,
            "match_reason": reason
        }

    return {
        "matched": False,
        "assignee_id": None,
        "owner": clean_input,
        "owner_status": "ambiguous",
        "confidence": top_score,
        "match_reason": f"Low confidence match ({top_score:.2f}) for '{clean_input}' with {best_user['name']}"
    }

def match_transcript_owner(extracted_name: Optional[str], active_users: Optional[List[Dict]] = None) -> Dict:
    """Convenience helper to match an extracted owner name using live DB users."""
    if active_users is None:
        try:
            from server import db
            active_users = db.list_active_users()
        except ImportError:
            import db
            active_users = db.list_active_users()
    res = match_owner_to_user(extracted_name, active_users)
    res["canonical_name"] = res.get("owner")
    return res

