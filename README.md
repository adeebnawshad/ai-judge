# **AI Judge — LLM-Powered Evaluation Layer**

AI Judge is a lightweight web application that adds an automated **AI Judge** layer on top of human-labeled submissions.

It allows users to:

- Import submission data  
- Configure AI judges (LLM prompts + model names)  
- Assign judges to questions in a queue  
- Run evaluations against a real LLM provider  
- Review results with filters and pass-rate statistics  

This project mirrors a simplified version of an internal annotation/review tool.

---

## **Tech Stack**

### **Frontend**
- React 18  
- TypeScript  
- Vite  
- React Router  

### **Backend**
- Node.js  
- Express  
- Supabase (Postgres persistence)  
- Google Gemini API (LLM provider)  

---

## **How to Run Locally**

### **Prerequisites**
- Node.js 18+  
- A Supabase project  
- A Gemini API key  

---

## **Frontend Setup**

```bash
npm install
npm run dev
```

The app will open at: **http://localhost:5173**

### **Environment Variables (Frontend)**

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_publishable_key
```

---

## **Backend Setup**

```bash
cd backend
npm install
npm start
```

Backend runs at: **http://localhost:8787**

### **Environment Variables (Backend)**

Create a `.env` file inside `backend/`:

```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_api_key
```

---

## **Core Features**

### **1. Data Import**
- Upload a JSON file following the provided sample schema  
- Parsed submissions, questions, answers, and queues are persisted to Supabase  
- All data is stored server-side (not in localStorage or client memory)

---

### **2. AI Judge Definitions**
Create, edit, and deactivate AI judges.  
Each judge contains:

- Name  
- System prompt / rubric  
- Target model name (free-text, provider-agnostic)  
- Active flag  

Judges persist across reloads.

---

### **3. Assigning Judges to Questions**
For each queue, users can assign one or more **active** judges to each question.  
Assignments are persisted and used by the evaluation runner.

---

### **4. Running Evaluations**
From the queue page, “Run AI Judges” triggers evaluation runs.

For each **submission × question × assigned judge**:

- Builds a prompt using judge rubric + question text + user answer  
- Calls the Gemini API  
- Parses structured JSON output  
- Stores a verdict & reasoning in Supabase  

Includes a real-time run summary:

- Planned count  
- Completed count  
- Failed count  

Typical errors (missing config, quota limits, LLM timeouts) are handled cleanly.

---

### **5. Results View**
Dedicated results page listing all evaluations:

- Submission  
- Question  
- Judge  
- Verdict  
- Reasoning  
- Timestamp  

**Filters:**
- Judge (multi-select)  
- Question (multi-select)  
- Verdict (pass / fail / inconclusive)  

Aggregate **pass-rate statistics** update dynamically based on active filters.

---

## **Bonus Features**

### **Pass Rate by Judge**
A visual breakdown showing how strict/lenient each judge is.  
Automatically respects filters on the Results page.

---

### **Error Handling**

#### **Frontend**
- Ensures required conditions before running judges (e.g., at least 1 question, at least 1 active judge)  

#### **Backend**
- Handles:
  - LLM timeouts  
  - Quota and rate-limit errors  
  - Malformed responses  
- Responds with structured error hints  
- UI displays clear status banners instead of failing silently  

---

## **Trade-Offs & Design Decisions**

- **Open-ended model field** — allows any model name (Gemini, OpenAI, Claude, etc.) without hardcoding  
- **Repeated imports allowed** — preserves ingestion behavior without deduplication  
- **Sequential LLM calls** — simpler, more predictable, avoids concurrency edge cases  

---

## **Time Spent**

**≈ 15 hours total.**

---

## **Demo Walkthrough (Loom)**

The screen recording demonstrates:

- Importing sample data  
- Creating and editing AI judges  
- Assigning judges in a queue  
- Running AI judges  
- Reviewing results with filters and pass-rate statistics  
