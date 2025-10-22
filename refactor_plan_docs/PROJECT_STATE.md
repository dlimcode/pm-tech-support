# Project State
**Purpose**: Single source of truth for "where are we now?"
**Updated**: Every session end
**Read**: Every session start

---

## 📍 Current Status

```yaml
# CURRENT STATE
project_phase: "Phase 0 - Critical Bug Fixes"
phase_status: "In Progress - Code Refactoring Complete, Testing Next"
current_task_id: "P0.TEST.1"
current_task: "Test ticket flow persistence across cold starts"

# COMPLETION TRACKING
overall_progress_percent: 8
phase_0_progress_percent: 45
phase_1_progress_percent: 0
phase_2_progress_percent: 0
phase_3_progress_percent: 0
phase_4_progress_percent: 0
phase_5_progress_percent: 0

# LAST SESSION
last_session_date: "2025-10-22"
last_task_completed: "Ticket flow state refactored - removed Map, added database functions, updated all usages"
last_task_id: "P0.CODE.4"
next_task_id: "P0.TEST.1"

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
- [x] Database tables created (conversation_sessions, active_ticket_flows)
- [x] Conversation context refactored to use Supabase
- [x] Ticket flow state refactored to use Supabase
- [ ] Tests passing (cold start resilience)
- [ ] Deployed to staging for 48hr soak test

**Target Completion**: Week 1-2 (In Progress - 45% complete)

**Current Focus**: Testing ticket flow persistence

---

## 📊 What Needs to Happen Next

### Immediate Next Task (P0.TEST.1)

**Task**: Test ticket flow persistence across cold starts
**Location**: Validate database functions work correctly
**Files**: None (testing only, database queries)
**Testing**: Insert test ticket flow, update steps, verify persistence, cleanup
**Risk**: Low (testing only with isolated test data)

**Success Criteria**:
- [ ] Start ticket flow in database
- [ ] Simulate step 1 (title) update
- [ ] Simulate step 2 (description) update
- [ ] Verify state persists correctly
- [ ] Verify flow cleanup works
- [ ] Test data cleaned up
- [ ] Checkbox marked in PROGRESS_TRACKER.md

### Next 3 Tasks After That

1. **P0.TEST.2**: Create comprehensive test script (test-statelessness-fix.js)
2. **P0.TEST.3**: Manual end-to-end testing
3. **P0.DEPLOY.1**: Deploy to staging for soak test

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
    status: "integrated and tested"
    rows: 0
    needs: "nothing (ready for production)"

  support.active_ticket_flows:
    status: "integrated"
    rows: 0
    needs: "testing (next task)"
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
- [x] Conversation persists across cold starts (Phase 0) ✅ TESTED
- [ ] Ticket flows complete successfully (Phase 0)
- [ ] Services work independently (Phase 1)
- [ ] Vector search returns relevant results (Phase 2)

---

## 📈 Progress Metrics

### Completion Tracking

**Phase 0** (45% complete):
- 10 / 22 tasks completed (Database + Code refactoring complete)

**Phase 1** (0% complete):
- 0 / 28 tasks completed

**Phase 2** (0% complete):
- 0 / 18 tasks completed

**Phase 3-5** (0% complete):
- 0 / 39 tasks completed

**Overall**: 10 / 120 tasks completed (8%)

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
database_ready: true
code_refactoring_complete: true
conversation_context_complete: true
ticket_flow_complete: true
tests_needed: true

next_milestone: "Test ticket flow persistence"
critical_files:
  - "server.js lines 71-171 (new database functions for ticket flow)"
  - "server.js line 2406+ (startTicketCreation, handleTicketCreationFlow)"
  - "refactor_plan_docs/PROGRESS_TRACKER.md lines 69-76 (testing checklist)"

dependencies_needed:
  - Supabase project access (✓ confirmed)
  - Environment variables (✓ confirmed set)
  - Write access to support schema (✓ verified working)
  - active_ticket_flows table (✓ exists and ready)
```

### Critical Information
- Server.js is 2,925 lines (NOT 800 as originally estimated)
- Use "support" schema for new tables (NOT FYPschema_blue)
- Conversation context: ✅ COMPLETE and TESTED
- Ticket flow state: ✅ COMPLETE (needs testing)
- All 4 in-memory Maps replaced with database functions
- Ready for comprehensive testing phase

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
