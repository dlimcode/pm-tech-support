// TicketingService - Handles all ticketing, escalation, and support workflows
// Extracted from server.js as part of Phase 1 refactoring

class TicketingService {
  constructor(supabase, larkService, dbFlowFunctions) {
    if (!supabase) {
      throw new Error('TicketingService requires supabase client');
    }
    if (!larkService) {
      throw new Error('TicketingService requires larkService instance');
    }
    if (!dbFlowFunctions) {
      throw new Error('TicketingService requires database flow functions');
    }

    this.supabase = supabase;
    this.larkService = larkService;
    this.dbFlowFunctions = dbFlowFunctions;

    // Issue category mappings
    this.ISSUE_CATEGORIES = {
      'candidate': 'candidate_management',
      'resume': 'candidate_management',
      'job': 'job_management',
      'position': 'job_management',
      'client': 'client_management',
      'company': 'client_management',
      'pipeline': 'pipeline_management',
      'deal': 'pipeline_management',
      'login': 'authentication',
      'password': 'authentication',
      'access': 'authentication',
      'upload': 'file_upload',
      'file': 'file_upload',
      'slow': 'system_performance',
      'performance': 'system_performance',
      'loading': 'system_performance',
      'add': 'general',
      'create': 'general',
      'save': 'general',
      'other': 'general'
    };
  }
  async createSupportTicket(ticketData) {
  try {
    console.log('📝 Inserting ticket into database...');
    console.log('🔗 Supabase URL configured:', !!process.env.SUPABASE_URL);
    console.log('🔑 Supabase key configured:', !!process.env.SUPABASE_ANON_KEY);
    
    const { data, error } = await supabase
      .schema('support')
      .from('support_tickets')
      .insert([ticketData])
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase error creating support ticket:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      console.error('❌ Full error object:', JSON.stringify(error, null, 2));
      return null;
    }

    if (!data) {
      console.error('❌ No data returned from Supabase insert');
      return null;
    }

    console.log('🎫 Support ticket created successfully:', data.ticket_number);
    console.log('📋 Ticket data:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('❌ Exception in createSupportTicket:', error.message);
    console.error('❌ Exception stack:', error.stack);
    console.error('❌ Exception full:', JSON.stringify(error, null, 2));
    return null;
  }
}

  async notifySupportTeam(ticket) {
  try {
    // Send notification to support group chat
    const supportGroupId = process.env.LARK_SUPPORT_GROUP_ID;
    if (!supportGroupId) {
      console.log('⚠️ No support group ID configured');
      return;
    }

    const message = `🚨 **New Support Ticket Created**

**Ticket**: ${ticket.ticket_number}
**User**: ${ticket.user_name || 'Unknown'}
**Category**: ${ticket.issue_category}
**Title**: ${ticket.issue_title}
**Urgency**: ${ticket.urgency_level}

**Description**: ${ticket.issue_description}

**Steps Attempted**: ${ticket.steps_attempted?.join(', ') || 'None specified'}

**Browser/Device**: ${ticket.browser_info || 'Not specified'} / ${ticket.device_info || 'Not specified'}

**Created**: ${new Date(ticket.created_at).toLocaleString()}

Please assign and respond to this ticket promptly.`;

    await larkService.sendMessage(supportGroupId, message);
    console.log('📢 Support team notified for ticket:', ticket.ticket_number);
  } catch (error) {
    console.error('❌ Error notifying support team:', error);
  }
}

  categorizeIssue(message, context = []) {
  const lowerMessage = message.toLowerCase();
  
  // First check the current message
  for (const [keyword, category] of Object.entries(ISSUE_CATEGORIES)) {
    if (lowerMessage.includes(keyword)) {
      return category;
    }
  }
  
  // If no category found in current message, check recent context
  if (context.length > 0) {
    const recentContext = context.slice(-6).map(msg => msg.content?.toLowerCase() || '').join(' ');
    for (const [keyword, category] of Object.entries(ISSUE_CATEGORIES)) {
      if (recentContext.includes(keyword)) {
        return category;
      }
    }
  }
  
  return 'general';
}

