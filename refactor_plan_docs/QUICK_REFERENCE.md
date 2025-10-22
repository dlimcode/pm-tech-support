# Quick Reference Guide
**Purpose**: Fast lookup for key decisions and constraints
**When to Use**: Before starting any coding task

---

## 🚨 Critical Facts (Don't Forget!)

### Database Schema
```
✅ CORRECT: support.conversation_sessions
✅ CORRECT: support.active_ticket_flows
✅ CORRECT: support.knowledge_base
✅ CORRECT: "FYPschema_blue".support_tickets

❌ WRONG: FYPschema_blue.conversation_sessions
❌ WRONG: public.knowledge_base
```

### Codebase Size
- **Actual**: 2,925 lines (NOT 800)
- **Target after refactor**: ~300-400 lines
- **Number of functions**: 33

### Supabase Project
- **Project ID**: `auclowlvfmvrtfiuqdqf`
- **Primary Schema**: `support`
- **Secondary Schema**: `FYPschema_blue` (for tickets table only)

---

## 📋 Before You Code Checklist

**Every time, no exceptions:**

1. [ ] Read CODING_DIRECTIVES.md section related to task
2. [ ] Check actual code (don't assume)
3. [ ] Verify database schema/table exists
4. [ ] Confirm no over-engineering
5. [ ] Plan rollback strategy

---

## 🎯 Current Priority

**Phase**: [Update manually as phases complete]

**This Week's Focus**:
- [ ] [Update from PROGRESS_TRACKER.md]

**Next Milestone**:
- [ ] [Update from REVISED_ACTION_PLAN_VERIFIED.md]

---

## 🛠️ Common Patterns to Reuse

### Database Query Pattern
```javascript
async function getData(id) {
  try {
    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Error fetching data:', error, 'id:', id);
      return null; // Graceful fallback
    }

    return data;
  } catch (error) {
    console.error('❌ Exception in getData:', error);
    return null;
  }
}
```

### Logging Pattern
```javascript
console.log('🔍 Doing thing:', variable);  // Info
console.error('❌ Error in function:', error);  // Error
console.log('✅ Success:', result);  // Success
```

### Function Signature Pattern
```javascript
// Existing style in codebase:
async function doSomething(chatId, userId, message) {
  // ...
}

// NOT like this:
const doSomething = async (chatId, userId, message) => {
  // ...
};
```

---

## ⚠️ Danger Zones

**High Risk - Extra Careful:**

1. **Lines 750-900**: Main message handling logic
2. **Lines 2067-2280**: Escalation and ticket flow
3. **Lines 1126-1189**: Lark API sendMessage function
4. **Any Map usage**: These ALL need database replacement

**Before Touching These**:
- Read surrounding 50 lines
- Grep for all callers
- Test thoroughly after changes

---

## 🔧 Useful Commands

### Find Functions
```bash
grep -n "^async function\|^function" server.js
```

### Find All Usages of X
```bash
grep -n "functionName(" server.js
```

### Count Lines in File
```bash
wc -l server.js
```

### Check Database Table Exists
```bash
# Via MCP tool or:
psql $SUPABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema='support';"
```

### Test Bot Locally
```bash
npm start
# In another terminal:
curl -X POST http://localhost:3001/lark/events -H "Content-Type: application/json" -d @test-event.json
```

---

## 📦 Dependencies (Don't Add More)

**Existing (Keep Using)**:
- `@larksuiteoapi/node-sdk: ^1.22.0`
- `@supabase/supabase-js: ^2.50.0`
- `openai: ^4.20.0`
- `express: ^4.18.2`

**Do NOT add**:
- Other ORMs (Prisma, etc.)
- Other LLM libraries
- Heavy frameworks
- Anything not approved by user

---

## 🎨 Code Style Rules

### Naming
- Functions: `camelCase`
- Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Files: `snake_case.js`

### Indentation
- **2 spaces** (not tabs)
- Match existing code exactly

### Comments
```javascript
// Single line comment - lowercase start
// Explain WHY, not WHAT

/**
 * Multi-line comment for complex functions
 */
```

---

## 📊 Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Response time | < 2s | ~2-3s |
| KB query time | < 500ms | N/A (loading full file) |
| OpenAI cost/month | < $100 | ~$200-300 |
| Ticket completion rate | 100% | ~40% (broken flows) |

---

## 🔍 Debugging Checklist

**When something doesn't work:**

1. [ ] Check server logs for errors
2. [ ] Verify database connection
3. [ ] Confirm table/column exists
4. [ ] Check environment variables
5. [ ] Test with simple input first
6. [ ] Read actual error message (don't assume)
7. [ ] Grep for recent changes to related code
8. [ ] Test rollback to previous version

---

## 📞 When to Ask User

**Always ask before**:
- [ ] Adding new npm package
- [ ] Changing database schema (show SQL first)
- [ ] Deleting any code
- [ ] Modifying API endpoints
- [ ] Changing environment variables
- [ ] Deploying to production

**Can proceed without asking**:
- [ ] Bug fixes using existing patterns
- [ ] Adding error handling
- [ ] Improving logging
- [ ] Following REVISED_ACTION_PLAN_VERIFIED.md

---

## 🎯 Success Indicators

**Good session if**:
- ✅ Completed tasks from PROGRESS_TRACKER.md
- ✅ No new bugs introduced
- ✅ Tests still passing
- ✅ Code is simpler than before
- ✅ Followed CODING_DIRECTIVES.md

**Bad session if**:
- ❌ Broke existing functionality
- ❌ Added complexity
- ❌ Guessed at APIs without verifying
- ❌ Skipped testing
- ❌ Over-engineered solution

---

## 📚 Document Hierarchy

**Read in this order**:

1. **QUICK_REFERENCE.md** (this file) - Start here
2. **CODING_DIRECTIVES.md** - How to code
3. **IMPLEMENTATION_VERIFICATION.md** - What's actually there
4. **REVISED_ACTION_PLAN_VERIFIED.md** - What to build
5. **PROGRESS_TRACKER.md** - Track progress

**Original docs** (for reference):
- GEMINI_REVIEW_ANALYSIS.md - Original Gemini review
- REVISED_ACTION_PLAN.md - Original Gemini plan

---

## 🔄 Weekly Routine

**Monday**:
- [ ] Review PROGRESS_TRACKER.md
- [ ] Set week goals
- [ ] Update "This Week's Focus" above

**Friday**:
- [ ] Update PROGRESS_TRACKER.md with completions
- [ ] Note blockers/issues
- [ ] Plan next week

**After each coding session**:
- [ ] Update relevant checkboxes in PROGRESS_TRACKER.md
- [ ] Note any deviations from plan
- [ ] Update "Current Priority" above

---

## 💾 Backup & Safety

**Before major changes**:
```bash
# Create git branch
git checkout -b phase-X-implementation

# Commit current state
git add .
git commit -m "Checkpoint before phase X"

# Can rollback with:
git checkout main
```

**Database backups**:
- Supabase has automatic backups
- Can export specific tables via dashboard
- Test restore procedure before needing it

---

## 🚀 Deployment Checklist

**Before deploying**:
- [ ] All tests pass locally
- [ ] Environment variables set in Vercel
- [ ] Database migrations applied
- [ ] No console.error in happy path
- [ ] Staging tested for 24+ hours
- [ ] User approved changes

**Deploy command**:
```bash
vercel --prod
```

**Rollback command** (if needed):
```bash
vercel rollback
```

---

**Keep this file updated as you learn new patterns and gotchas!**
