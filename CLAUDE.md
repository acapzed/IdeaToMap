# proj_dev_mindmap — Project Context

## Git / Commit Rules

- 커밋 메시지에 `Co-Authored-By: Claude` 등 AI 관련 footer를 추가하지 않는다.

---

## What this project is

An **interactive planning tool** for teams with ideas but limited technical/business knowledge.
Instead of free-text prompts, AI guides users through click-based multiple-choice questions
to surface constraints, align teammates, and produce a realistic mindmap + MVP definition.

Primary target: hackathon teams, capstone students (short deadline, need quick consensus).
Secondary target: non-technical founders wanting to concretize ideas before hiring developers.

Core value: "not a tool that expands ideas — a tool that carves them down to what's actually buildable."

---

## Tech Stack (decided)

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + Vite | Fast setup |
| Styling | Tailwind CSS | |
| State | Zustand | Simple |
| Mindmap renderer | @xyflow/react (react-flow) | Interactive node graph |
| Backend | Express or FastAPI | Thin proxy to Ollama |
| AI runtime | **Ollama** | Local now → GPU server later, same API |
| AI model | **qwen2.5:7b** | Best Korean + JSON + reasoning at 7B |
| Model upgrade path | qwen2.5:14b → 32b → 72b | Just change model name string |

### Why Ollama over WebLLM
- Requires local install but runs real model quality
- OpenAI-compatible API → migration to GPU server = change one env var (`OLLAMA_BASE_URL`)
- Easy model switching: `ollama pull <model>`, change one string in code

---

## Architecture

```
Frontend (React + Vite)
    ↓ fetch
Backend API (Express/FastAPI)   ← OLLAMA_BASE_URL env var
    ↓ OpenAI-compatible call
Ollama (localhost:11434 now → gpu-server later)
```

AI calls stay in backend, not directly from browser (CORS + future migration).

---

## AI Prompt Structure (3 prompts)

| Prompt | Input | Output |
|---|---|---|
| A | one-line idea | constraint questions JSON |
| B | user's answers | trade-off summary |
| C | all answers | mindmap node structure JSON |

All prompts instruct: "respond in valid JSON only."

---

## Mindmap Data Schema (target)

```json
{
  "root": { "id": "root", "label": "idea title" },
  "nodes": [
    { "id": "n1", "label": "Target User", "category": "users", "children": ["n1-1"] },
    { "id": "n1-1", "label": "University students", "status": "confirmed" }
  ],
  "edges": [
    { "source": "root", "target": "n1" }
  ],
  "conflicts": ["n3 conflicts with n5"],
  "warnings": ["Timeline too tight for 5 features"]
}
```

---

## Question Categories (dimensions to cover)

Order matters — purpose and team come first because they change all downstream trade-offs.

```
1. Purpose / Context    ← sets the entire lens (hackathon / capstone / startup / internal / portfolio)
2. Team personas        ← roles, experience level, availability
3. Team strengths/gaps  ← what's buildable, hidden risks
4. Problem & users      ← what to build for whom
5. Feature scope        ← MVP vs post-MVP vs out-of-scope
6. Constraints          ← time / budget / tech limits
7. External deps        ← APIs, data sources, hardware, approvals
8. Deliverables         ← demo / docs / deployment / presentation format
9. Market               ← competitors, differentiation
10. Business model      ← how it sustains (or: not applicable for contest)
11. Risks               ← biggest unknowns
12. Success criteria    ← definition of done for v1
```

### Mindmap top-level nodes (maps to above)
```
Project root
├── Context (purpose + deadline)
├── Team
│   ├── Personas (skills / availability)
│   └── Strengths & gaps
├── Problem & Users
├── Features (MVP / Post / Out-of-scope)
├── Constraints (time / money / tech)
├── External dependencies
├── Market & Differentiation
├── Business model
├── Deliverables
├── Risks
└── Success criteria
```

---

## App Flow (state machine)

```
IDLE
  → LOADING_QUESTIONS   (AI call A: idea → questions)
  → ANSWERING           (user clicks through Q&A)
    → per-answer: trade-off feedback (AI call B, or rule-based)
  → CALCULATING         (AI call C: answers → mindmap JSON)
  → MINDMAP_VIEW        (render + export)

Team Sync branch (deferred):
  ANSWERING → share session link → teammates answer same questions
           → CALCULATING includes conflict detection
```

---

## Backend API Endpoints

```
POST /api/sessions                     → create session → returns root node
POST /api/sessions/:id/questions       → prompt A: idea → questions + skeleton category nodes
POST /api/sessions/:id/answers         → submit ONE answer → returns delta { add_nodes, add_edges, trade_off }
POST /api/sessions/:id/mindmap/enrich  → prompt C: final pass, add conflicts/warnings/suggestions
GET  /api/sessions/:id                 → full session state

[DEFERRED - Team Sync]
GET  /api/sessions/:id  already covers state retrieval
teammates hit same /:id/answers with their own user_id
```

---

## Mindmap Build Strategy (incremental — NOT one-shot)

Mindmap grows live as user answers questions. Three phases:

```
Phase 1 — Skeleton (on /questions response)
  root node created at session start
  category nodes added as greyed-out placeholders

Phase 2 — Growth (per /answers call, rule-based, no AI latency)
  each answer maps deterministically to a category node
  leaf nodes added, category node becomes active

Phase 3 — Enrichment (one AI call at end via /mindmap/enrich)
  conflict edges, warning badges, MVP boundary highlight
  recommendations overlay
```

Node statuses: greyed | active | warning | confirmed

Category → mindmap node mapping:
  purpose         → Context
  team_personas   → Team > Personas
  team_strengths  → Team > Strengths & Gaps
  problem_users   → Problem & Users
  features        → Features (MVP / Post / Out-of-scope)
  constraints     → Constraints
  external_deps   → External Dependencies
  deliverables    → Deliverables
  market          → Market & Differentiation
  business_model  → Business Model
  risks           → Risks
  success         → Success Criteria

## Build Priority Order

```
1. Schemas: session state, node delta format, question JSON
2. Backend skeleton: Express + in-memory store + 5 endpoints (stub)
3. Prompt A: idea → questions (test against Ollama directly first)
4. Frontend skeleton: split panel (Q&A left, mindmap right)
5. IdeaInput → session create → root node renders
6. /questions → skeleton category nodes render (greyed)
7. /answers (rule-based delta) → nodes grow live per answer
8. Trade-off feedback UI per answer
9. Prompt C + /mindmap/enrich → warnings/conflicts overlay
10. Team Sync [DEFERRED]
11. Detailed question design per category [DEFERRED]
```

---

## Deferred / TODO

- [ ] Detailed question design per category (exact questions, options, trade-off weights)
- [ ] Team Sync session sharing flow
- [ ] Export: PDF / image of mindmap
- [ ] MVP definition text document generation
- [ ] Competitor analysis table generation
- [ ] Gamification: resource bar depleting as features are added

---

## Key Decisions Log

| Decision | Choice | Reason |
|---|---|---|
| AI runtime | Ollama (not WebLLM) | GPU server migration path, real model quality |
| Model | qwen2.5:7b | Korean support + JSON reliability + speed |
| AI calls location | Backend only | CORS, migration ease |
| Detail questions | Deferred | Skeleton first |
| Team Sync | Deferred | Core flow first |
