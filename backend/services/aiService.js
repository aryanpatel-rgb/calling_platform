import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Process a message with the AI model
 */
export async function processMessage(agent, message, conversationHistory = []) {
  try {
    const messages = [
      {
        role: 'system',
        content: buildSystemPrompt(agent)
      },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    const model = agent.model || 'gpt-4';
    
    // Check if model is Claude
    if (model.includes('claude')) {
      return await processWithClaude(messages, agent);
    }

    // Use OpenAI
    // Ensure temperature and max_tokens are numbers
    const temperature = parseFloat(agent.temperature) || 0.7;
    const maxTokens = parseInt(agent.maxTokens || agent.max_tokens) || 1000;

    const completion = await openai.chat.completions.create({
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens,
    });

    const responseMessage = completion.choices[0].message.content;

    // Check for function calls in response
    const functionCall = detectFunctionCall(responseMessage, agent.functions || []);

    return {
      message: responseMessage,
      functionCall: functionCall || null
    };
  } catch (error) {
    console.error('AI Service Error:', error);
    throw new Error(`Failed to process message: ${error.message}`);
  }
}

/**
 * Build system prompt with function definitions
 */
function buildSystemPrompt(agent) {
  let prompt = agent.systemPrompt || 'You are a helpful AI assistant.';

  if (agent.functions && agent.functions.length > 0) {
    prompt += '\n\n=== AVAILABLE FUNCTIONS ===\n';
    prompt += 'You have access to the following functions. When you need to use a function, respond EXACTLY in this format:\n\n';
    prompt += 'FUNCTION_CALL: function_name\n';
    prompt += 'PARAMETERS: {"param1": "value1", "param2": "value2"}\n\n';

    agent.functions.forEach(func => {
      prompt += `\nFunction: ${func.name}\n`;
      prompt += `Description: ${func.description}\n`;
      
      if (func.parameters && func.parameters.length > 0) {
        prompt += 'Parameters:\n';
        func.parameters.forEach(param => {
          prompt += `  - ${param.name} (${param.type}${param.required ? ', required' : ', optional'}): ${param.description}\n`;
        });
      }
    });

    prompt += '\n=== IMPORTANT ===\n';
    prompt += '- Only use FUNCTION_CALL format when you actually need to execute a function\n';
    prompt += '- After the function executes, you will receive the result and should provide a natural language response to the user\n';
    prompt += '- Do not make up function results - wait for actual execution\n';
  }

  return prompt;
}

/**
 * Detect function calls in AI response
 */
function detectFunctionCall(response, functions) {
  const functionCallPattern = /FUNCTION_CALL:\s*(\w+)\s*\nPARAMETERS:\s*({[\s\S]*?})/i;
  const match = response.match(functionCallPattern);

  if (!match) {
    return null;
  }

  const functionName = match[1].trim();
  let parameters;

  try {
    parameters = JSON.parse(match[2].trim());
  } catch (error) {
    console.error('Failed to parse function parameters:', error);
    return null;
  }

  // Verify function exists (trim both names for comparison)
  const functionExists = functions.some(f => f.name?.trim() === functionName?.trim());
  if (!functionExists) {
    console.warn(`Function ${functionName} not found in agent functions`);
    return null;
  }

  return {
    name: functionName,
    parameters
  };
}

/**
 * Process with Claude (Anthropic)
 */
async function processWithClaude(messages, agent) {
  // Note: This requires @anthropic-ai/sdk package
  // For now, return a placeholder
  console.warn('Claude integration not fully implemented. Using fallback.');
  
  return {
    message: 'Claude integration is in development. Please use a GPT model.',
    functionCall: null
  };
}

export default {
  processMessage
};

