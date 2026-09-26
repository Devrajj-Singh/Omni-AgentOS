# Omni AgentOS — Roadmap v2 (Post Phase 8)

## Why This Roadmap Changed

Phases 0-8 were built. The original plan for Phases 9-15 was reordered to better demonstrate **AI systems engineering** judgment — the target is an offline AI systems engineering internship, so the roadmap now optimizes for showing *why* architectural decisions were made, not just checking off a list of technologies (Docker, Redis, Postgres, Kubernetes, MCP, observability).

Two principles drove the resequencing:

1. **Instrument before you scale.** Observability is introduced early (Phase 9.5) instead of at the end, because Phase 9 (multi-agent orchestration) is exactly where you need visibility into agent handoffs and tool calls to debug it. Building it last means retrofitting tracing into code that was not designed for it.
2. **Earn infrastructure, do not inherit it.** Redis and PostgreSQL are introduced as deliberate *migrations* from a working in-process/ChromaDB-only system, not bolted on from day one. The narrative: built it simply first, identified the scaling limitation, then migrated.

---

## Status

| Phase | Name | Status |
|-------|------|--------|
| 0 | App Shell | Done |
| 1 | AI Chat with Streaming | Done |
| 2 | Developer Mode | Done |
| 3 | Tool System + LangGraph | Done |
| 4 | Memory System | Done |
| 5 | UI Polish | Done |
| 6 | Research Mode | Done |
| 7 | Settings Page | Done |
| 8 | Autonomous Execution (Human-in-the-Loop) | Done - tagged phase-8-complete |
| 9 | Multi-Agent Orchestration | Done - tagged phase-9-complete |
| 9.5 | Lightweight Observability | Done - tagged phase-9.5-complete |
| 10 | Repository Intelligence | Done - tagged phase-10-complete |
| 11 | Workspace Context Engine | Done - tagged phase-11-complete |
| 12 | Reflection Agent | Done - tagged phase-12-complete |
| 12.5 | Redis Migration | Done - tagged phase-12.5-complete |
| 12.6 | BYO API Key and Multi-Provider LLM Factory | Done - tagged phase-12.6-complete |

---

## Phase 12.7 — Chat UI/UX Polish

**Goal:** Bring the chat interface up to the quality standard users expect from modern AI tools (Claude, ChatGPT). This phase is scheduled *before* Phase 13 because the Autonomous Project Builder will produce long, complex multi-step output — it should render beautifully from day one, not retrofitted later.

**Why now:** The current output is functional but raw. Markdown renders as plain text, code blocks have no syntax highlighting or copy button, and there are no per-message actions. These gaps make the whole system feel less capable than it is, regardless of how good the underlying AI is.

- **Markdown rendering** — full CommonMark support: headers, lists, bold, italics, blockquotes, tables
- **Code blocks** — syntax highlighting (react-syntax-highlighter or shiki), language badge, one-click copy button per block
- **Message actions** — copy full message on hover; copy individual code blocks (separate from copy message)
- **Scroll behavior** — auto-scroll to bottom on new tokens; floating scroll-to-bottom button when user scrolls up mid-stream
- **Visual hierarchy** — clear user vs. assistant distinction; agent label (Planner/Coder/Researcher/Reviewer) as a small badge above each turn
- **Input area** — auto-expands up to ~6 lines; Shift+Enter for newline shown in placeholder
- **Typography and spacing** — consistent inter-message gap, readable line height, proper code font (JetBrains Mono or similar)
- **Loading state** — smooth pulsing dots indicator showing the active agent name
- **Overall premium feel** — tighter alignment, subtle borders, smooth transitions; goal: a developer opening the app for the first time thinks this is polished

---

## Phase 13 — Autonomous Project Builder

(Unchanged from original plan)

- User: Build a FastAPI auth service -> Planner creates steps -> multi-agent system executes -> Reviewer validates output -> approval gates on each destructive step (reuses Phase 8 approval system, now Redis-backed)

---

## Phase 13.5 — GitHub Integration Panel

**Goal:** Eliminate the tab-switching friction of the developer GitHub workflow by bringing the critical actions (view PRs, create PR, publish release) directly into Omni AgentOS as a resizable side panel, powered by the GitHub REST API.

