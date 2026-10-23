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
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

try:
    import db
    import ai
except ImportError:
    from server import db
    from server import ai

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
    """Extract and validate current authenticated user from session cookie or Authorization header."""
    token = request.cookies.get("cf_session")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
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

def process_transcript_async(tx_id, text, title):
    """Processes transcript using Gemini in a background thread."""
    logger.info(f"Starting Gemini transcript analysis for ID '{tx_id}'...")
    try:
        analysis_data = ai.analyze_transcript(text, title)

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
    """Health check endpoint reporting Neon database and Gemini AI status."""
    db_ok, db_msg = db.check_connection()
    ai_ok, ai_msg = ai.check_gemini_status()
    _, model_name = ai.get_gemini_config()

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
        }
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

    # Launch Gemini processing in background thread
    threading.Thread(
        target=process_transcript_async,
        args=(tx_id, text, title),
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

    threading.Thread(
        target=process_transcript_async,
        args=(tx_id, tx_text, tx_title),
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

@app.route("/api/action-items/<action_id>/approve", methods=["POST"])
def approve_action_item_endpoint(action_id):
    """Approve action item (human-in-the-loop task governance)."""
    if db.get_connection_url():
        success = db.update_action_item_status(action_id, "Approved")
        if success:
            return jsonify({"id": action_id, "status": "Approved"}), 200

    # Fallback
    for tx in _mem_store["transcripts"].values():
        for a in tx.get("actionItems", []):
            if a.get("id") == action_id:
                a["status"] = "Approved"
                return jsonify({"id": action_id, "status": "Approved"}), 200

    return jsonify({"error": "Action item not found."}), 404

@app.route("/api/action-items/<action_id>/reject", methods=["POST"])
def reject_action_item_endpoint(action_id):
    """Reject action item."""
    if db.get_connection_url():
        success = db.update_action_item_status(action_id, "Rejected")
        if success:
            return jsonify({"id": action_id, "status": "Rejected"}), 200

    # Fallback
    for tx in _mem_store["transcripts"].values():
        for a in tx.get("actionItems", []):
            if a.get("id") == action_id:
                a["status"] = "Rejected"
                return jsonify({"id": action_id, "status": "Rejected"}), 200

    return jsonify({"error": "Action item not found."}), 404

@app.route("/api/action-items/<action_id>", methods=["PUT"])
def edit_action_item_endpoint(action_id):
    """Edit action item details."""
    updates = request.get_json(silent=True) or {}
    if db.get_connection_url():
        success = db.edit_action_item(action_id, updates)
        if success:
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
                return jsonify({"id": action_id, "message": "Updated successfully."}), 200

    return jsonify({"error": "Action item not found."}), 404

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
    if not new_role:
        return jsonify({"error": "Role is required ('user' or 'admin')."}), 400
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
    stats = db.get_admin_stats() or {}

    return jsonify({
        "status": "healthy" if db_ok and ai_ok else "degraded",
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

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    logger.info(f"CommitFlow Flask server starting on http://localhost:{port}...")
    app.run(host="0.0.0.0", port=port, debug=False)
