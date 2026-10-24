"""
CommitFlow Flask Backend API
REST endpoints for Transcripts, Neon PostgreSQL, and Google Gemini AI analysis.
"""

import os
import threading
import logging
import uuid
from functools import wraps
from datetime import datetime, timezone
import csv
import io
from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from dotenv import load_dotenv

try:
    import db
    import ai
    import livekit_service
    import trello_service
except ImportError:
    from server import db
    from server import ai
    from server import livekit_service
    from server import trello_service

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("commitflow.server")

DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist"))

app = Flask(__name__, static_folder=None)
# Enable CORS with credentials for React Vite frontend and backend
CORS(app, supports_credentials=True, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5173", 
            "http://127.0.0.1:5173", 
            "http://localhost:5000", 
            "http://127.0.0.1:5000",
            "http://localhost:3000"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

def get_current_user():
    """Extract and validate current authenticated user from Authorization header or session cookie."""
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    if not token:
        token = request.cookies.get("cf_session")
    if not token:
        return None
    return db.get_session_user(token)

def require_auth(f):
    """Route decorator requiring valid authenticated session."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Unauthorized. Please log in to continue."}), 401
        request.current_user = user
        return f(*args, **kwargs)
    return decorated_function

def require_admin(f):
    """Route decorator requiring active administrator role."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Unauthorized. Please log in to continue."}), 401
        if user.get("role") != "admin":
            return jsonify({"error": "Forbidden. Administrator privileges required."}), 403
        request.current_user = user
        return f(*args, **kwargs)
    return decorated_function

def require_team_lead(f):
    """Route decorator requiring active Team Lead role."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Unauthorized. Please log in to continue."}), 401
        if user.get("role") != "team_lead":
            return jsonify({"error": "Forbidden. Team Lead privileges required."}), 403
        request.current_user = user
        return f(*args, **kwargs)
    return decorated_function

# In-memory store fallback when PostgreSQL is not yet connected
_mem_store = {
    "transcripts": {},
    "action_items": []
}

def init_backend():
    """Attempt database schema initialization on startup."""
    url = db.get_connection_url()
    if url:
        logger.info("Initializing Neon PostgreSQL schema...")
        success = db.init_schema()
        if success:
            logger.info("Neon PostgreSQL schema is active.")
        else:
            logger.warning("Neon PostgreSQL schema init failed. Backend will run with fallback mode.")
    else:
        logger.info("DATABASE_URL not set in .env. Running in local fallback mode.")

init_backend()

# -------------------------------------------------------------
# Background AI Processing Worker
# -------------------------------------------------------------

def process_transcript_async(tx_id, text, title="CommitFlow Meeting", meeting_date=None):
    """Processes transcript using Gemini in a background thread."""
    logger.info(f"Starting Gemini transcript analysis for ID '{tx_id}'...")
    try:
        analysis_data = ai.analyze_transcript(text, title, meeting_date=meeting_date)

        # 1. Try persisting to Neon PostgreSQL
        if db.get_connection_url():
            saved = db.save_analysis_results(tx_id, analysis_data)
            if saved:
                logger.info(f"Successfully saved Gemini analysis to Neon for '{tx_id}'.")
                return

        # 2. In-memory fallback if Neon is not configured
        if tx_id in _mem_store["transcripts"]:
            tx = _mem_store["transcripts"][tx_id]
            tx["status"] = "Processed"
            tx["duration"] = analysis_data.get("duration", "25 min")
            tx["participants"] = analysis_data.get("participants", [])
            tx["summary"] = analysis_data.get("summary")
            tx["decisions"] = analysis_data.get("decisions", [])
            tx["actionItems"] = [
                {**a, "sourceMeetingId": tx_id, "sourceMeetingTitle": title}
                for a in analysis_data.get("actionItems", [])
            ]
            tx["unresolvedQuestions"] = analysis_data.get("unresolvedQuestions", [])
            logger.info(f"Saved analysis to in-memory store for '{tx_id}'.")

    except Exception as e:
        logger.error(f"Error processing transcript '{tx_id}': {e}")
        if db.get_connection_url():
            db.mark_transcript_failed(tx_id, str(e))
        elif tx_id in _mem_store["transcripts"]:
            _mem_store["transcripts"][tx_id]["status"] = "Failed"
            _mem_store["transcripts"][tx_id]["errorMessage"] = str(e)

# -------------------------------------------------------------
# REST API Endpoints: Authentication
# -------------------------------------------------------------

@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    """Register a new standard user account. Always enforces role='user'."""
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()
    confirm_password = data.get("confirmPassword", "").strip()

    if not name:
        return jsonify({"error": "Full name is required."}), 400
    if not email or "@" not in email:
        return jsonify({"error": "A valid email address is required."}), 400
    if not password:
        return jsonify({"error": "Password is required."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long."}), 400
    if confirm_password and password != confirm_password:
        return jsonify({"error": "Passwords do not match."}), 400

    # Registration safeguard: public signups MUST NEVER assign admin role
    try:
        user = db.create_user(name=name, email=email, password=password, role="user")
        token, expires_at = db.create_session(user["id"])
        
        resp = jsonify({
            "message": "Account created successfully.",
            "user": user,
            "token": token
        })
        resp.set_cookie(
            "cf_session",
            token,
            httponly=True,
            samesite="Lax",
            secure=False,
            max_age=7 * 24 * 60 * 60
        )
        return resp, 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Registration error: {e}")
        return jsonify({"error": "Failed to create account. Please try again."}), 500

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    """Authenticate existing user and establish session."""
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    success, msg, user = db.authenticate_user(email, password, ip_address=request.remote_addr)
    if not success:
        status_code = 403 if "deactivated" in msg.lower() else 401
        return jsonify({"error": msg}), status_code

    token, expires_at = db.create_session(user["id"])
    resp = jsonify({
        "message": "Login successful.",
        "user": user,
        "token": token
    })
    resp.set_cookie(
        "cf_session",
        token,
        httponly=True,
        samesite="Lax",
        secure=False,
        max_age=7 * 24 * 60 * 60
    )
    return resp, 200

@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    """Invalidate current session and clear session cookie."""
    token = request.cookies.get("cf_session")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
    
    user = get_current_user()
    if token:
        db.delete_session(token)
    if user:
        db.log_audit_event(user["id"], user["email"], "USER_LOGOUT", ip_address=request.remote_addr)

    resp = jsonify({"message": "Logged out successfully."})
    resp.delete_cookie("cf_session")
    return resp, 200

@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    """Return verified session identity and permissions."""
    user = get_current_user()
    return jsonify({"user": user}), 200

# -------------------------------------------------------------
# REST API Endpoints: Health & Transcripts
# -------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint reporting Neon database, Gemini AI, and LiveKit Cloud status."""
    db_ok, db_msg = db.check_connection()
    ai_ok, ai_msg = ai.check_gemini_status()
    _, model_name = ai.get_gemini_config()
    lk_ok, lk_msg = livekit_service.check_livekit_status()
    trello_token = trello_service.get_active_token()
    trello_settings = db.get_trello_settings()

    return jsonify({
        "status": "ok",
        "database": {
            "configured": bool(db.get_connection_url()),
            "connected": db_ok,
            "type": "Neon PostgreSQL" if db_ok else "fallback-store",
            "message": db_msg
        },
        "gemini": {
            "configured": ai_ok,
            "model": model_name,
            "message": ai_msg
        },
        "livekit": {
            "configured": lk_ok,
            "message": lk_msg
        },
        "trello": {
            "configured": bool(trello_settings.get("apiKey")),
            "connected": bool(trello_token),
            "boardName": trello_settings.get("boardName", "CommitFlow Tasks"),
            "boardUrl": trello_settings.get("boardUrl", "")
        }
    }), 200

