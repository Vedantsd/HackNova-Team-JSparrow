# CommitFlow — Meeting-to-Execution Platform

**CommitFlow** turns conversations into structured, trackable, and human-approved action. It connects **Neon PostgreSQL** as its persistent database and the **Google Gemini API** for automated transcript analysis and task extraction.

---

## 1. Architecture Overview

- **Frontend:** React 18 + Vite (SPA) with sleek glassmorphism design system, dark/light theme, and live meeting room.
- **Backend API:** Python Flask REST API (`server/app.py`) running on `http://localhost:5000`.
- **Database:** Neon Serverless PostgreSQL with connection pooling (`psycopg2-binary`) and automatic relational schema initialization.
- **AI Engine:** Official Google Gemini API (`google-genai` SDK) with structured Pydantic schema validation and grounded fact extraction.
- **Human Governance:** All AI-extracted action items default to `Pending Approval` and require user confirmation or editing before dispatch.

---

## 2. Environment Variables Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set your values in `.env`:

```env
# Neon PostgreSQL Connection URL (SSL is automatically required)
DATABASE_URL=postgresql://<user>:<password>@<neon-hostname>/<dbname>?sslmode=require

# Google Gemini API Key from Google AI Studio (https://aistudio.google.com/)
GEMINI_API_KEY=your_gemini_api_key_here

# Gemini Model (default: gemini-1.5-flash)
GEMINI_MODEL=gemini-1.5-flash

# Backend Port (default: 5000)
PORT=5000
```

> **Security Note:** `.env` is listed in `.gitignore`. Never commit API keys or database credentials to version control.

---

## 3. Installation & Setup

### Prerequisites
- Node.js v18+ and npm
- Python 3.10+ and pip

### Step 1: Install Backend Dependencies
```bash
pip install -r requirements.txt
```

### Step 2: Install Frontend Dependencies
```bash
npm install
```

---

## 4. Running the Application

### Single Command (Recommended)

Start both the backend and frontend simultaneously with one command:

```powershell
python start.py
# or on Windows, simply run:
start.bat
```

*This automatically starts the Flask backend on port 5000, starts the Vite frontend on port 5173, streams color-coded output, and opens your browser.*

### Alternative: Run in Separate Terminals

**Terminal 1 (Backend API):**
```bash
python server/app.py
```

**Terminal 2 (Frontend Dev Server):**
```bash
npm run dev
```

---

## 5. Verification & Health Check

Verify database and Gemini connectivity at any time:

```bash
curl http://localhost:5000/api/health
```

Expected JSON response:
```json
{
  "status": "ok",
  "database": {
    "configured": true,
    "connected": true,
    "type": "Neon PostgreSQL",
    "message": "Connected successfully to Neon PostgreSQL."
  },
  "gemini": {
    "configured": true,
    "message": "Gemini API key is configured and ready.",
    "model": "gemini-1.5-flash"
  }
}
```

---

## 6. Database Schema (Neon PostgreSQL)

On backend startup, `server/db.py` automatically creates the relational schema:
- `transcripts`: Stores uploaded transcript records, metadata, durations, and processing statuses (`Processing`, `Processed`, `Failed`).
- `meeting_summaries`: Stores meeting overviews, key discussion points, and outcomes.
- `decisions`: Stores key decisions with source speaker and quote evidence.
- `action_items`: Stores tasks, assignees, deadlines, priorities, status (`Pending Approval`, `Approved`, `Rejected`), and speaker quotes.
- `unresolved_questions`: Stores unanswered questions and ambiguities identified in dialogue.

---

## 7. Graceful Fallback Mode

If `DATABASE_URL` or `GEMINI_API_KEY` are not set yet:
- The backend continues running safely without throwing unhandled exceptions.
- The health endpoint (`/api/health`) reports the missing credentials.
- Transcript processing uses the built-in rule-based analysis engine so you can test the end-to-end UI workflow before adding credentials.
