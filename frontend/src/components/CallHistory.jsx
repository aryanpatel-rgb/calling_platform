import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, Clock, User, FileText, DollarSign, Calendar, MessageSquare } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const CallHistory = ({ agentId }) => {
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (agentId) {
      fetchCallHistory();
      fetchCallStats();
      setupSSE();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [agentId]);

  const setupSSE = () => {
    // Use the same token key set by AuthContext
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const eventSource = new EventSource(`http://localhost:3000/api/sse/calls/${agentId}?token=${token}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      console.log('SSE connection established');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connected':
            console.log('SSE connected for agent:', data.agentId);
            break;
            
          case 'call_update':
            handleCallUpdate(data.data);
            break;
            
          case 'stats_update':
            setStats(data.data);
            break;
            
          default:
            console.log('Unknown SSE message type:', data.type);
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      setIsConnected(false);
      
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (agentId) {
          setupSSE();
        }
      }, 5000);
    };
  };

  const handleCallUpdate = (callUpdate) => {
    setCalls(prevCalls => {
      const existingCallIndex = prevCalls.findIndex(call => 
        call.call_sid === callUpdate.call_sid || call.id === callUpdate.id
      );

      if (existingCallIndex >= 0) {
        // Update existing call
        const updatedCalls = [...prevCalls];
        updatedCalls[existingCallIndex] = {
          ...updatedCalls[existingCallIndex],
          ...callUpdate
        };
        return updatedCalls;
      } else {
        // Add new call (shouldn't happen often, but just in case)
        return [callUpdate, ...prevCalls];
      }
    });

    // Show toast notification for important status changes
    if (callUpdate.status === 'completed') {
      toast.success(`Call completed - Duration: ${formatDuration(callUpdate.duration)}`);
    } else if (callUpdate.status === 'failed') {
      toast.error('Call failed');
    } else if (callUpdate.status === 'answered') {
      toast.success('Call answered');
    }
  };

  const fetchCallHistory = async () => {
    try {
      const response = await axios.get(`http://localhost:3000/api/agents/${agentId}/calls`);
      setCalls(response.data);
    } catch (error) {
      console.error('Error fetching call history:', error);
      toast.error('Failed to load call history');
    }
  };

  const fetchCallStats = async () => {
    try {
      const response = await axios.get(`http://localhost:3000/api/agents/${agentId}/calls/stats`);
      // Backend returns camelCase keys; keep them as-is
      setStats(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching call stats:', error);
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (number) => {
    if (!number) return 'Unknown';
    // Format phone number (e.g., +1234567890 -> +1 (234) 567-890)
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return number;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
      case 'busy': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'no-answer': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400';
      case 'failed': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      case 'in-progress': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      return new Intl.DateTimeFormat(undefined, {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }).format(d);
    } catch (_) {
      return dateString;
    }
  };

  const formatCurrency = (value) => {
    const num = Number(value || 0);
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(num);
  };

  const formatStatus = (status) => {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const CallDetailModal = ({ call, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Call Details</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">From</label>
              <p className="font-medium">{formatPhoneNumber(call.from_number)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">To</label>
              <p className="font-medium">{formatPhoneNumber(call.to_number)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</label>
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(call.status)}`}>
                {call.status}
              </span>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Duration</label>
              <p className="font-medium">{formatDuration(call.duration)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Direction</label>
              <p className="font-medium capitalize">{call.direction}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Cost</label>
              <p className="font-medium">{formatCurrency(call.cost)}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Started At</label>
            <p className="font-medium">{formatDateTime(call.started_at)}</p>
          </div>

          {call.ended_at && (
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Ended At</label>
              <p className="font-medium">{formatDateTime(call.ended_at)}</p>
            </div>
          )}

          {call.transcript && (
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Transcript</label>
              <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{call.transcript}</p>
              </div>
            </div>
          )}

          {call.recording_url && (
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Recording</label>
              <div className="mt-2">
                <audio controls className="w-full">
                  <source src={call.recording_url} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Call Statistics */}
      {stats && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Phone className="w-5 h-5 mr-2 text-primary-600" />
            Call Statistics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">{stats.totalCalls || 0}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Calls</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.completedCalls || 0}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{formatDuration(stats.totalDuration)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Duration</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{formatCurrency(stats.totalCost)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Cost</div>
            </div>
          </div>
        </div>
      )}

      {/* Call History */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center">
            <PhoneCall className="w-5 h-5 mr-2 text-primary-600" />
            Recent Calls
          </h2>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-xs text-gray-500">
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </div>

        {calls.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No calls yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {calls.map((call) => (
              <motion.div
                key={call.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                onClick={() => setSelectedCall(call)}
              >
                <div className="flex items-center w-full">
                  <div className="flex-shrink-0 mr-3">
                    {call.direction === 'outbound' ? (
                      <PhoneOutgoing className="w-5 h-5 text-blue-600" />
                    ) : (
                      <PhoneIncoming className="w-5 h-5 text-green-600" />
                    )}
                  </div>
                  <div className="grid grid-cols-12 gap-3 items-center w-full">
                    <div className="col-span-4 flex items-center space-x-2 min-w-0">
                      <span className="font-medium truncate">
                        {call.direction === 'outbound' ? formatPhoneNumber(call.to_number) : formatPhoneNumber(call.from_number)}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(call.status)}`}>
                        {formatStatus(call.status)}
                      </span>
                    </div>
                    <div className="col-span-4 flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="w-4 h-4 mr-1" />
                      {formatDateTime(call.started_at)}
                    </div>
                    <div className="col-span-2 flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <Clock className="w-4 h-4 mr-1" />
                      {formatDuration(call.duration)}
                    </div>
                    <div className="col-span-2 flex items-center justify-end space-x-3">
                      {Number(call.message_count) > 0 && (
                        <span className="flex items-center text-xs text-gray-500" title="Messages in conversation">
                          <MessageSquare className="w-4 h-4 mr-1" />
                          {call.message_count}
                        </span>
                      )}
                      {call.transcript && (
                        <FileText className="w-4 h-4 text-gray-400" title="Has transcript" />
                      )}
                      {call.recording_url && (
                        <div className="w-2 h-2 bg-red-500 rounded-full" title="Has recording"></div>
                      )}
                      {call.cost && (
                        <span className="flex items-center text-sm">
                          <DollarSign className="w-4 h-4 mr-1" />
                          {formatCurrency(call.cost)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Call Detail Modal */}
      {selectedCall && (
        <CallDetailModal
          call={selectedCall}
          onClose={() => setSelectedCall(null)}
        />
      )}
    </motion.div>
  );
};

export default CallHistory;