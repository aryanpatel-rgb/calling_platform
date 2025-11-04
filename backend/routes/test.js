import express from 'express';
import { authenticateToken } from '../utils/auth.js';
import { broadcastCallUpdate, broadcastStatsUpdate } from './sse.js';
import { poolQuery } from '../db/database.js';
import * as callHistoryRepo from '../db/repositories/callHistoryRepository.js';

const router = express.Router();

// Test endpoint to simulate call updates for demonstration
router.post('/simulate-call-update/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { status, duration, recordingUrl } = req.body;

    // Create a mock call update
    const mockCallUpdate = {
      id: Date.now(),
      call_sid: `CA${Date.now()}`,
      agent_id: parseInt(agentId),
      from_number: '+1234567890',
      to_number: '+0987654321',
      status: status || 'in-progress',
      direction: 'outbound',
      duration: duration || null,
      recording_url: recordingUrl || null,
      started_at: new Date().toISOString(),
      answered_at: status === 'answered' || status === 'completed' ? new Date().toISOString() : null,
      ended_at: status === 'completed' ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Broadcast the update
    broadcastCallUpdate(parseInt(agentId), mockCallUpdate);

    // Also broadcast updated stats
    const mockStats = {
      total_calls: Math.floor(Math.random() * 100) + 1,
      successful_calls: Math.floor(Math.random() * 80) + 1,
      failed_calls: Math.floor(Math.random() * 20),
      total_duration: Math.floor(Math.random() * 10000) + 1000,
      average_duration: Math.floor(Math.random() * 300) + 60,
      total_cost: (Math.random() * 50).toFixed(2)
    };

    broadcastStatsUpdate(parseInt(agentId), mockStats);

    res.json({ 
      success: true, 
      message: 'Call update broadcasted',
      callUpdate: mockCallUpdate,
      stats: mockStats
    });
  } catch (error) {
    console.error('Error simulating call update:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test endpoint to check what tables exist in the database
router.get('/check-tables', async (req, res) => {
  try {
    const result = await poolQuery(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    res.json({ 
      success: true, 
      tables: result.rows.map(row => row.table_name)
    });
  } catch (error) {
    console.error('Error checking tables:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test endpoint to verify call_history table structure and functionality
router.get('/test-call-history', async (req, res) => {
  try {
    // Check table structure
    const structureResult = await poolQuery(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'call_history' 
      ORDER BY ordinal_position;
    `);
    
    // Check if we can query the table (should be empty initially)
    const countResult = await poolQuery('SELECT COUNT(*) as count FROM call_history');
    
    res.json({ 
      success: true, 
      message: 'call_history table is working correctly',
      structure: structureResult.rows,
      record_count: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Error testing call_history table:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test call history update functionality
router.get('/test-call-update', async (req, res) => {
  try {
    // First create a test call record
    const testCallSid = 'CA_test_' + Date.now();
    const testAgentId = '4eeba5de-0c3b-4655-9424-52bfe3978339'; // Use existing agent ID
    
    const callData = {
      agentId: testAgentId,
      callSid: testCallSid,
      fromNumber: '+1234567890',
      toNumber: '+0987654321',
      status: 'initiated',
      direction: 'outbound'
    };
    
    const createdCall = await callHistoryRepo.createCall(callData);
    console.log('Created test call:', createdCall);
    
    // Now test updating it like Twilio would
    const updateData = {
      status: 'completed',
      answered_at: new Date(),
      ended_at: new Date(),
      duration: 120,
      recording_url: 'https://api.twilio.com/test-recording.mp3'
    };
    
    const updatedCall = await callHistoryRepo.updateCallBySid(testCallSid, updateData);
    console.log('Updated test call:', updatedCall);
    
    res.json({
      success: true,
      message: 'Call history update test completed successfully',
      created_call: createdCall,
      updated_call: updatedCall
    });
  } catch (error) {
    console.error('Call history update test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;