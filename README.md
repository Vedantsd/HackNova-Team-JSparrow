# CommitFlow — Meeting-to-Execution Automation Agent
### HACKNOVA'26 — Problem Statement 4 (PS-4)

[![React 18](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61dafb?logo=react)](https://react.dev/)
[![Python 3.10+](https://img.shields.io/badge/Backend-Python%203.10%2B%20%7C%20Flask-3776AB?logo=python)](https://flask.palletsprojects.com/)
[![Neon PostgreSQL](https://img.shields.io/badge/Database-Neon%20Serverless%20PostgreSQL-00e599?logo=postgresql)](https://neon.tech/)
[![Google Gemini](https://img.shields.io/badge/AI%20Engine-Google%20Gemini%203.5%20Flash--Lite-4285F4?logo=google)](https://aistudio.google.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

CommitFlow transforms unstructured meeting conversations and transcripts into structured, verifiable, and human-governed execution pipelines. Built for **HACKNOVA'26 (Team J.Sparrow)**, it eliminates post-meeting coordination overhead by extracting concrete commitments, isolating unconfirmed suggestions, mapping decisions directly to verbatim transcript evidence, detecting duplicate or conflicting deadlines, and synchronizing approved tasks directly to external PM boards.

---

## Table of Contents

1. [Problem Statement & Core Innovations](#1-problem-statement--core-innovations)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Key Capabilities & Modules](#3-key-capabilities--modules)
4. [Role-Based Access Control (RBAC) & Default Accounts](#4-role-based-access-control-rbac--default-accounts)
5. [Project Directory Layout](#5-project-directory-layout)
6. [Prerequisites & Environment Configuration](#6-prerequisites--environment-configuration)
7. [Installation & Setup](#7-installation--setup)
8. [Running CommitFlow](#8-running-commitflow)
9. [Meeting Analysis Deep Dive](#9-meeting-analysis-deep-dive)
10. [REST API Documentation](#10-rest-api-documentation)
11. [PostgreSQL Database Relational Schema](#11-postgresql-database-relational-schema)
12. [Testing & Quality Assurance](#12-testing--quality-assurance)
13. [Team Members](#13-team-members)

---

## 1. Problem Statement & Core Innovations

In modern engineering teams, valuable agreements made during sprint syncs, retrospectives, and architecture reviews often fail to translate into execution. CommitFlow solves this with strict algorithmic principles:

* **Strict Deliverable Classification:** Distinguishes concrete **commitments** ("Rahul will implement Redis connector by Friday at 5 PM") from exploratory **suggestions** ("maybe dark mode in a future sprint") and **unresolved questions**. Suggestions are never converted into approved tasks.
* **Ground-Truth Traceability & Zero Hallucination:** Every extracted decision and action item is bound to its source speech turn, speaker name, and verbatim quote with clickable passage navigation.
* **Automatic Ambiguity Resolution:** Relative deadlines (e.g., *"by next Wednesday at 2 PM"*) are resolved into ISO timestamps (`YYYY-MM-DD HH:MM`) based on meeting date context. Unassigned items are flagged with `ownerStatus: "ambiguous"`.
* **Duplicate & Scheduling Conflict Detection:** Compares newly extracted tasks against existing database items to detect overlapping deadlines and duplicate assignments before task dispatch.
* **Human-in-the-Loop Governance:** AI extraction defaults to `Pending Approval`. Team leads and owners retain full authority to edit, approve, or reject tasks before board synchronization.
* **Native External PM Synchronization:** One-click dispatch of approved tasks into Trello boards, downloadable structured JSON, and CSV spreadsheets.

---

## 2. High-Level Architecture

```
                  ┌──────────────────────────────────────────────────┐
                  │                 CommitFlow Client                │
                  │   React 18 + Vite SPA | Glassmorphism System     │
                  │   Roles: Admin | Team Lead | Team Member         │
                  └──────────────┬───────────────────▲───────────────┘
                                 │ REST API (JSON)   │
                                 ▼                   │
                  ┌──────────────────────────────────┴───────────────┐
                  │            Python Flask REST API                 │
                  │              (server/app.py)                     │
                  │  RBAC Auth | Owner Matcher | Conflict Engine     │
                  └──────┬───────────────────────────▲───────────────┘
                         │                           │
          ┌──────────────┴──────────────┐     ┌──────┴────────────────────────┐
          │     Google Gemini API       │     │     Neon Serverless PostgreSQL │
          │   (gemini-3.5-flash-lite)   │     │  Transcripts | Decisions | DB  │
          │  Structured Pydantic Schema │     │  Action Items | Summaries      │
          └─────────────────────────────┘     └───────────────────────────────┘
```

---

## 3. Key Capabilities & Modules

### 1. Live Video & Audio Meeting Room (`/room/:roomId`)
- Built-in WebRTC video conferencing with camera, microphone, screen sharing, and real-time meeting chat.
- Live speech-to-text recording with instant speech turn parsing.
- Instant transition from meeting conclusion to automated AI analysis.

### 2. Transcript Ingestion Pipeline (`/user/transcripts`)
- Supports `.txt`, `.docx`, and `.pdf` transcript uploads.
- Background asynchronous processing with real-time status polling (`Processing` $\rightarrow$ `Processed` / `Failed`).
- Idempotent analysis with retry capability and safe error reporting.

### 3. Dedicated Meeting Analysis Page (`/user/transcripts/:id/analysis`)
Contains strictly the three core intelligence sections:
1. **AI Meeting Summary:** Executive overview, numbered key discussion points with quick evidence verification links, and expected outcomes.
2. **Decisions & Agreements:** Confirmed architectural and product consensus cards with speaker attribution and verbatim quotes.
3. **Transcript Evidence:** Verbatim transcript speech turns with speaker avatars, source timestamps (never fabricated), dialogue search, and interactive bidirectional quote highlighting.

### 4. Human-Governed Action Items (`/user/action-items`)
- Filter by status (`Pending Approval`, `Approved`, `Rejected`), priority (`High`, `Medium`, `Low`), deliverable type (`Commitment` vs `Suggestion`), and assignee.
- Bulk approval for eligible commitments.
- Inline task editor for owners, deadlines, priority, and descriptions.
- Export to formatted CSV and structured JSON.

### 5. Follow-ups & Ambiguities Tracker (`/user/follow-ups`)
- Dedicated tracking for items flagged with missing owners, unconfirmed deadlines, or open architectural questions.
- Resolution modal allowing team leads to assign owners, establish deadlines, and convert ambiguities directly into sprint tasks.

### 6. Interactive Trello Integration (`/user/trello`)
- Interactive Kanban board (To Do, In Progress, In Review, Done).
- Direct synchronization of approved action items to Trello lists via Trello REST API credentials.

### 7. Administrative & Team Lead Portals
- **Admin Panel (`/admin/*`):** User management, team management, platform analytics, system health monitors, and audit logs.
- **Team Lead Panel (`/team-lead/*`):** Team members performance, meeting analytics, approval workflows, and reports.

---

## 4. Role-Based Access Control (RBAC) & Default Accounts

CommitFlow enforces strict 3-tier Role-Based Access Control on both frontend routes and backend REST endpoints:

| Role | Permissions | Access Scope |
| :--- | :--- | :--- |
| **Admin** | Full system control, user provisioning, role assignments, system health, audit logs | `/admin/*`, `/user/*` |
| **Team Lead** | Team management, task approvals, ambiguity resolutions, team analytics, reports | `/team-lead/*`, `/user/*` |
| **User (Team Member)** | View assigned tasks, view transcripts, inspect meeting analysis, participate in live meetings | `/user/*` |

### Default Seeded Accounts

The database is automatically pre-seeded with these demonstration credentials:

| Name | Role | Email | Password |
| :--- | :--- | :--- | :--- |
| **CommitFlow Admin** | `admin` | `admin@commitflow.dev` | `Admin@CommitFlow2026!` |
| **Aditi Sharma** | `team_lead` | `aditi@commitflow.dev` | `Lead@CommitFlow2026!` |
| **Rahul Patil** | `user` | `rahul@commitflow.dev` | `User@CommitFlow2026!` |
| **Neha Kulkarni** | `user` | `neha@commitflow.dev` | `User@CommitFlow2026!` |
| **Arjun Deshmukh** | `user` | `arjun@commitflow.dev` | `User@CommitFlow2026!` |

---

## 5. Project Directory Layout

```
HACKNOVA/
├── .env.example                     # Environment template configuration
├── index.html                       # Single Page Application HTML root
├── package.json                     # Frontend dependencies & Vite scripts
├── requirements.txt                 # Backend Python package requirements
├── start.py                         # Unified parallel launcher (Backend + Frontend)
├── start.bat                        # Windows batch launcher shortcut
├── vite.config.js                   # Vite configuration
│
├── server/                          # Flask Python Backend
│   ├── app.py                       # REST API routing & application lifecycle
│   ├── db.py                        # Neon PostgreSQL connection pool & schema
│   ├── ai.py                        # Google Gemini API integration & prompt engine
│   ├── conflict_detector.py         # Duplicate task & deadline conflict algorithm
│   ├── owner_matcher.py             # Fuzzy speaker-to-registered-user matcher
│   ├── test_ps4_regression.py       # Full PS-4 backend regression test suite
│   └── fixtures/                    # Safe demonstration fixtures
│
├── src/                             # React 18 SPA Frontend
│   ├── App.jsx                      # Route definitions, guards & redirects
│   ├── main.jsx                     # Application entry point
│   ├── styles.css                   # Comprehensive Glassmorphism design tokens
│   │
│   ├── components/                  # Shared UI Components
│   │   ├── Header.jsx               # Top navigation & user profile dropdown
│   │   ├── Sidebar.jsx              # Role-aware navigation sidebar
│   │   ├── Layout.jsx               # User panel layout wrapper
│   │   ├── TeamLeadLayout.jsx       # Team Lead layout wrapper
│   │   ├── AdminLayout.jsx          # Admin layout wrapper
│   │   └── KanbanBoard.jsx          # Interactive task board component
│   │
│   ├── context/                     # Application State Contexts
│   │   ├── AuthContext.jsx          # Session state, JWT storage & RBAC guards
│   │   └── ThemeContext.jsx         # Dark / Light theme management
│   │
│   ├── pages/                       # Application Views
│   │   ├── Dashboard.jsx            # User overview metrics & recent activity
│   │   ├── Transcripts.jsx          # Transcript upload & management
│   │   ├── MeetingAnalysis.jsx      # Summary, Decisions & Evidence (3 sections)
│   │   ├── ActionItems.jsx          # Task review, edit, and approvals
│   │   ├── FollowUps.jsx            # Ambiguities & unresolved questions
│   │   ├── LiveMeeting.jsx          # WebRTC video room & live transcript
│   │   ├── Summaries.jsx            # Catalog of meeting summaries
│   │   ├── TrelloBoard.jsx          # Kanban PM board synchronization
│   │   ├── Login.jsx / SignUp.jsx   # Authentication pages
│   │   │
│   │   ├── admin/                   # Admin Panel Views
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── AdminUsers.jsx
│   │   │   ├── AdminTeams.jsx
│   │   │   ├── AdminAnalytics.jsx
│   │   │   └── AdminSystemHealth.jsx
│   │   │
│   │   └── teamlead/                # Team Lead Panel Views
│   │       ├── TeamLeadDashboard.jsx
│   │       ├── TeamLeadTeam.jsx
│   │       ├── TeamLeadActionItems.jsx
│   │       └── TeamLeadReports.jsx
│   │
│   └── services/                    # API Clients & Utilities
│       ├── api.js                   # Authenticated REST client
│       ├── pdfGenerator.js          # Client-side PDF generation utility
│       └── transcriptStore.js       # Local caching helper
│
└── transcripts/                     # Sample meeting transcripts for testing
    └── demo_sprint_planning.txt
```

---

## 6. Prerequisites & Environment Configuration

### Prerequisites
* **Node.js** (v18.0 or higher) and `npm`
* **Python** (v3.10 or higher) and `pip`
* A **Neon PostgreSQL** database instance (Free tier at [neon.tech](https://neon.tech))
* A **Google Gemini API Key** (Free tier at [aistudio.google.com](https://aistudio.google.com/))

### Configuration (`.env`)

Create your `.env` file in the project root:

```bash
cp .env.example .env
```

Fill in your actual service credentials in `.env`:

```env
# -------------------------------------------------------------
# Neon Serverless PostgreSQL Database Connection
# -------------------------------------------------------------
DATABASE_URL=postgresql://neondb_owner:your_password@ep-your-subdomain.us-east-2.aws.neon.tech/neondb?sslmode=require

# -------------------------------------------------------------
# Google Gemini API Configuration
# -------------------------------------------------------------
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
GEMINI_MODEL=gemini-3.5-flash-lite

# -------------------------------------------------------------
# Application Ports & Security
# -------------------------------------------------------------
PORT=5000
SECRET_KEY=commitflow-hacknova-secret-key-2026
JWT_SECRET=commitflow-jwt-super-secret-key-2026

# -------------------------------------------------------------
# Optional: External Trello Board Integration
# -------------------------------------------------------------
TRELLO_API_KEY=
TRELLO_TOKEN=
TRELLO_BOARD_ID=
```

---

## 7. Installation & Setup

### Step 1: Install Python Backend Dependencies
```bash
pip install -r requirements.txt
```
*Dependencies installed: `flask`, `flask-cors`, `psycopg2-binary`, `google-genai`, `pydantic`, `python-dotenv`, `requests`, `werkzeug`.*

### Step 2: Install Frontend Dependencies
```bash
npm install
```

---

## 8. Running CommitFlow

### Option A: One-Command Startup (Recommended)

Run the unified orchestrator to launch both the Flask backend and the Vite frontend simultaneously:

```bash
python start.py
```
*(On Windows, you can also double-click or run `start.bat`)*

This script:
1. Verifies Python and Node dependencies.
2. Initializes the Neon PostgreSQL database tables and seeds demo users.
3. Starts the Flask backend on `http://localhost:5000`.
4. Starts the Vite dev server on `http://localhost:5173`.
5. Automatically opens your default web browser to `http://localhost:5173`.

### Option B: Separate Terminals

**Terminal 1 — Backend:**
```bash
python server/app.py
```

**Terminal 2 — Frontend:**
```bash
npm run dev
```

Visit **`http://localhost:5173`** and log in with any seeded account (e.g. `aditi@commitflow.dev` / `Lead@CommitFlow2026!`).

---

## 9. Meeting Analysis Deep Dive

The **Meeting Analysis** page (`src/pages/MeetingAnalysis.jsx`) is engineered to provide complete intelligence without clutter, structured into three sections:

### Section 1: AI Meeting Summary
* **Executive Overview & Objectives:** Synthesized purpose and context of the meeting.
* **Key Discussion Points:** Numbered discussion topics extracted by Gemini. Includes an interactive `"Verify in Evidence"` button that highlights dialogue passages matching that topic.
* **Outcomes & Conclusions:** Final consensus and forward-looking expectations.

### Section 2: Decisions & Agreements
* **Confirmed Decisions:** Architectural and product choices agreed upon by participants.
* **Evidence Attribution:** Shows speaker name, timestamp, and verbatim quotation.
* **Interactive Cross-Link:** Click `"View in Transcript Evidence"` to immediately jump to and highlight the corresponding dialogue turn in Section 3.
* **Honest Empty State:** If a transcript has no confirmed decisions (e.g., brainstorming sessions), it displays an honest empty state rather than inventing fake decisions.

### Section 3: Transcript Evidence
* **Source Ground Truth:** Verbatim speech turns with speaker avatars and original timestamps.
* **No Invented Metadata:** If timestamps or speaker tags were absent in the uploaded text, CommitFlow preserves raw formatting without fabricating synthetic timestamps.
* **Search & Highlight:** Filter dialogue turns with real-time text/speaker search, with distinct glowing outlines for active evidence passages.

---

## 10. REST API Documentation

All API endpoints are hosted on `http://localhost:5000`:

### System Health
* `GET /api/health` — Returns status of Neon PostgreSQL and Gemini AI service.

### Authentication (`/api/auth`)
* `POST /api/auth/register` — Register a standard user account.
* `POST /api/auth/login` — Authenticate and receive user session payload.
* `GET /api/auth/me` — Retrieve current authenticated profile.
* `POST /api/auth/logout` — Terminate session.

### Transcripts & AI Intelligence (`/api/transcripts`)
* `GET /api/transcripts` — List all accessible transcripts for user.
* `POST /api/transcripts` — Upload raw transcript text or file metadata for AI analysis.
* `GET /api/transcripts/<id>` — Retrieve full transcript details, AI summary, decisions, and evidence.
* `POST /api/transcripts/<id>/retry` — Rerun AI analysis for failed or updated transcripts.
* `DELETE /api/transcripts/<id>` — Remove transcript and associated records.

### Action Items & Governance (`/api/action-items`)
* `GET /api/action-items` — List all extracted deliverables with ambiguity and conflict annotations.
* `POST /api/transcripts/<tx_id>/actions/<id>/approve` — Human approval of a task.
* `POST /api/transcripts/<tx_id>/actions/<id>/reject` — Reject a proposed task.
* `PUT /api/transcripts/<tx_id>/actions/<id>` — Edit task title, assignee, deadline, or priority.
* `POST /api/action-items/bulk-approve` — Bulk approve multiple eligible commitments.
* `GET /api/export/tasks?format=csv&transcriptId=<id>` — Download approved tasks as CSV.
* `GET /api/export/tasks?format=json&transcriptId=<id>` — Export structured JSON tasks.

### Ambiguities & Follow-ups (`/api/follow-ups`)
* `GET /api/follow-ups` — Retrieve questions, missing owners, and missing deadlines.
* `POST /api/follow-ups/<id>/resolve` — Resolve ambiguity by assigning an owner and deadline.

---

## 11. PostgreSQL Database Relational Schema

CommitFlow automatically manages this relational schema on Neon PostgreSQL (`server/db.py`):

```sql
-- 1. Users Table (RBAC)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    email VARCHAR(128) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    role VARCHAR(32) DEFAULT 'user',
    status VARCHAR(32) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Transcripts Table
CREATE TABLE IF NOT EXISTS transcripts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(256) NOT NULL,
    filename VARCHAR(256),
    file_size VARCHAR(64),
    file_type VARCHAR(32),
    source_type VARCHAR(64) DEFAULT 'Uploaded Transcript',
    status VARCHAR(32) DEFAULT 'Processing',
    duration VARCHAR(64),
    participants JSONB DEFAULT '[]'::jsonb,
    raw_text TEXT NOT NULL,
    error_message TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Meeting Summaries Table
CREATE TABLE IF NOT EXISTS meeting_summaries (
    id SERIAL PRIMARY KEY,
    transcript_id VARCHAR(64) UNIQUE REFERENCES transcripts(id) ON DELETE CASCADE,
    overview TEXT,
    key_discussion_points JSONB DEFAULT '[]'::jsonb,
    outcomes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Confirmed Decisions Table
CREATE TABLE IF NOT EXISTS decisions (
    id VARCHAR(64) PRIMARY KEY,
    transcript_id VARCHAR(64) REFERENCES transcripts(id) ON DELETE CASCADE,
    title VARCHAR(256) NOT NULL,
    details TEXT,
    evidence_speaker VARCHAR(128),
    evidence_timestamp VARCHAR(64),
    evidence_quote TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Action Items Table
CREATE TABLE IF NOT EXISTS action_items (
    id VARCHAR(64) PRIMARY KEY,
    transcript_id VARCHAR(64) REFERENCES transcripts(id) ON DELETE CASCADE,
    title VARCHAR(256) NOT NULL,
    description TEXT,
    item_type VARCHAR(64) DEFAULT 'commitment',
    owner VARCHAR(128) DEFAULT 'Unassigned',
    owner_status VARCHAR(32) DEFAULT 'ambiguous',
    assignee_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    deadline VARCHAR(64) DEFAULT 'Unspecified',
    deadline_status VARCHAR(32) DEFAULT 'missing',
    priority VARCHAR(32) DEFAULT 'Medium',
    status VARCHAR(32) DEFAULT 'Pending Approval',
    confidence_score NUMERIC(4, 2) DEFAULT 0.90,
    is_duplicate BOOLEAN DEFAULT FALSE,
    duplicate_warning TEXT,
    is_conflict BOOLEAN DEFAULT FALSE,
    conflict_warning TEXT,
    trello_card_id VARCHAR(128),
    evidence_speaker VARCHAR(128),
    evidence_timestamp VARCHAR(64),
    evidence_quote TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Unresolved Questions & Ambiguities Table
CREATE TABLE IF NOT EXISTS unresolved_questions (
    id VARCHAR(64) PRIMARY KEY,
    transcript_id VARCHAR(64) REFERENCES transcripts(id) ON DELETE CASCADE,
    title VARCHAR(256) NOT NULL,
    category VARCHAR(64) DEFAULT 'Unanswered Question',
    description TEXT,
    evidence TEXT,
    status VARCHAR(32) DEFAULT 'Open',
    assigned_owner_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    target_deadline VARCHAR(64),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 12. Testing & Quality Assurance

CommitFlow includes automated test suites covering end-to-end AI analysis, database integrity, and security permissions:

### 1. Backend PS-4 Regression Suite
Runs 13 automated tests against the live database, Gemini integration, conflict detector, and RBAC rules:
```bash
python -m unittest server/test_ps4_regression.py
```
*Expected: `Ran 13 tests in 42s — OK`.*

### 2. Two-Transcript Ground-Truth Verification
Validates that decisions are accurately extracted when present and that honest empty states are maintained when decisions are absent (preventing false positives and cross-transcript leakage):
```bash
python scratch/test_meeting_analysis_two_transcripts.py
```
*Expected: `ALL TESTS (TEST A, TEST B, ISOLATION, PERSISTENCE) PASSED SUCCESSFULLY!`.*

### 3. Role-Based Access Control (RBAC) Security Tests
Verifies endpoint isolation between Admins, Team Leads, and Standard Users:
```bash
python test_rbac_permissions.py
```

### 4. Frontend Production Build Check
Validates JSX syntax, bundle chunking, and styling tokens:
```bash
npm run build
```
*Expected: `✓ built in ~480ms (Exit Code: 0)`.*

---

## 13. Team Members

Developed with pride for **HACKNOVA'26** by **Team J.Sparrow**:

* **Swapnil Ingole**
* **Aniket Bhujad**
* **Vedant Desai**
* **Bhoomi Tiple**

---

### License
This project is open-source and licensed under the [MIT License](LICENSE).
