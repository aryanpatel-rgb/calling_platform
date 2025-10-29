import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, MessageSquare, Phone, Calendar, TrendingUp, Activity } from 'lucide-react';
import AgentCard from '../components/AgentCard';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAgents: 0,
    totalConversations: 0,
    successRate: 0,
    activeAgents: 0
  });

  const { isAuthenticated, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only fetch data if user is authenticated
    if (isAuthenticated() && token) {
      fetchAgents();
      fetchStats();
    }
  }, [isAuthenticated, token]);

  const fetchAgents = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/agents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Fetched agents:', response.data);
      setAgents(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching agents:', error);
      setLoading(false);
      
      if (error.response?.status === 401) {
        toast.error('Authentication failed. Please log in again.');
        navigate('/login');
      } else {
        toast.error('Failed to fetch agents');
        // Set empty array for development
        setAgents([]);
      }
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Fetched stats:', response.data);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      
      if (error.response?.status === 401) {
        toast.error('Authentication failed. Please log in again.');
        navigate('/login');
      } else {
        toast.error('Failed to fetch statistics');
      }
    }
  };

  console.log('Stats:', stats);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  console.log('Agents:', agents);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 via-secondary-500 to-pink-500 p-8 text-white"
      >
        <div className="relative z-10">
          <h1 className="text-4xl font-bold mb-2">Welcome to AI Agent Platform</h1>
          <p className="text-lg text-white/90 mb-6">
            Build powerful chatbot and voice call agents with custom functions
          </p>
          <Link
            to="/agent/new"
            className="inline-flex items-center space-x-2 bg-white text-primary-600 px-6 py-3 rounded-xl font-medium hover:bg-white/90 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>{
              stats.totalAgents === 0 ? 'Create Your First Agent' : 'Create New Agent'
              }</span>
          </Link>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <motion.div variants={item} className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Agents</p>
              <p className="text-3xl font-bold mt-1">{stats.totalAgents}</p>
            </div>
            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
              <Activity className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
        </motion.div>

        <motion.div variants={item} className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Chatbot Agents</p>
              <p className="text-3xl font-bold mt-1">{stats.chatbotAgents}</p>
            </div>
            <div className="p-3 bg-secondary-100 dark:bg-secondary-900/30 rounded-xl">
              <MessageSquare className="w-6 h-6 text-secondary-600 dark:text-secondary-400" />
            </div>
          </div>
        </motion.div>

        <motion.div variants={item} className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
              <p className="text-3xl font-bold mt-1">{stats.successRate}%</p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </motion.div>

        <motion.div variants={item} className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Voice Call Agents</p>
              <p className="text-3xl font-bold mt-1">{stats.voiceCallAgents}</p>
            </div>
            <div className="p-3 bg-pink-100 dark:bg-pink-900/30 rounded-xl">
              <Phone className="w-6 h-6 text-pink-600 dark:text-pink-400" />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Agents Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Your Agents</h2>
          {agents.length > 0 && (
            <Link to="/agent/new" className="btn-secondary">
              <Plus className="w-4 h-4 inline mr-2" />
              Create Agent
            </Link>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4 mb-4"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card text-center py-12"
          >
            <div className="inline-flex p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
              <MessageSquare className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No agents yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first AI agent to get started
            </p>
            <Link to="/agent/new" className="btn-primary inline-flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Create Agent</span>
            </Link>
          </motion.div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {agents.map((agent) => (
              <motion.div key={agent.id} variants={item}>
                <AgentCard agent={agent} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