# -------------------------------------------------------------
# REST API Endpoints: Meetings & LiveKit Real-Time Sessions
# -------------------------------------------------------------

@app.route("/api/meetings", methods=["GET"])
def list_meetings_endpoint():
    """List accessible meetings for current user or admin."""
    user = get_current_user()
    user_id = user["id"] if user else None
    is_admin = (user.get("role") == "admin") if user else False

    meetings = db.list_meetings(user_id=user_id, is_admin=is_admin)
    return jsonify(meetings), 200

@app.route("/api/meetings/<meeting_id>", methods=["GET"])
def get_meeting_endpoint(meeting_id):
    """Retrieve metadata for a specific meeting."""
    user = get_current_user()
    meeting = db.get_meeting_by_id(meeting_id)
    if not meeting:
        return jsonify({"error": f"Meeting '{meeting_id}' not found."}), 404

    # If meeting is private, check access
    if meeting.get("isPrivate"):
        if not user:
            return jsonify({"error": "Unauthorized. Please log in to access this private meeting."}), 401
        allowed, reason, _ = db.can_user_access_meeting(meeting_id, user["id"], is_admin=(user.get("role") == "admin"))
        if not allowed:
            return jsonify({"error": reason}), 403

    return jsonify(meeting), 200

@app.route("/api/meetings", methods=["POST"])
@require_auth
def create_meeting_endpoint():
    """Create a new real-time meeting record in Neon PostgreSQL."""
    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip() or f"{request.current_user.get('name', 'User')}'s Meeting Room"
    is_private = bool(data.get("isPrivate", False))
    meeting_id = data.get("meetingId", "").strip() or None

    try:
        meeting = db.create_meeting(
            title=title,
            host_id=request.current_user["id"],
            is_private=is_private,
            meeting_id=meeting_id
        )
        db.log_audit_event(
            request.current_user["id"],
            request.current_user["email"],
            "MEETING_CREATED",
            {"meetingId": meeting["id"], "title": meeting["title"], "isPrivate": is_private},
            request.remote_addr
        )
        return jsonify(meeting), 201
    except Exception as e:
        logger.error(f"Error creating meeting: {e}")
        return jsonify({"error": "Failed to create meeting."}), 500

@app.route("/api/meetings/<meeting_id>/livekit-token", methods=["POST"])
@require_auth
def generate_livekit_token_endpoint(meeting_id):
    """
    Generate a cryptographically signed LiveKit AccessToken for real-time video/audio.
    Validates meeting existence and user permissions server-side.
    Returns only { serverUrl, token, roomName }. Never exposes credentials.
    """
    user = request.current_user
    is_admin = (user.get("role") == "admin")

    # 1. Validate LiveKit server configuration
    lk_ok, lk_msg = livekit_service.check_livekit_status()
    if not lk_ok:
        logger.error(f"LiveKit configuration check failed: {lk_msg}")
        return jsonify({
            "error": "LiveKit video conferencing is unavailable. Server configuration is missing or invalid."
        }), 503

    # 2. Check or auto-provision meeting record
    meeting = db.get_meeting_by_id(meeting_id)
    if not meeting:
        if meeting_id == "new":
            meeting = db.create_meeting(
                title=f"{user.get('name', 'User')}'s Meeting",
                host_id=user["id"],
                is_private=False
            )
        else:
            return jsonify({"error": f"Meeting '{meeting_id}' not found."}), 404

    # 3. Verify user authorization to join this meeting
    allowed, reason, verified_meeting = db.can_user_access_meeting(meeting["id"], user["id"], is_admin=is_admin)
    if not allowed:
        db.log_audit_event(
            user["id"],
            user["email"],
            "LIVEKIT_JOIN_DENIED",
            {"meetingId": meeting["id"], "reason": reason},
            request.remote_addr
        )
        return jsonify({"error": reason}), 403

    # 4. Generate participant token with least necessary privileges
    try:
        room_name = verified_meeting.get("roomName") or f"cf-room-{verified_meeting['id']}"
        token_data = livekit_service.generate_meeting_token(
            meeting_id=verified_meeting["id"],
            room_name=room_name,
            user_id=user["id"],
            user_name=user.get("name") or f"User-{user['id'][:6]}",
            user_role=user.get("role", "user")
        )

        # Register participant in DB
        db.add_meeting_participant(verified_meeting["id"], user["id"])

        # Audit log token issuance
        db.log_audit_event(
            user["id"],
            user["email"],
            "LIVEKIT_TOKEN_ISSUED",
            {"meetingId": verified_meeting["id"], "roomName": room_name},
            request.remote_addr
        )

        return jsonify(token_data), 200

    except Exception as e:
        logger.error(f"Error generating LiveKit token for meeting '{meeting_id}': {e}")
@app.route("/api/calendar", methods=["GET"])
def get_calendar_endpoint():
    """
    Retrieve calendar meetings for the requested year and month.
    Enforces user access permissions and computes attendance statuses.
    """
    user = get_current_user()
    user_id = user["id"] if user else None
    is_admin = (user.get("role") == "admin") if user else False

    try:
        now = datetime.now(timezone.utc)
        year_val = request.args.get("year")
        month_val = request.args.get("month")
        year = int(year_val) if year_val else now.year
        month = int(month_val) if month_val else now.month
    except (ValueError, TypeError):
        now = datetime.now(timezone.utc)
        year = now.year
        month = now.month

    if month < 1 or month > 12:
        return jsonify({"error": "Month must be between 1 and 12."}), 400
    if year < 1970 or year > 2100:
        return jsonify({"error": "Year must be between 1970 and 2100."}), 400

    meetings = db.get_calendar_meetings(user_id=user_id, year=year, month=month, is_admin=is_admin)
    return jsonify({
        "year": year,
        "month": month,
        "meetings": meetings
    }), 200

@app.route("/api/transcripts", methods=["GET"])
def list_transcripts_endpoint():
    """List meeting transcripts (user's own plus demo transcripts, or all if admin)."""
    user = get_current_user()
    user_id = user["id"] if user else None
    is_admin = (user.get("role") == "admin") if user else False

    # Try Neon PostgreSQL
    if db.get_connection_url():
        try:
            records = db.list_transcripts(user_id=user_id, is_admin=is_admin)
            if records is not None:
                return jsonify(records), 200
        except Exception as e:
            logger.error(f"Error listing transcripts from DB: {e}")

    # Fallback
    records = list(_mem_store["transcripts"].values())
    return jsonify(records), 200

