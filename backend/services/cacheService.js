/**
 * Simple in-memory cache service for AI responses
 * This helps reduce API calls for common queries
 */

class CacheService {
  constructor() {
    this.cache = new Map();
    this.maxSize = 1000; // Maximum number of cached items
    this.ttl = 5 * 60 * 1000; // 5 minutes TTL
  }

  /**
   * Generate cache key from user input and agent context
   */
  generateKey(userInput, agentId, systemPrompt) {
    const normalizedInput = userInput.toLowerCase().trim();
    const contextHash = this.simpleHash(systemPrompt + agentId);
    return `${contextHash}:${normalizedInput}`;
  }

  /**
   * Simple hash function for creating consistent keys
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached response if available and not expired
   */
  get(userInput, agentId, systemPrompt) {
    const key = this.generateKey(userInput, agentId, systemPrompt);
    const cached = this.cache.get(key);
    
    console.log(`Cache lookup for key: "${key}" (input: "${userInput}")`);
    console.log(`Cache has ${this.cache.size} entries`);
    
    if (!cached) {
      console.log(`Cache MISS for: "${userInput}"`);
      return null;
    }

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      console.log(`Cache EXPIRED for: "${userInput}"`);
      return null;
    }

    console.log(`Cache HIT for: "${userInput}" - returning cached response`);
    return cached.response;
  }

  /**
   * Store response in cache
   */
  set(userInput, agentId, systemPrompt, response) {
    const key = this.generateKey(userInput, agentId, systemPrompt);
    
    // Clean up old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }

    this.cache.set(key, {
      response,
      timestamp: Date.now()
    });

    console.log(`Cached response for: "${userInput}"`);
  }

  /**
   * Clean up expired entries and oldest entries if needed
   */
  cleanup() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    // Remove expired entries
    for (const [key, value] of entries) {
      if (now - value.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }

    // If still too many entries, remove oldest ones
    if (this.cache.size >= this.maxSize) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = sortedEntries.slice(0, Math.floor(this.maxSize * 0.2));
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached entries
   */
  clear() {
    this.cache.clear();
    console.log('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl
    };
  }
}

// Create singleton instance
const cacheService = new CacheService();

export default cacheService;