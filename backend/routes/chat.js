import express from 'express';
import { processMessage } from '../services/aiService.js';
import { executeFunction } from '../services/functionExecutor.js';
import * as agentRepo from '../db/repositories/agentRepository.js';
import * as conversationRepo from '../db/repositories/conversationRepository.js';
import { validateChatMessage, validateAgentId } from '../middleware/validation.js';
import { chatLimiter } from '../middleware/rateLimiting.js';

const router = express.Router();

// Chat with agent
router.post('/agents/:id/chat', chatLimiter, validateAgentId, validateChatMessage, async (req, res) => {
  try {
    // Get agent with functions from database
    const agent = await agentRepo.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: true, message: 'Agent not found' });
    }

    const { message, conversationHistory = [] } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: true, message: 'Message is required' });
    }

    // Create or get conversation
    let conversation;
    try {
      conversation = await conversationRepo.createConversation(agent.id, 'chat');
    } catch (error) {
      console.error('Conversation creation error:', error);
    }

    // Process message with AI
    const aiResponse = await processMessage(agent, message, conversationHistory);

    // Check for function calls
    const functionCalls = [];
    let finalMessage = aiResponse.message;

    if (aiResponse.functionCall) {
      try {
        console.log('🔧 Executing function:', aiResponse.functionCall.name);
        console.log('📝 Function call:', aiResponse);
        console.log('📝📝📝 Parameters:', aiResponse.functionCall.parameters);
        
        const startTime = Date.now();
        const functionResult = await executeFunction(
          agent,
          aiResponse.functionCall.name,
          aiResponse.functionCall.parameters
        );
        const executionTime = Date.now() - startTime;

        functionCalls.push(aiResponse.functionCall.name);

        // Log function execution
        if (conversation) {
          await conversationRepo.logFunctionExecution({
            conversationId: conversation.id,
            functionName: aiResponse.functionCall.name,
            parameters: aiResponse.functionCall.parameters,
            response: functionResult,
            status: 'success',
            executionTime
          });
        }

        console.log('✅ Function executed successfully');
        console.log('📊 Result:', functionResult);

        // Get AI response with function result
        const functionContext = `The function "${aiResponse.functionCall.name}" was executed successfully. Here are the results:\n${JSON.stringify(functionResult, null, 2)}\n\nPlease provide a natural, helpful response to the user based on these results.`;
        
        const finalResponse = await processMessage(
          agent,
          functionContext,
          [...conversationHistory, { role: 'user', content: message }]
        );

        finalMessage = finalResponse.message;

        // Log messages
        if (conversation) {
          await conversationRepo.addMessage(conversation.id, 'user', message);
          await conversationRepo.addMessage(
            conversation.id, 
            'assistant', 
            finalMessage,
            aiResponse.functionCall.name,
            functionResult
          );
        }

        return res.json({
          message: finalMessage,
          functionCalls,
          functionResults: [functionResult]
        });
      } catch (error) {
        console.error('❌ Function execution error:', error);
        
        // Log failed execution
        if (conversation) {
          await conversationRepo.logFunctionExecution({
            conversationId: conversation.id,
            functionName: aiResponse.functionCall.name,
            parameters: aiResponse.functionCall.parameters,
            response: null,
            status: 'failed',
            errorMessage: error.message
          });
        }

        finalMessage = `I tried to execute the ${aiResponse.functionCall.name} function, but encountered an error: ${error.message}. How else can I help you?`;
        
        return res.json({
          message: finalMessage,
          functionCalls,
          error: error.message
        });
      }
    }

    // Log messages (no function call)
    if (conversation) {
      await conversationRepo.addMessage(conversation.id, 'user', message);
      await conversationRepo.addMessage(conversation.id, 'assistant', finalMessage);
    }

    // Update agent stats
    await agentRepo.updateAgent(req.params.id, {
      conversations: (agent.conversations_count || 0) + 1,
      lastActive: new Date().toISOString()
    });

    res.json({
      message: finalMessage,
      functionCalls
    });
  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

export default router;

