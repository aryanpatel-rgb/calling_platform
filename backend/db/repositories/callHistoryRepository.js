/**
 * Call History Repository - Database operations for call tracking
 */

import { query } from '../database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create new call record
 */
export async function createCall(callData) {
  try {
    const id = uuidv4();
    const result = await query(
      `INSERT INTO call_history (
        id, agent_id, conversation_id, call_sid, from_number, to_number,
        status, direction, started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        id,
        callData.agentId,
        callData.conversationId || null,
        callData.callSid,
        callData.fromNumber,
        callData.toNumber,
        callData.status || 'initiated',
        callData.direction || 'outbound',
        callData.startedAt || new Date()
      ]
    );
    return result[0];
  } catch (error) {
    console.error('Error creating call record:', error);
    throw error;
  }
}

/**
 * Update call status
 */
export async function updateCallStatus(callSid, status, additionalData = {}) {
  try {
    const updateFields = ['status = $2'];
    const values = [callSid, status];
    let paramIndex = 3;

    // Add optional fields
    if (additionalData.answeredAt) {
      updateFields.push(`answered_at = $${paramIndex}`);
      values.push(additionalData.answeredAt);
      paramIndex++;
    }

    if (additionalData.endedAt) {
      updateFields.push(`ended_at = $${paramIndex}`);
      values.push(additionalData.endedAt);
      paramIndex++;
    }

    if (additionalData.duration !== undefined) {
      updateFields.push(`duration = $${paramIndex}`);
      values.push(additionalData.duration);
      paramIndex++;
    }

    if (additionalData.recordingUrl) {
      updateFields.push(`recording_url = $${paramIndex}`);
      values.push(additionalData.recordingUrl);
      paramIndex++;
    }

    if (additionalData.transcript) {
      updateFields.push(`transcript = $${paramIndex}`);
      values.push(additionalData.transcript);
      paramIndex++;
    }

    if (additionalData.cost !== undefined) {
      updateFields.push(`cost = $${paramIndex}`);
      values.push(additionalData.cost);
      paramIndex++;
    }

    const result = await query(
      `UPDATE call_history SET ${updateFields.join(', ')} WHERE call_sid = $1 RETURNING *`,
      values
    );

    return result[0];
  } catch (error) {
    console.error('Error updating call status:', error);
    throw error;
  }
}

/**
 * Update call by SID with flexible data object
 */
export async function updateCallBySid(callSid, updateData) {
  try {
    const updateFields = [];
    const values = [callSid];
    let paramIndex = 2;

    // Dynamically build update fields based on provided data
    for (const [key, value] of Object.entries(updateData)) {
      updateFields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      throw new Error('No update data provided');
    }

    // Always update the updated_at timestamp
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    const result = await query(
      `UPDATE call_history SET ${updateFields.join(', ')} WHERE call_sid = $1 RETURNING *`,
      values
    );

    return result[0];
  } catch (error) {
    console.error('Error updating call by SID:', error);
    throw error;
  }
}

/**
 * Get call by SID
 */
export async function getCallBySid(callSid) {
  try {
    const result = await query(
      `SELECT * FROM call_history WHERE call_sid = $1`,
      [callSid]
    );
    return result[0];
  } catch (error) {
    console.error('Error fetching call by SID:', error);
    throw error;
  }
}

/**
 * Get call history for an agent
 */
export async function getCallHistoryByAgent(agentId, limit = 50, offset = 0) {
  try {
    const calls = await query(
      `SELECT 
        ch.*,
        c.id as conversation_id,
        COUNT(m.id) as message_count
      FROM call_history ch
      LEFT JOIN conversations c ON ch.conversation_id = c.id
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE ch.agent_id = $1
      GROUP BY ch.id, c.id
      ORDER BY ch.started_at DESC
      LIMIT $2 OFFSET $3`,
      [agentId, limit, offset]
    );

    return calls.map(call => ({
      ...call,
      duration: call.duration ? parseInt(call.duration) : 0,
      message_count: parseInt(call.message_count || 0),
      cost: call.cost ? parseFloat(call.cost) : 0
    }));
  } catch (error) {
    console.error('Error fetching call history:', error);
    throw error;
  }
}

/**
 * Get call history for a user (across all their agents)
 */
export async function getCallHistoryByUser(userId, limit = 50, offset = 0) {
  try {
    const calls = await query(
      `SELECT 
        ch.*,
        a.name as agent_name,
        c.id as conversation_id,
        COUNT(m.id) as message_count
      FROM call_history ch
      JOIN agents a ON ch.agent_id = a.id
      LEFT JOIN conversations c ON ch.conversation_id = c.id
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE a.user_id = $1
      GROUP BY ch.id, a.name, c.id
      ORDER BY ch.started_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return calls.map(call => ({
      ...call,
      duration: call.duration ? parseInt(call.duration) : 0,
      message_count: parseInt(call.message_count || 0),
      cost: call.cost ? parseFloat(call.cost) : 0
    }));
  } catch (error) {
    console.error('Error fetching user call history:', error);
    throw error;
  }
}

/**
 * Get call statistics for an agent
 */
export async function getCallStatsByAgent(agentId) {
  try {
    const stats = await query(
      `SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_calls,
        COUNT(CASE WHEN status = 'answered' THEN 1 END) as answered_calls,
        COUNT(CASE WHEN status = 'failed' OR status = 'busy' OR status = 'no-answer' THEN 1 END) as failed_calls,
        COALESCE(AVG(CASE WHEN duration > 0 THEN duration END), 0) as avg_duration,
        COALESCE(SUM(duration), 0) as total_duration,
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(
          (COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 
          0
        ) as success_rate
      FROM call_history 
      WHERE agent_id = $1`,
      [agentId]
    );

    const result = stats[0];
    return {
      totalCalls: parseInt(result.total_calls || 0),
      completedCalls: parseInt(result.completed_calls || 0),
      answeredCalls: parseInt(result.answered_calls || 0),
      failedCalls: parseInt(result.failed_calls || 0),
      avgDuration: parseFloat(result.avg_duration || 0),
      totalDuration: parseInt(result.total_duration || 0),
      totalCost: parseFloat(result.total_cost || 0),
      successRate: parseFloat(result.success_rate || 0)
    };
  } catch (error) {
    console.error('Error fetching call stats:', error);
    throw error;
  }
}

/**
 * Get recent call activity
 */
export async function getRecentCallActivity(agentId, days = 7) {
  try {
    const activity = await query(
      `SELECT 
        DATE(started_at) as date,
        COUNT(*) as calls_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
        COALESCE(SUM(duration), 0) as total_duration
      FROM call_history 
      WHERE agent_id = $1 
        AND started_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(started_at)
      ORDER BY date DESC`,
      [agentId]
    );

    return activity.map(day => ({
      date: day.date,
      callsCount: parseInt(day.calls_count),
      completedCount: parseInt(day.completed_count),
      totalDuration: parseInt(day.total_duration)
    }));
  } catch (error) {
    console.error('Error fetching recent call activity:', error);
    throw error;
  }
}

export default {
  createCall,
  updateCallStatus,
  updateCallBySid,
  getCallBySid,
  getCallHistoryByAgent,
  getCallHistoryByUser,
  getCallStatsByAgent,
  getRecentCallActivity
};