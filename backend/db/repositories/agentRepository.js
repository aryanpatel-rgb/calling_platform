/**
 * Agent Repository - Database operations for agents
 * 
 * Clean, professional database operations with proper error handling
 */

import { query } from '../database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get all agents
 */
export async function getAllAgents() {
  try {
    const agents = await query(`
      SELECT 
        a.*,
        COUNT(DISTINCT c.id) as conversations,
        COALESCE(AVG(CASE WHEN c.status = 'completed' THEN 100 ELSE 0 END), 0) as success_rate
      FROM agents a
      LEFT JOIN conversations c ON a.id = c.agent_id
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `);

    // Convert numeric fields from strings to numbers for all agents
    return agents.map(agent => ({
      ...agent,
      temperature: agent.temperature ? parseFloat(agent.temperature) : 0.7,
      max_tokens: agent.max_tokens ? parseInt(agent.max_tokens) : 1000,
      conversations_count: agent.conversations_count ? parseInt(agent.conversations_count) : 0,
      success_rate: agent.success_rate ? parseFloat(agent.success_rate) : 0,
      conversations: agent.conversations ? parseInt(agent.conversations) : 0,
      functions: agent.functions?.map(func => ({
        ...func,
        name: func.name?.trim()
      }))
    }));
  } catch (error) {
    console.error('Error fetching agents:', error);
    throw error;
  }
}

/**
 * Validate if string is valid UUID
 */
function isValidUUID(id) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Get agent by ID with functions
 */
export async function getAgentById(agentId) {
  try {
    // Validate UUID format
    if (!isValidUUID(agentId)) {
      console.warn(`⚠️  Invalid UUID format: ${agentId}. This might be an old agent ID from in-memory storage.`);
      return null;
    }

    const agents = await query(
      `SELECT * FROM agents WHERE id = $1`,
      [agentId]
    );

    if (agents.length === 0) {
      return null;
    }

    const agent = agents[0];

    // Convert numeric fields from strings to numbers
    if (agent.temperature) agent.temperature = parseFloat(agent.temperature);
    if (agent.max_tokens) agent.max_tokens = parseInt(agent.max_tokens);
    if (agent.conversations_count) agent.conversations_count = parseInt(agent.conversations_count);
    if (agent.success_rate) agent.success_rate = parseFloat(agent.success_rate);

    // Get functions for this agent
    const functions = await query(
      `SELECT * FROM agent_functions WHERE agent_id = $1 ORDER BY created_at`,
      [agentId]
    );

    // Clean function names (remove trailing spaces)
    agent.functions = functions.map(func => ({
      ...func,
      name: func.name?.trim()
    }));

    return agent;
  } catch (error) {
    console.error('Error fetching agent:', error);
    throw error;
  }
}

/**
 * Create new agent
 */
export async function createAgent(agentData) {
  try {
    const id = uuidv4();
    const userId = '00000000-0000-0000-0000-000000000001'; // Default user for now

    const result = await query(
      `INSERT INTO agents (
        id, user_id, name, description, type, system_prompt,
        model, temperature, max_tokens, status,
        voice_settings, twilio_config
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        id,
        userId,
        agentData.name,
        agentData.description || null,
        agentData.type,
        agentData.systemPrompt,
        agentData.model || 'gpt-4',
        agentData.temperature || 0.7,
        agentData.maxTokens || 1000,
        'active',
        JSON.stringify(agentData.voiceSettings || null),
        JSON.stringify(agentData.twilioConfig || null)
      ]
    );

    const agent = result[0];

    // Create functions if provided
    if (agentData.functions && agentData.functions.length > 0) {
      agent.functions = [];
      for (const func of agentData.functions) {
        const functionData = await createAgentFunction(id, func);
        agent.functions.push(functionData);
      }
    }

    return agent;
  } catch (error) {
    console.error('Error creating agent:', error);
    throw error;
  }
}

/**
 * Create agent function
 */
export async function createAgentFunction(agentId, functionData) {
  try {
    const id = uuidv4();

    const result = await query(
      `INSERT INTO agent_functions (
        id, agent_id, name, description, type, sub_type,
        method, url, headers, body_template, parameters,
        api_key, event_type_id, timezone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        id,
        agentId,
        functionData.name,
        functionData.description || null,
        functionData.type,
        functionData.subType || null,
        functionData.method || null,
        functionData.url || null,
        JSON.stringify(functionData.headers || null),
        JSON.stringify(functionData.bodyTemplate || null),
        JSON.stringify(functionData.parameters || null),
        functionData.apiKey || null,
        functionData.eventTypeId || null,
        functionData.timezone || null
      ]
    );

    return result[0];
  } catch (error) {
    console.error('Error creating agent function:', error);
    throw error;
  }
}

/**
 * Update agent
 */
export async function updateAgent(agentId, agentData) {
  try {
    const result = await query(
      `UPDATE agents SET
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        system_prompt = COALESCE($4, system_prompt),
        model = COALESCE($5, model),
        temperature = COALESCE($6, temperature),
        max_tokens = COALESCE($7, max_tokens),
        status = COALESCE($8, status),
        voice_settings = COALESCE($9, voice_settings),
        twilio_config = COALESCE($10, twilio_config),
        conversations_count = COALESCE($11, conversations_count),
        last_active = COALESCE($12, last_active)
      WHERE id = $1
      RETURNING *`,
      [
        agentId,
        agentData.name,
        agentData.description,
        agentData.systemPrompt,
        agentData.model,
        agentData.temperature,
        agentData.maxTokens,
        agentData.status,
        JSON.stringify(agentData.voiceSettings),
        JSON.stringify(agentData.twilioConfig),
        agentData.conversations,
        agentData.lastActive
      ]
    );

    if (result.length === 0) {
      return null;
    }

    return result[0];
  } catch (error) {
    console.error('Error updating agent:', error);
    throw error;
  }
}

/**
 * Delete agent
 */
export async function deleteAgent(agentId) {
  try {
    await query(`DELETE FROM agents WHERE id = $1`, [agentId]);
    return true;
  } catch (error) {
    console.error('Error deleting agent:', error);
    throw error;
  }
}

/**
 * Get agent stats
 */
export async function getAgentStats() {
  try {
    const stats = await query(`
      SELECT 
        COUNT(DISTINCT a.id) as total_agents,
        COUNT(DISTINCT CASE WHEN a.status = 'active' THEN a.id END) as active_agents,
        COUNT(DISTINCT c.id) as total_conversations,
        COALESCE(AVG(CASE WHEN c.status = 'completed' THEN 100 ELSE 0 END), 0) as success_rate
      FROM agents a
      LEFT JOIN conversations c ON a.id = c.agent_id
    `);

    return stats[0];
  } catch (error) {
    console.error('Error fetching stats:', error);
    throw error;
  }
}

export default {
  getAllAgents,
  getAgentById,
  createAgent,
  createAgentFunction,
  updateAgent,
  deleteAgent,
  getAgentStats
};