  checkTicketConfirmation(context, userMessage) {
  // Check if the previous assistant message offered to create a ticket
  const recentMessages = context.slice(-4); // Look at last 4 messages
  const botOfferedTicket = recentMessages.some(msg => 
    msg.role === 'assistant' && 
    msg.content && 
    (msg.content.toLowerCase().includes('create a support ticket') ||
     msg.content.toLowerCase().includes('create a ticket') ||
     msg.content.toLowerCase().includes('support ticket for you'))
  );
  
  if (!botOfferedTicket) return false;
  
  // Check if user is confirming
  const confirmationPhrases = [
    /^yes$/i,
    /^yes please$/i,
    /^yeah$/i,
    /^sure$/i,
    /^ok$/i,
    /^okay$/i,
    /yes.*create/i,
    /yes.*ticket/i,
    /please.*create/i,
    /go ahead/i,
    /^do it$/i
  ];
  
  return confirmationPhrases.some(phrase => phrase.test(userMessage.trim()));
}

  shouldEscalateToTicket(context, userMessage) {
  const escalationTriggers = [
    // Existing triggers
    /still.*(not|doesn't|don't|doesnt).*(work|working|help|helping)/i,
    /tried.*(that|everything|all)/i,
    /doesn't.*(work|help)/i,
    /doesnt.*(work|help)/i,
    /still.*not.*working/i,
    /still.*doesnt.*work/i,
    /still.*having.*trouble/i,
    /need.*(human|person|live|real).*(help|support)/i,
    /speak.*(to|with).*(someone|person|human)/i,
    /this.*(is|isn't).*(working|helpful)/i,
    /frustrated/i,
    /urgent/i,
    /critical/i,
    /escalate.*to.*(support|team|human)/i,
    /can.*i.*escalate/i,
    /create.*ticket/i,
    /(cant|can't|cannot).*(add|create|upload|login|access)/i,
    /not.*working/i,
    /having.*trouble/i,
    /error/i,
    
    // New comprehensive triggers - User frustration expressions
    /this.*(sucks|terrible|awful|horrible|useless)/i,
    /waste.*of.*time/i,
    /annoying/i,
    /ridiculous/i,
    /pathetic/i,
    /broken/i,
    /buggy/i,
    /glitched/i,
    /messed.*up/i,
    /screwed.*up/i,
    /totally.*broken/i,
    /completely.*broken/i,
    /not.*functioning/i,
    
    // Request for human help variations
    /talk.*to.*(someone|person|human|agent|rep)/i,
    /contact.*(support|help|team)/i,
    /get.*(help|support).*from.*(human|person)/i,
    /live.*(chat|support|help|agent)/i,
    /real.*(person|human|agent)/i,
    /technical.*(support|help)/i,
    /customer.*(service|support)/i,
    /help.*desk/i,
    /support.*team/i,
    /human.*help/i,
    /manual.*help/i,
    
    // Problem persistence expressions  
    /keeps.*(happening|occurring|breaking|failing)/i,
    /always.*(broken|failing|not.*working)/i,
    /constantly.*(failing|broken|not.*working)/i,
    /repeatedly.*(failing|broken|not.*working)/i,
    /consistently.*(failing|broken|not.*working)/i,
    /same.*problem/i,
    /same.*issue/i,
    /again.*and.*again/i,
    /over.*and.*over/i,
    /multiple.*times/i,
    
    // Inability to perform tasks
    /unable.*to/i,
    /impossible.*to/i,
    /(cant|can't|cannot).*(save|submit|complete|finish)/i,
    /(cant|can't|cannot).*(get.*it.*to|make.*it)/i,
    /won't.*let.*me/i,
    /wont.*let.*me/i,
    /preventing.*me/i,
    /blocking.*me/i,
    /stuck.*on/i,
    /stuck.*at/i,
    /locked.*out/i,
    
    // Error and failure expressions
    /error.*message/i,
    /error.*code/i,
    /system.*error/i,
    /failed.*to/i,
    /failure/i,
    /crash/i,
    /crashed/i,
    /freezing/i,
    /frozen/i,
    /timeout/i,
    /timed.*out/i,
    /connection.*error/i,
    /server.*error/i,
    /database.*error/i,
    /404.*error/i,
    /500.*error/i,
    
    // Time-sensitive situations
    /asap/i,
    /immediately/i,
    /right.*now/i,
    /emergency/i,
    /deadline/i,
    /time.*sensitive/i,
    /running.*out.*of.*time/i,
    /need.*this.*fixed/i,
    /fix.*this.*now/i,
    /priority/i,
    /high.*priority/i,
    
    // Workflow blocking expressions
    /(cant|can't|cannot).*continue/i,
    /(cant|can't|cannot).*proceed/i,
    /(cant|can't|cannot).*move.*forward/i,
    /(cant|can't|cannot).*complete.*work/i,
    /blocking.*my.*work/i,
    /stopping.*me.*from/i,
    /preventing.*work/i,
    /halt.*work/i,
    /work.*stopped/i,
    
    // Data loss concerns
    /lost.*data/i,
    /lost.*work/i,
    /disappeared/i,
    /vanished/i,
    /missing.*files/i,
    /missing.*data/i,
    /corrupted/i,
    /damaged/i,
    
    // Multiple attempt expressions
    /tried.*multiple.*times/i,
    /tried.*several.*times/i,
    /attempted.*many.*times/i,
    /keep.*trying/i,
    /tried.*different.*ways/i,
    /nothing.*works/i,
    /nothing.*is.*working/i,
    /none.*of.*this.*works/i,
    
    // Final resort expressions
    /last.*resort/i,
    /final.*option/i,
    /no.*other.*choice/i,
    /exhausted.*options/i,
    /tried.*everything.*else/i,
    /what.*else.*can.*i.*do/i,
    /help.*me.*please/i,
    /please.*help/i,
    /desperate/i,
    /desperately.*need/i
  ];

  console.log('🔍 Checking escalation for message:', userMessage);
  const shouldEscalate = escalationTriggers.some(trigger => {
    const matches = trigger.test(userMessage);
    if (matches) {
      console.log('✅ Escalation trigger matched:', trigger);
    }
    return matches;
  });
  console.log('🚨 Should escalate:', shouldEscalate);
  
  return shouldEscalate;
}

  async startTicketCreation(chatId, userMessage, category, senderId = null) {
  console.log('🎫 Starting ticket creation for chat:', chatId);

  // Initialize ticket flow in database
  await startTicketFlow(chatId, senderId || 'unknown', category, userMessage);

  return `I'll help you create a support ticket to get personalized assistance. Let me collect some details:

**Step 1 of 3: Issue Title**
Please provide a brief title that describes your issue (e.g., "Cannot add candidate to job", "Login page not loading"):`;
}

  async handleTicketCreationFlow(chatId, userMessage, ticketState, senderId = null) {
  const { step, data, category, senderId: storedSenderId } = ticketState;
  const actualSenderId = senderId || storedSenderId;
  
  switch (step) {
    case 'title':
      // Update flow state with title
      await updateTicketFlowState(chatId, 'description', { title: userMessage.trim() });

      return `**Step 2 of 3: Detailed Description**
Please describe the issue in detail. What exactly happens when you try to perform the action?`;

    case 'description':
      // Update flow state with description
      await updateTicketFlowState(chatId, 'steps', { description: userMessage.trim() });

      return `**Step 3 of 3: Steps Attempted**
What steps have you already tried to resolve this issue? (e.g., "Refreshed page, cleared cache, tried different browser")`;

    case 'steps':
      data.stepsAttempted = userMessage.trim().split(',').map(s => s.trim());

      // Set default values for removed steps
      data.browser = 'Not specified';
      data.device = 'Not specified';
      data.urgency = 'medium'; // Default urgency level

      // Create the ticket immediately after step 3
      const ticket = await createTicketFromData(chatId, data, category, ticketState.originalMessage, actualSenderId);

      // Clear the flow state from database
      await completeTicketFlow(chatId);
      
      if (ticket) {
        console.log('🎯 Ticket created successfully, notifying support team...');
        
        // Notify support team
        try {
          await notifySupportTeam(ticket);
          console.log('📢 Support team notification sent successfully');
        } catch (notifyError) {
          console.error('⚠️ Failed to notify support team:', notifyError);
          // Continue anyway - ticket was created
        }
        
        return `✅ **Support Ticket Created Successfully!**

**Ticket Number**: ${ticket.ticket_number}
**Status**: Open
**Urgency**: ${data.urgency.toUpperCase()}

Your ticket has been submitted and our support team has been notified. They will review your issue and respond as soon as possible.

**What happens next:**
• Our support team will review your ticket
• You'll receive updates on the progress
• A support agent may reach out for additional information

**Estimated Response Time:**
• Critical: Within 1 hour
• High: Within 4 hours  
• Medium: Within 24 hours
• Low: Within 48 hours

Thank you for providing detailed information. Is there anything else I can help you with?`;
      } else {
        console.log('❌ Ticket creation failed - returning error message to user');
        return `❌ I encountered an error creating your support ticket. This could be due to:

• Database connection issues
• Missing required information
• System configuration problems

**Please try again in a few minutes, or contact our support team directly:**

📧 Email: support@pm-next.com
💬 Direct Chat: https://applink.larksuite.com/client/chat/chatter/add_by_link?link_token=3ddsabad-9efa-4856-ad86-a3974dk05ek2

I apologize for the inconvenience. Our technical team has been notified of this issue.`;
      }

    default:
      // Reset if in unknown state
      await completeTicketFlow(chatId);
      return `I encountered an error in the ticket creation process. Let me start over. Please describe your issue and I'll help you create a support ticket.`;
  }
}

  async createTicketFromData(chatId, data, category, originalMessage, senderId = null) {
  try {
    console.log('🔧 Creating ticket with data:', {
      chatId,
      category,
      title: data.title,
      urgency: data.urgency,
      senderId
    });
    
    // Get actual user info from Lark
    let userInfo = null;
    let actualUserId = senderId?.id || `user_${chatId}`;
    let actualUserName = 'Lark User';
    
    console.log('🔍 Analyzing sender ID for user info:', JSON.stringify(senderId, null, 2));
    
    if (senderId) {
      console.log('🔍 Attempting to fetch user info for sender ID:', senderId);
      userInfo = await larkService.getUserInfo(senderId);
      
      if (userInfo) {
        actualUserId = userInfo.user_id;
        actualUserName = userInfo.name;
        console.log('✅ Using fetched user info:', { id: actualUserId, name: actualUserName });
      } else {
        console.log('⚠️ Could not fetch user info, using sender ID as fallback');
        // Try to extract ID from sender object
        if (typeof senderId === 'object' && senderId.id) {
          actualUserId = senderId.id;
          console.log('🔄 Using sender.id as user ID:', actualUserId);
        } else if (typeof senderId === 'string') {
          actualUserId = senderId;
          console.log('🔄 Using sender string as user ID:', actualUserId);
        }
      }
    } else {
      console.log('⚠️ No sender ID provided, using fallback user identification');
    }
    
    const ticketData = {
      user_id: actualUserId,
      chat_id: chatId,
      user_name: actualUserName,
      issue_category: category,
      issue_title: data.title,
      issue_description: data.description,
      steps_attempted: data.stepsAttempted || [],
      browser_info: data.browser || 'Not specified',
      device_info: data.device || 'Not specified',
      urgency_level: data.urgency || 'medium',
      status: 'open',
      conversation_context: {
        original_message: originalMessage,
        collected_data: data,
        user_info: userInfo // Store additional user info for reference
      }
    };
    
    console.log('🎫 Sending ticket data to database:', JSON.stringify(ticketData, null, 2));
    
    const result = await createSupportTicket(ticketData);
    
    if (result) {
      console.log('✅ Ticket created successfully:', result.ticket_number);
    } else {
      console.log('❌ Ticket creation failed - no result returned');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error creating ticket from data:', error);
    console.error('❌ Error stack:', error.stack);
    return null;
  }
}
}

module.exports = TicketingService;
