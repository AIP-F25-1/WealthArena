// WealthArena API Test Component
// For testing API connectivity and endpoints

import React, { useState, useEffect } from 'react';
import apiService from '../services/apiService';

const ApiTestComponent = () => {
  const [testResults, setTestResults] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const runApiTests = async () => {
    setIsLoading(true);
    const results = {};

    try {
      // Test backend health
      results.backendHealth = await apiService.checkBackendHealth();
    } catch (error) {
      results.backendHealth = { error: error.message };
    }

    try {
      // Test chatbot health
      results.chatbotHealth = await apiService.checkChatbotHealth();
    } catch (error) {
      results.chatbotHealth = { error: error.message };
    }

    try {
      // Test top signals
      results.topSignals = await apiService.getTopSignals(5);
    } catch (error) {
      results.topSignals = { error: error.message };
    }

    try {
      // Test chatbot
      results.chatbot = await apiService.chatWithBot('What is RSI?');
    } catch (error) {
      results.chatbot = { error: error.message };
    }

    setTestResults(results);
    setIsLoading(false);
  };

  useEffect(() => {
    runApiTests();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>WealthArena API Test Results</h2>
      
      {isLoading && <p>Running API tests...</p>}
      
      <div style={{ marginTop: '20px' }}>
        <h3>Backend Health:</h3>
        <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
          {JSON.stringify(testResults.backendHealth, null, 2)}
        </pre>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>Chatbot Health:</h3>
        <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
          {JSON.stringify(testResults.chatbotHealth, null, 2)}
        </pre>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>Top Signals:</h3>
        <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
          {JSON.stringify(testResults.topSignals, null, 2)}
        </pre>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>Chatbot Response:</h3>
        <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
          {JSON.stringify(testResults.chatbot, null, 2)}
        </pre>
      </div>

      <button 
        onClick={runApiTests} 
        style={{ 
          marginTop: '20px', 
          padding: '10px 20px', 
          backgroundColor: '#007bff', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Run Tests Again
      </button>
    </div>
  );
};

export default ApiTestComponent;
