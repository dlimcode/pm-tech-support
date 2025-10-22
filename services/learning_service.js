// LearningService - Handles learning loop and knowledge base updates from support solutions
// Extracted from server.js as part of Phase 1 refactoring

class LearningService {
  constructor(supabaseClient, aiService, knowledgeService, larkService) {
    if (!supabaseClient) {
      throw new Error('LearningService requires a Supabase client');
    }
    if (!aiService) {
      throw new Error('LearningService requires an AIService instance');
    }
    if (!knowledgeService) {
      throw new Error('LearningService requires a KnowledgeService instance');
    }
    if (!larkService) {
      throw new Error('LearningService requires a LarkService instance');
    }

    this.supabase = supabaseClient;
    this.aiService = aiService;
    this.knowledgeService = knowledgeService;
    this.larkService = larkService;

    // Solution detection keywords
    this.SOLUTION_KEYWORDS = [
      // Explicit solution indicators
      'solution:', 'solution for', 'fix:', 'resolved:', 'answer:', 'steps to fix:', 'how to fix:',
      'to resolve this:', 'the issue is:', 'you need to:', 'try this:',
      'fixed by:', 'solution is:', 'resolve by:', 'fix this by:',
      'here\'s the solution:', 'here is how to fix:', 'problem solved:'
    ];

    // Knowledge base update indicators
    this.KNOWLEDGE_UPDATE_INDICATORS = [
      'for future reference', 'common issue', 'similar problem', 'faq',
      'frequently asked', 'add to kb', 'add to knowledge base', 'update kb',
      'document this', 'remember this solution', 'save this solution'
    ];

    // Track support ticket replies (legacy - may not be actively used)
    this.supportTicketReplies = new Map();
  }

  /**
   * Process support solution for knowledge base update
   * Main entry point for learning loop
   * @param {string} message - The solution message
   * @param {string} chatId - Chat ID where solution was posted
   * @param {string} senderId - User ID who posted the solution
   * @param {object} event - Lark event object (optional)
   * @returns {Promise<boolean>} True if solution was processed successfully
   */
  async processSupportSolution(message, chatId, senderId, event = null) {
    try {
      console.log('Processing potential support solution...');
      console.log('Message content:', message);
      console.log('Chat ID:', chatId);
      console.log('Sender ID:', senderId);
      console.log('Has event:', !!event);
      console.log('Has parent_id:', !!(event?.message?.parent_id));
      console.log('Has root_id:', !!(event?.message?.root_id));
      console.log('LARK_SUPPORT_GROUP_ID:', process.env.LARK_SUPPORT_GROUP_ID || 'Not set');
      console.log('STRICT_SUPPORT_GROUP_ONLY:', process.env.STRICT_SUPPORT_GROUP_ONLY || 'Not set (defaults to false)');

      // Check if this is a reply to a support ticket
      const isReply = this._isReplyToSupportTicket(message, event);
      console.log('Is reply to support ticket:', isReply);

      // Check if message contains a solution (use flexible detection)
      const isSolution = this._isSupportSolution(message, isReply);
      console.log('Is detected as solution:', isSolution);

      if (!isSolution) {
        console.log('Not detected as a support solution');
        return false;
      }

      // Check if this is from the configured support group (if set)
      // Allow testing in any chat by checking if STRICT_SUPPORT_GROUP_ONLY is enabled
      const strictGroupOnly = process.env.STRICT_SUPPORT_GROUP_ONLY === 'true';
      if (strictGroupOnly && process.env.LARK_SUPPORT_GROUP_ID && chatId !== process.env.LARK_SUPPORT_GROUP_ID) {
        console.log('Solution detected but not from configured support group');
        console.log('Current chat:', chatId);
        console.log('Support group:', process.env.LARK_SUPPORT_GROUP_ID);
        console.log('Set STRICT_SUPPORT_GROUP_ONLY=false to allow testing in any chat');
        return false;
      }

      console.log('Support solution detected, extracting ticket info...');

      // Extract ticket number from message or context
      console.log('Attempting to extract ticket number from:', {
        message: message.substring(0, 100) + '...',
        hasEvent: !!event,
        hasParentId: !!(event?.message?.parent_id),
        hasRootId: !!(event?.message?.root_id),
        chatId: event?.message?.chat_id
      });

      const ticketNumber = await this._extractTicketNumber(message, event);
      if (!ticketNumber) {
        console.log('No ticket number found in solution message or context');
        console.log('This could be because:');
        console.log('   - The message is not actually a reply to a support ticket');
        console.log('   - The original ticket message is older than 7 days');
        console.log('   - The ticket was created in a different chat');
        console.log('   - The parent message could not be retrieved from Lark API');
        return false;
      }

      console.log('Found ticket number:', ticketNumber);

      // Extract Q&A pair
      const qaPair = await this.aiService.extractQAPair(ticketNumber, message);
      if (!qaPair) {
        console.log('Could not extract Q&A pair');
        return false;
      }

      console.log('Extracted Q&A pair:', qaPair);

      // Update knowledge base (database-first approach)
      const success = await this.knowledgeService.addEntry({...qaPair, ticketNumber});
      if (success) {
        // Update ticket status to resolved
        await this.supabase
          .schema('support')
          .from('support_tickets')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolution_notes: message
          })
          .eq('ticket_number', ticketNumber);

        // Send confirmation message
        const confirmationMessage = `**Knowledge Base Updated**

**Ticket**: ${ticketNumber}
**Solution Recorded**: ${qaPair.question}
**Category**: ${qaPair.category}

Your solution has been saved to the knowledge base and will help resolve similar issues automatically. Thank you!`;

        console.log('Sending knowledge base update confirmation...');
        await this.larkService.sendMessage(chatId, confirmationMessage);

        return true;
      }

