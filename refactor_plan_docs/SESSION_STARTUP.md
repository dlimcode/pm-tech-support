# Session Startup Protocol
**Purpose**: Claude's mandatory orientation checklist for every coding session
**Usage**: Read this FIRST, every time, no exceptions

---

## 🎯 Session Initialization Sequence

### Step 1: Identify Current State (MANDATORY)

**Read in this exact order:**

1. **Read**: `refactor_plan_docs/PROJECT_STATE.md`
   - Current phase
   - Last completed task
   - Active blockers
   - Next task ID

2. **Read**: `refactor_plan_docs/PROGRESS_TRACKER.md`
   - Find current phase section
   - Identify next unchecked task
   - Review recent completions

3. **Read**: `refactor_plan_docs/CODING_DIRECTIVES.md`
   - Review principles relevant to current phase
   - Internalize anti-patterns
   - Check forbidden actions list

---

### Step 2: Verify Understanding (MANDATORY)

**Before proceeding, confirm:**

- [ ] I know which phase we're in
- [ ] I know the next task to complete
- [ ] I understand why this task is important
- [ ] I know how to test the task when done
- [ ] I've read the coding directives

**If ANY checkbox is unchecked, STOP and ask user for clarification.**

---

### Step 3: Context Validation (MANDATORY)

**Verify these facts match PROJECT_STATE.md:**

```bash
# Check actual codebase size
wc -l server.js
# Should match: ~2,925 lines (Phase 0) or decreasing (Phase 1+)

# Check database schema
# Verify tables exist based on current phase
```

**If reality doesn't match PROJECT_STATE.md:**
- STOP immediately
- Report discrepancy to user
- Do NOT proceed until resolved

---

### Step 4: Load Minimal Necessary Context

**Based on current phase, read ONLY what's needed:**

**If Phase 0 (Statelessness Fix):**
- Read: `REVISED_ACTION_PLAN_VERIFIED.md` Phase 0 section only
- Grep: `const.*= new Map\(\)` in server.js to find targets
- Query: Check if conversation_sessions table exists

**If Phase 1 (Refactoring):**
- Read: `REVISED_ACTION_PLAN_VERIFIED.md` Phase 1 section only
- Read: Current service being extracted (check PROJECT_STATE.md)
- Grep: Find all usages of functions being moved

**If Phase 2 (KB Migration):**
- Read: `REVISED_ACTION_PLAN_VERIFIED.md` Phase 2 section only
- Check: knowledge_base table schema
- Verify: Migration script status

**If Phase 3-5 (Enhancements):**
- Read: Specific enhancement section from action plan
- Check: Dependencies completed

**DO NOT read entire action plan - only current phase section**

---

### Step 5: Declare Intention (MANDATORY)

**Before writing ANY code, state clearly:**

```
Current Phase: [X]
Current Task: [Description from PROGRESS_TRACKER.md]
Files to Modify: [List]
Testing Strategy: [How to verify]
Estimated Risk: [Low/Medium/High]
Rollback Plan: [How to undo if fails]
```

**Wait for user acknowledgment if risk is Medium or High.**

---

## 🤖 Autonomous Decision Tree

### "What should I do next?"

```
START
  ↓
Read PROJECT_STATE.md → Current Phase = ?
  ↓
┌─────────────┬──────────────┬──────────────┬──────────────┐
│ Phase 0     │ Phase 1      │ Phase 2      │ Phase 3-5    │
└─────────────┴──────────────┴──────────────┴──────────────┘
  ↓             ↓              ↓              ↓
Check PROGRESS_TRACKER.md → Find first unchecked [ ] task
  ↓
Is there a blocker noted?
  ↓
YES → Ask user to resolve → STOP
NO → Continue
  ↓
Read task-specific section from ACTION_PLAN
  ↓
Can I complete this task with existing context?
  ↓
YES → Declare intention → Execute
NO → Load additional context (grep, read) → Declare intention → Execute
  ↓
After completion → Update PROGRESS_TRACKER.md checkbox
  ↓
After completion → Update PROJECT_STATE.md last_task_completed
  ↓
Run verification/tests for this task
  ↓
Tests pass?
  ↓
YES → Move to next task
NO → Rollback → Report to user → STOP
```

---

## 🚨 Session Startup Checklist

**Every session, confirm:**

- [ ] Read PROJECT_STATE.md
- [ ] Know current phase and next task
- [ ] Read relevant CODING_DIRECTIVES.md section
- [ ] Verified current state matches expectations
- [ ] Loaded minimal necessary context
- [ ] Declared intention before coding
- [ ] Know how to test when done
- [ ] Know rollback plan if fails

**If user just says "continue" or "proceed":**
1. Follow decision tree above
2. Pick up from PROJECT_STATE.md last_task_completed
3. Find next unchecked task in PROGRESS_TRACKER.md
4. Execute autonomously

---

## 📊 Context Budget Management

**With 200k token limit, prioritize:**

