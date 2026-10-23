"""
CommitFlow Trello Integration Service
Handles bidirectional synchronization between CommitFlow Action Items and Trello Boards/Cards.
"""

import os
import logging
from datetime import datetime, timezone
import requests
from dotenv import load_dotenv

try:
    import db
except ImportError:
    from server import db

load_dotenv()
logger = logging.getLogger("commitflow.trello")

TRELLO_API_BASE = "https://api.trello.com/1"
DEFAULT_API_KEY = "3eb17ed1dcc1ff335a7e317b1abd6a67"
DEFAULT_API_SECRET = "26052619ead30123e2e931b7eb386a3a98e0894e67241a8d8e846409998338cd"

def get_api_key():
    return os.getenv("TRELLO_API_KEY", "").strip() or DEFAULT_API_KEY

def get_api_secret():
    return os.getenv("TRELLO_API_SECRET", "").strip() or DEFAULT_API_SECRET

def get_auth_url():
    key = get_api_key()
    return f"https://trello.com/1/authorize?expiration=never&name=CommitFlow&scope=read,write&response_type=token&key={key}"

def get_active_token():
    """Retrieve token from DB config first, then from .env."""
    settings = db.get_trello_settings()
    token = settings.get("token") or os.getenv("TRELLO_TOKEN", "").strip()
    return token or None

def verify_token(token):
    """
    Validate Trello token with the Trello API.
    Returns (True, member_data) or (False, error_message).
    """
    if not token:
        return False, "Token is required"
    key = get_api_key()
    url = f"{TRELLO_API_BASE}/members/me"
    try:
        resp = requests.get(url, params={"key": key, "token": token}, timeout=10)
        if resp.status_code == 200:
            return True, resp.json()
        return False, f"Trello authorization failed ({resp.status_code}): {resp.text}"
    except Exception as e:
        logger.error(f"Error validating Trello token: {e}")
        return False, str(e)

def get_or_create_board(token=None):
    """
    Ensure a CommitFlow Tasks board exists in Trello with To Do, In Progress, Done lists.
    Returns dict with board info and list IDs.
    """
    token = token or get_active_token()
    if not token:
        raise ValueError("Trello token is not configured.")

    key = get_api_key()
    settings = db.get_trello_settings()
    board_id = settings.get("boardId")

    # 1. If board_id is already saved, test if it still exists
    if board_id:
        try:
            resp = requests.get(f"{TRELLO_API_BASE}/boards/{board_id}", params={"key": key, "token": token}, timeout=10)
            if resp.status_code == 200:
                board_data = resp.json()
                lists_data = _ensure_board_lists(board_id, token, key)
                return {
                    "boardId": board_id,
                    "boardName": board_data.get("name", "CommitFlow Tasks"),
                    "boardUrl": board_data.get("url", f"https://trello.com/b/{board_id}"),
                    "lists": lists_data
                }
        except Exception as e:
            logger.warning(f"Failed to fetch existing board {board_id}: {e}")

    # 2. Check if a board named "CommitFlow Tasks" already exists on user's account
    try:
        resp = requests.get(f"{TRELLO_API_BASE}/members/me/boards", params={"key": key, "token": token, "fields": "id,name,url,closed"}, timeout=10)
        if resp.status_code == 200:
            for b in resp.json():
                if not b.get("closed") and b.get("name", "").lower() == "commitflow tasks":
                    board_id = b["id"]
                    db.save_trello_setting("board_id", board_id)
                    db.save_trello_setting("board_name", b["name"])
                    db.save_trello_setting("board_url", b["url"])
                    lists_data = _ensure_board_lists(board_id, token, key)
                    return {
                        "boardId": board_id,
                        "boardName": b["name"],
                        "boardUrl": b["url"],
                        "lists": lists_data
                    }
    except Exception as e:
        logger.warning(f"Error querying user boards: {e}")

    # 3. Create a brand new board in Trello
    create_resp = requests.post(
        f"{TRELLO_API_BASE}/boards/",
        params={
            "name": "CommitFlow Tasks",
            "defaultLists": "false",
            "desc": "Automated project management board synchronized with CommitFlow meetings and action items.",
            "key": key,
            "token": token
        },
        timeout=10
    )
    if create_resp.status_code not in (200, 201):
        raise RuntimeError(f"Failed to create Trello board: {create_resp.status_code} - {create_resp.text}")

    board_data = create_resp.json()
    board_id = board_data["id"]
    board_url = board_data.get("url", f"https://trello.com/b/{board_id}")

    db.save_trello_setting("board_id", board_id)
    db.save_trello_setting("board_name", board_data.get("name", "CommitFlow Tasks"))
    db.save_trello_setting("board_url", board_url)

    lists_data = _ensure_board_lists(board_id, token, key)
    return {
        "boardId": board_id,
        "boardName": board_data.get("name", "CommitFlow Tasks"),
        "boardUrl": board_url,
        "lists": lists_data
    }

