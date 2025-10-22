// AIService - Handles all AI/OpenAI-related operations
// Extracted from server.js as part of Phase 1 refactoring

const OpenAI = require('openai');

class AIService {
  constructor(openaiApiKey, supabaseClient, knowledgeService) {
    if (!openaiApiKey) {
      throw new Error('AIService requires an OpenAI API key');
    }
    if (!supabaseClient) {
      throw new Error('AIService requires a Supabase client');
    }
    if (!knowledgeService) {
      throw new Error('AIService requires a KnowledgeService instance');
    }

    // Initialize OpenAI client
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.supabase = supabaseClient;
    this.knowledgeService = knowledgeService;

    // Response cache for common questions
    this.responseCache = new Map();
    this.CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

    // FAQ responses by category
    this.FAQ_RESPONSES = {
      candidate_management: `**Candidate Management FAQs:**

" **Add Candidate**: Dashboard � Candidates � Add New � fill form � Save
" **Upload Resume**: Drag & drop or click upload (AI parsing enabled)
" **Link to Job**: Candidate profile � Applications tab � Add to job
" **Update Status**: Use status dropdown in candidate profile

**Common Issues:**
" Resume not parsing? Check file format (PDF/DOC/DOCX) and size (<10MB)
" Candidate not saving? Ensure required fields are filled
" Can't find candidate? Use search bar or check filters`,

      job_management: `**Job Management FAQs:**

" **Create Job**: Dashboard � Jobs � Create Job � fill details � Save
" **Edit Job**: Click job title � update fields � Save
" **Add Candidates**: Job profile � Candidates section � Add Candidate
" **Set Status**: Use status dropdown (Active/Closed/On Hold)

**Common Issues:**
" Job not saving? Check required fields are completed
" Can't find job? Use search or check job status filters
" Candidates not linking? Ensure both candidate and job exist`,

      authentication: `**Login & Access FAQs:**

" **Login Issues**: Clear browser cache � try different browser � contact admin
" **Password Reset**: Use "Forgot Password" link or contact admin
" **Access Denied**: Check with admin about user permissions
" **Session Expired**: Log out completely and log back in

**Common Issues:**
" Browser compatibility: Use Chrome, Firefox, Safari, or Edge
" Clear cookies and cache if login loops
" Check internet connection stability`,

      general: `**General PM-Next FAQs:**

" **Navigation**: Use Dashboard menu � select module
" **Search**: Global search bar finds candidates, jobs, clients
" **Help**: Look for ? icons throughout the system
" **Performance**: Close unused tabs, clear cache

**Common Issues:**
" Page loading slowly? Check internet speed and close other tabs
" Feature not working? Try refreshing the page
" Data not syncing? Check internet connection`
    };

    // Common question patterns for caching
    this.CACHEABLE_PATTERNS = [
      /how.*add.*candidate/i,
      /how.*create.*job/i,
      /how.*schedule.*interview/i,
      /where.*find/i,
      /what.*pm.?next/i,
      /login.*problem/i,
      /upload.*error/i
    ];

    console.log(' AIService initialized');
  }

  /**
   * Get cache key for a message based on pattern matching
   * @param {string} message - User message
   * @returns {string|null} Cache key or null if not cacheable
   * @private
   */
  _getCacheKey(message) {
    const normalized = message.toLowerCase().trim();
    for (const pattern of this.CACHEABLE_PATTERNS) {
      if (pattern.test(normalized)) {
        return pattern.toString();
      }
    }
    return null;
  }

