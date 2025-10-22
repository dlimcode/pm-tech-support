# Progress Tracker
**Project**: PM-Tech-Support V1 → V2 Refactoring
**Timeline**: 6-8 weeks
**Started**: 2025-10-22
**Status**: Phase 0 In Progress - Database Setup Complete

---

## 📅 Phase 0: Critical Bug Fixes (Week 1-2)

### Database Setup

- [x] **Create conversation_sessions table**
  - [x] Run SQL in "support" schema
  - [x] Verify table exists
  - [x] Confirm indexes created
  - [x] Test insert/select operations

- [x] **Create active_ticket_flows table**
  - [x] Run SQL in "support" schema
  - [x] Verify table exists
  - [x] Confirm indexes created
  - [x] Test insert/update/delete operations

- [x] **Create cleanup function**
  - [x] Run cleanup_old_sessions() SQL
  - [x] Test function execution
  - [ ] Set up scheduled job (optional)

### Code Refactoring - Conversation Context

- [x] **Remove Map declaration**
  - [x] Delete line 18: `const conversationContext = new Map();`
  - [x] Confirm no compilation errors

- [x] **Add new functions**
  - [x] Implement getConversationHistory(chatId)
  - [x] Implement addToConversation(chatId, userId, userName, message)
  - [x] Add error handling to both functions
  - [x] Test functions individually

- [x] **Update all usages**
  - [x] Find all: `grep -n "conversationContext" server.js`
  - [x] Replace: conversationContext.get() calls
  - [x] Replace: conversationContext.set() calls
  - [x] Verify no missed references

- [ ] **Test conversation persistence**
  - [ ] Send test message
  - [ ] Verify saved to database
  - [ ] Retrieve conversation history
  - [ ] Confirm context maintained

### Code Refactoring - Ticket Flow State

- [ ] **Remove Map declaration**
  - [ ] Delete line 39: `const ticketCollectionState = new Map();`
  - [ ] Confirm no compilation errors

- [ ] **Add new functions**
  - [ ] Implement startTicketCreation()
  - [ ] Implement getTicketFlowState()
  - [ ] Implement updateTicketFlowState()
  - [ ] Implement completeTicketFlow()
  - [ ] Add error handling to all functions

- [ ] **Update handleTicketCreationFlow**
  - [ ] Refactor to use database functions
  - [ ] Test each step (title → description → steps)
  - [ ] Verify ticket created successfully
  - [ ] Confirm flow cleanup works

- [ ] **Update handleMessage**
  - [ ] Change to: `const ticketState = await getTicketFlowState(chatId);`
  - [ ] Verify flow detection works
  - [ ] Test routing to handleTicketCreationFlow

### Testing & Validation

- [ ] **Create test script**
  - [ ] Write test-statelessness-fix.js
  - [ ] Add conversation persistence test
  - [ ] Add ticket flow persistence test
  - [ ] Add cleanup/teardown code

- [ ] **Run automated tests**
  - [ ] Execute: `node test-statelessness-fix.js`
  - [ ] All tests pass
  - [ ] No errors in console
  - [ ] Database cleaned up properly

- [ ] **Manual end-to-end testing**
  - [ ] Start conversation with bot
  - [ ] Send multiple messages
  - [ ] Simulate cold start (restart server)
  - [ ] Continue conversation
  - [ ] Verify context preserved

- [ ] **Ticket flow testing**
  - [ ] Trigger escalation
  - [ ] Complete step 1 (title)
  - [ ] Restart server
  - [ ] Complete step 2 (description)
  - [ ] Restart server
  - [ ] Complete step 3 (steps)
  - [ ] Verify ticket created
  - [ ] Confirm flow removed from database

### Deployment to Staging

- [ ] **Deploy changes**
  - [ ] Push to git branch
  - [ ] Deploy to Vercel staging
  - [ ] Verify environment variables
  - [ ] Check build success

- [ ] **Soak test (48 hours)**
  - [ ] Monitor error logs
  - [ ] Check database growth
  - [ ] Verify no memory leaks
  - [ ] Test multiple concurrent users

