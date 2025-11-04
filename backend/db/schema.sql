-- AI Agent Platform Database Schema
-- PostgreSQL/Neon Database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (for authentication)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('chatbot', 'voice_call')),
    system_prompt TEXT NOT NULL,
    model VARCHAR(50) DEFAULT 'gpt-4',
    temperature DECIMAL(3,2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 1),
    max_tokens INTEGER DEFAULT 1000 CHECK (max_tokens >= 100 AND max_tokens <= 4000),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'draft')),
    voice_settings JSONB,
    twilio_config JSONB,
    conversations_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0,
    last_active TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent Functions table
CREATE TABLE IF NOT EXISTS agent_functions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('cal_com', 'custom')),
    sub_type VARCHAR(50),
    method VARCHAR(10),
    url TEXT,
    headers JSONB,
    body_template JSONB,
    parameters JSONB,
    api_key TEXT,
    event_type_id VARCHAR(100),
    timezone VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, name)
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('chat', 'call')),
    call_sid VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
    duration INTEGER,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    function_call VARCHAR(255),
    function_result JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Function Executions table
CREATE TABLE IF NOT EXISTS function_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    function_id UUID REFERENCES agent_functions(id) ON DELETE SET NULL,
    function_name VARCHAR(255) NOT NULL,
    parameters JSONB,
    response JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    error_message TEXT,
    execution_time INTEGER,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Call History table for detailed call tracking
CREATE TABLE IF NOT EXISTS call_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    call_sid VARCHAR(255) UNIQUE,
    from_number VARCHAR(20),
    to_number VARCHAR(20),
    status VARCHAR(20) DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'answered', 'completed', 'failed', 'busy', 'no-answer')),
    direction VARCHAR(20) DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
    duration INTEGER DEFAULT 0,
    recording_url TEXT,
    transcript TEXT,
    cost DECIMAL(10,4),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    answered_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
CREATE INDEX IF NOT EXISTS idx_agent_functions_agent_id ON agent_functions(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_function_executions_conversation_id ON function_executions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_call_history_agent_id ON call_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_history_call_sid ON call_history(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_history_status ON call_history(status);

-- Update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_functions_updated_at BEFORE UPDATE ON agent_functions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_call_history_updated_at BEFORE UPDATE ON call_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create default user for development (optional)
INSERT INTO users (id, email, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'demo@aiagent.com', 'Demo User')
ON CONFLICT (email) DO NOTHING;

