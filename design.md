# Design Specification: The Lenny Growth Assistant

**Version:** 1.0.0  
**Author:** Forward Deployed UI/UX Engineering  

---

## 1. UX Principles & Visual Aesthetics

### 1.1 Core Design Philosophy
"The Lenny Growth Assistant" is built for modern product and growth professionals who expect high-density information, zero distraction, and instant visual feedback. The UI takes inspiration from state-of-the-art AI workspaces like Claude Artifacts and Cursor IDE, blending sleek dark-mode glassmorphism with crisp typography and responsive split-pane ergonomics.

### 1.2 Aesthetic Tokens & Color System
The visual foundation relies on a custom dark mode palette using HSL color variables to maintain seamless contrast ratios across components:

```css
:root {
  /* Surface & Background Colors */
  --bg-primary: #0b0f19;        /* Deep obsidian space */
  --bg-secondary: #111827;      /* Slate card background */
  --bg-tertiary: #1f293d;       /* Glassmorphic border hover surface */
  --bg-glass: rgba(17, 24, 39, 0.75);

  /* Brand Accents */
  --accent-primary: #6366f1;     /* Electric Indigo */
  --accent-secondary: #8b5cf6;   /* Royal Purple Gradient */
  --accent-success: #10b981;     /* Emerald Green (Ollama Active) */
  --accent-warning: #f59e0b;     /* Amber Warning */
  --accent-error: #ef4444;       /* Crimson Red */

  /* Text & Contrast Tokens */
  --text-main: #f9fafb;          /* Crisp Off-White */
  --text-muted: #9ca3af;         /* Cool Slate Gray */
  --text-subtle: #6b7280;        /* Subtle Label Gray */

  /* Borders & Shadows */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-glow: rgba(99, 102, 241, 0.3);
  --shadow-lg: 0 10px 30px -5px rgba(0, 0, 0, 0.5);
  --font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', Fira Code, monospace;
}
```

---

## 2. Information Architecture & Layout Math

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ NAVBAR: Logo, Model Selector Toggle (Ollama / Claude), Dataset Search, Connection Status     │
├───────────────┬──────────────────────────────────────────────┬──────────────────────────────┤
│ SIDEBAR       │ MAIN CHAT AREA                               │ SIDE-BY-SIDE ARTIFACT CANV   │
│ (260px)       │ (Flexible 1fr)                               │ (Shiftable 50% / Hidden)     │
│               │                                              │                              │
│ ✚ New Chat    │ ┌──────────────────────────────────────────┐ │ ┌──────────────────────────┐ │
│               │ │ Assistant Message                        │ │ │ Header: Artifact Title   │ │
│ Sessions List │ │ "Here is the Elena Verna PLG framework"  │ │ │ [Preview] [Code] [Copy]  │ │
│               │ │                                          │ │ ├──────────────────────────┤ │
│ ─ Recent      │ │ [Citation: Lenny #110] [Citation: #94]   │ │ │                          │ │
│   - PLG Metrics│ │                                          │ │ │ Sandboxed IFrame / MD    │ │
│   - Ship 30   │ │ [ ⚡ Open Interactive PLG Matrix ]        │ │ │ Rendered Content          │ │
│               │ └──────────────────────────────────────────┘ │ │                          │ │
│               │                                              │ │                          │ │
│ ⚙ Settings    │ ┌──────────────────────────────────────────┐ │ │                          │ │
│ 📄 Knowledge  │ │ Input Prompt Area (Shift+Enter multi)    │ │ │                          │ │
│               │ │ [ 🚀 Ship 30 Skill ] [ 📄 Artifact Tool] │ │ │                          │ │
│               │ └──────────────────────────────────────────┘ │ └──────────────────────────┘ │
└───────────────┴──────────────────────────────────────────────┴──────────────────────────────┘
```

### 2.1 Workspace Components
1. **Top Navigation Bar:**
   - App Brand: "Lenny Growth Assistant" with animated pulse indicator.
   - Provider Toggle Pill: Switches between **Ollama (Llama 3.2)**, **Claude 3.5 Sonnet**, and **OpenAI GPT-4o**. Displays latency badge ($\sim 45\text{ms}$).
   - Search Dataset Trigger: Quick modal search over pre-indexed podcast transcripts.
2. **Left Sidebar (Navigation & Sessions):**
   - New Chat Button (`Ctrl + N`).
   - Session List: Shows user session history with editable titles and timestamps.
   - Quick Skill Actions: "Ship 30 Essay Generator", "Product Framework Artifact", "Monetization Audit".
3. **Main Conversational Stream:**
   - Message Cards: User prompts vs. Assistant answers.
   - Markdown Engine: Formats code blocks, tables, bold text, bullet points.
   - Grounded Citation Chips: Interactive pills (`[Lenny Podcast #120 - Shreyas Doshi]`) opening a source excerpt modal.
   - Artifact Triggers: Interactive buttons embedded in messages that open the artifact in the side canvas.
4. **Side-by-Side Artifact Drawer (Claude Artifacts Style):**
   - Width: 50% split screen when active, auto-collapsible.
   - Tabs: **Rendered Preview** (Sandboxed HTML/CSS or rendered Markdown) and **Raw Code** (Syntax highlighted).
   - Utility Bar: Copy to Clipboard, Download File, Fullscreen Toggle, Close Canvas.

---

## 3. Key Interaction States & Micro-Animations

### 3.1 Streaming & Typing State
- When the assistant is generating text, a subtle gradient shine animates across the message container.
- Citation chips pop in with a smooth CSS scale-up transition (`transform: scale(0.95)` to `scale(1.0)` over $150\text{ms}$).

### 3.2 Artifact Generation & Opening State
- When an artifact payload is detected in the response stream, the Artifact Drawer glides in smoothly from the right side (`transform: translateX(0)` with `transition: 300ms cubic-bezier(0.16, 1, 0.3, 1)`).
- Visual indicator highlights the linked message node to maintain context.

### 3.3 Model Switching State
- Switching providers updates the status badge with a quick color pulse:
  - Green pulse = Ollama (Local Daemon connected).
  - Indigo pulse = Claude 3.5 Sonnet (Cloud API active).
  - Amber pulse = Degraded fallback mode.

---

## 4. Accessibility & Security

### 4.1 Accessibility Standards (WCAG 2.1 AA)
- **Keyboard Navigation:** Full keyboard shortcut support (`Tab`, `Shift + Tab`, `Esc` to close modal/artifact panel, `Ctrl + Enter` to send prompt).
- **ARIA Labeling:** All interactive elements contain explicit `aria-label`, `role="button"`, and `aria-expanded` properties.
- **Contrast Ratios:** Text color `#f9fafb` on background `#0b0f19` yields a contrast ratio of $15.8:1$ (exceeds AAA standard).

### 4.2 Security Isolation Strategy for HTML Artifacts
- Generated HTML/CSS code is executed inside an `<iframe>` populated via the `srcdoc` attribute.
- **Sandbox Configuration:** `sandbox="allow-scripts"` (Strictly excludes `allow-same-origin`, `allow-top-navigation`, and `allow-forms`).
- **DOMPurify Sanitization:** Sanitize generated HTML prior to mounting to strip dangerous event handlers like `onload`, `onerror`, or `<script>` injections that attempt parent frame escaping.
