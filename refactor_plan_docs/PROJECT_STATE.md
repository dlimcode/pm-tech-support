# Project State
**Purpose**: Single source of truth for "where are we now?"
**Updated**: Every session end
**Read**: Every session start

---

## 📍 Current Status

```yaml
# CURRENT STATE
project_phase: "Phase 0 - Critical Bug Fixes"
phase_status: "In Progress - Conversation Context Refactored"
current_task_id: "P0.CODE.2"
current_task: "Test conversation persistence"

# COMPLETION TRACKING
overall_progress_percent: 5
phase_0_progress_percent: 17
phase_1_progress_percent: 0
phase_2_progress_percent: 0
phase_3_progress_percent: 0
phase_4_progress_percent: 0
phase_5_progress_percent: 0

# LAST SESSION
last_session_date: "2025-10-22"
last_task_completed: "Conversation context refactored - removed Map, added database functions, updated all usages"
last_task_id: "P0.CODE.1"
next_task_id: "P0.CODE.2"

# BLOCKERS
blockers:
  - none currently

# ACTIVE BRANCHES
git_branch: "main"
staging_branch: null
production_branch: "main"

# DEPLOYMENTS
last_staging_deploy: null
last_production_deploy: null
staging_health: "N/A"
production_health: "STABLE (with known bugs)"
```

---

## 🎯 Current Phase Details

### Phase 0: Critical Bug Fixes

**Objective**: Fix statelessness bug to enable all other features

**Key Milestones**:
- [ ] Database tables created (conversation_sessions, active_ticket_flows)
- [ ] Conversation context refactored to use Supabase
- [ ] Ticket flow state refactored to use Supabase
- [ ] Tests passing (cold start resilience)
- [ ] Deployed to staging for 48hr soak test

**Target Completion**: Week 1-2 (Not started)

**Current Focus**: Database setup

---

## 📊 What Needs to Happen Next

### Immediate Next Task (P0.CODE.1)

**Task**: Remove conversationContext Map and add database functions
**Location**: refactor_plan_docs/REVISED_ACTION_PLAN_VERIFIED.md → Phase 0 → Step 2
**Files**: server.js (line 18, plus new functions)
**Testing**: Grep for all usages, verify compilation
**Risk**: Medium (code changes, affects message handling)

**Success Criteria**:
- [ ] Line 18 Map declaration removed
- [ ] getConversationHistory() function added
- [ ] addToConversation() function added
- [ ] Error handling implemented
- [ ] Checkbox marked in PROGRESS_TRACKER.md

### Next 3 Tasks After That

1. **P0.CODE.2**: Update all conversationContext.get/set usages
2. **P0.CODE.3**: Test conversation persistence
3. **P0.CODE.4**: Remove ticketCollectionState Map declaration

---

## 🚨 Known Issues & Blockers

### Active Blockers
```yaml
blockers: []
```

### Known Bugs (Not Blocking)
- Statelessness bug (being fixed in Phase 0)
- Learning loop barely functional (1 entry in 4 months)
- No interactive Lark cards (text only)

### Technical Debt
- 2,925-line monolith (being fixed in Phase 1)
- Inefficient KB loading (being fixed in Phase 2)
- Manual Lark API calls (being fixed in Phase 4)

---

## 🗂️ Key Files & Their Status

### Code Files
```yaml
server.js:
  status: "needs_refactoring"
  size_lines: 2925
  target_size: 400
  current_functions: 33
  target_functions: 5-10

services/:
  status: "does_not_exist"
  target: "5 service files"

package.json:
  status: "stable"
  dependencies_ok: true
```

### Database
```yaml
schema: "support"
project_id: "auclowlvfmvrtfiuqdqf"

tables:
  support.knowledge_base:
    status: "exists"
    rows: 1
    needs: "embedding column + migration"

  support.message_logs:
    status: "exists"
    rows: "unknown"
    needs: "nothing"

  "FYPschema_blue".support_tickets:
    status: "exists"
    rows: 25
    needs: "nothing"

  support.conversation_sessions:
    status: "exists"
    rows: 0
    needs: "code integration"

  support.active_ticket_flows:
    status: "exists"
    rows: 0
    needs: "code integration"
```

