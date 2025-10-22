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

## Phase 2: Knowledge Base Migration (Week 5)

**Objective**: Move from static file to dynamic vector search

### Step 1: Add Embedding Column

```sql
-- Add to support.knowledge_base
ALTER TABLE support.knowledge_base
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create index for similarity search
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding
ON support.knowledge_base
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create similarity search function
CREATE OR REPLACE FUNCTION support.match_knowledge(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  question text,
  answer text,
  category varchar,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    question,
    answer,
    category,
    1 - (embedding <=> query_embedding) as similarity
  FROM support.knowledge_base
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
    AND is_active = true
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

### Step 2: Migration Script

**Create** `scripts/migrate-knowledge-base.js`:
```javascript
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function parseKnowledgeBase() {
  const content = fs.readFileSync('knowledge-base.md', 'utf-8');
  const pairs = [];

  // Parse Q&A format from markdown
  // Adjust regex based on actual format in knowledge-base.md
  const sections = content.split(/^###\s+/m);

  for (const section of sections) {
    if (!section.trim()) continue;

    const lines = section.split('\n');
    const question = lines[0].replace(/^Q:\s*/i, '').trim();
    const answerLines = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].startsWith('**A**') || lines[i].startsWith('A:')) {
        answerLines.push(...lines.slice(i + 1));
        break;
      }
    }

    const answer = answerLines.join('\n').trim();

    if (question && answer) {
      pairs.push({ question, answer, category: 'general' });
    }
  }

  return pairs;
}

async function migrateToDatabase() {
  const pairs = await parseKnowledgeBase();
  console.log(`📚 Found ${pairs.length} Q&A pairs`);

  for (const pair of pairs) {
    // Generate embedding
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: pair.question
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Insert into database
    const { error } = await supabase
      .from('knowledge_base')
      .insert({
        question: pair.question,
        answer: pair.answer,
        category: pair.category,
        embedding: embedding,
        source: 'migration',
        is_active: true
      });

    if (error) {
      console.error('❌ Error inserting:', pair.question.substring(0, 50), error);
    } else {
      console.log('✅ Migrated:', pair.question.substring(0, 50));
    }

    // Rate limit: 3 requests/second for embeddings API
    await new Promise(resolve => setTimeout(resolve, 350));
  }

  console.log('🎉 Migration complete!');
}

migrateToDatabase();
```

**Run Migration**:
```bash
node scripts/migrate-knowledge-base.js
```

### Step 3: Update Knowledge Service

**In services/knowledge_service.js**:
```javascript
class KnowledgeService {
  constructor(supabase, openai) {
    this.supabase = supabase;
    this.openai = openai;
  }

  async search(query, limit = 5) {
    try {
      // Generate embedding for query
      const embeddingResponse = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: query
      });

      const queryEmbedding = embeddingResponse.data[0].embedding;

      // Search similar entries
      const { data, error } = await this.supabase
        .rpc('match_knowledge', {
          query_embedding: queryEmbedding,
          match_threshold: 0.7,
          match_count: limit
        });

      if (error) {
        console.error('❌ Knowledge search error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Exception in knowledge search:', error);
      return [];
    }
  }
}
```

### Step 4: Remove Static KB Loading

**In server.js**, delete:
```javascript
// DELETE THESE LINES:
const PM_NEXT_KNOWLEDGE = '';
function loadKnowledgeBase() { ... }
loadKnowledgeBase();

// UPDATE generateAIResponse to use:
const relevantKB = await knowledge.search(userMessage, 5);
const kbContext = relevantKB.map(k => `Q: ${k.question}\nA: ${k.answer}`).join('\n\n');

// In system prompt:
Use this relevant knowledge:
${kbContext}
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