**Always Loaded (15-20k tokens):**
- SESSION_STARTUP.md (this file)
- PROJECT_STATE.md
- CODING_DIRECTIVES.md
- Current task from PROGRESS_TRACKER.md
- Relevant section from ACTION_PLAN

**Load On-Demand (30-50k tokens):**
- Specific code sections being modified (via Read with offset/limit)
- Database schema for tables being used (via targeted queries)
- Test files for current feature

**Never Load Unless Explicitly Needed:**
- Entire server.js (2,925 lines = ~30k tokens)
- Entire ACTION_PLAN (all phases)
- Historical context from previous sessions
- Documentation files not relevant to current task

**Smart Loading Patterns:**
```javascript
// ❌ DON'T: Read entire file
Read server.js

// ✅ DO: Read targeted section
Grep "function handleMessage" server.js → Get line number
Read server.js offset:750 limit:100

// ❌ DON'T: Read all tables
list_tables → Returns 50k tokens

// ✅ DO: Query specific table
execute_sql "SELECT column_name FROM information_schema.columns
             WHERE table_name = 'conversation_sessions'"
```

---

## 🎯 Staying Aligned: Self-Check Questions

**Before each code change, ask myself:**

1. **Is this the next task in PROGRESS_TRACKER.md?**
   - If NO: Why am I doing this instead? Justify or stop.

2. **Does this follow CODING_DIRECTIVES.md?**
   - Evidence-based? Simplest solution? No over-engineering?

3. **Can I test this immediately after?**
   - If NO: Don't code it yet. Plan testing first.

4. **Will this break existing functionality?**
   - If MAYBE: Grep for all usages first.

5. **Am I staying in scope?**
   - If touching unrelated code: Stop and justify.

**If ANY answer is concerning, STOP and ask user.**

---

## 🔄 Session End Protocol

**Before ending session, ALWAYS update:**

1. **Update PROJECT_STATE.md:**
   ```yaml
   last_task_completed: "Created conversation_sessions table"
   last_task_id: "P0.DB.1"
   next_task_id: "P0.DB.2"
   session_notes: "Table created successfully, indexes verified"
   blockers: [] or ["Waiting for CRM API credentials"]
   ```

2. **Update PROGRESS_TRACKER.md:**
   - Check off completed tasks: [x]
   - Add notes if needed
   - Note any discoveries

3. **Commit state:**
   ```bash
   git add refactor_plan_docs/PROJECT_STATE.md
   git add refactor_plan_docs/PROGRESS_TRACKER.md
   git commit -m "Session: Completed [task description]"
   ```

**This ensures next session picks up seamlessly.**

---

## 💡 User Oversight Model

**User's role:**
- ✅ Verify my declared intentions before I code
- ✅ Approve Medium/High risk changes
- ✅ Resolve blockers noted in PROJECT_STATE.md
- ✅ Review completed work periodically
- ✅ Adjust priorities if needed

**User does NOT need to:**
- ❌ Tell me what to do next (I read PROJECT_STATE.md)
- ❌ Remind me of principles (I read CODING_DIRECTIVES.md)
- ❌ Explain the plan (I read ACTION_PLAN)
- ❌ Track progress (I update PROGRESS_TRACKER.md)

**User can simply say:**
- "Continue" → I pick up where I left off
- "What's next?" → I report from PROJECT_STATE.md
- "Proceed" → I execute next task
- "Status?" → I report progress from PROGRESS_TRACKER.md

---

## 🚀 Quick Start Commands

**User says:** → **I do:**

`"Continue"` → Read PROJECT_STATE.md → Execute next task

`"Status?"` → Report current phase, last completed task, next task

`"Review progress"` → Summarize PROGRESS_TRACKER.md completion %

`"What's blocking?"` → Report blockers from PROJECT_STATE.md

`"Start Phase X"` → Update PROJECT_STATE.md → Begin Phase X first task

`"Test current work"` → Run tests for recently completed tasks

---

## 🎓 Learning from Failures

**If I produce "AI slop" or deviate:**

**User should add to PROJECT_STATE.md → lessons_learned:**
```yaml
lessons_learned:
  - "Don't refactor unrelated code while fixing bugs"
  - "Always grep for usages before changing function signatures"
  - "Test after EVERY change, not batched at end"
```

**I will read lessons_learned in Step 1 and avoid repeating mistakes.**

---

## ✅ Success Indicators

**Good session if:**
- Started by reading SESSION_STARTUP.md
- Completed next task from PROGRESS_TRACKER.md
- Followed CODING_DIRECTIVES.md
- Updated state files at end
- Tests passing
- No scope creep

**Bad session if:**
- Jumped straight to coding without reading state
- Did random tasks not in PROGRESS_TRACKER.md
- Broke existing functionality
- Didn't update state files
- User had to redirect me multiple times

---

**Remember: I am an autonomous agent with oversight, not a directive-following robot. I read state, decide what's next, declare intention, execute, verify, update state. User verifies and approves, doesn't micromanage.**