      return false;
    } catch (error) {
      console.error('Error processing support solution:', error);
      return false;
    }
  }

  /**
   * Check if message is likely a reply to a support ticket
   * @param {string} message - The message to check
   * @param {object} event - Lark event object (optional)
   * @returns {boolean} True if message is a reply to a ticket
   * @private
   */
  _isReplyToSupportTicket(message, event = null) {
    // Check if message mentions support ticket patterns
    const supportReplyPatterns = [
      /reply.*to.*ask.*danish/i,
      /support.*ticket/i,
      /ticket.*created/i,
      /pmn-\d{8}-\d{4}/i
    ];

    // Also check if this is a threaded reply
    const isThreadedReply = event && event.message &&
      (event.message.parent_id || event.message.root_id);

    const isReply = supportReplyPatterns.some(pattern =>
      pattern.test(message) || (event && pattern.test(JSON.stringify(event)))
    ) || isThreadedReply;

    return isReply;
  }

  /**
   * Check if message contains a support solution
   * @param {string} message - The message to check
   * @param {boolean} isReplyToTicket - Whether this is a reply to a ticket
   * @returns {boolean} True if message contains a solution
   * @private
   */
  _isSupportSolution(message, isReplyToTicket = false) {
    const lowerMessage = message.toLowerCase();

    // If this is a reply to a support ticket, treat any substantive reply as a solution
    if (isReplyToTicket) {
      // Any reply to a support ticket with reasonable length is considered a solution
      if (message.trim().length >= 5) {
        console.log('Treating reply to support ticket as solution');
        return true;
      }
    }

    // For non-reply messages, check for explicit solution keywords
    const hasSolutionKeyword = this.SOLUTION_KEYWORDS.some(keyword =>
      lowerMessage.includes(keyword.toLowerCase())
    );

    // Check for knowledge base update indicators
    const hasKBIndicator = this.KNOWLEDGE_UPDATE_INDICATORS.some(indicator =>
      lowerMessage.includes(indicator.toLowerCase())
    );

    // Check for typical support response patterns - EXPANDED
    const supportPatterns = [
      /here.*how.*to/i,
      /follow.*these.*steps/i,
      /you.*can.*fix.*this.*by/i,
      /the.*problem.*is/i,
      /to.*resolve.*this/i,
      /issue.*caused.*by/i,
      /workaround.*is/i,
      /temporary.*fix/i,
      /first.*try/i,
      /next.*step/i,
      /should.*work/i,
      /test.*this/i,
      /try.*this/i,
      /check.*if/i,
      /refresh.*the/i,
      /clear.*cache/i,
      /restart.*browser/i,
      /incognito.*window/i,
      /private.*window/i,
      /disable.*extensions/i
    ];

    const hasPattern = supportPatterns.some(pattern => pattern.test(message));

    return hasSolutionKeyword || hasKBIndicator || hasPattern;
  }

  /**
   * Extract ticket number from message context
   * @param {string} message - The message to search
   * @param {object} event - Lark event object (optional)
   * @returns {Promise<string|null>} Ticket number or null
   * @private
   */
  async _extractTicketNumber(message, event = null) {
    // First, try to find ticket number directly in the message
    const ticketPattern = /([A-Z]{2,3}-\d{8}-\d{4})/i;
    const directMatch = message.match(ticketPattern);
    if (directMatch) {
      console.log('Found ticket number directly in message:', directMatch[1]);
      return directMatch[1];
    }

    // If this is a reply message, check if we can find ticket context
    if (event && event.message) {
      // Check if the message is a reply (in Lark, replies contain context)
      // Look for ticket patterns in any quoted/referenced content
      const messageContent = JSON.stringify(event.message);
      const contextMatch = messageContent.match(ticketPattern);
      if (contextMatch) {
        console.log('Found ticket number in message context:', contextMatch[1]);
        return contextMatch[1];
      }

      // If this message has parent_id or root_id, it's a reply
      if (event.message.parent_id || event.message.root_id) {
        console.log('Detected reply message - searching for ticket in conversation context');

        // Try to get the parent message content from Lark API
        const parentMessageId = event.message.parent_id || event.message.root_id;
        console.log('Parent message ID:', parentMessageId);

        const parentContent = await this._getParentMessageContent(parentMessageId);
        if (parentContent) {
          console.log('Retrieved parent message content:', parentContent);
          const parentMatch = parentContent.match(ticketPattern);
          if (parentMatch) {
            console.log('Found ticket number in parent message:', parentMatch[1]);
            return parentMatch[1];
          }
        }

        // If we still can't find the ticket in parent content, try database search
        const chatId = event.message.chat_id;
        console.log('Searching database for recent tickets as fallback...');
        return await this._findRecentTicketFromChat(chatId);
      }
    }

    return null;
  }

  /**
   * Get parent message content from Lark API
   * @param {string} messageId - The parent message ID
   * @returns {Promise<string|null>} Parent message content or null
   * @private
   */
  async _getParentMessageContent(messageId) {
    try {
      console.log('Attempting to fetch parent message:', messageId);

      // Get access token
      const tokenResponse = await fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          app_id: process.env.LARK_APP_ID,
          app_secret: process.env.LARK_APP_SECRET
        })
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.code !== 0) {
        console.log('Failed to get access token for parent message:', tokenData.msg);
        return null;
      }

      const accessToken = tokenData.tenant_access_token;

      // Get the parent message content
      const messageResponse = await fetch(`https://open.larksuite.com/open-apis/im/v1/messages/${messageId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const messageData = await messageResponse.json();
      console.log('Parent message API response:', messageData);

      if (messageData.code === 0 && messageData.data && messageData.data.items && messageData.data.items.length > 0) {
        const content = messageData.data.items[0].body.content;
        console.log('Parent message content:', content);

        // Try to parse content if it's JSON
        try {
          const parsedContent = JSON.parse(content);
          if (parsedContent.text) {
            console.log('Extracted text from parent message:', parsedContent.text);
            return parsedContent.text;
          }
        } catch (parseError) {
          // Content might already be plain text
          console.log('Using content as plain text');
          return content;
        }

        return content;
      } else {
        console.log('Failed to get parent message:', messageData.msg);
        return null;
      }
    } catch (error) {
      console.log('Error fetching parent message:', error.message);
      return null;
    }
  }

  /**
   * Find the most recent ticket from a specific chat
   * @param {string} chatId - Chat ID to search
   * @returns {Promise<string|null>} Ticket number or null
   * @private
   */
  async _findRecentTicketFromChat(chatId) {
    try {
      // Look for recent tickets created in this chat (extend to 7 days for better coverage)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      console.log('Searching for recent tickets in chat:', chatId);
      console.log('Looking for tickets since:', sevenDaysAgo.toISOString());

      const { data: recentTickets, error } = await this.supabase
        .schema('support')
        .from('support_tickets')
        .select('ticket_number, created_at, issue_title')
        .eq('chat_id', chatId)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(5); // Get more tickets to choose from

      console.log('Query result:', { recentTickets, error });

      if (error) {
        console.log('Error searching for recent tickets:', error.message);
        return null;
      }

      if (recentTickets && recentTickets.length > 0) {
        const ticketNumber = recentTickets[0].ticket_number;
        console.log('Found recent ticket from this chat:', ticketNumber);
        console.log('Ticket details:', recentTickets[0]);

        // Log all found tickets for debugging
        if (recentTickets.length > 1) {
          console.log('All recent tickets found:', recentTickets.map(t => ({
            ticket: t.ticket_number,
            created: t.created_at,
            title: t.issue_title
          })));
        }

        return ticketNumber;
      }

      console.log('No recent tickets found in this chat');
      return null;
    } catch (error) {
      console.log('Exception searching for recent tickets:', error.message);
      return null;
    }
  }
}

module.exports = LearningService;