def _ensure_board_lists(board_id, token, key):
    """Ensure standard lists 'To Do', 'In Progress', 'Done' exist on the board."""
    resp = requests.get(f"{TRELLO_API_BASE}/boards/{board_id}/lists", params={"key": key, "token": token}, timeout=10)
    existing_lists = resp.json() if resp.status_code == 200 else []

    list_map = {}
    for lst in existing_lists:
        if not lst.get("closed"):
            list_map[lst["name"].lower().strip()] = lst["id"]

    # Target standard lists
    desired = [
        ("To Do", "list_todo_id"),
        ("In Progress", "list_doing_id"),
        ("Done", "list_done_id")
    ]

    result = {}
    for name, setting_key in desired:
        matched_id = None
        for existing_name, lid in list_map.items():
            if name.lower() in existing_name:
                matched_id = lid
                break

        if not matched_id:
            # Create the list
            create_resp = requests.post(
                f"{TRELLO_API_BASE}/boards/{board_id}/lists",
                params={"name": name, "pos": "bottom", "key": key, "token": token},
                timeout=10
            )
            if create_resp.status_code in (200, 201):
                matched_id = create_resp.json()["id"]

        if matched_id:
            result[name] = matched_id
            db.save_trello_setting(setting_key, matched_id)

    return result

def get_target_list_id(status, lists_map):
    """Map CommitFlow action item status to appropriate Trello list ID."""
    status_clean = (status or "").lower()
    if "approve" in status_clean or "progress" in status_clean or "doing" in status_clean:
        return lists_map.get("In Progress") or lists_map.get("To Do")
    elif "done" in status_clean or "complete" in status_clean or "reject" in status_clean:
        return lists_map.get("Done") or lists_map.get("In Progress")
    else:
        return lists_map.get("To Do") or lists_map.get("In Progress")

def create_card(title, description="", status="Pending Approval", deadline=None, token=None):
    """Create a card on the synchronized Trello board."""
    token = token or get_active_token()
    if not token:
        return None

    key = get_api_key()
    board_info = get_or_create_board(token)
    list_id = get_target_list_id(status, board_info["lists"])

    params = {
        "idList": list_id,
        "name": title,
        "desc": description or "",
        "key": key,
        "token": token
    }

    try:
        resp = requests.post(f"{TRELLO_API_BASE}/cards", params=params, timeout=10)
        if resp.status_code in (200, 201):
            return resp.json()
        logger.error(f"Failed to create Trello card: {resp.status_code} - {resp.text}")
    except Exception as e:
        logger.error(f"Exception creating Trello card: {e}")
    return None

def update_card(card_id, title=None, description=None, status=None, token=None):
    """Update title, description, or status (list move) on an existing Trello card."""
    token = token or get_active_token()
    if not token or not card_id:
        return False

    key = get_api_key()
    params = {"key": key, "token": token}
    if title:
        params["name"] = title
    if description is not None:
        params["desc"] = description

    if status:
        try:
            board_info = get_or_create_board(token)
            params["idList"] = get_target_list_id(status, board_info["lists"])
        except Exception:
            pass

    try:
        resp = requests.put(f"{TRELLO_API_BASE}/cards/{card_id}", params=params, timeout=10)
        return resp.status_code == 200
    except Exception as e:
        logger.error(f"Exception updating Trello card {card_id}: {e}")
        return False