- [ ] **Performance validation**
  - [ ] Measure response time
  - [ ] Check database query performance
  - [ ] Verify no timeout errors
  - [ ] Monitor Vercel function logs

### Phase 0 Completion Criteria

- [ ] Zero conversation context losses
- [ ] 100% ticket creation completion rate
- [ ] Bot works reliably across cold starts
- [ ] No in-memory state dependencies
- [ ] All tests passing
- [ ] No errors in production logs (48hr soak test)

**Phase 0 Completed**: [ ] Yes [ ] No
**Completion Date**: ___________
**Notes**: ___________

---

## 📅 Phase 1: Monolith Refactoring (Week 3-4)

### Setup

- [ ] **Create services directory**
  - [ ] mkdir services
  - [ ] Verify directory exists
  - [ ] Add to git

- [ ] **Create service files**
  - [ ] touch services/lark_service.js
  - [ ] touch services/ai_service.js
  - [ ] touch services/ticketing_service.js
  - [ ] touch services/learning_service.js
  - [ ] touch services/knowledge_service.js

### Service Extraction - Week 3

#### LarkService

- [ ] **Extract Lark functionality**
  - [ ] Create LarkService class
  - [ ] Move sendMessage function
  - [ ] Move getUserInfo function
  - [ ] Add constructor with appId/appSecret
  - [ ] Export module

- [ ] **Update server.js**
  - [ ] Import LarkService
  - [ ] Initialize: `const lark = new LarkService(...)`
  - [ ] Replace sendMessage() calls
  - [ ] Replace getUserInfo() calls
  - [ ] Test all Lark operations work

#### KnowledgeService

- [ ] **Extract knowledge functionality**
  - [ ] Create KnowledgeService class
  - [ ] Move loadKnowledgeBase logic
  - [ ] Add search method (prepare for vector search)
  - [ ] Add add method (for learning loop)
  - [ ] Export module

- [ ] **Update server.js**
  - [ ] Import KnowledgeService
  - [ ] Initialize knowledge service
  - [ ] Update KB loading references
  - [ ] Test KB retrieval works

### Service Extraction - Week 4

#### AIService

- [ ] **Extract AI functionality**
  - [ ] Create AIService class
  - [ ] Move generateAIResponse logic
  - [ ] Move extractQAPair function
  - [ ] Add buildSystemPrompt method
  - [ ] Export module

- [ ] **Update server.js**
  - [ ] Import AIService
  - [ ] Initialize AI service
  - [ ] Replace OpenAI calls
  - [ ] Test AI responses work

#### LearningService

- [ ] **Extract learning functionality**
  - [ ] Create LearningService class
  - [ ] Move processSupportSolution
  - [ ] Move addToKnowledgeBase
  - [ ] Add confidence scoring methods
  - [ ] Export module

- [ ] **Update server.js**
  - [ ] Import LearningService
  - [ ] Initialize learning service
  - [ ] Update solution processing calls
  - [ ] Test learning loop works

#### TicketingService

- [ ] **Extract ticketing functionality**
  - [ ] Create TicketingService class
  - [ ] Move shouldEscalateToTicket
  - [ ] Move createSupportTicket
  - [ ] Move notifySupportTeam
  - [ ] Export module

- [ ] **Update server.js**
  - [ ] Import TicketingService
  - [ ] Initialize ticketing service
  - [ ] Update escalation logic
  - [ ] Test ticket creation works

### Final Cleanup

- [ ] **Clean server.js**
  - [ ] Verify only routing logic remains
  - [ ] Target: ~300-400 lines
  - [ ] Remove duplicate code
  - [ ] Add clear comments

- [ ] **Update imports**
  - [ ] Check all requires are used
  - [ ] Remove unused imports
  - [ ] Organize imports logically

### Testing After Refactor

- [ ] **All existing tests pass**
- [ ] **Manual testing**
  - [ ] Bot responds to messages
  - [ ] Escalation works
  - [ ] Ticket creation works
  - [ ] Learning loop works
  - [ ] No functionality broken

### Phase 1 Completion Criteria

- [ ] Services directory with 5 service files
- [ ] server.js reduced to ~300-400 lines
- [ ] All tests passing
- [ ] No broken functionality
- [ ] Code easier to understand
- [ ] Each service has single responsibility