@app.route("/api/transcripts", methods=["POST"])
def upload_transcript_endpoint():
    """Upload and start processing a new meeting transcript."""
    user = get_current_user()
    user_id = user["id"] if user else None

    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip()
    text = data.get("text", "").strip()

    if not title:
        return jsonify({"error": "Meeting title is required."}), 400
    if not text:
        return jsonify({"error": "Transcript content cannot be empty."}), 400

    # Validate file size (15MB limit)
    if len(text.encode("utf-8")) > 15 * 1024 * 1024:
        return jsonify({"error": "Transcript content exceeds 15MB limit."}), 400

    tx_id = f"tx-{int(uuid.uuid4().time_low)}"
    filename = data.get("filename") or f"{title.lower().replace(' ', '_')}.txt"
    file_type = data.get("fileType", "TXT").upper()
    file_size = data.get("fileSize") or f"{len(text)/1024:.1f} KB"
    participants = data.get("optionalParticipants", "").split(",") if data.get("optionalParticipants") else []
    participants = [p.strip() for p in participants if p.strip()]

    tx_record = {
        "id": tx_id,
        "title": title,
        "filename": filename,
        "fileSize": file_size,
        "fileType": file_type,
        "sourceType": "Uploaded Transcript",
        "uploadedAt": data.get("optionalDate") or "Just now",
        "status": "Processing",
        "duration": "Calculating...",
        "participants": participants,
        "text": text,
        "transcriptText": text,
        "summary": None,
        "decisions": [],
        "actionItems": [],
        "unresolvedQuestions": [],
        "userId": user_id
    }

    # Save to PostgreSQL
    if db.get_connection_url():
        try:
            db.insert_transcript(tx_record, user_id=user_id)
        except Exception as e:
            logger.error(f"Failed to insert transcript into DB: {e}")
            _mem_store["transcripts"][tx_id] = tx_record
    else:
        _mem_store["transcripts"][tx_id] = tx_record

    meeting_date = data.get("optionalDate") or ai.extract_meeting_date(text)

    # Launch Gemini processing in background thread
    threading.Thread(
        target=process_transcript_async,
        args=(tx_id, text, title),
        kwargs={"meeting_date": meeting_date},
        daemon=True
    ).start()

    return jsonify(tx_record), 201

@app.route("/api/transcripts/<tx_id>", methods=["GET"])
def get_transcript_endpoint(tx_id):
    """Retrieve complete transcript details with ownership check."""
    user = get_current_user()
    user_id = user["id"] if user else None
    is_admin = (user.get("role") == "admin") if user else False

    if db.get_connection_url():
        try:
            record = db.get_transcript_by_id(tx_id, user_id=user_id, is_admin=is_admin)
            if record:
                if record.get("_forbidden"):
                    if not user_id:
                        return jsonify({"error": "Unauthorized. Please log in to view this transcript."}), 401
                    return jsonify({"error": "Access denied. You do not have permission to view this transcript."}), 403
                return jsonify(record), 200
        except Exception as e:
            logger.error(f"Error fetching transcript {tx_id} from DB: {e}")

    # Fallback
    if tx_id in _mem_store["transcripts"]:
        return jsonify(_mem_store["transcripts"][tx_id]), 200

    return jsonify({"error": f"Transcript '{tx_id}' not found."}), 404

@app.route("/api/transcripts/<tx_id>/retry", methods=["POST"])
def retry_transcript_endpoint(tx_id):
    """Retry analysis for a failed or existing transcript."""
    tx_text = ""
    tx_title = ""

    if db.get_connection_url():
        record = db.get_transcript_by_id(tx_id)
        if record:
            tx_text = record.get("transcriptText", "")
            tx_title = record.get("title", "")
            db.update_transcript_status(tx_id, "Processing") if hasattr(db, 'update_transcript_status') else None
    elif tx_id in _mem_store["transcripts"]:
        tx = _mem_store["transcripts"][tx_id]
        tx_text = tx.get("text", "")
        tx_title = tx.get("title", "")
        tx["status"] = "Processing"
        tx.pop("errorMessage", None)

    if not tx_text:
        return jsonify({"error": "Transcript not found."}), 404

    meeting_date = ai.extract_meeting_date(tx_text)
    threading.Thread(
        target=process_transcript_async,
        args=(tx_id, tx_text, tx_title),
        kwargs={"meeting_date": meeting_date},
        daemon=True
    ).start()

    return jsonify({"message": f"Processing restarted for transcript '{tx_id}'."}), 200

@app.route("/api/action-items", methods=["GET"])
def list_action_items_endpoint():
    """Retrieve all action items across permitted meetings."""
    user = get_current_user()
    user_id = user["id"] if user else None
    is_admin = (user.get("role") == "admin") if user else False

    if db.get_connection_url():
        try:
            items = db.list_all_action_items(user_id=user_id, is_admin=is_admin)
            if items is not None:
                return jsonify(items), 200
        except Exception as e:
            logger.error(f"Error listing action items: {e}")

    # Fallback
    items = []
    for tx in _mem_store["transcripts"].values():
        for a in tx.get("actionItems", []):
            items.append(a)
    return jsonify(items), 200

def _sync_action_item_to_trello(action_id, status=None, title=None, desc=None):
    """Background helper to reflect action item updates on corresponding Trello card."""
    def _worker():
        try:
            if not db.get_connection_url():
                return
            with db.get_db_cursor(commit=False) as cur:
                cur.execute("SELECT trello_card_id FROM action_items WHERE id = %s;", (action_id,))
                row = cur.fetchone()
                if row and row.get("trello_card_id"):
                    trello_service.update_card(row["trello_card_id"], title=title, description=desc, status=status)
        except Exception as e:
            logger.warning(f"Failed to sync action item to Trello: {e}")
    threading.Thread(target=_worker, daemon=True).start()

@app.route("/api/action-items/<action_id>/approve", methods=["POST"])
@require_auth
def approve_action_item_endpoint(action_id):
    """Approve action item (human-in-the-loop task governance) with audit logging."""
    user = request.current_user
    approver_id = user["id"]
    approver_name = user.get("name", "Authorized Reviewer")

    if db.get_connection_url():
        # Permission check: admin, team_lead, or transcript owner/assignee
        with db.get_db_cursor(commit=False) as cur:
            cur.execute("""
                SELECT a.id, a.transcript_id, a.assignee_id, t.user_id as transcript_owner
                FROM action_items a
                LEFT JOIN transcripts t ON a.transcript_id = t.id
                WHERE a.id = %s;
            """, (action_id,))
            item = cur.fetchone()
        if not item:
            return jsonify({"error": "Action item not found."}), 404
        is_privileged = user.get("role") in ("admin", "team_lead")
        is_owner = (item.get("transcript_owner") == user["id"]) or (item.get("assignee_id") == user["id"])
        if item.get("transcript_owner") is not None and not is_privileged and not is_owner:
            return jsonify({"error": "Forbidden. You do not have permission to review this task."}), 403

        success = db.update_action_item_status(action_id, "Approved", approver_id=approver_id)
        if success:
            _sync_action_item_to_trello(action_id, status="Approved")
            return jsonify({"id": action_id, "status": "Approved", "approvedBy": approver_name}), 200

    # Fallback
    for tx in _mem_store["transcripts"].values():
        for a in tx.get("actionItems", []):
            if a.get("id") == action_id:
                a["status"] = "Approved"
                a["approvedByName"] = approver_name
                return jsonify({"id": action_id, "status": "Approved", "approvedBy": approver_name}), 200

    return jsonify({"error": "Action item not found."}), 404

