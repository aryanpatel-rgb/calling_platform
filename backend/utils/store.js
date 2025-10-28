/**
 * Simple in-memory store for agents
 * In production, replace with a proper database (PostgreSQL, MongoDB, etc.)
 */

class AgentStore {
  constructor() {
    this.agents = new Map();
  }

  /**
   * Get all agents
   */
  getAll() {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent by ID
   */
  get(id) {
    return this.agents.get(id);
  }

  /**
   * Create new agent
   */
  create(agent) {
    this.agents.set(agent.id, agent);
    return agent;
  }

  /**
   * Update agent
   */
  update(id, agent) {
    if (!this.agents.has(id)) {
      throw new Error('Agent not found');
    }
    this.agents.set(id, agent);
    return agent;
  }

  /**
   * Delete agent
   */
  delete(id) {
    if (!this.agents.has(id)) {
      throw new Error('Agent not found');
    }
    return this.agents.delete(id);
  }

  /**
   * Find agents by criteria
   */
  find(criteria) {
    return this.getAll().filter(agent => {
      return Object.entries(criteria).every(([key, value]) => {
        return agent[key] === value;
      });
    });
  }
}

// Export singleton instance
export const agentStore = new AgentStore();

export default AgentStore;

