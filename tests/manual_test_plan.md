# Manual UI/UX Test Plan for Evaluators

**Application:** The Lenny Growth Assistant  
**Evaluation Protocol:** 15-Minute End-to-End Verification  

---

## 1. Local Deployment Verification

- [ ] **Step 1:** Run `docker compose up --build` in repository root.
- [ ] **Step 2:** Open browser to `http://localhost:8000`.
- [ ] **Expected Result:** Application renders dark-mode dashboard with Navbar, Left Sidebar, Chat Stream, and Status indicators showing "System Ready".

---

## 2. Model Toggle & Resilience Testing

- [ ] **Step 1:** Ensure Ollama is running on host (`ollama serve`) with `llama3.2` pulled.
- [ ] **Step 2:** Select **Ollama (Llama 3.2 Local)** from top right dropdown.
- [ ] **Step 3:** Send query: *"How does Elena Verna define Product-Led Growth (PLG)?"*
- [ ] **Expected Result:** Assistant answers using local model, citing Episode #110 (Elena Verna) with clickable citation pills.
- [ ] **Step 4:** Stop Ollama daemon (`killall ollama` or close terminal window).
- [ ] **Step 5:** Send follow-up query.
- [ ] **Expected Result:** App cleanly catches connection failure and presents structured error toast informing evaluator that Ollama is unreachable, without crashing the server.

---

## 3. Grounded Q&A & Citation Verification

- [ ] **Step 1:** Ask *"Explain Shreyas Doshi's LNO Framework for product managers."*
- [ ] **Expected Result:** Response breaks down Leverage (L), Neutral (N), and Overhead (O) tasks with grounded citations to Shreyas Doshi's episode.
- [ ] **Step 2:** Ask an out-of-domain question: *"What is the capital of France?"*
- [ ] **Expected Result:** Assistant explicitly acknowledges: *"I cannot find this topic in Lenny's podcast transcripts knowledge base."*

---

## 4. Ship 30 for 30 Content Skill Verification

- [ ] **Step 1:** Click **🚀 Ship 30 Essay Skill** in left sidebar or input area.
- [ ] **Step 2:** Prompt *"Write a Ship 30 for 30 essay on product positioning."*
- [ ] **Expected Result:**
  1. Assistant response confirms essay generation.
  2. Side-by-Side **Artifact Canvas** glides open on the right.
  3. Essay displays Hook, skimmable headings (H2/H3), selective bolding, bullet points, and Actionable Takeaway (~1,250 words).

---

## 5. Artifact Viewer & Security Isolation

- [ ] **Step 1:** Click **HTML/CSS Artifact Tool** pill.
- [ ] **Step 2:** Prompt *"Create an interactive HTML pricing calculator."*
- [ ] **Expected Result:**
  1. Side-by-Side Artifact Drawer opens.
  2. **Preview Tab** renders interactive HTML component inside sandboxed `iframe`.
  3. **Code Tab** shows raw HTML/CSS source code.
  4. Clicking **Copy** copies code to clipboard; clicking **Download** exports `.html` file.
  5. Inspected iframe element shows `sandbox="allow-scripts"` and `DOMPurify` protection active.