@app.route("/api/action-items/bulk-approve", methods=["POST"])
@require_auth
def bulk_approve_action_items_endpoint():
    """Bulk approve multiple eligible action items with reviewer audit trail."""
    data = request.get_json(silent=True) or {}
    action_ids = data.get("actionIds", [])
    if not action_ids:
        return jsonify({"error": "actionIds list is required."}), 400

    user = request.current_user
    approver_id = user["id"]
    approver_name = user.get("name", "Authorized Reviewer")

    if db.get_connection_url():
        approved_count = db.bulk_approve_action_items(action_ids, approver_id=approver_id)
        for act_id in action_ids:
            _sync_action_item_to_trello(act_id, status="Approved")
        return jsonify({
            "message": f"Successfully approved {approved_count} action item(s).",
            "approvedCount": approved_count,
            "approvedBy": approver_name
        }), 200

    # Fallback
    approved_count = 0
    for tx in _mem_store["transcripts"].values():
        for a in tx.get("actionItems", []):
            if a.get("id") in action_ids and a.get("status") != "Approved":
                a["status"] = "Approved"
                a["approvedByName"] = approver_name
                approved_count += 1
    return jsonify({
        "message": f"Successfully approved {approved_count} action item(s).",
        "approvedCount": approved_count,
        "approvedBy": approver_name
    }), 200

