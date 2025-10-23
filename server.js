// ===================================================================
// PM-Next Lark Bot - Main Server
// ===================================================================
// This is the main entry point for the PM-Next Lark support bot.
// All services have been extracted to /services directory for maintainability.
// Test endpoints are in test-endpoints.js for cleaner organization.
// ===================================================================

require('dotenv').config();

// === Core Dependencies ===
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// === Internal Modules ===
const messageLogger = require('./message-logger');
const analyticsAPI = require('./analytics-api');

// === Service Imports ===
const LarkService = require('./services/lark_service');
const KnowledgeService = require('./services/knowledge_service');
const AIService = require('./services/ai_service');
const LearningService = require('./services/learning_service');
const TicketingService = require('./services/ticketing_service');

// === Express App Setup ===
const app = express();
const PORT = process.env.PORT || 3001;

// === Event Deduplication ===
// Store processed event IDs to prevent duplicate processing
const processedEvents = new Set();

// === Database Functions for State Persistence ===
// These functions manage conversation and ticket flow state in Supabase
// (replacing previous in-memory Maps for serverless compatibility)
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

// Ticket flow state management functions
async function startTicketFlow(chatId, userId, category, originalMessage) {
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
      return false;
    }

    console.log('✅ Ticket flow started for chat:', chatId);
    return true;
  } catch (error) {
    console.error('❌ Exception in startTicketFlow:', error);
    return false;
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

    // Transform database format to match existing code structure
    return {
      step: data.current_step,
      category: data.collected_data.category,
      originalMessage: data.collected_data.originalMessage,
      senderId: data.user_id,
      data: data.collected_data.data || {}
    };
  } catch (error) {
    console.error('❌ Error fetching ticket flow state:', error);
    return null;
  }
}

