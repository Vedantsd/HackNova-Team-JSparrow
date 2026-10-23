"""
CommitFlow Flask Backend API
REST endpoints for Transcripts, Neon PostgreSQL, and Google Gemini AI analysis.
"""

import os
import threading
import logging
import uuid
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

app = Flask(
    __name__,
    static_folder=DIST_DIR if os.path.exists(DIST_DIR) else None,
    static_url_path="/"
)
# Enable CORS for frontend requests
CORS(app, resources={r"/api/*": {"origins": "*"}})

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
# REST API Endpoints
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
    """List all meeting transcripts."""
    # Try Neon PostgreSQL
    if db.get_connection_url():
        try:
            records = db.list_transcripts()
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
        "unresolvedQuestions": []
    }

    # Save to PostgreSQL
    if db.get_connection_url():
        try:
            db.insert_transcript(tx_record)
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
    """Retrieve complete transcript details and structured analysis."""
    if db.get_connection_url():
        try:
            record = db.get_transcript_by_id(tx_id)
            if record:
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
    """Retrieve all action items across meetings."""
    if db.get_connection_url():
        try:
            items = db.list_all_action_items()
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
