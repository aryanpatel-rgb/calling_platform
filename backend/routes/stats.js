import express from 'express';
import { query } from '../db/database.js';

const router = express.Router();

/**
 * Get platform statistics
 */
router.get('/', async (req, res) => {
  try {
    // Get total agents count
    const agentStats = await query(`
      SELECT 
        COUNT(*) as total_agents,
        COUNT(CASE WHEN type = 'chatbot' THEN 1 END) as chatbot_count,
        COUNT(CASE WHEN type = 'voice_call' THEN 1 END) as voice_call_count
      FROM agents
    `);

    // Get conversation statistics
    const conversationStats = await query(`
      SELECT 
        COUNT(*) as total_conversations,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_conversations,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_conversations
      FROM conversations
    `);

    // Get function execution statistics
    const functionStats = await query(`
      SELECT 
        COUNT(*) as total_function_calls,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_calls,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_calls
      FROM function_executions
    `);

    // Get recent activity (last 7 days)
    const recentActivity = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as conversations_today
      FROM conversations 
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Calculate success rate
    const totalConversations = parseInt(conversationStats[0]?.total_conversations || 0);
    const completedConversations = parseInt(conversationStats[0]?.completed_conversations || 0);
    const successRate = totalConversations > 0 ? Math.round((completedConversations / totalConversations) * 100) : 0;

    // Calculate function success rate
    const totalFunctionCalls = parseInt(functionStats[0]?.total_function_calls || 0);
    const successfulFunctionCalls = parseInt(functionStats[0]?.successful_calls || 0);
    const functionSuccessRate = totalFunctionCalls > 0 ? Math.round((successfulFunctionCalls / totalFunctionCalls) * 100) : 0;

    const stats = {
      totalAgents: parseInt(agentStats[0]?.total_agents || 0),
      chatbotAgents: parseInt(agentStats[0]?.chatbot_count || 0),
      voiceCallAgents: parseInt(agentStats[0]?.voice_call_count || 0),
      totalConversations: totalConversations,
      completedConversations: completedConversations,
      activeConversations: parseInt(conversationStats[0]?.active_conversations || 0),
      successRate: successRate,
      totalFunctionCalls: totalFunctionCalls,
      successfulFunctionCalls: successfulFunctionCalls,
      failedFunctionCalls: parseInt(functionStats[0]?.failed_calls || 0),
      functionSuccessRate: functionSuccessRate,
      activeAgents: parseInt(conversationStats[0]?.active_conversations || 0), // Using active conversations as proxy
      recentActivity: recentActivity.map(activity => ({
        date: activity.date,
        conversations: parseInt(activity.conversations_today)
      }))
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    
    // Return fallback stats if database is not available
    const fallbackStats = {
      totalAgents: 0,
      chatbotAgents: 0,
      voiceCallAgents: 0,
      totalConversations: 0,
      completedConversations: 0,
      activeConversations: 0,
      successRate: 0,
      totalFunctionCalls: 0,
      successfulFunctionCalls: 0,
      failedFunctionCalls: 0,
      functionSuccessRate: 0,
      activeAgents: 0,
      recentActivity: []
    };

    res.json(fallbackStats);
  }
});

/**
 * Get agent performance stats
 */
router.get('/agent/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get agent-specific stats
    const agentStats = await query(`
      SELECT 
        a.*,
        COUNT(DISTINCT c.id) as total_conversations,
        COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed_conversations,
        COUNT(DISTINCT fe.id) as total_function_calls,
        COUNT(CASE WHEN fe.status = 'success' THEN 1 END) as successful_function_calls
      FROM agents a
      LEFT JOIN conversations c ON a.id = c.agent_id
      LEFT JOIN function_executions fe ON a.id = fe.agent_id
      WHERE a.id = $1
      GROUP BY a.id
    `, [id]);

    if (agentStats.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const stats = agentStats[0];
    const totalConversations = parseInt(stats.total_conversations || 0);
    const completedConversations = parseInt(stats.completed_conversations || 0);
    const successRate = totalConversations > 0 ? Math.round((completedConversations / totalConversations) * 100) : 0;

    const totalFunctionCalls = parseInt(stats.total_function_calls || 0);
    const successfulFunctionCalls = parseInt(stats.successful_function_calls || 0);
    const functionSuccessRate = totalFunctionCalls > 0 ? Math.round((successfulFunctionCalls / totalFunctionCalls) * 100) : 0;

    res.json({
      agentId: stats.id,
      agentName: stats.name,
      agentType: stats.type,
      totalConversations,
      completedConversations,
      successRate,
      totalFunctionCalls,
      successfulFunctionCalls,
      functionSuccessRate,
      createdAt: stats.created_at,
      lastActive: stats.updated_at
    });
  } catch (error) {
    console.error('Error fetching agent stats:', error);
    res.status(500).json({ error: 'Failed to fetch agent stats' });
  }
});

export default router;