async function updateTicketFlowState(chatId, newStep, newData) {
  try {
    const currentState = await getTicketFlowState(chatId);
    if (!currentState) {
      console.error('❌ No ticket flow found for chat:', chatId);
      return false;
    }

    // Merge new data with existing data
    const mergedData = { ...currentState.data, ...newData };

    const { error } = await supabase
      .from('active_ticket_flows')
      .update({
        current_step: newStep,
        collected_data: {
          category: currentState.category,
          originalMessage: currentState.originalMessage,
          data: mergedData
        },
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

// === Performance Analytics Tracking ===
const analytics = {
  totalRequests: 0,
  cacheHits: 0,
  averageResponseTime: 0,
  commonQuestions: new Map(),
  errorCount: 0
};

// === Express Middleware ===
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// === Analytics API ===
app.use('/api/analytics', analyticsAPI);

// === Service Initialization ===
// Initialize Lark service
const larkService = new LarkService(
  process.env.LARK_APP_ID,
  process.env.LARK_APP_SECRET
);

// Validate required environment variables
console.log('🔧 Environment variable check:');
console.log('   - NODE_ENV:', process.env.NODE_ENV);
console.log('   - VERCEL:', process.env.VERCEL);
console.log('   - SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
console.log('   - SUPABASE_ANON_KEY exists:', !!process.env.SUPABASE_ANON_KEY);

if (!process.env.SUPABASE_URL) {
  console.error('❌ SUPABASE_URL environment variable is required but not set');
  console.error('💡 Check your Vercel environment variables configuration');
}

if (!process.env.SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE_ANON_KEY environment variable is required but not set');
  console.error('💡 Check your Vercel environment variables configuration');
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    db: {
      schema: 'support'
    }
  }
);

// Initialize Knowledge service
const knowledgeService = new KnowledgeService(supabase);

// Initialize AI service
const aiService = new AIService(process.env.OPENAI_API_KEY, supabase, knowledgeService);

// Initialize Learning service
const learningService = new LearningService(supabase, aiService, knowledgeService, larkService);

// Initialize Ticketing service
const ticketingService = new TicketingService(supabase, larkService, {
  startTicketFlow,
  updateTicketFlowState,
  completeTicketFlow,
  getTicketFlowState
});

// === Test and Debug Endpoints ===
// Load test endpoints (extracted to separate file for cleaner codebase)
const createTestRouter = require('./test-endpoints');
const testRouter = createTestRouter({
  larkService,
  ticketingService,
  learningService,
  aiService,
  knowledgeService,
  supabase
});
app.use(testRouter);

// === Core Routes ===

// Handle Lark events
app.post('/lark/events', async (req, res) => {
  try {
    console.log('📥 Received Lark event:', JSON.stringify(req.body, null, 2));
    const { header, event, challenge, type } = req.body;

    // Handle URL verification (legacy format)
    if (type === 'url_verification') {
      console.log('🔗 URL verification request');
      return res.status(200).json({ 
        challenge: challenge 
      });
    }

    // Handle new format events
    if (header && header.event_type === 'im.message.receive_v1' && event) {
      console.log('📨 Message event received from header');
      console.log('📋 Event structure:', Object.keys(event));
      
      // Check for duplicate events
      const eventId = header.event_id;
      if (processedEvents.has(eventId)) {
        console.log('🔄 Duplicate event detected, skipping:', eventId);
        return res.json({ success: true });
      }
      
      // Mark event as processed
      processedEvents.add(eventId);
      
      // Clean up old event IDs (keep only last 1000 to prevent memory issues)
      if (processedEvents.size > 1000) {
        const eventsArray = Array.from(processedEvents);
        processedEvents.clear();
        eventsArray.slice(-500).forEach(id => processedEvents.add(id));
      }
      
      // Check if this is a message event by looking for the message property
      if (event.message) {
        console.log('💬 Processing message event');
        await handleMessage(event);
      } else {
        console.log('⏭️ Not a message event, skipping');
      }
    } else {
      console.log('⏭️ Unknown event type or structure');
      console.log('📋 Available keys:', Object.keys(req.body));
      if (header) {
        console.log('📋 Header event type:', header.event_type);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error handling Lark event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Extract text from Lark rich content format
function extractTextFromRichContent(content) {
  try {
    if (!Array.isArray(content)) return '';
    
    let text = '';
    content.forEach(paragraph => {
      if (Array.isArray(paragraph)) {
        paragraph.forEach(element => {
          if (element.tag === 'text' && element.text) {
            text += element.text;
          }
        });
        text += ' '; // Add space between paragraphs
      }
    });
    
    return text.trim().replace(/@\w+/g, '').trim(); // Remove mentions
  } catch (error) {
    console.error('❌ Error extracting rich content:', error);
    return '';
  }
}

// Handle incoming messages
async function handleMessage(event) {
  try {
    console.log('🔍 Handling message event:', JSON.stringify(event, null, 2));
    
    const { chat_id, message_id, content, mentions } = event.message;
    const { sender_type, sender_id } = event.sender;

    console.log('📋 Message details:');
    console.log('  - Chat ID:', chat_id);
    console.log('  - Message ID:', message_id);
    console.log('  - Sender Type:', sender_type);
    console.log('  - Sender ID:', JSON.stringify(sender_id, null, 2));
    console.log('  - Sender ID type:', typeof sender_id);
    console.log('  - Chat type:', event.message.chat_type);
    console.log('  - Content:', content);
    console.log('  - Mentions:', mentions);
    
    // Log chat ID for support group identification
    console.log('🆔 CHAT ID FOR REFERENCE:', chat_id);

    // Check if the message is from the bot itself
    if (sender_type === 'app' || (sender_id && sender_id.id === process.env.LARK_APP_ID)) {
      console.log('🤖 Skipping: Message from bot itself');
      return; // Don't respond to own messages
    }

    // Check if the bot was mentioned or if it's a direct message
    
    const isMentioned = mentions && mentions.some(mention => 
      mention.key === process.env.LARK_APP_ID || 
      mention.name === 'Ask Danish' ||
      (mention.id && (mention.id.open_id || mention.id.user_id || mention.id.union_id))
    );
    const isDirectMessage = event.message.chat_type === 'p2p';

    console.log('🎯 Response conditions:');
    console.log('  - Is mentioned:', isMentioned);
    console.log('  - Is direct message:', isDirectMessage);
    console.log('  - Should respond:', isMentioned || isDirectMessage);

    if (!isMentioned && !isDirectMessage) {
      console.log('⏭️  Skipping: Not mentioned and not a DM');
      return; // Don't respond if bot wasn't mentioned and it's not a DM
    }

    // Extract text content
    let userMessage = '';
    if (content) {
      // Content might be a JSON string, so parse it first
      let parsedContent = content;
      if (typeof content === 'string') {
        try {
          parsedContent = JSON.parse(content);
        } catch (e) {
          console.log('⚠️ Content is not JSON, using as string');
          parsedContent = { text: content };
        }
      }
      
      // Handle different message types
      if (parsedContent && parsedContent.text) {
        // Simple text message
        userMessage = parsedContent.text.replace(/@\w+/g, '').trim();
      } else if (parsedContent && parsedContent.content) {
        // Rich text/post message - extract text from structured content
        userMessage = extractTextFromRichContent(parsedContent.content);
      }
    }

    console.log('📝 Extracted user message:', userMessage);
    console.log('📏 Message length:', userMessage.length);

    // Check if user is in ticket creation flow
    const ticketFlowState = await getTicketFlowState(chat_id);
    const isInTicketFlow = ticketFlowState !== null;

    if (!userMessage || (userMessage.length < 2 && !isInTicketFlow)) {
      console.log('⏭️  Skipping: Empty or too short message');
      return; // Don't respond to empty messages
    }
    
    if (isInTicketFlow) {
      console.log('🎫 User in ticket creation flow, allowing short responses');
    }

    // Get user information for logging
    let userName = 'Unknown User';
    let userInfo = null;
    try {
      if (sender_id && (sender_id.user_id || sender_id.open_id || sender_id.union_id)) {
        userInfo = await larkService.getUserInfo(sender_id);
        userName = userInfo?.name || userInfo?.displayName || 'Unknown User';
      }
    } catch (error) {
      console.log('⚠️ Could not fetch user info for logging:', error.message);
    }

    // Log the user message
    const userLogData = {
      chatId: chat_id,
      userId: sender_id?.user_id || sender_id?.open_id || sender_id?.union_id || null,
      userName: userName,
      message: userMessage,
      userMetadata: {
        senderType: sender_type,
        chatType: event.message.chat_type,
        messageId: message_id,
        userInfo: userInfo
      },
      messageMetadata: {
        originalContent: content,
        mentions: mentions,
        isInTicketFlow: isInTicketFlow
      }
    };
    
    const userMessageLog = await messageLogger.logUserMessage(userLogData);
    console.log('📝 User message logged with ID:', userMessageLog?.id);

    // Check if this is a support solution for knowledge base update
    console.log('🔍 Checking if message is a support solution...');
    const solutionProcessed = await learningService.processSupportSolution(userMessage, chat_id, sender_id, event);
    console.log('📊 Solution processing result:', solutionProcessed);
    
    if (!solutionProcessed) {
      console.log('🤖 Generating AI response...');
      // Generate AI response with context, passing sender information
      const responseStartTime = Date.now();
      const aiResponseData = await aiService.generateResponse(userMessage, chat_id, sender_id, {
        getConversationHistory,
        getTicketFlowState,
        handleTicketCreationFlow: ticketingService.handleTicketCreationFlow.bind(ticketingService),
        startTicketCreation: ticketingService.startTicketCreation.bind(ticketingService),
        checkTicketConfirmation: ticketingService.checkTicketConfirmation.bind(ticketingService),
        categorizeIssue: ticketingService.categorizeIssue.bind(ticketingService),
        shouldEscalateToTicket: ticketingService.shouldEscalateToTicket.bind(ticketingService),
        analytics
      });
      const totalProcessingTime = Date.now() - responseStartTime;
      
      // Handle response data (could be string or object with metadata)
      let aiResponse, responseMetadata;
      if (typeof aiResponseData === 'object' && aiResponseData.response) {
        aiResponse = aiResponseData.response;
        responseMetadata = aiResponseData;
      } else {
        aiResponse = aiResponseData;
        responseMetadata = {
          responseType: 'ai_generated',
          processingTimeMs: totalProcessingTime
        };
      }
      
      console.log('✅ AI response generated:', aiResponse);

      console.log('📤 Sending response to Lark...');
      // Send response back to Lark
      await larkService.sendMessage(chat_id, aiResponse);
      console.log('🎉 Message sent successfully!');
      
      // Log the bot response with detailed metadata
      const botLogData = {
        chatId: chat_id,
        message: aiResponse,
        responseType: responseMetadata.responseType || 'ai_generated',
        processingTimeMs: responseMetadata.processingTimeMs || totalProcessingTime,
        knowledgeBaseHit: responseMetadata.knowledgeBaseHit || false,
        cacheHit: responseMetadata.cacheHit || false,
        escalatedToHuman: responseMetadata.escalatedToHuman || false,
        messageMetadata: {
          userMessageId: userMessageLog?.id,
          originalUserMessage: userMessage,
          responseMetadata: responseMetadata
        }
      };
      
      const botMessageLog = await messageLogger.logBotResponse(botLogData);
      console.log('🤖 Bot response logged with ID:', botMessageLog?.id);
    } else {
      console.log('📚 Support solution processed, knowledge base updated!');
      console.log('🚫 Skipping AI response generation since solution was processed');
    }
    
  } catch (error) {
    console.error('❌ Error handling message:', error);
  }
}

// === Health & Diagnostic Endpoints ===

// Environment check endpoint
app.get('/env-check', (req, res) => {
  res.json({
    environment: process.env.NODE_ENV,
    vercel: !!process.env.VERCEL,
    supabaseUrl: !!process.env.SUPABASE_URL,
    supabaseKey: !!process.env.SUPABASE_ANON_KEY,
    supabaseUrlPrefix: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 30) + '...' : 'NOT SET'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'PM-Next Lark Bot',
    timestamp: new Date().toISOString()
  });
});

// Test database connection endpoint
app.post('/test-db-connection', async (req, res) => {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test Supabase connection
    const { error: testError } = await supabase
      .schema('support')
      .from('support_tickets')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Database test failed:', testError);
      return res.status(500).json({ 
        success: false, 
        error: testError.message,
        details: testError
      });
    }
    
    // Test knowledge base table
    const { error: kbError } = await supabase
      .from('knowledge_base')
      .select('count')
      .limit(1);
    
    if (kbError) {
      console.error('❌ Knowledge base test failed:', kbError);
      return res.status(500).json({ 
        success: false, 
        error: kbError.message,
        table: 'knowledge_base'
      });
    }
    
    console.log('✅ Database connection successful');
    res.json({
      success: true,
      message: 'Database connection working',
      environment: process.env.VERCEL ? 'vercel' : 'local',
      supabaseUrl: process.env.SUPABASE_URL ? 'configured' : 'missing',
      supabaseKey: process.env.SUPABASE_ANON_KEY ? 'configured' : 'missing'
    });
    
  } catch (error) {
    console.error('❌ Database connection error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Check knowledge base entries endpoint
app.get('/check-kb-entries', async (req, res) => {
  try {
    const { data: entries, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.json({
      success: true,
      count: entries.length,
      entries: entries.map(entry => ({
        id: entry.id,
        ticket_source: entry.ticket_source,
        question: entry.question?.substring(0, 50) + '...',
        category: entry.category,
        created_at: entry.created_at
      }))
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});


// === Production Monitoring Endpoints ===

// Analytics endpoint
app.get('/analytics', (req, res) => {
  const topQuestions = Array.from(analytics.commonQuestions.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([question, count]) => ({ question, count }));
    
  res.json({
    totalRequests: analytics.totalRequests,
    cacheHitRate: analytics.totalRequests > 0 ?
      (analytics.cacheHits / analytics.totalRequests * 100).toFixed(1) + '%' : '0%',
    averageResponseTime: analytics.averageResponseTime.toFixed(0) + 'ms',
    errorCount: analytics.errorCount,
    errorRate: analytics.totalRequests > 0 ?
      (analytics.errorCount / analytics.totalRequests * 100).toFixed(1) + '%' : '0%',
    topQuestions: topQuestions,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// === Support Ticket Management Endpoints ===

app.get('/tickets', async (req, res) => {
  try {
    const { status = 'open', limit = 50 } = req.query;
    
    let query = supabase
      .schema('support')
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.json({
      tickets: data,
      count: data.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

app.get('/tickets/:ticketNumber', async (req, res) => {
  try {
    const { ticketNumber } = req.params;
    
    const { data, error } = await supabase
      .schema('support')
      .from('support_tickets')
      .select('*')
      .eq('ticket_number', ticketNumber)
      .single();
    
    if (error) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

app.patch('/tickets/:ticketNumber', async (req, res) => {
  try {
    const { ticketNumber } = req.params;
    const updates = req.body;
    
    // Add resolved timestamp if status is being set to resolved
    if (updates.status === 'resolved' && !updates.resolved_at) {
      updates.resolved_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .schema('support')
      .from('support_tickets')
      .update(updates)
      .eq('ticket_number', ticketNumber)
      .select()
      .single();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

// === Knowledge Base Management Endpoints ===

// Get knowledge base statistics
app.get('/knowledge-stats', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const knowledgeBasePath = path.join(__dirname, 'knowledge-base.md');
    const knowledgeBase = fs.readFileSync(knowledgeBasePath, 'utf8');
    
    // Count Q&A pairs
    const qaCount = (knowledgeBase.match(/### Q:/g) || []).length;
    
    // Count by category
    const categories = {
      candidate_management: (knowledgeBase.match(/candidate/gi) || []).length,
      job_management: (knowledgeBase.match(/job/gi) || []).length,
      client_management: (knowledgeBase.match(/client/gi) || []).length,
      authentication: (knowledgeBase.match(/login|password|access/gi) || []).length,
      system_performance: (knowledgeBase.match(/slow|performance|loading/gi) || []).length
    };
    
    // Get resolved tickets count
    const { data: resolvedTickets } = await supabase
      .schema('support')
      .from('support_tickets')
      .select('id, created_at, resolved_at')
      .eq('status', 'resolved');
    
    const stats = {
      totalQAs: qaCount,
      fileSize: Math.round(knowledgeBase.length / 1024 * 100) / 100, // KB
      lastModified: fs.statSync(knowledgeBasePath).mtime,
      categories: categories,
      resolvedTickets: resolvedTickets?.length || 0,
      timestamp: new Date().toISOString()
    };
    
    res.json(stats);
    
  } catch (error) {
    console.error('❌ Knowledge stats error:', error);
    res.status(500).json({ error: 'Failed to get knowledge base statistics' });
  }
});

// Reload knowledge base endpoint (static + database content)
app.post('/reload-knowledge-base', async (req, res) => {
  try {
    const oldLength = knowledgeService.getContent().length;
    await knowledgeService.reload();
    const newLength = knowledgeService.getContent().length;

    res.json({
      success: true,
      message: 'Knowledge base reloaded successfully (static + dynamic content)',
      stats: {
        oldSize: Math.round(oldLength / 1024 * 100) / 100,
        newSize: Math.round(newLength / 1024 * 100) / 100,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Knowledge base reload error:', error);
    res.status(500).json({ error: 'Failed to reload knowledge base' });
  }
});

// Get current loaded knowledge base content
app.get('/current-knowledge-base', (req, res) => {
  try {
    const stats = knowledgeService.getStats();
    res.json({
      ...stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting current knowledge base:', error);
    res.status(500).json({ error: 'Failed to get current knowledge base' });
  }
});

// === Server Initialization ===

// Initialize knowledge base for serverless environment
async function initializeForServerless() {
  console.log('🚀 Serverless environment detected - initializing for Vercel');
  try {
    await knowledgeService.initialize();
    console.log(`🗄️ Hybrid knowledge base initialized (static + dynamic content)`);
  } catch (error) {
    console.error('⚠️ Knowledge base initialization failed:', error.message);
    console.log('🔄 Using static file-based knowledge base only');
  }
}

// For local development only
if (!process.env.VERCEL && !process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.listen(PORT, async () => {
    console.log(`🤖 PM-Next Lark Bot server is running on port ${PORT}`);
    console.log(`📝 Health check: http://localhost:${PORT}/health`);

    try {
      await knowledgeService.initialize();
      console.log(`🗄️ Hybrid knowledge base initialized (static + dynamic content)`);
    } catch (error) {
      console.error('⚠️ Knowledge base initialization failed:', error.message);
      console.log('🔄 Using static file-based knowledge base only');
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down PM-Next Lark Bot server...');
    process.exit(0);
  });
} else {
  // Serverless environment - initialize on first request
  initializeForServerless();
}

// Export the app for Vercel
module.exports = app;