**Why:** The current workflow for every phase is: finish work -> switch to browser -> open GitHub -> type PR title/body -> switch back -> copy release notes -> switch again -> paste -> publish. That is 6-8 context switches for a mechanical task. A native panel collapses this to zero.

**What it is NOT:** An embedded browser or GitHub mirror. GitHub blocks iframe embedding (X-Frame-Options: DENY) — browser-within-browser is technically impossible on the web. This is a purpose-built native panel using the GitHub REST API exposing only the actions that matter during development.

- GitHub OAuth 2.0 flow — one-time Connect GitHub in Settings; token stored in sessionStorage (same pattern as Phase 12.6 API key)
- Resizable panel (drag handle), opens via a persistent GitHub button in the sidebar alongside existing panels
- **PR tab:** list open PRs, create new PR with branch selector, title, body pre-filled by AI from current branch diff + commit messages
- **Releases tab:** list recent releases and tags, publish a new release with AI-generated title and body from PR description
- **AI draft button:** one click -> agent reads the diff and commit log -> generates PR title, body, release notes in the exact repo style. User reviews and edits before submitting.
- No GitHub features beyond these — frictionless workflow, not a GitHub replacement
- **Portfolio narrative:** The agent does not just generate code — it handles the surrounding development workflow too. PR creation and release management happen inside the same tool, with the AI drafting the content based on what was actually changed.

---

## Phase 14 — MCP (Model Context Protocol)

**Goal:** Wrap existing tools (read_file_tool, write_file_tool, run_command_tool, web_search_tool) as MCP servers instead of plain LangChain @tool functions.

- Demonstrates fluency with the MCP standard — directly relevant to AI systems engineering roles
- Existing tool logic does not change; this is a protocol/interface layer, not a rewrite
- Good portfolio signal: shows you can adapt a working system to an emerging industry standard rather than treating your first implementation as final

---

## Phase 14.5 — Local ML Layer

(Previously Phase 14 — renumbered to accommodate new phases. This remains the strongest Coursera-to-code demonstration.)

- Intent Classifier (Logistic Regression / LightGBM, MLflow-tracked, served via FastAPI): routes user input -> developer / research / memory / execution / general_chat
- Complexity Predictor: simple/medium/complex -> routes to appropriate model size
- Hugging Face for embeddings/tokenization

---

## Phase 15 — PostgreSQL Migration

**Goal:** Move session and memory metadata off in-memory storage and ChromaDB-only patterns onto PostgreSQL, while ChromaDB remains the vector store for embeddings.

- Sessions, messages, document metadata, approval audit history -> PostgreSQL
- ChromaDB stays — still the right tool for vector similarity search; Postgres complements it for relational/audit data, not a replacement
- This phase explicitly demonstrates when to use a vector DB vs. a relational DB — a real architectural decision, not just adding a database

---

## Phase 16 — Docker + Kubernetes + Full Observability + Deployment

**Goal:** Production-style deployment, upgraded from the original docker-compose-only plan.

- docker-compose.yml for one-command local start (Phase 16a)
- Kubernetes manifests (or Helm chart) for a more production-realistic deployment story (Phase 16b)
- Full observability stack: OpenTelemetry traces, Prometheus metrics, Grafana dashboard — upgrading the Phase 9.5 lightweight version
- CI/CD pipeline
- Vercel for frontend, Render (or a Kubernetes cluster, if pursued) for backend
- Full README with architecture diagram and setup guide

---

## How to Use This Roadmap

- Each phase still gets its own prompt in the existing format (Mission -> What Already Exists -> exact file changes -> File Checklist -> Definition of Done)
- Git: one branch per phase, tag phase-N-complete after Definition of Done passes and the fix is committed
- When describing this project in an internship interview, the strongest narrative beats are the migrations (Phase 12.5, 15) and the early observability (Phase 9.5) — these show systems judgment, not just feature accumulation
- **New narrative beats added:** Phase 12.7 (polish before scale — UI quality as a first-class concern), Phase 13.5 (workflow integration — the AI handles not just code but the surrounding dev process)
