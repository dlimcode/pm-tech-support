# Coding Directives & Principles
**Purpose**: Keep Claude aligned, prevent hallucination, avoid over-engineering
**Date**: October 22, 2025
**Status**: MANDATORY - All code changes must follow these directives

---

## 🎯 Core Principles

### 1. EVIDENCE-BASED DECISIONS ONLY

**Directive**: Never assume, always verify

**Rules**:
- ✅ Read actual code before making changes
- ✅ Query database to verify schema/data
- ✅ Test assumptions with grep/search
- ❌ Don't trust memory or previous assumptions
- ❌ Don't assume file locations without checking
- ❌ Don't guess API signatures

**Example**:
```javascript
// ❌ WRONG - Assuming function exists
await knowledgeService.search(query);

// ✅ CORRECT - Verify first
// 1. Grep for function: grep "search.*query" services/*.js
// 2. Read function signature
// 3. Use correct parameters
```

---

### 2. NO OVER-ENGINEERING

**Directive**: Simplest solution that works

**Rules**:
- ✅ Use existing patterns in codebase
- ✅ Minimal changes to achieve objective
- ✅ Reuse existing Supabase/OpenAI/Lark clients
- ❌ Don't introduce new frameworks/libraries
- ❌ Don't create abstractions unless needed 3+ times
- ❌ Don't refactor code not related to task

**Example**:
```javascript
// ❌ WRONG - Over-engineered factory pattern
class ConversationContextFactory {
  createStrategy(type) {
    return new DatabaseStrategy(this.config);
  }
}

// ✅ CORRECT - Simple direct implementation
async function getConversationHistory(chatId) {
  const { data } = await supabase
    .from('conversation_sessions')
    .select('messages')
    .eq('chat_id', chatId)
    .single();
  return data?.messages || [];
}
```

---

### 3. PRESERVE EXISTING FUNCTIONALITY

**Directive**: Don't break what works

**Rules**:
- ✅ Test that existing flows still work after changes
- ✅ Keep same function signatures when possible
- ✅ Maintain backward compatibility
- ❌ Don't rename functions used elsewhere without grep verification
- ❌ Don't change return types without checking all callers
- ❌ Don't remove code without confirming it's unused

**Verification Process**:
```bash
# Before changing function X:
1. grep -n "function X\|async function X" server.js
2. grep -n "X(" server.js  # Find all callers
3. Verify all callsites work with new implementation
```

---

### 4. SCHEMA CONSISTENCY

**Directive**: Use correct database schema locations

**Rules**:
- ✅ New support tables go in **"support" schema**
- ✅ Check existing table locations before querying
- ✅ Use schema-qualified table names in queries
- ❌ Don't assume tables are in "public" schema
- ❌ Don't mix schemas without explicit reason

**Reference**:
```sql
-- ✅ CORRECT - Existing structure
support.knowledge_base
support.message_logs
"FYPschema_blue".support_tickets

-- ✅ CORRECT - New tables location
support.conversation_sessions  -- NOT FYPschema_blue!
support.active_ticket_flows    -- NOT public!
```

---

### 5. INCREMENTAL CHANGES

**Directive**: Small, testable changes

**Rules**:
- ✅ One feature/fix per commit
- ✅ Test after each change
- ✅ Can rollback individual changes
- ❌ Don't make multiple unrelated changes at once
- ❌ Don't refactor while fixing bugs
- ❌ Don't change code you're not testing

**Change Sequence**:
```
Bad: Change 5 files, test once at end
Good: Change 1 file → Test → Commit → Change next file
```

---

### 6. EXPLICIT ERROR HANDLING

**Directive**: Handle all failure cases

**Rules**:
- ✅ Wrap database calls in try-catch
- ✅ Log errors with context (chatId, userId, etc.)
- ✅ Return graceful degradation on failures
- ❌ Don't use empty catch blocks
- ❌ Don't assume database calls succeed
- ❌ Don't skip validation

**Template**:
```javascript
// ✅ CORRECT
async function getConversationHistory(chatId) {
  try {
    const { data, error } = await supabase
      .from('conversation_sessions')
      .select('messages')
      .eq('chat_id', chatId)
      .single();

    if (error) {
      console.error('Error fetching conversation:', error, 'chatId:', chatId);
      return []; // Graceful fallback
    }

    return data?.messages || [];
  } catch (error) {
    console.error('Exception in getConversationHistory:', error);
    return []; // Don't crash, return empty
  }
}
```

---

### 7. NO HALLUCINATION

**Directive**: Only use verified APIs and patterns

**Rules**:
- ✅ Check package documentation for actual API
- ✅ Read existing code for usage patterns
- ✅ Verify Supabase/OpenAI methods exist
- ❌ Don't invent API methods that don't exist
- ❌ Don't use placeholder code without implementation
- ❌ Don't assume library capabilities

