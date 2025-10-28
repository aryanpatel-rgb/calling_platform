import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Settings, Trash2, Calendar, Phone, MessageSquare } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AgentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgent();
  }, [id]);

  const fetchAgent = async () => {
    try {
      const response = await axios.get(`http://localhost:3000/api/agents/${id}`);
      setAgent(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching agent:', error);
      toast.error('Failed to load agent');
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this agent?')) {
      return;
    }

    try {
      await axios.delete(`http://localhost:3000/api/agents/${id}`);
      toast.success('Agent deleted successfully');
      navigate('/');
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast.error('Failed to delete agent');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">Agent Not Found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          The agent you're looking for doesn't exist
        </p>
        <Link to="/" className="btn-primary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Link
          to="/"
          className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Dashboard</span>
        </Link>

        <div className="flex space-x-3">
          <Link to={`/agent/${id}/test`} className="btn-primary flex items-center space-x-2">
            <Play className="w-4 h-4" />
            <span>Test Agent</span>
          </Link>
          <button
            onClick={handleDelete}
            className="btn-secondary text-red-600 flex items-center space-x-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Agent Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card mb-6"
      >
        <div className="flex items-center space-x-4 mb-4">
          <div className={`p-4 rounded-xl ${
            agent.type === 'voice_call'
              ? 'bg-purple-100 dark:bg-purple-900/30'
              : 'bg-blue-100 dark:bg-blue-900/30'
          }`}>
            {agent.type === 'voice_call' ? (
              <Phone className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            ) : (
              <MessageSquare className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{agent.name}</h1>
            <p className="text-gray-600 dark:text-gray-400">
              {agent.type === 'voice_call' ? 'Voice Call Agent' : 'Chatbot Agent'}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            agent.status === 'active'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
          }`}>
            {agent.status}
          </span>
        </div>

        {agent.description && (
          <p className="text-gray-700 dark:text-gray-300">{agent.description}</p>
        )}
      </motion.div>

      {/* Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Model Configuration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Settings className="w-5 h-5 mr-2 text-primary-600" />
            Configuration
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Model:</span>
              <span className="font-medium">{agent.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Temperature:</span>
              <span className="font-medium">{agent.temperature}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Max Tokens:</span>
              <span className="font-medium">{agent.max_tokens}</span>
            </div>
          </div>
        </motion.div>

        {/* Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <h2 className="text-xl font-bold mb-4">Statistics</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Conversations</span>
              <span className="text-2xl font-bold">{agent.conversations || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Success Rate</span>
              <span className="text-2xl font-bold text-green-600">{agent.successRate || 0}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Functions</span>
              <span className="text-2xl font-bold">{agent.functions?.length || 0}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* System Prompt */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card mb-6"
      >
        <h2 className="text-xl font-bold mb-4">System Prompt</h2>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
          <p className="text-sm font-mono whitespace-pre-wrap">{agent.system_prompt}</p>
        </div>
      </motion.div>

      {/* Functions */}
      {agent.functions && agent.functions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card mb-6"
        >
          <h2 className="text-xl font-bold mb-4">Configured Functions</h2>
          <div className="space-y-3">
            {agent.functions.map((func, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
              >
                {func.type === 'cal_com' ? (
                  <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Settings className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                )}
                <div className="flex-1">
                  <h4 className="font-medium">{func.name}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{func.description}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded">
                  {func.type === 'cal_com' ? 'Cal.com' : 'Custom'}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Voice Settings (if voice call agent) */}
      {agent.type === 'voice_call' && agent.voiceSettings && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card"
        >
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Phone className="w-5 h-5 mr-2 text-primary-600" />
            Voice Settings
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Voice ID:</span>
              <p className="font-medium">{agent.voiceSettings.voiceId}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Speed:</span>
              <p className="font-medium">{agent.voiceSettings.speed}x</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Stability:</span>
              <p className="font-medium">{agent.voiceSettings.stability}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Similarity:</span>
              <p className="font-medium">{agent.voiceSettings.similarityBoost}</p>
            </div>
          </div>
          {agent.voiceSettings.greeting && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Greeting:</span>
              <p className="mt-1">{agent.voiceSettings.greeting}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default AgentDetail;

