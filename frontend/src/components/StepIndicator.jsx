import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const StepIndicator = ({ steps, currentStep }) => {
  return (
    <div className="relative">
      {/* Progress Line */}
      <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-800">
        <motion.div
          className="h-full bg-gradient-to-r from-brand-sky to-brand-secondary"
          initial={{ width: '0%' }}
          animate={{
            width: `${((steps.findIndex(s => s.id === currentStep)) / (steps.length - 1)) * 100}%`
          }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Steps */}
      <div className="relative flex justify-between">
        {steps.map((step, index) => {
          const isCompleted = steps.findIndex(s => s.id === currentStep) > index;
          const isCurrent = step.id === currentStep;

          return (
            <div key={step.id} className="flex flex-col items-center">
              <motion.div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  isCompleted
                    ? 'bg-brand-secondary border-brand-secondary text-white'
                    : isCurrent
                    ? 'bg-white dark:bg-gray-900 border-brand-secondary text-brand-secondary'
                    : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-400'
                }`}
                whileHover={{ scale: 1.05 }}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <span className="font-semibold">{step.id}</span>
                )}
              </motion.div>

              <div className="mt-2 text-center">
                <p
                  className={`text-sm font-medium ${
                    isCurrent
                      ? 'text-brand-secondary'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {step.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 hidden sm:block">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;