**Verification Checklist**:
- [ ] Supabase method? → Check @supabase/supabase-js docs or existing usage
- [ ] OpenAI method? → Check openai package docs or existing usage
- [ ] Lark SDK method? → Check @larksuiteoapi/node-sdk docs or scrape API
- [ ] Custom function? → Grep codebase to find actual implementation

---

### 8. MAINTAIN EXISTING PATTERNS

**Directive**: Code should look like it belongs

**Rules**:
- ✅ Follow existing naming conventions (camelCase for functions)
- ✅ Use same indentation style (2 spaces)
- ✅ Match existing logging format
- ✅ Use same error handling patterns
- ❌ Don't introduce new code style
- ❌ Don't use different logging approach
- ❌ Don't change formatting in unrelated code

**Pattern Examples**:
```javascript
// Existing pattern in codebase:
console.log('🔍 Processing message:', messageId);
console.error('❌ Error fetching user:', error);

// ✅ MATCH THIS STYLE
console.log('💾 Saving conversation:', chatId);
console.error('❌ Error saving conversation:', error);

// ❌ DON'T INTRODUCE NEW STYLE
logger.info(`Processing message ${messageId}`);
```

---

### 9. PERFORMANCE AWARENESS

**Directive**: Don't make things slower

**Rules**:
- ✅ Use database indexes for frequent queries
- ✅ Limit result sets (LIMIT clause)
- ✅ Cache when appropriate
- ❌ Don't query database in loops
- ❌ Don't load unnecessary data
- ❌ Don't duplicate queries

**Anti-Pattern**:
```javascript
// ❌ WRONG - N+1 query problem
for (const chatId of chatIds) {
  const history = await getConversationHistory(chatId);
}

// ✅ CORRECT - Batch query
const { data } = await supabase
  .from('conversation_sessions')
  .select('chat_id, messages')
  .in('chat_id', chatIds);
```

---

### 10. SECURITY FIRST

**Directive**: Never expose sensitive data

**Rules**:
- ✅ Validate all user inputs
- ✅ Use parameterized queries
- ✅ Keep API keys in environment variables
- ❌ Don't log sensitive data (tokens, keys)
- ❌ Don't trust user input in SQL
- ❌ Don't expose internal errors to users

**Example**:
```javascript
// ❌ WRONG
console.log('Access token:', accessToken);
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ CORRECT
console.log('Access token obtained successfully');
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId);
```

---

## 📋 Pre-Coding Checklist

Before writing any code, verify:

- [ ] I have read the actual code I'm modifying
- [ ] I have verified database schema/table locations
- [ ] I understand existing patterns in the codebase
- [ ] I have a plan to test the changes
- [ ] I know how to rollback if needed
- [ ] I checked that functions/methods I'm using actually exist
- [ ] I'm not over-engineering the solution
- [ ] I'm not breaking existing functionality

---

## 🚫 Forbidden Actions

**NEVER do these without explicit user approval**:

1. ❌ Install new npm packages
2. ❌ Change database schema without showing SQL first
3. ❌ Modify package.json dependencies
4. ❌ Delete existing functions without grep verification
5. ❌ Change API endpoints or webhook handlers
6. ❌ Modify environment variable requirements
7. ❌ Alter Vercel deployment configuration
8. ❌ Refactor unrelated code "while you're at it"

---

## ✅ Code Review Self-Check

After writing code, ask yourself:

1. **Is this the simplest solution?**
   - If you used a design pattern, why?
   - Could it be done with fewer lines?

2. **Did I verify all assumptions?**
   - Did I check the actual API?
   - Did I query the database to confirm?

3. **Will this work on Vercel serverless?**
   - No in-memory state?
   - No file system dependencies?

4. **Is error handling complete?**
   - What if database is down?
   - What if Lark API fails?
   - What if OpenAI times out?

5. **Does it match existing code style?**
   - Same naming conventions?
   - Same logging format?
   - Same indentation?

---

## 🎯 Success Metrics

**Good Code Changes**:
- ✅ Solves stated problem
- ✅ Doesn't break existing tests
- ✅ Uses existing patterns
- ✅ Under 100 lines per function
- ✅ Clear error messages
- ✅ Can be explained in 2 sentences

**Bad Code Changes**:
- ❌ Adds complexity
- ❌ Introduces new dependencies
- ❌ Breaks existing features
- ❌ Has no error handling
- ❌ Uses unverified APIs
- ❌ Needs extensive explanation

---

## 📞 When to Ask User

**Always ask before**:
- Adding new npm packages
- Changing database schema
- Modifying API contracts
- Deleting code (unless verified unused)
- Making architectural changes
- Introducing new patterns not in codebase

**Can proceed without asking**:
- Bug fixes using existing patterns
- Adding error handling
- Improving logging
- Adding comments
- Refactoring within same file (if tested)

---

**Remember**: Code that works simply is better than code that's clever. The best code is code the user can understand and maintain.
