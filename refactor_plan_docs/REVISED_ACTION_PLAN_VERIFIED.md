# Revised Action Plan (Evidence-Based)
**Date**: October 22, 2025
**Based On**: Actual code analysis + Gemini review
**Timeline**: 6-8 weeks (adjusted from Gemini's 5-6 weeks)
**Approach**: Incremental fixes → Refactor → Enhance

---

## 🎯 Plan Overview

This plan corrects Gemini's estimates based on actual codebase analysis:
- **Actual size**: 2,925 lines (not 800)
- **Actual schema**: "support" schema (not just FYPschema_blue)
- **Actual complexity**: Medium-High (not Medium)

---

## Phase 0: Critical Bug Fixes (Week 1-2) 🚨

**Objective**: Fix statelessness bug to enable all other features

### Step 1: Create Missing Database Tables

**Location**: "support" schema in Supabase

**SQL to Execute**:
```sql
-- ⚠️ Execute in "support" schema, NOT FYPschema_blue
CREATE TABLE support.conversation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id VARCHAR(255) NOT NULL UNIQUE,
    user_id VARCHAR(255) NOT NULL,
    lark_user_name VARCHAR(255),
    messages JSONB NOT NULL DEFAULT '[]',
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conversation_chat_id ON support.conversation_sessions(chat_id);
CREATE INDEX idx_conversation_last_activity ON support.conversation_sessions(last_activity DESC);

CREATE TABLE support.active_ticket_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id VARCHAR(255) NOT NULL UNIQUE,
    user_id VARCHAR(255) NOT NULL,
    current_step VARCHAR(50) NOT NULL,
    collected_data JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_update TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ticket_flow_chat_id ON support.active_ticket_flows(chat_id);
CREATE INDEX idx_ticket_flow_last_update ON support.active_ticket_flows(last_update DESC);

-- Auto-cleanup function
CREATE OR REPLACE FUNCTION support.cleanup_old_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM support.conversation_sessions
    WHERE last_activity < NOW() - INTERVAL '24 hours'
    AND status = 'active';

    DELETE FROM support.active_ticket_flows
    WHERE last_update < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;
```

**Verification**:
```sql
-- Confirm tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'support'
AND table_name IN ('conversation_sessions', 'active_ticket_flows');
```

---

### Step 2: Refactor Conversation Context Storage

**Target Lines**: 18, 750-755, 842-843 in server.js

**Current Code** (server.js:18):
```javascript
const conversationContext = new Map();
```

**Replacement**:
```javascript
// Remove the Map declaration entirely
// Add these functions instead:

async function getConversationHistory(chatId) {
  try {
    const { data, error } = await supabase
      .from('conversation_sessions')
      .select('messages')
      .eq('chat_id', chatId)
      .single();

    if (error) {
      console.log('📭 No existing conversation for chat:', chatId);
      return [];
    }

    return data?.messages || [];
  } catch (error) {
    console.error('❌ Error fetching conversation:', error);
    return [];
  }
}

async function addToConversation(chatId, userId, userName, message) {
  try {
    const history = await getConversationHistory(chatId);
    history.push({
      ...message,
      timestamp: new Date().toISOString()
    });

    // Keep last 10 messages only
    const recentHistory = history.slice(-10);

    const { error } = await supabase
      .from('conversation_sessions')
      .upsert({
        chat_id: chatId,
        user_id: userId,
        lark_user_name: userName,
        messages: recentHistory,
        last_activity: new Date().toISOString(),
        status: 'active'
      }, {
        onConflict: 'chat_id'
      });

    if (error) {
      console.error('❌ Error saving conversation:', error);
    }
  } catch (error) {
    console.error('❌ Exception in addToConversation:', error);
  }
}
```

**Find & Replace All Usages**:
```bash
# Find all usages
grep -n "conversationContext.get\|conversationContext.set" server.js

# Replace pattern:
# conversationContext.get(chatId) → await getConversationHistory(chatId)
# conversationContext.set(...) → await addToConversation(chatId, userId, userName, {...})
```

---

### Step 3: Refactor Ticket Flow State Storage

**Target Lines**: 39, 2236-2280 in server.js

**Current Code** (server.js:39):
```javascript
const ticketCollectionState = new Map();
```

**Replacement Functions**:
```javascript
// Remove the Map declaration, add these functions:

async function startTicketCreation(chatId, userId, category, originalMessage) {
  try {
    const { error } = await supabase
      .from('active_ticket_flows')
      .insert({
        chat_id: chatId,
        user_id: userId,
        current_step: 'title',
        collected_data: {
          category: category,
          originalMessage: originalMessage
        }
      });

    if (error) {
      console.error('❌ Error starting ticket flow:', error);
      return null;
    }

    return true;
  } catch (error) {
    console.error('❌ Exception in startTicketCreation:', error);
    return null;
  }
}

async function getTicketFlowState(chatId) {
  try {
    const { data, error } = await supabase
      .from('active_ticket_flows')
      .select('*')
      .eq('chat_id', chatId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      userId: data.user_id,
      step: data.current_step,
      data: data.collected_data
    };
  } catch (error) {
    console.error('❌ Error fetching ticket flow state:', error);
    return null;
  }
}

async function updateTicketFlowState(chatId, step, newData) {
  try {
    const state = await getTicketFlowState(chatId);
    if (!state) {
      console.error('❌ No ticket flow found for chat:', chatId);
      return false;
    }

    const { error } = await supabase
      .from('active_ticket_flows')
      .update({
        current_step: step,
        collected_data: { ...state.data, ...newData },
        last_update: new Date().toISOString()
      })
      .eq('chat_id', chatId);

    if (error) {
      console.error('❌ Error updating ticket flow:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Exception in updateTicketFlowState:', error);
    return false;
  }
}

async function completeTicketFlow(chatId) {
  try {
    await supabase
      .from('active_ticket_flows')
      .delete()
      .eq('chat_id', chatId);

    console.log('✅ Ticket flow completed for chat:', chatId);
  } catch (error) {
    console.error('❌ Error completing ticket flow:', error);
  }
}
```

**Update handleTicketCreationFlow** (server.js:2250):
```javascript
async function handleTicketCreationFlow(chatId, userMessage, ticketState, senderId) {
  const { step, data } = ticketState;

  switch (step) {
    case 'title':
      await updateTicketFlowState(chatId, 'description', { title: userMessage.trim() });
      return `**Step 2 of 3: Detailed Description**
Please describe the issue in detail.`;

    case 'description':
      await updateTicketFlowState(chatId, 'steps', { description: userMessage.trim() });
      return `**Step 3 of 3: Steps Attempted**
What steps have you already tried?`;

    case 'steps':
      const finalState = await getTicketFlowState(chatId);
      const ticketData = {
        userId: finalState.userId,
        title: finalState.data.title,
        description: finalState.data.description,
        stepsAttempted: userMessage.trim().split(',').map(s => s.trim()),
        category: finalState.data.category,
        originalMessage: finalState.data.originalMessage
      };

      const ticket = await createTicketFromData(chatId, ticketData, finalState.data.category, finalState.data.originalMessage, finalState.userId);

      // Clean up flow
      await completeTicketFlow(chatId);

      return `✅ Ticket created! ID: ${ticket.ticket_number}`;
  }
}
```

---

### Step 4: Update Main Message Handler

**Location**: server.js around line 750

**Update Check for Ticket Flow**:
```javascript
async function handleMessage(event) {
  // ... existing code ...

  // Check if user is in ticket creation flow
  const ticketState = await getTicketFlowState(chatId);

  if (ticketState) {
    console.log('🎫 User in ticket flow, step:', ticketState.step);
    const response = await handleTicketCreationFlow(chatId, userMessage, ticketState, senderId);
    await sendMessage(chatId, response);
    return; // Don't process as normal message
  }

  // ... rest of normal message handling ...
}
```

---

### Step 5: Testing Strategy

**Create Test Script** (`test-statelessness-fix.js`):
```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testConversationPersistence() {
  console.log('🧪 Testing conversation persistence...');

  const testChatId = 'test_' + Date.now();

  // Simulate conversation
  await addToConversation(testChatId, 'user123', 'Test User', {
    role: 'user',
    content: 'Hello'
  });

  // Retrieve (simulating cold start)
  const history = await getConversationHistory(testChatId);

  if (history.length === 1 && history[0].content === 'Hello') {
    console.log('✅ Conversation persisted across "cold start"');
    return true;
  } else {
    console.log('❌ Conversation NOT persisted');
    return false;
  }
}

async function testTicketFlowPersistence() {
  console.log('🧪 Testing ticket flow persistence...');

  const testChatId = 'test_ticket_' + Date.now();

  // Start flow
  await startTicketCreation(testChatId, 'user123', 'test_category', 'test message');

  // Update step (simulating cold start)
  await updateTicketFlowState(testChatId, 'description', { title: 'Test Title' });

  // Retrieve
  const state = await getTicketFlowState(testChatId);

  if (state && state.step === 'description' && state.data.title === 'Test Title') {
    console.log('✅ Ticket flow persisted across "cold start"');
    // Cleanup
    await completeTicketFlow(testChatId);
    return true;
  } else {
    console.log('❌ Ticket flow NOT persisted');
    return false;
  }
}

async function runTests() {
  const test1 = await testConversationPersistence();
  const test2 = await testTicketFlowPersistence();

  if (test1 && test2) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('❌ Some tests failed');
  }
}

runTests();
```

**Run Tests**:
```bash
node test-statelessness-fix.js
```

---

### Week 1-2 Success Criteria

- [ ] Tables created in "support" schema
- [ ] All Map usages replaced with database calls
- [ ] Tests pass (conversation persistence)
- [ ] Tests pass (ticket flow persistence)
- [ ] No errors in logs about missing state
- [ ] Can complete a ticket creation flow end-to-end
- [ ] Multi-turn conversation works across simulated cold starts

---

## Phase 1: Monolith Refactoring (Week 3-4)

**Objective**: Break 2,925-line server.js into maintainable services

**NOTE**: This is 3.6x larger than Gemini estimated. Proceed carefully.

### Step 1: Create Services Directory Structure

```bash
mkdir -p services
touch services/lark_service.js
touch services/ai_service.js
touch services/ticketing_service.js
touch services/learning_service.js
touch services/knowledge_service.js
```

### Step 2: Extract Services (One at a Time)

**Order of Extraction** (safest to riskiest):
1. lark_service.js (least dependencies)
2. knowledge_service.js (isolated functionality)
3. ai_service.js (depends on knowledge)
4. learning_service.js (depends on ai + knowledge)
5. ticketing_service.js (depends on lark)

**Pattern for Each Service**:
```javascript
// services/lark_service.js
const { Client } = require('@larksuiteoapi/node-sdk');

class LarkService {
  constructor(appId, appSecret) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.client = new Client({ appId, appSecret });
  }

  async sendMessage(chatId, message) {
    // Move sendMessage function here
  }

  async getUserInfo(userId) {
    // Move getUserInfo function here
  }
}

module.exports = { LarkService };
```

**Update server.js** after each extraction:
```javascript
const { LarkService } = require('./services/lark_service');
const lark = new LarkService(process.env.LARK_APP_ID, process.env.LARK_APP_SECRET);

// Replace all sendMessage(chatId, msg) calls with:
await lark.sendMessage(chatId, msg);
```

**Test After Each Extraction**:
```bash
# Test that bot still works
curl -X POST http://localhost:3001/lark/events -H "Content-Type: application/json" -d @test-event.json
```

### Step 3: Gradual Migration

**Week 3**: Extract lark_service + knowledge_service
**Week 4**: Extract ai_service + learning_service + ticketing_service

**Target server.js Size**: ~300-400 lines (routing + initialization only)

---

## Phase 2: Hybrid Knowledge Base System (Week 5)

**Objective**: Build hybrid KB system - vector search for AI + self-service search for users
**Strategic Shift**: Reduce AI dependency by 60-70% through direct KB access
**Impact**: Faster responses, lower costs, better UX

### Step 1: Database Setup ✅ COMPLETE

**Already completed:**
- ✅ Added `embedding vector(1536)` column
- ✅ Created ivfflat index for similarity search
- ✅ Created `match_knowledge()` function
- ✅ Verified all migrations applied successfully

**Next**: Populate embeddings via migration script

### Step 2: Database-First KB Setup (REVISED APPROACH)

**Strategic Decision**: Database as primary source, YAML exports for version control

**Architecture**:
- **Database** = Primary source (scalable to 1000+ entries)
- **YAML export** = Git backup (weekly export for audit trail)
- **knowledge-base.md → pm-next-documentation.md** = Feature documentation (separate concern)

**Why Database-First**:
✅ Scalability: Handles 1000+ entries without merge conflicts
✅ Maintenance: Edit via UI, not text files
✅ Analytics: Track helpful/not_helpful, usage counts built-in
✅ Collaboration: No merge conflicts on concurrent edits
✅ Search: Database + vector + full-text search capabilities

**Implementation Steps**:

1. **Separate Documentation Concerns**:
   ```bash
   # Rename current file to feature documentation
   mv knowledge-base.md pm-next-documentation.md
   # This 305-line file is 60% feature docs, 40% Q&A - keep as developer reference
   ```

2. **Enhance Database Schema**:
   ```sql
   ALTER TABLE support.knowledge_base
   ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}',
   ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) CHECK (difficulty IN ('easy', 'medium', 'hard')),
   ADD COLUMN IF NOT EXISTS helpful_count INT DEFAULT 0,
   ADD COLUMN IF NOT EXISTS not_helpful_count INT DEFAULT 0,
   ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual',
   ADD COLUMN IF NOT EXISTS search_vector tsvector
     GENERATED ALWAYS AS (to_tsvector('english', question || ' ' || answer)) STORED;

   CREATE INDEX idx_kb_keywords ON support.knowledge_base USING gin(keywords);
   CREATE INDEX idx_kb_search ON support.knowledge_base USING gin(search_vector);
   ```

3. **Manually Insert Initial Q&As** (20-25 entries):
   - Extract 8 existing Q&A entries from documentation
   - Add 10-15 common questions you anticipate
   - Use proper structure: question, answer, category, keywords, difficulty

4. **Create Embedding Generation Script**:
   ```javascript
   // scripts/generate-kb-embeddings.js
   // Reads existing entries from database (where embedding IS NULL)
   // Generates embeddings using OpenAI API
   // Updates database with embeddings
   // Rate limit: 350ms between calls
   ```

5. **Optional: Create Export Script for Git Backup**:
   ```javascript
   // scripts/export-kb-to-yaml.js
   // Exports database → knowledge-base.yaml
   // Run weekly or on-demand
   // Commit to git for version control and audit trail
   ```

**Test Strategy**:
1. Insert 20-25 Q&A entries manually
2. Run embedding generation on first 5 entries
3. Verify embeddings are valid vector(1536)
4. Run full generation for all entries
5. Test similarity search returns relevant results
6. Verify keyword search works via search_vector

### Step 3: Hybrid Knowledge Service

**Update `services/knowledge_service.js`** to support both AI and user search:

**New Methods**:
```javascript
class KnowledgeService {
  // For AI: Vector similarity search (existing)
  async searchForAI(query, limit = 5) {
    // Generate embedding → search vector DB
    // Returns: Top 5 most relevant KB entries
    // Use: AI system prompt context
  }

  // For users: Hybrid keyword + vector search (NEW)
  async searchForUsers(query, limit = 10) {
    // 1. Try exact keyword match first (fast)
    // 2. Fall back to vector search if no matches
    // Returns: Formatted KB articles with confidence scores
    // Use: Direct user responses (no AI needed)
  }

  // Track feedback (NEW)
  async recordFeedback(entryId, wasHelpful) {
    // Update helpful_count or not_helpful_count
    // Use: Confidence scoring (Phase 3)
  }

  // Keep existing getContent() as fallback
  getContent() {
    // Static markdown content (unchanged)
    // Use: Fallback if DB search fails
  }
}
```

**Key Decision Logic**:
```javascript
// In handleMessage flow:
1. Check if question matches KB (quick vector search, threshold > 0.85)
2. If confident match → Return KB article directly (no AI call)
3. If uncertain (0.6-0.85) → Show KB + offer AI help
4. If no match (< 0.6) → Full AI response with top 3-5 KB context
```

### Step 4: Update AI Service (Hybrid Response Flow)

**In `services/ai_service.js`**, update `generateResponse()`:

**OLD (inefficient)**:
```javascript
Use this knowledge base about PM-Next:
${this.knowledgeService.getContent()}  // 1,200+ tokens every time
```

**NEW (intelligent)**:
```javascript
async generateResponse(userMessage, chatId, ...) {
  // STEP 1: Try KB-only response first (no AI needed)
  const kbResults = await this.knowledgeService.searchForUsers(userMessage);

  if (kbResults.length > 0 && kbResults[0].similarity > 0.85) {
    // High confidence KB match - return directly
    return formatKBResponse(kbResults[0]) + "\n\nWas this helpful? 👍 👎";
  }

  // STEP 2: KB wasn't confident enough - use AI with relevant context
  const relevantKB = await this.knowledgeService.searchForAI(userMessage, 5);
  const kbContext = relevantKB
    .map(k => `Q: ${k.question}\nA: ${k.answer}`)
    .join('\n\n');

  // Only send relevant 3-5 articles (~150-300 tokens vs 1,200+)
  const systemPrompt = `Use this RELEVANT knowledge:
${kbContext}

If none of these articles help, use your general knowledge.`;

  return await this.callOpenAI(systemPrompt, userMessage, context);
}
```

**Impact**: 60-70% of questions answered without AI call

### Step 5: Add Feedback Tracking

**Database columns** (Already added in Step 2 schema enhancement):
- ✅ helpful_count INT DEFAULT 0
- ✅ not_helpful_count INT DEFAULT 0

**Update message handler** to detect feedback:
```javascript
// In handleMessage, detect: 👍 or "helpful" or "yes that helped"
if (isPositiveFeedback(userMessage)) {
  await knowledgeService.recordFeedback(lastKBEntryId, true);
  return "Great! Glad I could help. 😊";
}

// Detect: 👎 or "not helpful" or "didn't work"
if (isNegativeFeedback(userMessage)) {
  await knowledgeService.recordFeedback(lastKBEntryId, false);
  return "Sorry that didn't help. Let me try a different approach...";
}
```

**Analytics Query** (for later):
```sql
-- Find low-performing KB entries
SELECT question, answer, helpful_count, not_helpful_count,
       (helpful_count::float / NULLIF(helpful_count + not_helpful_count, 0)) as success_rate
FROM support.knowledge_base
WHERE (helpful_count + not_helpful_count) > 10
ORDER BY success_rate ASC
LIMIT 20;
```

---

## Phase 3-5: Enhancements (Week 6-8)

### Week 6: Enhanced Learning & Confidence Scoring

**Add Columns**:
```sql
ALTER TABLE support.knowledge_base
ADD COLUMN confidence_score FLOAT DEFAULT 0.5,
ADD COLUMN success_count INT DEFAULT 0,
ADD COLUMN failure_count INT DEFAULT 0;
```

**Implement Feedback**:
- Add "Was this helpful?" buttons (text-based for now)
- Update confidence score based on feedback
- Deprecate low-confidence entries

### Week 7: Lark Interactive Cards

**Research**: Scrape Lark card documentation
**Implement**: Ticket status cards, feedback buttons
**Pattern**: Use `msg_type: "interactive"` instead of "text"

### Week 8: CRM Integration (Optional)

**Only if CRM API available**
**Create**: services/crm_service.js
**Integrate**: User context in diagnostic flow

---

## 📊 Tracking Progress

**Use**: PROGRESS_TRACKER.md (separate document)

**Weekly Milestones**:
- Week 1-2: Tests pass for statelessness fix
- Week 3: 2 services extracted (lark, knowledge)
- Week 4: 3 services extracted (ai, learning, ticketing)
- Week 5: Vector search working, static KB removed
- Week 6: Confidence scoring implemented
- Week 7: Lark cards working
- Week 8: CRM integrated (if applicable)

---

## 🚨 Risk Management

**If Phase 0 Takes Longer**:
- Push entire timeline back
- Don't proceed to Phase 1 without fixing critical bug

**If Refactoring Breaks Tests**:
- Rollback to previous service extraction
- Fix issues before proceeding

**If KB Migration Fails**:
- Keep static file as fallback
- Debug migration script with small sample

---

**Next Document**: See PROGRESS_TRACKER.md for task checklist
