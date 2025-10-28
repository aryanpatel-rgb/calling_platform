import express from 'express';
import { validateAgent } from '../utils/validation.js';
import * as agentRepo from '../db/repositories/agentRepository.js';

const router = express.Router();

// Get all agents
router.get('/', async (req, res) => {
  try {
    const agents = await agentRepo.getAllAgents();
    res.json(agents);
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

// Get stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await agentRepo.getAgentStats();
    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

// Get single agent
router.get('/:id', async (req, res) => {
  try {
    const agent = await agentRepo.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({ 
        error: true, 
        message: 'Agent not found. If this is an old agent, please recreate it with the database enabled.',
        hint: 'Old agents from in-memory storage are not compatible with database mode.'
      });
    }
    res.json(agent);
  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

// Create agent
router.post('/', async (req, res) => {
  try {
    const validation = validateAgent(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: true, message: validation.error });
    }

    const agent = await agentRepo.createAgent(req.body);
    res.status(201).json(agent);
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

// Update agent
router.put('/:id', async (req, res) => {
  try {
    const agent = await agentRepo.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: true, message: 'Agent not found' });
    }

    const validation = validateAgent(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: true, message: validation.error });
    }

    const updatedAgent = await agentRepo.updateAgent(req.params.id, req.body);
    res.json(updatedAgent);
  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

// Delete agent
router.delete('/:id', async (req, res) => {
  try {
    const agent = await agentRepo.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({ 
        error: true, 
        message: 'Agent not found. If this is an old agent, it may have been created before database was enabled.'
      });
    }

    await agentRepo.deleteAgent(req.params.id);
    res.json({ success: true, message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

export default router;