### Documentation
```yaml
refactor_plan_docs/:
  status: "complete"
  files:
    - SESSION_STARTUP.md (mandatory read)
    - PROJECT_STATE.md (this file)
    - CODING_DIRECTIVES.md (principles)
    - REVISED_ACTION_PLAN_VERIFIED.md (roadmap)
    - PROGRESS_TRACKER.md (tasks)
    - QUICK_REFERENCE.md (lookup)
    - IMPLEMENTATION_VERIFICATION.md (analysis)
```

---

## 🧪 Testing Status

### Test Coverage
```yaml
unit_tests: "none"
integration_tests: "manual only"
e2e_tests: "none"

test_scripts:
  test-statelessness-fix.js:
    status: "not_created"
    needed_for: "Phase 0 validation"
```

### Verification Needed
- [ ] Conversation persists across cold starts (Phase 0)
- [ ] Ticket flows complete successfully (Phase 0)
- [ ] Services work independently (Phase 1)
- [ ] Vector search returns relevant results (Phase 2)

---

## 📈 Progress Metrics

### Completion Tracking

**Phase 0** (0% complete):
- 0 / 35 tasks completed

**Phase 1** (0% complete):
- 0 / 28 tasks completed

**Phase 2** (0% complete):
- 0 / 18 tasks completed

**Phase 3-5** (0% complete):
- 0 / 39 tasks completed

**Overall**: 0 / 120 tasks completed (0%)

### Time Tracking

**Estimated Timeline**: 6-8 weeks
**Elapsed**: 0 weeks
**Remaining**: 6-8 weeks
**On Track**: Yes (just started)

---

## 🎯 Decision Matrix: "What Should I Do Next?"

### If User Says "Continue"
→ Read PROGRESS_TRACKER.md
→ Find first unchecked task in current phase
→ Execute: P0.DB.1 (Create conversation_sessions table)

### If User Says "Status?"
→ Report:
- Current Phase: Phase 0
- Progress: 0%
- Next Task: Create conversation_sessions table
- Blockers: None

### If User Says "Review"
→ Summarize:
- Documentation complete
- Ready to start Phase 0
- No blockers
- Waiting for approval to proceed

### If User Says "Start Phase 0"
→ Execute: P0.DB.1
→ Create SQL for conversation_sessions table
→ Execute via Supabase MCP tool
→ Verify creation
→ Update PROGRESS_TRACKER.md
→ Update this file (PROJECT_STATE.md)
→ Move to P0.DB.2

---

## 🔄 Session Update Template

**At end of each session, update this section:**

```yaml
last_session_date: "YYYY-MM-DD"
last_task_completed: "Description of what was done"
last_task_id: "PX.SECTION.N"
next_task_id: "PX.SECTION.N+1"

session_notes: |
  - What went well
  - What was challenging
  - What was learned

new_blockers:
  - "Description if any"

context_carried_over: |
  - Key information for next session
  - Decisions made
  - Things to remember
```

---

## 📝 Lessons Learned

**Mistakes to Avoid** (will grow over time):
- [ ] (None yet - first session)

**Effective Patterns** (will grow over time):
- ✅ Starting with documentation before coding
- ✅ Evidence-based analysis before planning
- ✅ Detailed action plans with line numbers

---

## 🎓 Context for Next Session

### What Claude Should Know
```yaml
database_ready: false
code_changes_started: false
tests_created: false

next_milestone: "Complete Phase 0 database setup"
critical_files:
  - "server.js lines 18, 39 (Map declarations to remove)"
  - "refactor_plan_docs/REVISED_ACTION_PLAN_VERIFIED.md Phase 0"

dependencies_needed:
  - Supabase project access (✓ confirmed)
  - Environment variables (✓ assumed set)
  - Write access to support schema (? needs verification)
```

### Critical Information
- Server.js is 2,925 lines (NOT 800 as originally estimated)
- Use "support" schema for new tables (NOT FYPschema_blue)
- 4 in-memory Maps need database replacement
- 25 tickets exist but only 1 KB entry (flows are broken)

---

## 🚀 Quick Actions

**User commands I should recognize:**

| Command | Action |
|---------|--------|
| "Continue" | Execute next task from PROGRESS_TRACKER.md |
| "Status?" | Report current phase, task, progress |
| "Review" | Summarize overall progress |
| "What's blocking?" | Report blockers section |
| "Skip to Phase X" | Update phase, start Phase X first task |
| "Rollback" | Revert last change, mark task unchecked |
| "Test" | Run verification for recently completed tasks |

---

**IMPORTANT**: This file is the single source of truth. When in doubt about what to do next, read this file first.
