import React, { useState } from 'react';
import '../styles/global.css';
import '../styles/settings.css';
import { AzureConfig } from '../types';

export const Settings: React.FC = () => {
  const [selectedSection, setSelectedSection] = useState('basic');
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
    <>
      <header className="settings-header">
        <h1>TabGenius Settings</h1>
      </header>
      <div className="settings-layout">
      <div className="settings-sidebar">
        <div className="sidebar-section">
          <div 
            className={`sidebar-item ${selectedSection === 'basic' ? 'selected' : ''}`}
            onClick={() => setSelectedSection('basic')}
          >
            Basic Settings
          </div>
          <div 
            className={`sidebar-item ${selectedSection === 'about' ? 'selected' : ''}`}
            onClick={() => setSelectedSection('about')}
          >
            About
          </div>
        </div>
      </div>
      <div className="settings-content">
        {selectedSection === 'basic' ? (
          <>
            <h2>Basic Settings</h2>
            <div className="settings-card">
              <h3>AI Expert Settings</h3>
              <div className="settings-description">
                Configure your Azure OpenAI settings to enable AI-powered tab organization.
              </div>
              <div className="form-group">
                <label htmlFor="endpoint">
                  Endpoint URL:
                  <span className="tooltip" data-tooltip="Your Azure OpenAI resource endpoint">ⓘ</span>
                </label>
                <input 
                  type="url" 
                  id="endpoint" 
                  value={config.endpoint}
                  onChange={handleChange('endpoint')}
                  placeholder="https://your-resource.openai.azure.com"
                />
              </div>
              <div className="form-group">
                <label htmlFor="apiKey">
                  API Key:
                  <span className="tooltip" data-tooltip="Your Azure OpenAI API key">ⓘ</span>
                </label>
                <input 
                  type="password" 
                  id="apiKey" 
                  value={config.apiKey}
                  onChange={handleChange('apiKey')}
                  placeholder="Enter your Azure OpenAI API Key"
                />
              </div>
              <div className="form-group">
                <label htmlFor="deploymentName">
                  Model Deployment Name:
                  <span className="tooltip" data-tooltip="The name of your deployed model">ⓘ</span>
                </label>
                <input 
                  type="text" 
                  id="deploymentName" 
                  value={config.deploymentName}
                  onChange={handleChange('deploymentName')}
                  placeholder="Enter your deployment name"
                />
              </div>
              <button className="btn btn-primary" onClick={handleSave}>Save & Group Tabs</button>
            </div>

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
          </>
        ) : (
          <>
            <h2>About TabGenius</h2>
            <div className="settings-card">
              <h3>Developer Information</h3>
              <div className="settings-description">
                TabGenius is a Chrome extension that helps you organize your tabs using AI.
              </div>
              <div className="info">
                <p>GitHub: <a href="https://github.com/ssjssh/TabGenius" target="_blank" rel="noopener noreferrer">
                  github.com/ssjssh/TabGenius
                </a></p>
                <p>Email: <a href="mailto:ssjssh666@gmail.com">ssjssh666@gmail.com</a></p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
};
