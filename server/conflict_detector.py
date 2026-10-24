"""
Duplicate and Conflict Detection Component for CommitFlow
Identifies redundant tasks, overlapping commitments, contradictory deadlines, and decision collisions.
"""

import re
import logging
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger("commitflow.conflict_detector")

STOPWORDS = {
    "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "with",
    "by", "of", "from", "as", "is", "are", "be", "will", "should", "must",
    "can", "we", "i", "you", "they", "it", "this", "that", "these", "those"
}

def tokenize(text: str) -> set:
    """Extract normalized content tokens excluding common punctuation and stopwords."""
    if not text:
        return set()
    words = re.findall(r'[a-zA-Z0-9]+', text.lower())
    return {w for w in words if w not in STOPWORDS and len(w) > 2}

def compute_similarity(str1: str, str2: str) -> float:
    """Compute token Jaccard similarity between two strings."""
    tokens1 = tokenize(str1)
    tokens2 = tokenize(str2)
    if not tokens1 or not tokens2:
        return 0.0
    intersection = tokens1.intersection(tokens2)
    union = tokens1.union(tokens2)
    return len(intersection) / len(union)

def detect_duplicates_and_conflicts(
    proposed_items: List[Dict],
    existing_items: List[Dict],
    decisions: Optional[List[Dict]] = None
) -> List[Dict]:
    """
    Evaluates newly extracted action items against existing DB records and current batch.
    Annotates each item with is_duplicate, duplicate_warning, is_conflict, conflict_warning.
    """
    decisions = decisions or []
    annotated: List[Dict] = []

    # Combine existing database items and already-evaluated batch items
    pool: List[Dict] = list(existing_items)

    for i, item in enumerate(proposed_items):
        item_copy = dict(item)
        title = item_copy.get("title", "")
        desc = item_copy.get("description", "")
        owner = item_copy.get("owner", "").lower()
        deadline = item_copy.get("deadline", "")
        is_dup = False
        dup_warning = None
        dup_of_id = None

        is_conf = False
        conf_warnings = []

        # 1. Duplicate Detection against current batch predecessors and existing DB items
        for other in pool:
            other_id = other.get("id")
            other_title = other.get("title", "")
            other_owner = (other.get("owner") or "").lower()
            other_deadline = other.get("deadline", "")

            # Exact or highly similar title
            sim = compute_similarity(title, other_title)
            
            # Check previously exported task
            if other.get("trelloCardId") and sim >= 0.70:
                is_dup = True
                dup_warning = f"Duplicate Warning: Previously exported to Trello as '{other_title}' (#{other_id})."
                dup_of_id = other_id
                break

            if sim >= 0.75:
                is_dup = True
                dup_warning = f"Duplicate Warning: High similarity ({int(sim*100)}%) with existing task '{other_title}' (#{other_id})."
                dup_of_id = other_id
                break
            elif sim >= 0.60 and owner == other_owner and owner not in ("unassigned", ""):
                is_dup = True
                dup_warning = f"Duplicate Warning: Same assignee ({other.get('owner')}) already has closely matching task '{other_title}'."
                dup_of_id = other_id
                break

        # 2. Conflict Detection
        for other in pool:
            other_title = other.get("title", "")
            other_owner = (other.get("owner") or "").lower()
            other_deadline = other.get("deadline", "")
            sim = compute_similarity(title, other_title)

            # Conflict A: Multiple different owners assigned to closely related deliverable
            if 0.50 <= sim < 0.75 and owner and other_owner:
                if owner != other_owner and "unassigned" not in (owner, other_owner):
                    is_conf = True
                    conf_warnings.append(
                        f"Assignee mismatch: '{item_copy.get('owner')}' vs '{other.get('owner')}' for deliverable '{other_title}'"
                    )

            # Conflict B: Contradictory due dates for the same commitment/feature
            if sim >= 0.65 and deadline and other_deadline:
                if deadline != "Unspecified" and other_deadline != "Unspecified":
                    d_day = deadline.split()[0]
                    o_day = other_deadline.split()[0]
                    if d_day != o_day:
                        is_conf = True
                        conf_warnings.append(
                            f"Contradictory deadlines: '{deadline}' vs '{other_deadline}' in task '{other_title}'"
                        )

            # Conflict C: Same owner assigned multiple high-priority tasks on identical tight deadline
            if owner and other_owner and owner == other_owner and owner not in ("unassigned", ""):
                if deadline != "Unspecified" and deadline == other_deadline:
                    if item_copy.get("priority") == "High" and other.get("priority") == "High":
                        is_conf = True
                        conf_warnings.append(
                            f"Workload collision: {item_copy.get('owner')} assigned multiple High Priority deliverables due on {deadline}"
                        )

        # 3. Decision Collision Detection
        for dec in decisions:
            dec_title = dec.get("title", "")
            dec_details = dec.get("details", "")
            sim_dec = compute_similarity(title, dec_title)
            
            # Check for negative/reversal keywords in decision vs task
            # E.g., decision: "Do not support MySQL" vs task: "Implement MySQL schema"
            combined_dec = f"{dec_title} {dec_details}".lower()
            combined_task = f"{title} {desc}".lower()

            reversal_words = ["not", "deprecated", "abandon", "cancelled", "rejected", "postponed", "skip"]
            has_reversal = any(w in combined_dec for w in reversal_words)
            if sim_dec >= 0.50 and has_reversal:
                is_conf = True
                conf_warnings.append(f"Potential conflict with Confirmed Decision: '{dec_title}'")

        item_copy["is_duplicate"] = is_dup
        item_copy["duplicate_warning"] = dup_warning
        item_copy["duplicate_of"] = dup_of_id
        item_copy["is_conflict"] = is_conf
        item_copy["conflict_warning"] = " | ".join(conf_warnings) if conf_warnings else None

        annotated.append(item_copy)
        pool.append(item_copy)

    return annotated

def detect_item_conflicts(item: Dict, existing_items: List[Dict], decisions: Optional[List[Dict]] = None) -> Dict:
    """Convenience helper to detect conflicts for a single item against existing database items."""
    results = detect_duplicates_and_conflicts([item], existing_items, decisions)
    return results[0] if results else item

