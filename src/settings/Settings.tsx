import React, { useState } from 'react';
import '../styles/global.css';
import '../styles/settings.css';
import { AzureConfig } from '../types';

export const Settings: React.FC = () => {
  const [config, setConfig] = useState<AzureConfig>({
    apiKey: '',
    endpoint: '',
    deploymentName: ''
  });

  const handleSave = () => {
    const { apiKey, endpoint, deploymentName } = config;
    
    if (!apiKey || !endpoint || !deploymentName) {
      alert('Please fill in all fields');
      return;
    }

    if (!endpoint.startsWith('https://')) {
      alert('Endpoint URL must start with https://');
      return;
    }
    
    // Send config to background script
    chrome.runtime.sendMessage({
      action: 'setApiKey',
      config
    }, (response) => {
      console.log('Configuration response:', response);
      if (response?.success) {
        chrome.tabs.query({ currentWindow: true }, (tabs) => {
          const tabInfo = tabs.map(tab => ({
            id: tab.id,
            title: tab.title || '',
            url: tab.url || ''
          }));

          console.log('Sending initial grouping request');
          chrome.runtime.sendMessage({
            action: 'groupByAI',
            tabs: tabInfo
          }, (groupResponse) => {
            console.log('Grouping response:', groupResponse);
            if (groupResponse?.error) {
              alert(`Error: ${groupResponse.error}`);
            }
          });
        });

        window.close();
      } else {
        alert(`Configuration failed: ${response?.error || 'Unknown error'}`);
      }
    });
  };

  const handleChange = (field: keyof AzureConfig) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setConfig(prev => ({
      ...prev,
      [field]: e.target.value.trim()
    }));
  };

  return (
    <div className="container">
      <h2>Azure OpenAI Configuration</h2>
      <div className="form-group">
        <label htmlFor="endpoint">Endpoint URL:</label>
        <input 
          type="url" 
          id="endpoint" 
          value={config.endpoint}
          onChange={handleChange('endpoint')}
          placeholder="https://your-resource.openai.azure.com"
        />
      </div>
      <div className="form-group">
        <label htmlFor="apiKey">API Key:</label>
        <input 
          type="password" 
          id="apiKey" 
          value={config.apiKey}
          onChange={handleChange('apiKey')}
          placeholder="Enter your Azure OpenAI API Key"
        />
      </div>
      <div className="form-group">
        <label htmlFor="deploymentName">Model Deployment Name:</label>
        <input 
          type="text" 
          id="deploymentName" 
          value={config.deploymentName}
          onChange={handleChange('deploymentName')}
          placeholder="Enter your deployment name"
        />
      </div>
      <button className="button" onClick={handleSave}>Save & Group Tabs</button>
      <div className="info">
        Find your Azure OpenAI resource in the{' '}
        <a 
          href="https://portal.azure.com/#blade/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/OpenAI" 
          target="_blank"
          rel="noopener noreferrer"
        >
          Azure Portal
        </a>
      </div>
    </div>
  );
};
