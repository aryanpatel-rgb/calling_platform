import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Phone, PhoneOff, Loader, User, Bot } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const TestAgent = () => {
  const { id } = useParams();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [testPhone, setTestPhone] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchAgent();
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let interval;
    if (callActive) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callActive]);

  const fetchAgent = async () => {
    try {
      const response = await axios.get(`http://localhost:3000/api/agents/${id}`);
      setAgent(response.data);
      setTestPhone(response.data.twilioConfig?.testPhone || '');
      setLoading(false);
    } catch (error) {
      console.error('Error fetching agent:', error);
      toast.error('Failed to load agent');
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || sending) return;

    const userMessage = { role: 'user', content: inputMessage, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setSending(true);

    try {
      const response = await axios.post(`http://localhost:3000/api/agents/${id}/chat`, {
        message: inputMessage,
        conversationHistory: messages
      });

      const botMessage = {
        role: 'assistant',
        content: response.data.message,
        functionCalls: response.data.functionCalls,
        timestamp: new Date()
      }; 
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  const handleStartCall = async () => {
    if (!testPhone) {
      toast.error('Please enter a phone number');
      return;
    }

    try {
      setCallActive(true);
      setCallDuration(0);
      const response = await axios.post(`http://localhost:3000/api/twilio/agents/${id}/call`, {
        phoneNumber: testPhone
      });

      toast.success('Call initiated!');
      
      // Simulate live transcript updates
      setMessages([{
        role: 'system',
        content: `Call initiated to ${testPhone}`,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error starting call:', error);
      toast.error(error.response?.data?.message || 'Failed to initiate call');
      setCallActive(false);
    }
  };

  const handleEndCall = async () => {
    try {
      await axios.post(`http://localhost:3000/api/twilio/agents/${id}/call/end`);
      setCallActive(false);
      toast.success('Call ended');
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Call ended. Duration: ${formatDuration(callDuration)}`,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error ending call:', error);
      toast.error('Failed to end call');
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
        <Link to="/" className="btn-primary">Back to Dashboard</Link>
      </div>
    );
  }

  console.log('Agent:', agent);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to={`/agent/${id}`}
          className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Agent</span>
        </Link>

        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold">Testing: {agent.name}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat/Transcript Area */}
        <div className="lg:col-span-2">
          <div className="card h-[600px] flex flex-col">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">
              <h2 className="text-lg font-semibold">
                {agent.type === 'voice_call' ? 'Live Transcript' : 'Chat'}
              </h2>
              {callActive && (
                <div className="flex items-center space-x-2 mt-2 text-green-600">
                  <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Call Active: {formatDuration(callDuration)}</span>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>
                      {agent.type === 'voice_call'
                        ? 'Start a call to see the live transcript'
                        : 'Start chatting with your agent'}
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`flex items-start space-x-2 max-w-[80%] ${
                        message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                      }`}
                    >
                      <div
                        className={`p-2 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-primary-100 dark:bg-primary-900/30'
                            : message.role === 'system'
                            ? 'bg-gray-100 dark:bg-gray-800'
                            : 'bg-secondary-100 dark:bg-secondary-900/30'
                        }`}
                      >
                        {message.role === 'user' ? (
                          <User className="w-5 h-5 text-primary-600" />
                        ) : message.role === 'system' ? (
                          <Phone className="w-5 h-5 text-gray-600" />
                        ) : (
                          <Bot className="w-5 h-5 text-secondary-600" />
                        )}
                      </div>
                      <div>
                        <div
                          className={`px-4 py-2 rounded-2xl ${
                            message.role === 'user'
                              ? 'bg-primary-600 text-white'
                              : message.role === 'system'
                              ? 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                              : 'bg-gray-100 dark:bg-gray-800'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                        {message.functionCalls && message.functionCalls.length > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            <span className="font-medium">Function executed:</span>{' '}
                            {message.functionCalls.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input (for chatbot) */}
            {agent.type === 'chatbot' && (
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 input-field"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !inputMessage.trim()}
                  className="btn-primary px-6 disabled:opacity-50"
                >
                  {sending ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Controls Sidebar */}
        <div className="space-y-6">
          {/* Voice Call Controls */}
          {agent.type === 'voice_call' && (
            <div className="card">
              <h3 className="font-semibold mb-4">Call Controls</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Test Phone Number
                  </label>
                  <input
                    type="tel"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="+1234567890"
                    className="input-field"
                    disabled={callActive}
                  />
                </div>

                {!callActive ? (
                  <button
                    onClick={handleStartCall}
                    className="btn-primary w-full flex items-center justify-center space-x-2"
                  >
                    <Phone className="w-5 h-5" />
                    <span>Start Call</span>
                  </button>
                ) : (
                  <button
                    onClick={handleEndCall}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    <PhoneOff className="w-5 h-5" />
                    <span>End Call</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Agent Info */}
          <div className="card">
            <h3 className="font-semibold mb-4">Agent Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Type:</span>
                <span className="font-medium">
                  {agent.type === 'voice_call' ? 'Voice Call' : 'Chatbot'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Model:</span>
                <span className="font-medium">{agent.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Functions:</span>
                <span className="font-medium">{agent.functions?.length || 0}</span>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">
              Testing Tips
            </h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Try mentioning function names</li>
              <li>• Test edge cases</li>
              <li>• Check response quality</li>
              <li>• Verify function execution</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestAgent;