@app.route("/api/action-items/export", methods=["GET"])
def export_action_items_endpoint():
    """Export approved action items as CSV or structured JSON file."""
    export_format = request.args.get("format", "csv").lower()
    transcript_id = request.args.get("transcriptId") or request.args.get("transcript_id")
    only_approved = request.args.get("onlyApproved", "true").lower() in ("true", "1", "yes")

    items = db.get_action_items_for_export(transcript_id=transcript_id, only_approved=only_approved)

    if export_format == "json":
        return jsonify({
            "exportDate": datetime.now(timezone.utc).isoformat(),
            "totalItems": len(items),
            "items": items
        }), 200

    # CSV Format
    output = io.StringIO()
    fieldnames = [
        "taskId", "taskTitle", "description", "classification", "approvalStatus",
        "priority", "assignedOwner", "ownerEmail", "dueDate", "sourceMeeting",
        "trelloCardId", "trelloCardUrl", "createdAt", "approvedAt", "approvedByName"
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for item in items:
        writer.writerow({k: item.get(k, "") for k in fieldnames})

    csv_data = output.getvalue()
    filename = f"commitflow_tasks_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.route("/api/action-items/<action_id>/reject", methods=["POST"])
@require_auth
def reject_action_item_endpoint(action_id):
    """Reject action item."""
    user = request.current_user
    if db.get_connection_url():
        with db.get_db_cursor(commit=False) as cur:
            cur.execute("""
                SELECT a.id, a.transcript_id, a.assignee_id, t.user_id as transcript_owner
                FROM action_items a
                LEFT JOIN transcripts t ON a.transcript_id = t.id
                WHERE a.id = %s;
            """, (action_id,))
            item = cur.fetchone()
        if not item:
            return jsonify({"error": "Action item not found."}), 404
        is_privileged = user.get("role") in ("admin", "team_lead")
        is_owner = (item.get("transcript_owner") == user["id"]) or (item.get("assignee_id") == user["id"])
        if item.get("transcript_owner") is not None and not is_privileged and not is_owner:
            return jsonify({"error": "Forbidden. You do not have permission to review this task."}), 403

        success = db.update_action_item_status(action_id, "Rejected")
        if success:
            _sync_action_item_to_trello(action_id, status="Rejected")
            return jsonify({"id": action_id, "status": "Rejected"}), 200

    # Fallback
    for tx in _mem_store["transcripts"].values():
        for a in tx.get("actionItems", []):
            if a.get("id") == action_id:
                a["status"] = "Rejected"
                return jsonify({"id": action_id, "status": "Rejected"}), 200

    return jsonify({"error": "Action item not found."}), 404

@app.route("/api/action-items/<action_id>", methods=["PUT"])
@require_auth
def edit_action_item_endpoint(action_id):
    """Edit action item details."""
    user = request.current_user
    updates = request.get_json(silent=True) or {}
    if db.get_connection_url():
        with db.get_db_cursor(commit=False) as cur:
            cur.execute("""
                SELECT a.id, a.transcript_id, a.assignee_id, t.user_id as transcript_owner
                FROM action_items a
                LEFT JOIN transcripts t ON a.transcript_id = t.id
                WHERE a.id = %s;
            """, (action_id,))
            item = cur.fetchone()
        if not item:
            return jsonify({"error": "Action item not found."}), 404
        is_privileged = user.get("role") in ("admin", "team_lead")
        is_owner = (item.get("transcript_owner") == user["id"]) or (item.get("assignee_id") == user["id"])
        if item.get("transcript_owner") is not None and not is_privileged and not is_owner:
            return jsonify({"error": "Forbidden. You do not have permission to edit this task."}), 403

        success = db.edit_action_item(action_id, updates)
        if success:
            _sync_action_item_to_trello(
                action_id,
                title=updates.get("title"),
                desc=updates.get("description"),
                status=updates.get("status")
            )
            return jsonify({"id": action_id, "message": "Updated successfully."}), 200

    # Fallback
    for tx in _mem_store["transcripts"].values():
        for a in tx.get("actionItems", []):
            if a.get("id") == action_id:
                if "title" in updates: a["title"] = updates["title"]
                if "owner" in updates:
                    a["owner"] = updates["owner"]
                    a["ownerStatus"] = "ambiguous" if updates["owner"] == "Unassigned" else "confirmed"
                if "deadline" in updates:
                    a["deadline"] = updates["deadline"]
                    a["deadlineStatus"] = "missing" if updates["deadline"] == "Unspecified" else "confirmed"
                if "priority" in updates: a["priority"] = updates["priority"]
                if "itemType" in updates: a["itemType"] = updates["itemType"]
                return jsonify({"id": action_id, "message": "Updated successfully."}), 200

    return jsonify({"error": "Action item not found."}), 404

@app.route("/api/users/active", methods=["GET"])
def list_active_users_endpoint():
    """Retrieve active registered users for task assignment and reviewer dropdowns."""
    if db.get_connection_url():
        users = db.list_active_users()
        return jsonify(users), 200
    return jsonify([]), 200

# -------------------------------------------------------------
# REST API Endpoints: Unresolved Questions & Follow-ups Lifecycle
# -------------------------------------------------------------

@app.route("/api/unresolved-questions", methods=["GET"])
@require_auth
def list_unresolved_questions_endpoint():
    """
    Retrieve real persisted unresolved questions, pending follow-ups, and items awaiting clarification.
    """
    user = request.current_user
    is_admin = (user.get("role") == "admin")
    is_team_lead = (user.get("role") == "team_lead")
    status_filter = request.args.get("status")

    if db.get_connection_url():
        questions = db.list_unresolved_questions(
            user_id=user["id"],
            is_admin=is_admin,
            is_team_lead=is_team_lead,
            status_filter=status_filter
        )
        return jsonify(questions), 200
    return jsonify([]), 200

@app.route("/api/unresolved-questions/<question_id>", methods=["PUT"])
@require_auth
def update_unresolved_question_endpoint(question_id):
    """
    Update lifecycle state, resolution notes, assigned owner, or target deadline of a follow-up item.
    """
    user = request.current_user
    data = request.get_json(silent=True) or {}
    
    if db.get_connection_url():
        updated = db.update_unresolved_question(question_id, data, resolver_id=user["id"])
        if updated:
            db.log_audit_event(
                user["id"],
                user["email"],
                "UNRESOLVED_QUESTION_UPDATED",
                {"questionId": question_id, "status": updated.get("status"), "resolvedBy": updated.get("resolvedBy")},
                request.remote_addr
            )
            return jsonify(updated), 200
        return jsonify({"error": "Unresolved question or follow-up item not found."}), 404

    return jsonify({"error": "Database unavailable."}), 503

@app.route("/api/unresolved-questions", methods=["POST"])
@require_auth
def create_unresolved_question_endpoint():
    """
    Create a new follow-up action or unresolved question linked to a transcript or meeting.
    """
    user = request.current_user
    data = request.get_json(silent=True) or {}
    transcript_id = data.get("transcriptId") or data.get("transcript_id")
    title = data.get("title")

    if not title:
        return jsonify({"error": "Title is required for a follow-up item."}), 400

    if db.get_connection_url():
        created = db.create_unresolved_question(
            transcript_id=transcript_id,
            title=title,
            category=data.get("category", "Follow-up Action"),
            description=data.get("description", ""),
            evidence=data.get("evidence", ""),
            assigned_owner_id=data.get("assignedOwnerId") or data.get("assigned_owner_id"),
            target_deadline=data.get("targetDeadline") or data.get("target_deadline")
        )
        if created:
            db.log_audit_event(
                user["id"],
                user["email"],
                "UNRESOLVED_QUESTION_CREATED",
                {"questionId": created.get("id"), "title": title},
                request.remote_addr
            )
            return jsonify(created), 201

    return jsonify({"error": "Failed to create follow-up item."}), 500

# -------------------------------------------------------------
# REST API Endpoints: Trello Project Management Integration
# -------------------------------------------------------------

@app.route("/api/trello/status", methods=["GET"])
def trello_status_endpoint():
    """Return Trello integration configuration, active token status, and board details."""
    settings = db.get_trello_settings()
    token = trello_service.get_active_token()
    member_info = None
    is_valid = False
    if token:
        valid, info_or_err = trello_service.verify_token(token)
        is_valid = valid
        if valid:
            member_info = info_or_err

    return jsonify({
        "configured": bool(settings.get("apiKey")),
        "connected": is_valid,
        "hasToken": bool(token),
        "apiKey": trello_service.get_api_key(),
        "boardId": settings.get("boardId", ""),
        "boardName": settings.get("boardName", "CommitFlow Tasks"),
        "boardUrl": settings.get("boardUrl", ""),
        "lastSyncedAt": settings.get("lastSyncedAt", ""),
        "authUrl": trello_service.get_auth_url(),
        "member": member_info
    }), 200

@app.route("/api/trello/connect", methods=["POST"])
@require_auth
def trello_connect_endpoint():
    """Verify user Trello token, save in database and .env, and initialize board."""
    data = request.get_json(silent=True) or {}
    token = data.get("token", "").strip()
    if not token:
        return jsonify({"error": "Trello token is required."}), 400

    valid, res = trello_service.verify_token(token)
    if not valid:
        return jsonify({"error": f"Invalid Trello token: {res}"}), 400

    # Save token in DB
    db.save_trello_setting("token", token)

    # Attempt to persist token to .env file
    try:
        env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                env_content = f.read()
            if "TRELLO_TOKEN=" in env_content:
                lines = []
                for line in env_content.splitlines():
                    if line.startswith("TRELLO_TOKEN="):
                        lines.append(f"TRELLO_TOKEN={token}")
                    else:
                        lines.append(line)
                with open(env_path, "w", encoding="utf-8") as f:
                    f.write("\n".join(lines) + "\n")
    except Exception as e:
        logger.warning(f"Could not update .env: {e}")

    # Provision or connect board
    try:
        board_info = trello_service.get_or_create_board(token)
    except Exception as e:
        return jsonify({"error": f"Token is valid, but failed to setup board: {e}"}), 500

    # Run initial sync in background
    user = request.current_user
    user_id = user["id"]
    is_admin = (user.get("role") == "admin")
    threading.Thread(target=trello_service.sync_all, args=(user_id, is_admin), daemon=True).start()

    return jsonify({
        "message": "Connected to Trello successfully!",
        "member": res,
        "boardUrl": board_info.get("boardUrl"),
        "boardName": board_info.get("boardName")
    }), 200

@app.route("/api/trello/disconnect", methods=["POST"])
@require_auth
def trello_disconnect_endpoint():
    """Disconnect Trello token and reset integration."""
    db.save_trello_setting("token", "")
    return jsonify({"message": "Trello disconnected successfully."}), 200

@app.route("/api/trello/sync", methods=["POST"])
def trello_sync_endpoint():
    """Trigger bidirectional sync between CommitFlow action items and Trello cards."""
    user = get_current_user()
    user_id = user["id"] if user else None
    is_admin = (user.get("role") == "admin") if user else False
    result = trello_service.sync_all(user_id=user_id, is_admin=is_admin)
    if not result.get("success") and not result.get("connected"):
        return jsonify(result), 400
    return jsonify(result), 200

@app.route("/api/trello/export/<action_id>", methods=["POST"])
def trello_export_task_endpoint(action_id):
    """Export a single CommitFlow action item to Trello."""
    token = trello_service.get_active_token()
    if not token:
        return jsonify({"error": "Trello is not connected. Please connect your token first."}), 400

    # Fetch action item details
    with db.get_db_cursor(commit=False) as cur:
        cur.execute("""
            SELECT a.id, a.title, a.description, a.owner, a.deadline, a.status,
                   a.trello_card_id, a.trello_card_url,
                   COALESCE(t.title, 'CommitFlow Meeting') as "meeting_title"
            FROM action_items a
            LEFT JOIN transcripts t ON a.transcript_id = t.id
            WHERE a.id = %s;
        """, (action_id,))
        item = cur.fetchone()

    if not item:
        return jsonify({"error": "Action item not found."}), 404

    if item.get("status") != "Approved":
        return jsonify({"error": "Only approved action items can be exported to project boards. Please review and approve the task first."}), 400

    desc_parts = []
    if item.get("description"):
        desc_parts.append(item["description"])
    if item.get("owner"):
        desc_parts.append(f"👤 Assignee: {item['owner']}")
    if item.get("deadline") and item["deadline"] != "Unspecified":
        desc_parts.append(f"⏰ Deadline: {item['deadline']}")
    if item.get("meeting_title"):
        desc_parts.append(f"📌 Source: {item['meeting_title']}")
    card_desc = "\n\n".join(desc_parts)

    if item.get("trello_card_id"):
        trello_service.update_card(
            item["trello_card_id"],
            title=item["title"],
            description=card_desc,
            status=item.get("status")
        )
        return jsonify({
            "message": "Trello card updated.",
            "cardId": item["trello_card_id"],
            "cardUrl": item.get("trello_card_url")
        }), 200
    else:
        card = trello_service.create_card(
            title=item["title"],
            description=card_desc,
            status=item.get("status")
        )
        if not card:
            return jsonify({"error": "Failed to create Trello card."}), 500

        db.link_action_item_trello(action_id, card["id"], card.get("url", ""))
        return jsonify({
            "message": "Exported to Trello successfully!",
            "cardId": card["id"],
            "cardUrl": card.get("url")
        }), 200

@app.route("/api/trello/board", methods=["GET"])
def trello_board_endpoint():
    """Retrieve board view organized into To Do, In Progress, and Done columns."""
    data = trello_service.get_trello_board_cards()
    return jsonify(data), 200

@app.route("/api/trello/cards", methods=["POST"])
def trello_create_card_endpoint():
    """Create a new task card both on Trello and in CommitFlow."""
    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip()
    description = data.get("description", "").strip()
    status = data.get("status", "Pending Approval")
    deadline = data.get("deadline", "Unspecified")

    if not title:
        return jsonify({"error": "Title is required."}), 400

    card = trello_service.create_card(title=title, description=description, status=status)
    card_id = card["id"] if card else None
    card_url = card.get("url") if card else None

    saved = db.upsert_action_item_from_trello(
        trello_card_id=card_id or f"cf-task-{uuid.uuid4().hex[:6]}",
        title=title,
        description=description,
        status=status,
        deadline=deadline,
        trello_card_url=card_url
    )
    return jsonify({"message": "Task created successfully.", "task": saved, "trelloCard": card}), 201

@app.route("/api/trello/cards/<card_id>", methods=["PUT"])
def trello_update_card_endpoint(card_id):
    """Update or move card status on Trello and update in CommitFlow."""
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    title = data.get("title")
    description = data.get("description")

    trello_service.update_card(card_id, title=title, description=description, status=status)

    if status and db.get_connection_url():
        with db.get_db_cursor(commit=True) as cur:
            cur.execute("UPDATE action_items SET status = %s WHERE trello_card_id = %s;", (status, card_id))

    return jsonify({"message": "Card updated successfully."}), 200

# -------------------------------------------------------------
# REST API Endpoints: Administrator Panel
# -------------------------------------------------------------

@app.route("/api/admin/stats", methods=["GET"])
@require_admin
def admin_stats():
    """Platform-wide database-backed statistics."""
    stats = db.get_admin_stats()
    if stats is None:
        return jsonify({"error": "Unable to calculate platform statistics."}), 500
    return jsonify(stats), 200

@app.route("/api/admin/users", methods=["GET"])
@require_admin
def admin_users_list():
    """List, search, and filter registered users."""
    search = request.args.get("search", "").strip() or None
    role = request.args.get("role", "").strip() or None
    status = request.args.get("status", "").strip() or None
    limit = min(int(request.args.get("limit", 100)), 200)
    offset = int(request.args.get("offset", 0))

    users = db.list_users(search=search, role=role, status=status, limit=limit, offset=offset)
    return jsonify({"users": users}), 200

@app.route("/api/admin/users/<user_id>/status", methods=["PUT"])
@require_admin
def admin_update_user_status(user_id):
    """Activate or deactivate a user account with last-active-admin safeguard."""
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    if not new_status:
        return jsonify({"error": "Status is required ('active' or 'deactivated')."}), 400
    try:
        db.update_user_status(user_id, new_status, actor_admin=request.current_user)
        return jsonify({"message": f"User status updated to '{new_status}' successfully."}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error updating user status: {e}")
        return jsonify({"error": "Failed to update user status."}), 500

@app.route("/api/admin/users/<user_id>/role", methods=["PUT"])
@require_admin
def admin_update_user_role(user_id):
    """Promote or demote a user role with last-active-admin safeguard."""
    data = request.get_json(silent=True) or {}
    new_role = data.get("role")
    if not new_role or new_role not in ('user', 'team_lead', 'admin'):
        return jsonify({"error": "Role is required ('user', 'team_lead', or 'admin')."}), 400
    try:
        db.update_user_role(user_id, new_role, actor_admin=request.current_user)
        return jsonify({"message": f"User role updated to '{new_role}' successfully."}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error updating user role: {e}")
        return jsonify({"error": "Failed to update user role."}), 500

@app.route("/api/admin/meetings", methods=["GET"])
@require_admin
def admin_meetings_list():
    """Platform-wide authorized meeting metadata oversight."""
    limit = min(int(request.args.get("limit", 50)), 100)
    offset = int(request.args.get("offset", 0))
    meetings = db.get_admin_meetings_overview(limit=limit, offset=offset)
    return jsonify({"meetings": meetings}), 200

@app.route("/api/admin/meetings/<meeting_id>/investigate", methods=["GET"])
@require_admin
def admin_investigate_meeting(meeting_id):
    """
    Controlled administrative inspection of sensitive meeting content for support/audit purposes.
    Explicitly logs this access in audit_logs.
    """
    db.log_audit_event(
        request.current_user["id"],
        request.current_user["email"],
        "ADMIN_INVESTIGATE_MEETING",
        {"meetingId": meeting_id},
        request.remote_addr
    )
    meeting = db.get_transcript_by_id(meeting_id, is_admin=True)
    if not meeting:
        return jsonify({"error": "Meeting transcript not found."}), 404
    return jsonify(meeting), 200

@app.route("/api/admin/audit-logs", methods=["GET"])
@require_admin
def admin_audit_logs():
    """Retrieve immutable audit logs."""
    limit = min(int(request.args.get("limit", 50)), 100)
    offset = int(request.args.get("offset", 0))
    action_filter = request.args.get("action", "").strip() or None
    logs = db.list_audit_logs(limit=limit, offset=offset, action_filter=action_filter)
    return jsonify({"logs": logs}), 200

@app.route("/api/admin/system-health", methods=["GET"])
@require_admin
def admin_system_health():
    """Protected health status and connectivity metrics for administrators."""
    import platform
    db_ok, db_msg = db.check_connection()
    ai_ok, ai_msg = ai.check_gemini_status()
    _, model_name = ai.get_gemini_config()
    lk_ok, lk_msg = livekit_service.check_livekit_status()
    stats = db.get_admin_stats() or {}

    return jsonify({
        "status": "healthy" if db_ok and ai_ok and lk_ok else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": {
            "status": "connected" if db_ok else "error",
            "message": db_msg,
            "provider": "Neon PostgreSQL",
            "activeAdmins": db.count_active_admins()
        },
        "ai": {
            "status": "configured" if ai_ok else "unconfigured",
            "model": model_name,
            "provider": "Google Gemini",
            "message": ai_msg
        },
        "livekit": {
            "status": "configured" if lk_ok else "unconfigured",
            "message": lk_msg
        },
        "system": {
            "pythonVersion": platform.python_version(),
            "os": platform.system(),
            "totalUsers": stats.get("total_users", 0),
            "totalMeetings": stats.get("total_meetings", 0)
        }
    }), 200

@app.route("/api/admin/settings", methods=["GET"])
@require_admin
def admin_get_settings():
    """Retrieve platform configuration settings."""
    settings = db.get_platform_settings()
    return jsonify({"settings": settings}), 200

@app.route("/api/admin/settings", methods=["PUT"])
@require_admin
def admin_update_settings():
    """Update platform configuration."""
    data = request.get_json(silent=True) or {}
    try:
        db.update_platform_settings(data, actor_admin=request.current_user)
        return jsonify({
            "message": "Platform settings updated successfully.",
            "settings": db.get_platform_settings()
        }), 200
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        return jsonify({"error": "Failed to update platform settings."}), 500

# -------------------------------------------------------------
# Frontend Application & Landing Page Serving
# -------------------------------------------------------------

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend_or_status(path):
    """
    Serves the built React SPA for non-API routes.
    If the frontend dist folder is not yet built, renders a friendly status dashboard.
    """
    if path.startswith("api"):
        return jsonify({"error": f"API endpoint '/{path}' not found."}), 404

    # 1. Check if built frontend static file exists in dist
    if os.path.exists(DIST_DIR):
        file_path = os.path.join(DIST_DIR, path)
        if path and os.path.exists(file_path) and os.path.isfile(file_path):
            return send_from_directory(DIST_DIR, path)
        
        # SPA fallback: return index.html for client-side routing
        index_file = os.path.join(DIST_DIR, "index.html")
        if os.path.exists(index_file):
            return send_from_directory(DIST_DIR, "index.html")

    # 2. If dist is not present, render a clean status landing dashboard
    db_ok, db_msg = db.check_connection()
    ai_ok, ai_msg = ai.check_gemini_status()

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CommitFlow Backend Service</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(circle at 50% 10%, #172138, #0a0d14);
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
    }}
    .card {{
      background: rgba(18, 25, 42, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(16px);
      border-radius: 16px;
      padding: 36px;
      max-width: 620px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
    }}
    h1 {{
      font-size: 24px;
      margin-top: 0;
      margin-bottom: 8px;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 10px;
    }}
    .badge {{
      display: inline-block;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 20px;
    }}
    .badge-ok {{ background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.35); }}
    .badge-warn {{ background: rgba(234, 179, 8, 0.15); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.35); }}
    .status-row {{
      background: rgba(255, 255, 255, 0.04);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
    }}
    .links {{
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }}
    a {{
      color: #38bdf8;
      text-decoration: none;
      font-weight: 500;
    }}
    a:hover {{ text-decoration: underline; }}
    .btn {{
      display: inline-block;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #ffffff;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      margin-top: 16px;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }}
    .btn:hover {{
      background: linear-gradient(135deg, #1d4ed8, #1e40af);
      text-decoration: none;
    }}
  </style>
</head>
<body>
  <div class="card">
    <h1>CommitFlow Backend Service</h1>
    <span class="badge badge-ok">&#9679; Online on Port {os.getenv('PORT', 5000)}</span>

    <div class="status-row">
      <span><strong>Neon PostgreSQL:</strong> {db_msg}</span>
      <span class="badge {'badge-ok' if db_ok else 'badge-warn'}">{'Connected' if db_ok else 'Fallback'}</span>
    </div>

    <div class="status-row">
      <span><strong>Google Gemini AI:</strong> {ai_msg}</span>
      <span class="badge {'badge-ok' if ai_ok else 'badge-warn'}">{'Ready' if ai_ok else 'Fallback'}</span>
    </div>

    <div class="links">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #94a3b8;">Direct API Endpoints:</p>
      <ul style="margin: 0 0 16px 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
        <li><a href="/api/health">/api/health</a> &mdash; System & credential status</li>
        <li><a href="/api/transcripts">/api/transcripts</a> &mdash; Transcripts list & upload</li>
        <li><a href="/api/action-items">/api/action-items</a> &mdash; Tracked action items</li>
      </ul>
      <a class="btn" href="http://localhost:5173" target="_blank">Open Vite Frontend (http://localhost:5173) &rarr;</a>
    </div>
  </div>
</body>
</html>""", 200

# -------------------------------------------------------------
# Admin Teams Management Endpoints (Strictly require_admin)
# -------------------------------------------------------------

@app.route("/api/admin/teams", methods=["GET"])
@require_admin
def admin_list_teams():
    """Retrieve all teams with assigned leads, member count, and meeting count."""
    teams = db.get_teams()
    return jsonify({"teams": teams}), 200

@app.route("/api/admin/teams", methods=["POST"])
@require_admin
def admin_create_team():
    """Create a new team and optionally assign a Team Lead."""
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    description = data.get("description", "").strip()
    lead_id = data.get("leadId")
    if not name:
        return jsonify({"error": "Team name is required."}), 400
    try:
        team = db.create_team(name=name, description=description, lead_id=lead_id)
        db.log_audit_event(
            request.current_user["id"],
            request.current_user["email"],
            "TEAM_CREATED",
            {"teamId": team["id"], "teamName": name, "leadId": lead_id},
            request.remote_addr
        )
        return jsonify({"message": "Team created successfully.", "team": team}), 201
    except Exception as e:
        logger.error(f"Error creating team: {e}")
        return jsonify({"error": str(e)}), 400

@app.route("/api/admin/teams/<team_id>", methods=["PUT"])
@require_admin
def admin_update_team(team_id):
    """Update team details and reassign lead."""
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    description = data.get("description", "").strip()
    lead_id = data.get("leadId")
    if not name:
        return jsonify({"error": "Team name is required."}), 400
    try:
        team = db.update_team(team_id, name=name, description=description, lead_id=lead_id)
        db.log_audit_event(
            request.current_user["id"],
            request.current_user["email"],
            "TEAM_UPDATED",
            {"teamId": team_id, "teamName": name, "leadId": lead_id},
            request.remote_addr
        )
        return jsonify({"message": "Team updated successfully.", "team": team}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/admin/teams/<team_id>", methods=["DELETE"])
@require_admin
def admin_delete_team(team_id):
    """Delete a team."""
    try:
        ok = db.delete_team(team_id)
        if not ok:
            return jsonify({"error": "Team not found."}), 404
        db.log_audit_event(
            request.current_user["id"],
            request.current_user["email"],
            "TEAM_DELETED",
            {"teamId": team_id},
            request.remote_addr
        )
        return jsonify({"message": "Team deleted successfully."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/teams/<team_id>/members", methods=["GET"])
@require_admin
def admin_get_team_members(team_id):
    """List members belonging to a team."""
    members = db.get_team_members(team_id)
    return jsonify({"members": members}), 200

@app.route("/api/admin/teams/<team_id>/members", methods=["POST"])
@require_admin
def admin_add_team_member(team_id):
    """Add a member to a team."""
    data = request.get_json(silent=True) or {}
    user_id = data.get("userId")
    role = data.get("role", "member")
    if not user_id:
        return jsonify({"error": "User ID is required."}), 400
    try:
        db.add_team_member(team_id, user_id, role=role)
        return jsonify({"message": "Member added to team successfully."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/admin/teams/<team_id>/members/<user_id>", methods=["DELETE"])
@require_admin
def admin_remove_team_member(team_id, user_id):
    """Remove a member from a team."""
    try:
        db.remove_team_member(team_id, user_id)
        return jsonify({"message": "Member removed from team."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/admin/eligible-leads", methods=["GET"])
@require_admin
def admin_eligible_leads():
    """Retrieve users eligible to be assigned as team leads."""
    leads = db.get_eligible_team_leads()
    return jsonify({"leads": leads}), 200

# -------------------------------------------------------------
# Team Lead Dedicated Endpoints (Strictly require_team_lead)
# -------------------------------------------------------------

@app.route("/api/team-lead/dashboard", methods=["GET"])
@require_team_lead
def team_lead_dashboard():
    """Retrieve authorized team overview, member counts, upcoming meetings, and action items."""
    user_id = request.current_user["id"]
    data = db.get_team_lead_stats(user_id)
    return jsonify(data), 200

@app.route("/api/team-lead/team", methods=["GET"])
@require_team_lead
def team_lead_team_details():
    """Retrieve Team Lead's assigned team details and real member list with metrics."""
    user_id = request.current_user["id"]
    team = db.get_team_by_lead_id(user_id)
    if not team:
        return jsonify({"hasTeam": False, "team": None, "members": []}), 200
    members = db.get_team_members(team["id"])
    return jsonify({"hasTeam": True, "team": team, "members": members}), 200

@app.route("/api/team-lead/team/members", methods=["POST"])
@require_team_lead
def team_lead_add_member():
    """Add a registered user to the Team Lead's authorized team."""
    user_id = request.current_user["id"]
    team = db.get_team_by_lead_id(user_id)
    if not team:
        return jsonify({"error": "No assigned team found for this Team Lead."}), 404
    data = request.get_json(silent=True) or {}
    target_user_id = data.get("userId")
    if not target_user_id:
        return jsonify({"error": "User ID is required."}), 400
    try:
        db.add_team_member(team["id"], target_user_id, role="member")
        return jsonify({"message": "Member added to team successfully."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/team-lead/team/members/<target_user_id>", methods=["DELETE"])
@require_team_lead
def team_lead_remove_member(target_user_id):
    """Remove a member from the Team Lead's authorized team."""
    user_id = request.current_user["id"]
    team = db.get_team_by_lead_id(user_id)
    if not team:
        return jsonify({"error": "No assigned team found for this Team Lead."}), 404
    try:
        db.remove_team_member(team["id"], target_user_id)
        return jsonify({"message": "Member removed from team."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/team-lead/available-users", methods=["GET"])
@require_team_lead
def team_lead_available_users():
    """Retrieve registered users who are not yet members of this team."""
    user_id = request.current_user["id"]
    team = db.get_team_by_lead_id(user_id)
    if not team:
        return jsonify({"users": []}), 200
    users = db.get_available_users_for_team(team["id"])
    return jsonify({"users": users}), 200

@app.route("/api/team-lead/meetings", methods=["GET"])
@require_team_lead
def team_lead_meetings():
    """Retrieve meetings belonging to Team Lead's team."""
    user_id = request.current_user["id"]
    team = db.get_team_by_lead_id(user_id)
    if not team:
        return jsonify({"meetings": []}), 200
    limit = min(int(request.args.get("limit", 50)), 100)
    offset = int(request.args.get("offset", 0))
    meetings = db.get_team_meetings(team["id"], limit=limit, offset=offset)
    return jsonify({"meetings": meetings}), 200

@app.route("/api/team-lead/meetings", methods=["POST"])
@require_team_lead
def team_lead_create_meeting():
    """Create and schedule a meeting for this team using real team members."""
    user_id = request.current_user["id"]
    team = db.get_team_by_lead_id(user_id)
    if not team:
        return jsonify({"error": "No team assigned."}), 404
    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip()
    scheduled_at = data.get("scheduledAt")
    duration = data.get("duration", "30 min")
    participant_ids = data.get("participantIds", [])
    if not title:
        return jsonify({"error": "Meeting title is required."}), 400
    try:
        meeting = db.create_team_meeting(
            title=title,
            host_id=user_id,
            team_id=team["id"],
            scheduled_at=scheduled_at,
            duration=duration,
            participant_ids=participant_ids
        )
        return jsonify({"message": "Team meeting scheduled successfully.", "meeting": meeting}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/team-lead/calendar", methods=["GET"])
@require_team_lead
def team_lead_calendar():
    """Retrieve calendar meetings for Team Lead."""
    user_id = request.current_user["id"]
    now = datetime.now(timezone.utc)
    try:
        year = int(request.args.get("year", now.year))
        month = int(request.args.get("month", now.month))
    except (ValueError, TypeError):
        year = now.year
        month = now.month
    meetings = db.get_calendar_meetings(user_id=user_id, year=year, month=month, is_admin=False)
    return jsonify({"year": year, "month": month, "meetings": meetings}), 200

@app.route("/api/team-lead/transcripts", methods=["GET"])
@require_team_lead
def team_lead_transcripts():
    """Retrieve meeting transcripts and summaries for Team Lead's team."""
    user_id = request.current_user["id"]
    team = db.get_team_by_lead_id(user_id)
    if not team:
        return jsonify({"transcripts": []}), 200
    transcripts = db.get_team_transcripts(team["id"])
    return jsonify({"transcripts": transcripts}), 200

@app.route("/api/team-lead/transcripts/<transcript_id>/analysis", methods=["GET"])
@require_team_lead
def team_lead_analysis(transcript_id):
    """Retrieve AI analysis, decisions, and questions for team meeting transcript."""
    meeting = db.get_transcript_by_id(transcript_id, is_admin=False)
    if not meeting:
        meeting = db.get_transcript_by_id(transcript_id, is_admin=True)
    if not meeting:
        return jsonify({"error": "Meeting analysis not found."}), 404
    return jsonify(meeting), 200

@app.route("/api/team-lead/action-items", methods=["GET"])
@require_team_lead
def team_lead_action_items():
    """Retrieve action items for this team's meetings with assigned member details."""
    user_id = request.current_user["id"]
    team = db.get_team_by_lead_id(user_id)
    if not team:
        return jsonify({"actionItems": []}), 200
    items = db.get_team_action_items(team["id"])
    return jsonify({"actionItems": items}), 200

@app.route("/api/team-lead/action-items/<action_id>/assign", methods=["PUT"])
@require_team_lead
def team_lead_assign_action(action_id):
    """Assign an action item to a valid team member."""
    user_id = request.current_user["id"]
    team = db.get_team_by_lead_id(user_id)
    if not team:
        return jsonify({"error": "No assigned team found."}), 404
    data = request.get_json(silent=True) or {}
    assignee_id = data.get("assigneeId")
    if not assignee_id:
        return jsonify({"error": "Assignee user ID is required."}), 400
    try:
        db.assign_team_action_item(action_id, assignee_id, team_id=team["id"])
        return jsonify({"message": "Action item assigned successfully."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/team-lead/action-items/<action_id>", methods=["PUT"])
@require_team_lead
def team_lead_update_action(action_id):
    """Update task status or deadline for a team action item."""
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    deadline = data.get("deadline")
    try:
        db.update_team_action_item(action_id, status=status, deadline=deadline)
        return jsonify({"message": "Action item updated successfully."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/team-lead/reports", methods=["GET"])
@require_team_lead
def team_lead_reports():
    """Retrieve team meeting, attendance, and action item metrics."""
    user_id = request.current_user["id"]
    team = db.get_team_by_lead_id(user_id)
    if not team:
        return jsonify({"reports": None}), 200
    reports = db.get_team_reports(team["id"])
    return jsonify({"reports": reports}), 200

@app.route("/api/team-lead/follow-ups", methods=["GET"])
@require_team_lead
def team_lead_follow_ups():
    """Retrieve unresolved questions and follow-ups scoped to team lead permissions."""
    user_id = request.current_user["id"]
    status_filter = request.args.get("status")
    if db.get_connection_url():
        questions = db.list_unresolved_questions(
            user_id=user_id,
            is_admin=False,
            is_team_lead=True,
            status_filter=status_filter
        )
        return jsonify(questions), 200
    return jsonify([]), 200

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    logger.info(f"CommitFlow Flask server starting on http://localhost:{port}...")
    app.run(host="0.0.0.0", port=port, debug=False)
