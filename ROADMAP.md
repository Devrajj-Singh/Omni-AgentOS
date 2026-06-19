# Omni AgentOS — Roadmap v2 (Post Phase 8)

## Why This Roadmap Changed

Phases 0-8 were built. The original plan for Phases 9-15 was reordered to better demonstrate **AI systems engineering** judgment — the target is an offline AI systems engineering internship, so the roadmap now optimizes for showing *why* architectural decisions were made, not just checking off a list of technologies (Docker, Redis, Postgres, Kubernetes, MCP, observability).

Two principles drove the resequencing:

1. **Instrument before you scale.** Observability is introduced early (Phase 9.5) instead of at the end, because Phase 9 (multi-agent orchestration) is exactly where you need visibility into agent handoffs and tool calls to debug it. Building it last means retrofitting tracing into code that wasn't designed for it.
2. **Earn infrastructure, don't inherit it.** Redis and PostgreSQL are introduced as deliberate *migrations* from a working in-process/ChromaDB-only system, not bolted on from day one. "I built it simply first, identified the scaling limitation, then migrated" is a stronger systems-engineering story than starting with infrastructure the project doesn't yet need.

---

## Status

| Phase | Name | Status |
|-------|------|--------|
| 0 | App Shell | ✅ Done |
| 1 | AI Chat with Streaming | ✅ Done |
| 2 | Developer Mode | ✅ Done |
| 3 | Tool System + LangGraph | ✅ Done |
| 4 | Memory System | ✅ Done |
| 5 | UI Polish | ✅ Done |
| 6 | Research Mode | ✅ Done |
| 7 | Settings Page | ✅ Done |
| 8 | Autonomous Execution (Human-in-the-Loop) | ✅ Done — tagged `phase-8-complete` |

---

## Phase 9 — Multi-Agent Orchestration

**Goal:** Replace the single ReAct agent with an orchestrator that routes tasks to specialist agents.

- Orchestrator agent routes tasks to specialist agents via LangGraph `StateGraph`
- Planner Agent: breaks complex tasks into steps
- Researcher Agent: web search + document retrieval
- Coder Agent: code generation and file operations (refactor of existing `coder_agent.py`)
- Reviewer Agent: reviews output from other agents
- New WSEvent: `agent.handoff` (shows which agent is active, in the activity panel)
- Activity panel shows each agent distinctly (own color/label)
- **Architecture decision:** agent state and coordination stay **in-process** (asyncio, same pattern as the Phase 8 approval store) — no Redis yet. The system is single-process/single-worker at this stage, so distributed coordination isn't needed yet, and introducing it now would mean debugging multi-agent logic and a new infra layer simultaneously.
- **Built-in from the start:** every agent handoff and tool call gets a structured log line (JSON, written to stdout/file) capturing agent name, action, duration, and outcome. Not a dashboard — just structured data that Phase 9.5 will visualize. This is built now because you'll need it to debug handoffs during Phase 9 itself.

---

## Phase 9.5 — Lightweight Observability

**Goal:** Make the structured logs from Phase 9 queryable and visible.

- Parse the structured logs into a simple `/observability` page: timeline view of agent handoffs per task, tool call durations, token counts per turn
- No external dependencies yet (no Prometheus/Grafana) — this is intentionally minimal, proving you understand observability as a *concept* before adopting heavier tooling
- This phase is a strong, standalone interview talking point: "before scaling the system, I built visibility into what each agent was doing and how long it took"

---

## Phase 10 — Repository Intelligence

(Unchanged from original plan)

- Analyze entire project structure, explain architecture from codebase, find bugs across files, suggest refactors, generate documentation
- Uses existing file tools with higher-level analysis prompts

---

## Phase 11 — Workspace Context Engine

(Unchanged from original plan)

- Project dependency graph (`package.json`, `requirements.txt` parsing)
- Recent files tracking, current task awareness
- Injects rich project context into every agent turn automatically

---

## Phase 12 — Reflection Agent

(Unchanged from original plan)

- After an agent produces an answer, a second LLM call reviews and improves it
- Maps to RLHF/self-improvement concepts from the DeepLearning.AI coursework

---

## Phase 12.5 — Redis Migration

**Goal:** Migrate agent coordination state from in-process asyncio to Redis.

- Move the approval store (Phase 8) and multi-agent task state (Phase 9) from in-memory Python objects to Redis
- Enables multiple backend workers (no longer tied to a single process holding state in memory)
- Redis pub/sub used for agent handoff signaling instead of direct in-process callbacks
- **This is the deliberate "why we needed it" phase** — frame it explicitly as: "the in-process version worked for a single worker; Redis was introduced specifically to support horizontal scaling of the backend." This narrative is the actual skill being demonstrated, not the use of Redis itself.

---

## Phase 13 — Autonomous Project Builder

(Unchanged from original plan)

- User: "Build a FastAPI auth service" → Planner creates steps → multi-agent system executes → Reviewer validates output → approval gates on each destructive step (reuses Phase 8 approval system, now Redis-backed)

---

## Phase 13.5 — MCP (Model Context Protocol)

**Goal:** Wrap existing tools (`read_file_tool`, `write_file_tool`, `run_command_tool`, `web_search_tool`) as MCP servers instead of plain LangChain `@tool` functions.

- Demonstrates fluency with Anthropic's MCP standard — directly relevant to AI systems engineering roles
- Existing tool logic doesn't change; this is a protocol/interface layer, not a rewrite
- Good portfolio signal: shows you can adapt a working system to an emerging industry standard rather than treating your first implementation as final

---

## Phase 14 — Local ML Layer

(Unchanged from original plan — this remains the strongest Coursera-to-code demonstration)

- Intent Classifier (Logistic Regression / LightGBM, MLflow-tracked, served via FastAPI): routes user input → developer / research / memory / execution / general_chat
- Complexity Predictor: simple/medium/complex → routes to appropriate model size
- Hugging Face for embeddings/tokenization

---

## Phase 14.5 — PostgreSQL Migration

**Goal:** Move session and memory *metadata* off in-memory storage and ChromaDB-only patterns onto PostgreSQL, while ChromaDB remains the vector store for embeddings.

- Sessions, messages, document metadata, approval audit history → PostgreSQL
- ChromaDB stays — it's still the right tool for vector similarity search; Postgres complements it for relational/audit data, not a replacement
- This phase explicitly teaches (and demonstrates) when to use a vector DB vs. a relational DB — a real architectural decision, not just "add a database"

---

## Phase 15 — Docker + Kubernetes + Full Observability + Deployment

**Goal:** Production-style deployment, upgraded from the original docker-compose-only plan.

- `docker-compose.yml` for one-command local start (Phase 15a)
- Kubernetes manifests (or Helm chart) for a more production-realistic deployment story (Phase 15b)
- Full observability stack: OpenTelemetry traces, Prometheus metrics, Grafana dashboard — upgrading the Phase 9.5 lightweight version into something resembling real production tooling
- CI/CD pipeline
- Vercel for frontend, Render (or a Kubernetes cluster, if pursued) for backend
- Full README with architecture diagram and setup guide

---

## How to Use This Roadmap

- Each phase still gets its own Codex prompt in the existing format (Mission → What Already Exists → exact file changes → File Checklist → Definition of Done)
- Git: one branch per phase (`phase-9-multi-agent`, `phase-9.5-observability`, etc.), tag `phase-N-complete` after Definition of Done passes and the fix is committed
- When describing this project in an internship interview, the strongest narrative beats are the *migrations* (Phase 12.5, 14.5) and the *early observability* (Phase 9.5) — these show systems judgment, not just feature accumulation