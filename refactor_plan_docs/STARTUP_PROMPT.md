# Startup Prompt Template
**Purpose**: What the user should say to start each session
**Usage**: Copy-paste this to begin any coding session

---

## 🚀 For Starting a New Session

### Option 1: Fully Autonomous (Recommended)

```
I need you to look at @SESSION_STARTUP.md and follow the protocol.

Then look at @PROJECT_STATE.md to understand where we are.

Continue with the next task autonomously. Declare your intention before executing.
```

### Option 2: Status Check First

```
I need you to look at @SESSION_STARTUP.md and @PROJECT_STATE.md

Report current status and what you plan to do next.

Wait for my approval before proceeding.
```

### Option 3: Specific Phase/Task

```
I need you to look at @SESSION_STARTUP.md

We're starting Phase X. Follow the startup protocol and begin with the first task.
```

---

## 🎯 For Continuing Mid-Session

### Simple Continue

```
Continue
```

Claude will:
1. Check PROJECT_STATE.md for next task
2. Execute next unchecked task from PROGRESS_TRACKER.md
3. Update state files when done

### Status Check

```
Status?
```

Claude will report:
- Current phase and progress %
- Last completed task
- Next task to execute
- Any blockers

### Review Progress

```
Review progress
```

Claude will:
- Summarize PROGRESS_TRACKER.md
- Report completion percentages
- Highlight blockers
- Estimate remaining time

---

## 🔧 For Specific Actions

### Test Current Work

```
Run tests for recent changes
```

### Rollback Last Change

```
Rollback the last change - it didn't work
```

### Skip Ahead

```
Skip to Phase X - Phase Y is complete
```

### Report Blocker

```
We're blocked on [description]. Update PROJECT_STATE.md and pause.
```

---

## 📋 Weekly Check-in Template

**Monday Morning (Week Start)**

```
I need you to look at @SESSION_STARTUP.md and @PROJECT_STATE.md

We're starting week X of the project.

Review last week's progress, update any metrics, and report what we'll focus on this week.

Then continue with the next task.
```

**Friday Evening (Week End)**

```
End of week review:

1. Update PROJECT_STATE.md with weekly progress
2. Update PROGRESS_TRACKER.md with any notes
3. Summarize what was completed this week
4. Note any blockers for next week
5. Commit state files

Then give me a brief status report.
```

---

## 🚨 Emergency / Problem Solving

### Something's Wrong

```
I need you to look at @SESSION_STARTUP.md

Something is broken. Follow Step 3 (Context Validation) to verify the actual state matches PROJECT_STATE.md.

Report any discrepancies.
```

### Lost Context

```
I need you to look at @SESSION_STARTUP.md and @PROJECT_STATE.md

Re-orient yourself and tell me:
1. What phase are we in?
2. What was the last completed task?
3. What should we do next?
```

### Need to Backtrack

```
The last few tasks didn't work out.

Roll back to [task ID or description].

Update PROJECT_STATE.md and PROGRESS_TRACKER.md accordingly.
```

---

## 📊 Context Management Tips

### If Context is Getting Full (>85%)

**User should say:**

```
Context is at 85%.

Compact the conversation:
1. Preserve SESSION_STARTUP.md, PROJECT_STATE.md, CODING_DIRECTIVES.md
2. Preserve current task context only
3. Summarize previous work completed
4. Clear out old code snippets and discussions
```

### Starting Fresh Session

**User should say:**

```
New session - starting fresh.

Read @SESSION_STARTUP.md and follow the full protocol.

Load minimal context for current task only.
```

---

## 🎓 Best Practices

### DO say:

✅ "Continue" (simple, I know what to do)
✅ "Status?" (quick check-in)
✅ "Review progress" (periodic assessment)
✅ "What's blocking?" (check for issues)
✅ "Look at @SESSION_STARTUP.md" (re-orient)

### DON'T need to say:

❌ "Work on fixing the statelessness bug" (I know from PROJECT_STATE.md)
❌ "Remember to follow coding directives" (I read them in startup)
❌ "We're in Phase 0" (I check PROJECT_STATE.md)
❌ "Next do task X" (I read PROGRESS_TRACKER.md)
❌ "Don't over-engineer" (in CODING_DIRECTIVES.md)

---

## 🔄 Session Flow Example

**User**:
```
I need you to look at @SESSION_STARTUP.md
Continue with next task.
```

**Claude**:
```
Following SESSION_STARTUP.md protocol...

✓ Read PROJECT_STATE.md
  - Current Phase: Phase 0 - Critical Bug Fixes
  - Last completed: Documentation creation
  - Next task: P0.DB.1 - Create conversation_sessions table

✓ Read CODING_DIRECTIVES.md
  - Evidence-based only
  - No over-engineering
  - Schema: "support" (not FYPschema_blue)

✓ Context validation
  - server.js: 2925 lines ✓
  - Supabase project: auclowlvfmvrtfiuqdqf ✓

✓ Loaded minimal context
  - Phase 0 SQL from ACTION_PLAN

DECLARING INTENTION:
---
Current Phase: Phase 0
Current Task: Create conversation_sessions table
Files to Modify: None (SQL only)
Testing Strategy: Query to verify table exists
Estimated Risk: Low
Rollback Plan: DROP TABLE if needed
---

Proceeding to execute SQL via Supabase MCP...
```

**Then Claude executes the task autonomously.**

---

## 💡 Power User Tips

### Quick Status

```
?
```

Claude interprets as "Status?" and reports current state.

### Quick Continue

```
✓
```

Claude interprets as "Continue" and executes next task.

### Quick Rollback

```
↩
```

Claude interprets as "Rollback" and reverts last change.

*Note: These shortcuts only work if established with Claude at project start*

---

## 📁 File References

**Always available for @-mentioning:**

- `@SESSION_STARTUP.md` - Startup protocol
- `@PROJECT_STATE.md` - Current state
- `@CODING_DIRECTIVES.md` - Principles
- `@PROGRESS_TRACKER.md` - Task list
- `@REVISED_ACTION_PLAN_VERIFIED.md` - Full roadmap
- `@QUICK_REFERENCE.md` - Fast lookup

**Load on-demand (more tokens):**

- `@IMPLEMENTATION_VERIFICATION.md` - Analysis
- `@server.js` - Main codebase (30k tokens!)
- `@package.json` - Dependencies

---

## 🎯 Success Metrics

**Good session startup if:**
- Claude starts by reading SESSION_STARTUP.md
- Claude identifies next task from PROJECT_STATE.md
- Claude declares intention before coding
- User only needs to say "Continue"

**Bad session startup if:**
- Claude asks "What should I do?"
- User needs to explain the plan
- User needs to remind of directives
- Claude doesn't know current state

---

**Keep this prompt template handy for quick copy-paste session starts!**