**Phase 1 Completed**: [ ] Yes [ ] No
**Completion Date**: ___________
**Notes**: ___________

---

## 📅 Phase 2: KB Migration (Week 5)

### Database Setup

- [ ] **Add embedding column**
  - [ ] Run ALTER TABLE SQL
  - [ ] Verify column added
  - [ ] Check data type: vector(1536)

- [ ] **Create vector index**
  - [ ] Run CREATE INDEX SQL
  - [ ] Verify index created
  - [ ] Test query performance

- [ ] **Create similarity function**
  - [ ] Run CREATE FUNCTION SQL
  - [ ] Test function execution
  - [ ] Verify results ranked by similarity

### Migration Script

- [ ] **Create migration script**
  - [ ] Create scripts/migrate-knowledge-base.js
  - [ ] Implement parseKnowledgeBase()
  - [ ] Add embedding generation
  - [ ] Add database insertion
  - [ ] Add rate limiting (350ms between calls)

- [ ] **Test on small sample**
  - [ ] Parse first 5 Q&A pairs
  - [ ] Generate embeddings
  - [ ] Insert into database
  - [ ] Verify data correct

- [ ] **Full migration**
  - [ ] Run: `node scripts/migrate-knowledge-base.js`
  - [ ] Monitor for errors
  - [ ] Verify all entries migrated
  - [ ] Count rows matches expected

- [ ] **Verification**
  - [ ] Check embedding column populated
  - [ ] Test similarity search
  - [ ] Verify relevant results returned

### Update Knowledge Service

- [ ] **Implement vector search**
  - [ ] Update search() method
  - [ ] Generate query embedding
  - [ ] Call match_knowledge RPC
  - [ ] Return top 5 results
  - [ ] Add error handling

- [ ] **Update add() method**
  - [ ] Generate embedding for new entries
  - [ ] Insert with embedding
  - [ ] Set confidence_score to 0.5
  - [ ] Test insertion works

### Update AI Service

- [ ] **Remove static KB loading**
  - [ ] Delete PM_NEXT_KNOWLEDGE variable
  - [ ] Delete loadKnowledgeBase() function
  - [ ] Remove file read operations

- [ ] **Use vector search**
  - [ ] Call knowledge.search(userMessage, 5)
  - [ ] Format results for prompt
  - [ ] Inject into system message
  - [ ] Test AI responses use relevant KB

### Performance Testing

- [ ] **Measure query time**
  - [ ] Before: Measure with static file
  - [ ] After: Measure with vector search
  - [ ] Target: < 500ms
  - [ ] Verify improvement

- [ ] **OpenAI cost analysis**
  - [ ] Compare token usage before/after
  - [ ] Target: 70-90% reduction
  - [ ] Monitor over 1 week

### Phase 2 Completion Criteria

- [ ] All KB entries migrated to database
- [ ] All entries have embeddings
- [ ] Vector search returns relevant results
- [ ] Query time < 500ms
- [ ] Static file removed/deprecated
- [ ] OpenAI costs reduced
- [ ] AI responses still accurate

**Phase 2 Completed**: [ ] Yes [ ] No
**Completion Date**: ___________
**Notes**: ___________

---

## 📅 Phase 3: Enhanced Learning (Week 6)

### Database Updates

- [ ] **Add confidence columns**
  - [ ] ALTER TABLE for confidence_score
  - [ ] ALTER TABLE for success_count
  - [ ] ALTER TABLE for failure_count
  - [ ] Verify columns added

### Learning Service Updates

- [ ] **Implement confidence tracking**
  - [ ] Update captureSolution() to set initial confidence
  - [ ] Add updateConfidence() method
  - [ ] Implement Bayesian scoring
  - [ ] Test confidence calculations

- [ ] **Add feedback mechanism**
  - [ ] Detect "helpful/not helpful" responses
  - [ ] Update success/failure counts
  - [ ] Recalculate confidence score
  - [ ] Log feedback for analytics

- [ ] **Pattern categorization**
  - [ ] Classify by issue type
  - [ ] Add category to KB entries
  - [ ] Track success rate per category
  - [ ] Use in relevance ranking

