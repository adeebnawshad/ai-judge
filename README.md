AI Judge — LLM-Powered Evaluation Layer

AI Judge is a small web application that adds an automated AI Judge layer on top of human-labeled submissions.

It allows users to:

Import submission data

Configure AI judges (LLM prompts + models)

Assign judges to questions in a queue

Run evaluations against a real LLM provider

Review results with filters and pass-rate statistics

This project mirrors a simplified version of an internal annotation / review tool.

Tech Stack
Frontend

React 18

TypeScript

Vite

React Router

Backend

Node.js

Express

Supabase (Postgres + persistence)

Google Gemini API (LLM provider)

How to Run Locally
Prerequisites

Node.js 18+

A Supabase project

A Gemini API key

Frontend
npm install
npm run dev

App will open at:
http://localhost:5173

Environment Variables (Frontend)

Create a .env file in the project root:
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_publishable_key


Backend
cd backend
npm install
npm start


Backend runs at:
http://localhost:8787

Environment Variables (Backend)

Create a .env file in backend/:

SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_api_key

Core Features
1. Data Import

Upload a JSON file following the provided sample schema

Parsed submissions, questions, answers, and queues are persisted to Supabase

Data is stored in the backend (not in memory or localStorage)

2. AI Judge Definitions

Create, edit, and deactivate AI judges

Each judge stores:

Name

System prompt / rubric

Target model name (free-text, provider-agnostic)

Active flag

Judges persist across reloads

3. Assigning Judges to Questions

For a given queue, assign one or more active judges per question

Assignments are persisted and later used by the evaluation runner

4. Running Evaluations

“Run AI Judges” action on the queue page

For each submission × question × assigned judge:

Builds a prompt from the judge rubric, question text, and user answer

Calls a real LLM provider (Gemini)

Parses structured JSON output

Persists an evaluation record with verdict and reasoning

Run summary includes:

Planned count

Completed count

Failed count

Common error cases (e.g. missing configuration, LLM quota errors) are handled gracefully.

5. Results View

Dedicated Results page listing all evaluations:

Submission

Question

Judge

Verdict

Reasoning

Created timestamp

Filters:

Judge (multi-select)

Question (multi-select)

Verdict (pass / fail / inconclusive)

Aggregate pass-rate summary updates live based on active filters.

Bonus Features
Pass Rate by Judge

Visual “pass rate by judge” breakdown

Shows how strict or lenient each judge is

Automatically respects active filters in the Results view

Error Handling

Frontend

Validates required conditions before running judges
(e.g. no questions, no active judges, no assignments)

Backend

Handles LLM timeouts, quota/rate-limit errors, and malformed responses

Returns structured error hints to the frontend

UI displays clear status banners instead of failing silently.

Trade-offs & Design Decisions

Model field is open-ended: users can type any valid provider model name
→ keeps the system flexible as models change frequently

Repeated imports are allowed: imports preserve raw ingestion behavior
→ avoids destructive deduplication logic

Sequential LLM calls: chosen over parallel execution
→ simpler and more predictable

Time Spent

~15 hours total.

Demo Walkthrough (Loom)

The screen recording demonstrates:

Importing sample data

Creating and editing AI judges

Assigning judges to questions in a queue

Running AI judges

Reviewing results with filters and pass-rate statistics
