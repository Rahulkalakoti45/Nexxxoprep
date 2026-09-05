<div align="center">

#  NexoPrep.AI

### AI Hiring Intelligence & Recruitment Automation Platform

**Resume Intelligence • Recruitment Automation • Adaptive Voice Interviews • Behavioral Analysis • Grounded AI Reports**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-Backend-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-Frontend-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#-contributing)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [System Architecture](#️-complete-system-architecture)
- [AI Engine 1 — Resume Intelligence](#-ai-engine-1--resume-intelligence)
- [AI Engine 2 — Recruitment Automation](#-ai-engine-2--recruitment-automation)
- [AI Engine 3 — Adaptive Interview](#️-ai-engine-3--nexoprep-adaptive-interview)
- [AI Engine 4 — Hiring Intelligence](#-ai-engine-4--hiring-intelligence)
- [Features](#-current-features)
- [Technology Stack](#-technology-stack)
- [Repository Structure](#-repository-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Development Status](#-development-status)
- [Roadmap](#️-roadmap)
- [Contributing](#-contributing)
- [Team](#-team)
- [License](#-license)

---

## 📌 Overview

**NexoPrep.AI** is an end-to-end AI Hiring Intelligence Platform that automates the complete technical hiring workflow — from screening resumes to conducting adaptive AI interviews, analyzing candidate behavior, generating grounded reports, and delivering recruiter-ready hiring insights.

Unlike traditional interview platforms that only ask static, scripted questions, NexoPrep combines multiple purpose-built AI engines into a single, unified recruitment ecosystem — reducing recruiter workload while giving candidates a fairer, more consistent interview experience.

---

## 🏗️ Complete System Architecture

```text
                         COMPANY / RECRUITER
                                 │
                                 ▼
                  Upload Resumes + Job Description
                                 │
   ══════════════════════════════════════════════════════
   AI ENGINE 1 — Resume Intelligence
   ══════════════════════════════════════════════════════
                                 │
                    Bulk Resume Parsing
                                 │
                    Job Description Matching
                                 │
                    ML Similarity & Ranking
                                 │
                    Explainable Candidate Ranking
                                 │
                         candidate.json
                                 │
   ══════════════════════════════════════════════════════
   AI ENGINE 2 — Recruitment Automation
   ══════════════════════════════════════════════════════
                                 │
                  ┌──────────────┴──────────────┐
                  ▼                              ▼
             Email Agent                  AI Calling Agent
                  │                              │
        • Interview invite            • Candidate confirmation
        • Interview link              • Rescheduling support
                  │                              │
                  └──────────────┬───────────────┘
                                 ▼
   ══════════════════════════════════════════════════════
   AI ENGINE 3 — NexoPrep Interview Core
   ══════════════════════════════════════════════════════
                                 │
                    Resume-Aware Interview Context
                                 │
                    Adaptive Voice Interview
                                 │
                    Conversation Memory
                                 │
                    Transcript Storage
                                 │
                    MediaPipe Behavior Analysis
                                 │
                    Evidence Extraction
                                 │
                    Grounded AI Report
                                 │
                    Unified Analytics
                                 │
   ══════════════════════════════════════════════════════
   AI ENGINE 4 — Hiring Intelligence
   ══════════════════════════════════════════════════════
                                 │
                    Interview Results + Behavior Results
                                 │
                    Candidate Scores
                                 │
                    Hiring Summary
                                 │
                    Recruiter Dashboard
                                 │
                    Email Results to Recruiter
```

---

## 🧠 AI Engine 1 — Resume Intelligence

Evaluates multiple resumes against a recruiter-provided job description and produces an explainable, ranked shortlist.

**Workflow**

1. Upload multiple resumes
2. Upload the job description
3. Parse candidate information
4. Compute similarity between resumes and JD
5. Rank candidates
6. Generate explainable ranking reasons
7. Export ranked candidates as structured JSON

**Output**

| Output | Description |
|---|---|
| Ranked candidate list | Ordered by JD fit |
| Matching score | Quantified similarity score |
| Resume insights | Extracted skills, experience, education |
| Explainable reasoning | Why each candidate was ranked as such |
| Structured candidate JSON | Machine-readable output for downstream engines |

---

## 📨 AI Engine 2 — Recruitment Automation

Once resumes are ranked, this engine automatically reaches out to shortlisted candidates.

**Email Automation**
- Reads candidate JSON
- Extracts relevant resume information
- Generates a personalized interview invitation
- Attaches interview details and includes the interview link
- Sends the email automatically

**AI Calling Agent**
- Calls shortlisted candidates
- Introduces the interview
- Asks them to check their email
- Confirms attendance
- Handles rescheduling requests

---

## 🎙️ AI Engine 3 — NexoPrep Adaptive Interview

The core of the platform.

- **Resume-Aware Context** — the uploaded resume becomes live interview context
- **Adaptive Voice Interview** — AI interviewer with dynamic follow-up questions, context-aware conversation, and difficulty adaptation
- **Conversation Memory** — the interview remembers previous answers and generates intelligent follow-ups
- **Transcript Pipeline** — every interview is stored for later evaluation
- **Behavioral Intelligence** — using MediaPipe and OpenCV, the platform analyzes:
  - Eye contact
  - Face orientation
  - Head pose
  - Hand gestures
  - Confidence
  - Attention
  - Body posture
- **Evidence Extraction Layer** — instead of hallucinating feedback, the system extracts evidence directly from interview transcripts before evaluation
- **Grounded Report Generation** — reports are built using only extracted evidence, producing strengths, weaknesses, technical topics, recommendations, and an overall performance summary

---

## 📊 AI Engine 4 — Hiring Intelligence

Combines outputs from all previous engines into a single recruiter-facing summary.

Recruiters receive:
- Interview reports
- Behavioral analysis
- Candidate rankings
- Hiring summary
- Analytics dashboard
- Final recommendations

---

## ✨ Current Features

**Candidate**
- Resume upload
- Adaptive voice interview
- Interview history
- Grounded reports
- Performance analytics
- Progress tracking

**Recruiter**
- Candidate ranking
- Resume insights
- Interview reports
- Behavioral insights
- Hiring dashboard

---

## 🧰 Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React, Vite, Tailwind CSS |
| **Backend** | Node.js, Fastify, TypeScript, Prisma ORM |
| **AI & ML** | Google Gemini, ElevenLabs, MediaPipe, OpenCV |
| **Data Layer** | PostgreSQL, Redis |

---

## 📂 Repository Structure

```text
apps/
  server/                # Fastify + TypeScript backend
packages/
  config/                # Shared configuration
  database/              # Prisma schema & migrations
  events/                # Event bus / messaging
  shared/                # Shared utilities
  types/                 # Shared TypeScript types
services/
  analytics-service/     # Hiring analytics & dashboards
  memory-service/        # Conversation memory for interviews
  report-service/        # Grounded report generation
  session-service/       # Interview session orchestration
src/                     # Frontend application source
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js 20+
- Python 3.11+
- PostgreSQL
- Redis
- Git
- npm

### 1. Clone the repository

```bash
git clone https://github.com/Rurubyte/ShieldClan_Shraddharawat.git
cd ShieldClan_Shraddharawat
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your own values:

```bash
cp .env.example .env
```

See [Environment Variables](#-environment-variables) below for what's required.

### 4. Set up the database

```bash
npm run db:generate
npm run db:migrate
```

### 5. Start the backend

```bash
npm run dev:server
```

Backend runs at: `http://localhost:4000`

### 6. Start the frontend

```bash
npm run dev
```

Frontend runs at: `http://localhost:5173`

### 7. Verify your setup

- [ ] Backend health endpoint responds
- [ ] Database connected
- [ ] Redis connected
- [ ] Frontend loads successfully

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `GEMINI_API_KEY` | Google Gemini API key |
| `ELEVENLABS_API_KEY` | ElevenLabs API key (voice interviews) |
| `AUTH_SECRET` / auth keys | Authentication signing keys |
| *(see `.env.example`)* | Any additional project-specific variables |

> ⚠️ Never commit your `.env` file. Keep API keys and secrets out of version control.

---

## 📌 Development Status

**✅ Implemented**
- Resume-aware interviews
- Voice interview pipeline
- Transcript persistence
- Conversation memory
- Behavior engine
- Evidence extraction
- Grounded reports
- Unified reporting foundation
- Analytics foundation

**🚧 In Progress**
- Dashboard real-data integration
- Unified recruiter reports
- Company-specific interview workflows
- Advanced recruiter automation

---

## 🛣️ Roadmap

- **Phase 4E** — Unified report experience & dashboard integration
- **Phase 4F** — Unified recruiter report with behavior intelligence
- **Phase 5** — Real company interview rounds, adaptive interview orchestration, end-to-end hiring automation

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "Add: your feature"`
4. Push to your branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

Please open an issue first for major changes so we can discuss what you'd like to change.

---

## 👥 Team

**ShieldClan**

Built across multiple hackathons and continuously evolved into a production-oriented AI Hiring Intelligence Platform.

---

## 📄 License

Distributed under the [MIT License](./LICENSE).
