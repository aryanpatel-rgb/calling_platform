import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Phone, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import StepIndicator from '../components/StepIndicator';
import AgentTypeSelection from '../components/builder/AgentTypeSelection';
import BasicConfiguration from '../components/builder/BasicConfiguration';
import FunctionConfiguration from '../components/builder/FunctionConfiguration';
import VoiceConfiguration from '../components/builder/VoiceConfiguration';
import TestConfiguration from '../components/builder/TestConfiguration';
import ReviewAndDeploy from '../components/builder/ReviewAndDeploy';

const STEPS = [
  { id: 1, name: 'Type', description: 'Choose agent type' },
  { id: 2, name: 'Configuration', description: 'Basic settings' },
  { id: 3, name: 'Functions', description: 'Add capabilities' },
  { id: 4, name: 'Voice', description: 'Voice settings', voiceOnly: true },
  { id: 5, name: 'Testing', description: 'Test your agent', voiceOnly: true },
  { id: 6, name: 'Deploy', description: 'Review and deploy' },
];

const AgentBuilder = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  
  const [agentData, setAgentData] = useState({
    type: '', // 'chatbot' or 'voice_call'
    name: '',
    description: '',
    systemPrompt: '',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 1000,
    functions: [],
    voiceSettings: {
      voiceId: 'default',
      stability: 0.5,
      similarityBoost: 0.75,
      speed: 1.0,
      greeting: ''
    },
    twilioConfig: {
      accountSid: '',
      authToken: '',
      phoneNumber: '',
      testPhone: ''
    }
  });

  const updateAgentData = (field, value) => {
    setAgentData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const filteredSteps = STEPS.filter(step => 
    !step.voiceOnly || agentData.type === 'voice_call'
  );

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return agentData.type !== '';
      case 2:
        return agentData.name.trim() !== '' && agentData.systemPrompt.trim() !== '';
      case 3:
        return true; // Functions are optional
      case 4:
        return agentData.type !== 'voice_call' || agentData.voiceSettings.voiceId !== '';
      case 5:
        return agentData.type !== 'voice_call' || agentData.twilioConfig.accountSid !== '';
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!canProceed()) {
      toast.error('Please fill in all required fields');
      return;
    }

    const nextStepIndex = filteredSteps.findIndex(s => s.id === currentStep) + 1;
    if (nextStepIndex < filteredSteps.length) {
      setCurrentStep(filteredSteps[nextStepIndex].id);
    }
  };

  const handlePrevious = () => {
    const prevStepIndex = filteredSteps.findIndex(s => s.id === currentStep) - 1;
    if (prevStepIndex >= 0) {
      setCurrentStep(filteredSteps[prevStepIndex].id);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await axios.post('http://localhost:3000/api/agents', agentData);
      toast.success('Agent created successfully!');
      navigate(`/agent/${response.data.id}`);
    } catch (error) {
      console.error('Error saving agent:', error);
      toast.error(error.response?.data?.message || 'Failed to create agent');
    } finally {
      setSaving(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <AgentTypeSelection
            selectedType={agentData.type}
            onSelect={(type) => updateAgentData('type', type)}
          />
        );
      case 2:
        return (
          <BasicConfiguration
            data={agentData}
            onChange={updateAgentData}
          />
        );
      case 3:
        return (
          <FunctionConfiguration
            functions={agentData.functions}
            onChange={(functions) => updateAgentData('functions', functions)}
          />
        );
      case 4:
        return (
          <VoiceConfiguration
            voiceSettings={agentData.voiceSettings}
            onChange={(settings) => updateAgentData('voiceSettings', settings)}
          />
        );
      case 5:
        return (
          <TestConfiguration
            twilioConfig={agentData.twilioConfig}
            onChange={(config) => updateAgentData('twilioConfig', config)}
          />
        );
      case 6:
        return (
          <ReviewAndDeploy
            agentData={agentData}
            onSave={handleSave}
            saving={saving}
          />
        );
      default:
        return null;
    }
  };

  const currentStepIndex = filteredSteps.findIndex(s => s.id === currentStep);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New Agent</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Build a powerful AI agent in just a few steps
        </p>
      </div>

      {/* Step Indicator */}
      <StepIndicator
        steps={filteredSteps}
        currentStep={currentStep}
      />

      {/* Step Content */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
        className="card my-8"
      >
        {renderStepContent()}
      </motion.div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentStepIndex === 0}
          className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>

        <div className="flex space-x-3">
          {currentStepIndex < filteredSteps.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving || !canProceed()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Create Agent</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentBuilder;