def sync_all(user_id=None, is_admin=False):
    """
    Perform bidirectional synchronization:
    1. Export any CommitFlow action items not yet on Trello to Trello cards.
    2. Import or update cards from Trello into CommitFlow action items.
    """
    token = get_active_token()
    if not token:
        return {
            "success": False,
            "connected": False,
            "error": "Trello token is not connected. Please authorize Trello first.",
            "authUrl": get_auth_url()
        }

    key = get_api_key()
    try:
        board_info = get_or_create_board(token)
    except Exception as e:
        logger.error(f"Sync failed - board error: {e}")
        return {
            "success": False,
            "connected": False,
            "error": str(e),
            "authUrl": get_auth_url()
        }

    board_id = board_info["boardId"]
    board_url = board_info["boardUrl"]
    lists_map = board_info["lists"]

    pushed_count = 0
    pulled_count = 0

    # Step 1: Push CommitFlow action items without trelloCardId to Trello
    try:
        items = db.list_action_items_with_trello(user_id=user_id, is_admin=is_admin)
        for item in items:
            if not item.get("trelloCardId"):
                card_title = item.get("title", "Untitled Task")
                desc_parts = []
                if item.get("description"):
                    desc_parts.append(item["description"])
                if item.get("owner"):
                    desc_parts.append(f"👤 Assignee: {item['owner']}")
                if item.get("deadline") and item["deadline"] != "Unspecified":
                    desc_parts.append(f"⏰ Deadline: {item['deadline']}")
                if item.get("sourceMeetingTitle"):
                    desc_parts.append(f"📌 From Meeting: {item['sourceMeetingTitle']}")

                card_desc = "\n\n".join(desc_parts)
                card = create_card(
                    title=card_title,
                    description=card_desc,
                    status=item.get("status", "Pending Approval"),
                    token=token
                )
                if card:
                    db.link_action_item_trello(item["id"], card["id"], card.get("url", ""))
                    pushed_count += 1
    except Exception as e:
        logger.error(f"Error pushing tasks to Trello: {e}")

    # Step 2: Pull cards from Trello into CommitFlow
    try:
        cards_resp = requests.get(
            f"{TRELLO_API_BASE}/boards/{board_id}/cards",
            params={"key": key, "token": token, "fields": "id,name,desc,idList,url,due,closed"},
            timeout=10
        )
        if cards_resp.status_code == 200:
            todo_id = lists_map.get("To Do")
            doing_id = lists_map.get("In Progress")
            done_id = lists_map.get("Done")

            for card in cards_resp.json():
                if card.get("closed"):
                    continue
                list_id = card.get("idList")
                status = "Pending Approval"
                if list_id == doing_id:
                    status = "Approved"
                elif list_id == done_id:
                    status = "Approved" # In CommitFlow approved/completed

                due_date = card.get("due")
                if due_date:
                    try:
                        due_date = due_date[:10]
                    except Exception:
                        pass

                db.upsert_action_item_from_trello(
                    trello_card_id=card["id"],
                    title=card.get("name", "Untitled Card"),
                    description=card.get("desc", ""),
                    status=status,
                    deadline=due_date or "Unspecified",
                    trello_card_url=card.get("url")
                )
                pulled_count += 1
    except Exception as e:
        logger.error(f"Error pulling cards from Trello: {e}")

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    db.save_trello_setting("last_synced_at", now_iso)

    return {
        "success": True,
        "connected": True,
        "pushed": pushed_count,
        "pulled": pulled_count,
        "boardId": board_id,
        "boardUrl": board_url,
        "lastSyncedAt": now_iso
    }

def get_trello_board_cards():
    """
    Retrieve board structure with columns: To Do, In Progress, Done.
    If Trello is not connected, fallback to CommitFlow action items organized in columns.
    """
    token = get_active_token()
    settings = db.get_trello_settings()
    
    # Try fetching live cards directly from Trello
    if token:
        try:
            board_info = get_or_create_board(token)
            key = get_api_key()
            cards_resp = requests.get(
                f"{TRELLO_API_BASE}/boards/{board_info['boardId']}/cards",
                params={"key": key, "token": token, "fields": "id,name,desc,idList,url,due,closed"},
                timeout=10
            )
            if cards_resp.status_code == 200:
                lists = board_info["lists"]
                columns = {
                    "todo": [],
                    "inprogress": [],
                    "done": []
                }
                for card in cards_resp.json():
                    if card.get("closed"):
                        continue
                    item_data = {
                        "id": card["id"],
                        "trelloCardId": card["id"],
                        "title": card["name"],
                        "description": card.get("desc", ""),
                        "url": card.get("url"),
                        "due": card.get("due"),
                        "trelloCardUrl": card.get("url")
                    }
                    if card["idList"] == lists.get("Done"):
                        columns["done"].append(item_data)
                    elif card["idList"] == lists.get("In Progress"):
                        columns["inprogress"].append(item_data)
                    else:
                        columns["todo"].append(item_data)

                return {
                    "connected": True,
                    "live": True,
                    "boardUrl": board_info["boardUrl"],
                    "boardName": board_info["boardName"],
                    "columns": columns,
                    "lastSyncedAt": settings.get("lastSyncedAt")
                }
        except Exception as e:
            logger.warning(f"Error fetching live cards from Trello, falling back to local DB: {e}")

    # Fallback: Organize CommitFlow action items into board columns
    items = db.list_action_items_with_trello()
    columns = {
        "todo": [],
        "inprogress": [],
        "done": []
    }
    for item in items:
        status = (item.get("status") or "").lower()
        formatted = {
            "id": item["id"],
            "trelloCardId": item.get("trelloCardId"),
            "title": item["title"],
            "description": item.get("description", ""),
            "owner": item.get("owner"),
            "deadline": item.get("deadline"),
            "priority": item.get("priority", "Medium"),
            "sourceMeetingTitle": item.get("sourceMeetingTitle"),
            "trelloCardUrl": item.get("trelloCardUrl"),
            "trelloLastSynced": item.get("trelloLastSynced")
        }
        if "approved" in status or "progress" in status:
            columns["inprogress"].append(formatted)
        elif "rejected" in status or "completed" in status or "done" in status:
            columns["done"].append(formatted)
        else:
            columns["todo"].append(formatted)

    return {
        "connected": bool(token),
        "live": False,
        "boardUrl": settings.get("boardUrl") or "https://trello.com",
        "boardName": settings.get("boardName", "CommitFlow Tasks"),
        "columns": columns,
        "lastSyncedAt": settings.get("lastSyncedAt")
    }