### Testing

- [ ] **Feedback loop testing**
  - [ ] Provide solution to user
  - [ ] User marks as helpful
  - [ ] Verify confidence increased
  - [ ] User marks as not helpful
  - [ ] Verify confidence decreased

- [ ] **Low confidence handling**
  - [ ] Create entry with low confidence
  - [ ] Verify deprioritized in search
  - [ ] Test deprecation logic

### Phase 3 Completion Criteria

- [ ] Confidence scoring implemented
- [ ] Feedback tracking working
- [ ] Pattern categorization active
- [ ] Low-confidence entries handled
- [ ] Learning quality improved

**Phase 3 Completed**: [ ] Yes [ ] No
**Completion Date**: ___________

---

## 📅 Phase 4: Lark Cards (Week 7)

### Research

- [ ] **Lark API documentation**
  - [ ] Scrape card format documentation
  - [ ] Study interactive card examples
  - [ ] Understand button callbacks
  - [ ] Note rate limits

### Implementation

- [ ] **Ticket status cards**
  - [ ] Design card template
  - [ ] Implement sendTicketCard() method
  - [ ] Add to ticketing service
  - [ ] Test card rendering

- [ ] **Feedback buttons**
  - [ ] Design feedback card template
  - [ ] Add "Helpful"/"Not helpful" buttons
  - [ ] Implement button handler
  - [ ] Link to confidence scoring

- [ ] **Update LarkService**
  - [ ] Add sendCard() method
  - [ ] Use msg_type: "interactive"
  - [ ] Handle card callbacks
  - [ ] Test all card types

### Testing

- [ ] **Card display testing**
  - [ ] Send ticket status card
  - [ ] Verify renders correctly
  - [ ] Test on mobile
  - [ ] Test on desktop

- [ ] **Button interaction testing**
  - [ ] Click "Helpful" button
  - [ ] Verify callback received
  - [ ] Confirm action executed
  - [ ] Test error handling

### Phase 4 Completion Criteria

- [ ] Lark cards rendering correctly
- [ ] Buttons working
- [ ] Callbacks handled
- [ ] Better UX than text-only
- [ ] No card-related errors

**Phase 4 Completed**: [ ] Yes [ ] No
**Completion Date**: ___________

---

## 📅 Phase 5: CRM Integration (Week 8)

### CRM API Setup

- [ ] **Obtain CRM API access**
  - [ ] Get API endpoint
  - [ ] Get API key
  - [ ] Test connectivity
  - [ ] Review documentation

### CRM Service Creation

- [ ] **Create services/crm_service.js**
  - [ ] Implement getUserRole()
  - [ ] Implement getUserPermissions()
  - [ ] Implement getRecentActivity()
  - [ ] Add error handling

### Integration

- [ ] **Update AI Service**
  - [ ] Call CRM for user context
  - [ ] Use role in diagnostics
  - [ ] Check permissions before suggesting actions
  - [ ] Test context-aware responses

### Testing

- [ ] **CRM integration testing**
  - [ ] Test with different user roles
  - [ ] Verify permission checks work
  - [ ] Confirm context improves accuracy
  - [ ] Test graceful degradation if CRM unavailable

### Phase 5 Completion Criteria

- [ ] CRM service implemented
- [ ] User context retrieved
- [ ] Context used in diagnostics
- [ ] Graceful fallback if CRM down
- [ ] Improved support accuracy

**Phase 5 Completed**: [ ] Yes [ ] No
**Completion Date**: ___________

---

## 📊 Overall Project Status

**Current Phase**: ___________
**Overall Progress**: ___% complete
**On Track**: [ ] Yes [ ] No

**Blockers**:
-

**Notes**:
-

---

## 🎯 Final Validation

- [ ] All 5 phases completed
- [ ] All tests passing
- [ ] No critical bugs
- [ ] Performance improved
- [ ] Costs reduced
- [ ] Code maintainable
- [ ] Documentation updated
- [ ] Ready for production

**Project Completed**: [ ] Yes [ ] No
**Completion Date**: ___________

---

**Update this tracker after each task completion. Review weekly with stakeholders.**