  /**
   * Get cached response for a message
   * @param {string} message - User message
   * @returns {string|null} Cached response or null if not found/expired
   */
  getCachedResponse(message) {
    const cacheKey = this._getCacheKey(message);
    if (!cacheKey) return null;

    const cached = this.responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_EXPIRY) {
      console.log('=� Using cached response for pattern:', cacheKey);
      return cached.response;
    }
    return null;
  }

  /**
   * Set cached response for a message
   * @param {string} message - User message
   * @param {string} response - Response to cache
   */
  setCachedResponse(message, response) {
    const cacheKey = this._getCacheKey(message);
    if (cacheKey) {
      this.responseCache.set(cacheKey, {
        response,
        timestamp: Date.now()
      });
      console.log('=� Cached response for pattern:', cacheKey);
    }
  }

  /**
   * Generate AI response to user message
   * @param {string} userMessage - User's message
   * @param {string} chatId - Chat ID for conversation context
   * @param {string|null} senderId - Sender ID
   * @param {object} callbacks - Callback functions for external dependencies
   * @param {function} callbacks.getConversationHistory - Get conversation history
   * @param {function} callbacks.getTicketFlowState - Get ticket flow state
   * @param {function} callbacks.handleTicketCreationFlow - Handle ticket creation flow
   * @param {function} callbacks.startTicketCreation - Start ticket creation
   * @param {function} callbacks.checkTicketConfirmation - Check ticket confirmation
   * @param {function} callbacks.categorizeIssue - Categorize issue
   * @param {function} callbacks.shouldEscalateToTicket - Check if should escalate
   * @param {function} callbacks.trackRequest - Track request analytics
   * @param {object} callbacks.analytics - Analytics object
   * @returns {Promise<string|object>} AI response or response object with metadata
   */
  async generateResponse(userMessage, chatId, senderId = null, callbacks = {}) {
    const startTime = Date.now();

    try {
      // Ensure knowledge base is initialized for serverless environments
      await this.knowledgeService.initialize();

      console.log('>� Calling OpenAI with message:', userMessage);

      // Get conversation context from database
      const context = await callbacks.getConversationHistory(chatId);
      console.log('=� Current context length:', context.length);

      // Check if user is in ticket creation flow
      const ticketState = await callbacks.getTicketFlowState(chatId);
      if (ticketState) {
        return await callbacks.handleTicketCreationFlow(chatId, userMessage, ticketState, senderId);
      }

      // Check if user is confirming they want to create a ticket
      const isConfirmingTicket = callbacks.checkTicketConfirmation(context, userMessage);
      if (isConfirmingTicket) {
        console.log(' User confirming ticket creation, starting flow...');
        const category = callbacks.categorizeIssue(userMessage, context);
        return await callbacks.startTicketCreation(chatId, userMessage, category, senderId);
      }

      // Check for escalation triggers
      console.log('<� Checking escalation triggers for message:', userMessage);
      const shouldEscalate = callbacks.shouldEscalateToTicket(context, userMessage);
      const category = callbacks.categorizeIssue(userMessage);
      console.log('=� Escalation result:', shouldEscalate, 'Category:', category);

      if (shouldEscalate) {
        console.log('=� Escalation triggered for category:', category);

        // Check for direct escalation phrases that should skip FAQs
        const directEscalationPhrases = [
          // Existing direct escalation phrases
          /still.*(not|doesn't|don't).*(work|working)/i,
          /escalate.*to.*(support|team|human)/i,
          /can.*i.*escalate/i,
          /create.*ticket/i,
          /not.*working/i,

          // Additional direct escalation phrases
          /need.*human.*help/i,
          /speak.*to.*(someone|person|human)/i,
          /talk.*to.*(support|agent|human)/i,
          /contact.*support/i,
          /urgent.*help/i,
          /emergency/i,
          /critical.*issue/i,
          /this.*is.*broken/i,
          /completely.*broken/i,
          /nothing.*works/i,
          /tried.*everything/i,
          /exhausted.*options/i,
          /desperate.*help/i,
          /last.*resort/i,
          /immediately.*need/i,
          /right.*now/i,
          /asap/i,
          /blocking.*work/i,
          /cant.*continue/i,
          /can't.*continue/i,
          /cannot.*continue/i,
          /lost.*data/i,
          /system.*error/i,
          /server.*error/i,
          /crashed/i,
          /frozen/i,
          /timeout/i,
          /failed.*multiple.*times/i,
          /keep.*failing/i,
          /repeatedly.*failing/i
        ];

        const isDirectEscalation = directEscalationPhrases.some(phrase => phrase.test(userMessage));

        if (isDirectEscalation) {
          // Direct escalation - go straight to ticket creation
          console.log('<� Direct escalation detected, starting ticket creation');
          return await callbacks.startTicketCreation(chatId, userMessage, category, senderId);
        }

        // Check if we've already shown FAQs for this category
        const hasShownFAQs = context.some(msg =>
          msg.content && msg.content.toLowerCase().includes('faqs:') &&
          msg.content.toLowerCase().includes(category.replace('_', ' ').toLowerCase())
        );

        if (!hasShownFAQs && this.FAQ_RESPONSES[category]) {
          // First escalation - show relevant FAQs
          const faqResponse = `I understand you're having trouble. Let me share some relevant FAQs that might help:

${this.FAQ_RESPONSES[category]}

If these don't resolve your issue, I can create a support ticket for you to get personalized help. Just let me know!`;

          const responseTime = Date.now() - startTime;
          callbacks.trackRequest(userMessage, responseTime, false);

          // Update conversation context
          context.push({ role: 'user', content: userMessage });
          context.push({ role: 'assistant', content: faqResponse });

          // Save conversation to database
          await this.supabase
            .from('conversation_sessions')
            .upsert({
              chat_id: chatId,
              user_id: senderId || 'unknown',
              lark_user_name: 'Unknown',
              messages: context.slice(-10),
              last_activity: new Date().toISOString(),
              status: 'active'
            }, {
              onConflict: 'chat_id'
            });

          // Return response with metadata for logging
          return {
            response: faqResponse,
            responseType: 'knowledge_base',
            knowledgeBaseHit: true,
            processingTimeMs: responseTime,
            escalatedToHuman: false
          };
        } else {
          // Second escalation or no specific FAQs - start ticket creation
          return await callbacks.startTicketCreation(chatId, userMessage, category, senderId);
        }
      }

      // Check cache first for common questions
      const cachedResponse = this.getCachedResponse(userMessage);
      if (cachedResponse) {
        const responseTime = Date.now() - startTime;
        callbacks.trackRequest(userMessage, responseTime, true);

        // Return response with metadata for logging
        return {
          response: cachedResponse,
          responseType: 'cached',
          cacheHit: true,
          processingTimeMs: responseTime
        };
      }

      // Continue with normal AI response...
      const models = ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
      const selectedModel = process.env.OPENAI_MODEL || models[0];
      console.log('🔧 Using OpenAI model:', selectedModel);

      // Build messages array with context
      const messages = [
        {
          role: 'system',
          content: `You are a helpful assistant for the PM-Next Recruitment Management System.
        Your role is to help users navigate and understand how to use the application effectively.

        IMPORTANT:
        - Always respond to user messages. Never leave a user without a response.
        - Pay attention to conversation context - don't ask for details the user already provided.
        - If user says "still not working" or similar, the system will automatically escalate.

        Use this knowledge base about PM-Next:
        ${this.knowledgeService.getContent()}

        ENHANCED RESPONSE GUIDELINES:

          1. **Initial Response**: Provide clear, step-by-step instructions for navigation and usage

          2. **Follow-up Questions**: If the user encounters issues or needs clarification, ask specific diagnostic questions based on their problem type:

          **For File Upload Issues:**
          - What file format are you trying to upload? (PDF, DOC, DOCX, etc.)
          - What is the file size?
          - What error message do you see exactly?
          - Which browser are you using?
          - Have you tried uploading a different file to test?

          **For Candidate Management Issues:**
          - At which step are you experiencing the problem?
          - Are you seeing any error messages?
          - What candidate status are you trying to set?
          - Are you able to access the candidate list?
          - Is this happening with all candidates or specific ones?

          **For Job Management Issues:**
          - Which specific job feature is not working?
          - Can you see the job in your job list?
          - Are you trying to create, edit, or delete a job?
          - What error appears when you try to save?
          - Are the required fields filled in correctly?

          **For Client Management Issues:**
          - What client information are you trying to access or modify?
          - Can you see the client in your client list?
          - Are you experiencing issues with contact management or financial tracking?
          - What error message appears?

          **For Login/Access Issues:**
          - Are you using the correct login credentials?
          - What error message do you see when trying to log in?
          - Have you tried resetting your password?
          - Which page are you unable to access?

          **For Performance Issues:**
          - Which specific pages or features are loading slowly?
          - How long does it typically take to load?
          - Are you experiencing this across all features or specific ones?
          - What device and browser are you using?

          3. **General Guidelines:**
          - Be specific about where to find features in the application
          - Keep responses concise but helpful
          - Use bullet points or numbered steps when appropriate
          - Always be friendly and professional
          - If asked about features not in the knowledge base, politely explain limitations and offer general guidance`
        }
      ];

      // Add conversation context (keep last 6 messages for context)
      const recentContext = context.slice(-6);
      messages.push(...recentContext);

      // Add current user message
      messages.push({
        role: 'user',
        content: userMessage
      });

      const completion = await this.openai.chat.completions.create({
        model: selectedModel,
        messages: messages,
        max_tokens: 800,
        temperature: 0.7,
        stream: false
      });

      const response = completion.choices[0].message.content;

      // Cache the response for common questions
      this.setCachedResponse(userMessage, response);

      // Update conversation context
      context.push({ role: 'user', content: userMessage });
      context.push({ role: 'assistant', content: response });

      // Keep context manageable (last 20 messages)
      if (context.length > 20) {
        context.splice(0, context.length - 20);
      }

      // Save conversation to database
      await this.supabase
        .from('conversation_sessions')
        .upsert({
          chat_id: chatId,
          user_id: senderId || 'unknown',
          lark_user_name: 'Unknown',
          messages: context.slice(-10),
          last_activity: new Date().toISOString(),
          status: 'active'
        }, {
          onConflict: 'chat_id'
        });

      const responseTime = Date.now() - startTime;
      callbacks.trackRequest(userMessage, responseTime, false);

      console.log('<� OpenAI response received successfully');
      return response;
    } catch (error) {
      if (callbacks.analytics) {
        callbacks.analytics.errorCount++;
      }
      console.error('L Error generating AI response:', error);
      console.error('L Error details:', error.message);

      // Provide more specific error responses
      if (error.message.includes('timeout')) {
        return 'I apologize for the delay. The system is taking longer than usual to respond. Please try asking your question again, or contact our support team if this continues.';
      } else if (error.message.includes('rate limit')) {
        return 'I\'m currently experiencing high demand. Please wait a moment and try again.';
      } else {
        return 'I encountered a technical issue while processing your request. Please try rephrasing your question or our support team for immediate assistance.';
      }
    }
  }

  /**
   * Extract Q&A pair from a support ticket and solution
   * @param {string} ticketNumber - Ticket number
   * @param {string} solutionMessage - Solution message
   * @returns {Promise<object|null>} Q&A pair object or null if failed
   */
  async extractQAPair(ticketNumber, solutionMessage) {
    try {
      // Get ticket details from database
      console.log('=� Fetching ticket details for:', ticketNumber);

      const { data: ticket, error } = await this.supabase
        .schema('support')
        .from('support_tickets')
        .select('*')
        .eq('ticket_number', ticketNumber)
        .single();

      console.log('<� Ticket fetch result:', { ticket: ticket?.ticket_number, error });

      if (error || !ticket) {
        console.log('L Could not fetch ticket for knowledge base update:', ticketNumber);
        return null;
      }

      // Use AI to extract and format the Q&A pair
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a knowledge base curator. Extract a clear question and answer from a support ticket and its solution.

Format the response as JSON:
{
  "question": "Clear, general question that future users might ask",
  "answer": "Step-by-step solution that can help similar issues",
  "category": "One of: candidate_management, job_management, client_management, pipeline_management, authentication, system_performance, general"
}

Make the question generic enough to match similar future issues, but specific enough to be useful.
Make the answer comprehensive with clear steps.`
          },
          {
            role: 'user',
            content: `Support Ticket:
Title: ${ticket.issue_title}
Description: ${ticket.issue_description}
Category: ${ticket.issue_category}
Steps Attempted: ${ticket.steps_attempted?.join(', ') || 'None'}

Solution Provided:
${solutionMessage}

Extract a Q&A pair from this support interaction.`
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      });

      const response = completion.choices[0].message.content;
      console.log('> AI extracted Q&A:', response);

      try {
        return JSON.parse(response);
      } catch (parseError) {
        console.log('� Could not parse AI response as JSON, using fallback');
        return {
          question: ticket.issue_title,
          answer: solutionMessage,
          category: ticket.issue_category || 'general'
        };
      }

    } catch (error) {
      console.error('L Error extracting Q&A pair:', error);
      return null;
    }
  }
}

module.exports = AIService;
