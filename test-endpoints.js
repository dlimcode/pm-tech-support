/**
 * Test and Debug Endpoints
 *
 * This module contains test, debug, and admin endpoints for the PM-Next Lark Bot.
 * These endpoints are used for testing functionality, debugging issues, and manual administration.
 *
 * Usage: const testRouter = require('./test-endpoints')(services);
 *        app.use(testRouter);
 */

const express = require('express');

module.exports = function createTestRouter(services) {
  const router = express.Router();

  // Destructure all required services
  const {
    larkService,
    ticketingService,
    learningService,
    aiService,
    knowledgeService,
    supabase
  } = services;

  // Test user info endpoint for debugging
  router.get('/test-user/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      console.log('🧪 Testing user info fetch for:', userId);

      const userInfo = await larkService.getUserInfo(userId);

      res.json({
        success: !!userInfo,
        userInfo: userInfo,
        userId: userId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        userId: req.params.userId,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Test notification endpoint
  router.post('/test-notification', async (req, res) => {
    try {
      const { chatId } = req.body;

      if (!chatId) {
        return res.status(400).json({ error: 'chatId is required' });
      }

      const testTicket = {
        ticket_number: 'TEST-' + Date.now(),
        user_name: 'Test User',
        issue_category: 'test',
        issue_title: 'Test Notification',
        issue_description: 'This is a test notification to verify the support team notification system.',
        urgency_level: 'medium',
        steps_attempted: ['Testing notification system'],
        browser_info: 'Test Browser',
        device_info: 'Test Device',
        created_at: new Date().toISOString()
      };

      // Override the support group ID temporarily
      const originalGroupId = process.env.LARK_SUPPORT_GROUP_ID;
      process.env.LARK_SUPPORT_GROUP_ID = chatId;

      await ticketingService.notifySupportTeam(testTicket);

      // Restore original group ID
      process.env.LARK_SUPPORT_GROUP_ID = originalGroupId;

      res.json({
        success: true,
        message: 'Test notification sent',
        chatId: chatId
      });
    } catch (error) {
      console.error('❌ Test notification error:', error);
      res.status(500).json({ error: 'Failed to send test notification' });
    }
  });

  // Test ticket creation endpoint
  router.post('/test-ticket', async (req, res) => {
    try {
      console.log('🧪 Testing ticket creation...');

      const testTicketData = {
        user_id: 'test_user_' + Date.now(),
        chat_id: 'test_chat_' + Date.now(),
        user_name: 'Test User',
        issue_category: 'general',
        issue_title: 'Test Ticket Creation',
        issue_description: 'This is a test ticket to verify the database connection and ticket creation process.',
        steps_attempted: ['Testing system'],
        browser_info: 'Test Browser',
        device_info: 'Test Device',
        urgency_level: 'medium',
        status: 'open',
        conversation_context: {
          test: true,
          timestamp: new Date().toISOString()
        }
      };

      const ticket = await ticketingService.createSupportTicket(testTicketData);

      if (ticket) {
        res.json({
          success: true,
          message: 'Test ticket created successfully',
          ticket: {
            ticket_number: ticket.ticket_number,
            id: ticket.id,
            created_at: ticket.created_at
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create test ticket',
          message: 'Check server logs for detailed error information'
        });
      }
    } catch (error) {
      console.error('❌ Test ticket creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Exception during test ticket creation',
        message: error.message
      });
    }
  });

  // Test solution processing endpoint
  router.post('/test-solution-processing', async (req, res) => {
    try {
      console.log('🧪 Testing solution processing...');

      const { chatId, solutionMessage, createTestTicket = true } = req.body;

      if (!solutionMessage) {
        return res.status(400).json({
          error: 'solutionMessage is required'
        });
      }

      let testChatId = chatId || 'test_chat_' + Date.now();
      let testTicketNumber = null;

      // Create a test ticket if requested
      if (createTestTicket) {
        const testTicketData = {
          user_id: 'test_user_solution_' + Date.now(),
          chat_id: testChatId,
          user_name: 'Test User - Solution Processing',
          issue_category: 'authentication',
          issue_title: 'Test login issue for solution processing',
          issue_description: 'This is a test ticket to verify solution processing works correctly.',
          steps_attempted: ['Tried different browser', 'Cleared cache'],
          browser_info: 'Chrome',
          device_info: 'MacBook',
          urgency_level: 'medium',
          status: 'open',
          conversation_context: {
            test: true,
            purpose: 'solution_processing_test'
          }
        };

        const ticket = await ticketingService.createSupportTicket(testTicketData);
        if (!ticket) {
          return res.status(500).json({
            error: 'Failed to create test ticket for solution processing test'
          });
        }

        testTicketNumber = ticket.ticket_number;
        console.log('✅ Test ticket created:', testTicketNumber);
      }

      // Create a mock event that simulates a reply
      const mockEvent = {
        message: {
          chat_id: testChatId,
          parent_id: 'mock_parent_id',
          content: JSON.stringify({ text: solutionMessage })
        }
      };

      // Test solution processing
      console.log('🔍 Testing solution processing with message:', solutionMessage.substring(0, 100) + '...');

      const result = await learningService.processSupportSolution(
        solutionMessage,
        testChatId,
        { id: 'test_sender_id' },
        mockEvent
      );

      // Clean up test ticket if we created one
      if (testTicketNumber) {
        try {
          await supabase
            .schema('support')
            .from('support_tickets')
            .delete()
            .eq('ticket_number', testTicketNumber);
          console.log('🧹 Test ticket cleaned up');
        } catch (cleanupError) {
          console.log('⚠️ Failed to cleanup test ticket:', cleanupError.message);
        }
      }

      res.json({
        success: true,
        message: 'Solution processing test completed',
        results: {
          solutionProcessed: result,
          testTicketCreated: createTestTicket,
          testTicketNumber: testTicketNumber,
          testChatId: testChatId,
          messageLength: solutionMessage.length
        }
      });

    } catch (error) {
      console.error('❌ Test solution processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Test failed',
        message: error.message
      });
    }
  });

  // Manually trigger knowledge base update from ticket solution
  router.post('/update-knowledge-base', async (req, res) => {
    try {
      const { ticketNumber, solution, forceUpdate = false } = req.body;

      if (!ticketNumber || !solution) {
        return res.status(400).json({
          error: 'ticketNumber and solution are required'
        });
      }

      console.log('🔧 Manual knowledge base update requested:', ticketNumber);

      // Note: Solution validation removed - extractQAPair will handle validation
      // If extraction fails, the endpoint will return an error naturally

      // Extract Q&A pair
      const qaPair = await aiService.extractQAPair(ticketNumber, solution);
      if (!qaPair) {
        return res.status(400).json({
          error: 'Could not extract Q&A pair from ticket and solution'
        });
      }

      // Update knowledge base (database-first approach)
      const success = await knowledgeService.addEntry({...qaPair, ticketNumber});
      if (!success) {
        return res.status(500).json({
          error: 'Failed to update knowledge base'
        });
      }

      // Update ticket status
      await supabase
        .schema('support')
        .from('support_tickets')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolution_notes: solution
        })
        .eq('ticket_number', ticketNumber);

      res.json({
        success: true,
        message: 'Knowledge base updated successfully',
        qaPair: qaPair
      });

    } catch (error) {
      console.error('❌ Manual knowledge base update error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  // Test knowledge base update with sample data
  router.post('/test-knowledge-update', async (req, res) => {
    try {
      console.log('🧪 Testing knowledge base update...');

      const testSolution = `Solution: The user needs to clear their browser cache and cookies.

Steps to fix:
1. Go to browser settings
2. Clear browsing data
3. Select "Cookies and other site data" and "Cached images and files"
4. Click "Clear data"
5. Refresh the page and try again

This resolves the login issue in most cases.`;

      const mockTicket = {
        ticket_number: 'TEST-' + Date.now(),
        issue_title: 'Cannot login to PM-Next',
        issue_description: 'User reports login page keeps loading but never completes',
        issue_category: 'authentication',
        steps_attempted: ['Tried different browser', 'Restarted computer']
      };

      // Temporarily insert mock ticket
      const { data: insertedTicket } = await supabase
        .schema('support')
        .from('support_tickets')
        .insert([{
          ticket_number: mockTicket.ticket_number,
          user_id: 'test_user',
          chat_id: 'test_chat',
          user_name: 'Test User',
          issue_category: mockTicket.issue_category,
          issue_title: mockTicket.issue_title,
          issue_description: mockTicket.issue_description,
          steps_attempted: mockTicket.steps_attempted,
          urgency_level: 'low',
          status: 'open'
        }])
        .select()
        .single();

      if (!insertedTicket) {
        return res.status(500).json({ error: 'Failed to create test ticket' });
      }

      // Test the knowledge base update
      const qaPair = await aiService.extractQAPair(mockTicket.ticket_number, testSolution);
      if (!qaPair) {
        return res.status(500).json({ error: 'Failed to extract Q&A pair' });
      }

      const success = await knowledgeService.addEntry(qaPair);

      // Clean up test ticket
      await supabase
        .schema('support')
        .from('support_tickets')
        .delete()
        .eq('ticket_number', mockTicket.ticket_number);

      if (success) {
        res.json({
          success: true,
          message: 'Knowledge base test update successful',
          testData: {
            ticket: mockTicket,
            solution: testSolution,
            extractedQA: qaPair
          }
        });
      } else {
        res.status(500).json({ error: 'Failed to update knowledge base' });
      }

    } catch (error) {
      console.error('❌ Test knowledge base update error:', error);
      res.status(500).json({
        error: 'Test failed',
        message: error.message
      });
    }
  });

  return router;
};
