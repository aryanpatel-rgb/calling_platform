import { getUserProfile, getEventType } from './backend/services/calcomService.js';

// Test configuration using the provided API key and event type ID
const API_KEY = 'cal_live_df9e8b15b39de35477891eb63074b46a';
const EVENT_TYPE_ID = '3468013';

async function testCalComService() {
  console.log('🧪 Testing Cal.com Service Functions...\n');

  try {
    // Test getUserProfile function
    console.log('1. Testing getUserProfile...');
    const userResult = await getUserProfile(API_KEY);
    console.log('User Profile Result:', JSON.stringify(userResult, null, 2));
    console.log('');

    // Test getEventType function
    console.log('2. Testing getEventType...');
    const eventTypeResult = await getEventType(API_KEY, EVENT_TYPE_ID);
    console.log('Event Type Result:', JSON.stringify(eventTypeResult, null, 2));
    console.log('');

    console.log('✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the tests
testCalComService();