import React, { useState, useEffect } from 'react';
import { AzureOpenAISettings, SiliconFlowSettings } from '../types/storage';
import { storageService } from '../services/storage';
import { validateAISettings } from '../utils/api';
import '../styles/global.css';

interface SettingsProps {
  onBack: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const [provider, setProvider] = useState<'azure-openai' | 'siliconflow'>('azure-openai');
  const [azureSettings, setAzureSettings] = useState<AzureOpenAISettings>({
    apiKey: '',
    endpoint: '',
    deploymentName: ''
  });
  const [siliconFlowSettings, setSiliconFlowSettings] = useState<SiliconFlowSettings>({
    apiKey: '',
    model: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const savedProvider = await storageService.getProvider();
      setProvider(savedProvider);

      const savedAzureSettings = await storageService.getAzureOpenAISettings();
      if (savedAzureSettings) {
        setAzureSettings(savedAzureSettings);
      }

      const savedSiliconFlowSettings = await storageService.getSiliconFlowSettings();
      if (savedSiliconFlowSettings) {
        setSiliconFlowSettings(savedSiliconFlowSettings);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const currentSettings = provider === 'azure-openai' ? azureSettings : siliconFlowSettings;
      
      const validation = await validateAISettings(provider, currentSettings);
      if (!validation.isValid) {
        setError(validation.error || 'Invalid settings');
        return;
      }

      await storageService.saveProvider(provider);
      if (provider === 'azure-openai') {
        await storageService.saveAzureOpenAISettings(azureSettings);
      } else {
        await storageService.saveSiliconFlowSettings(siliconFlowSettings);
      }

      // If this is first time setup, trigger initial grouping
      const existingAzureSettings = await storageService.getAzureOpenAISettings();
      const existingSiliconFlowSettings = await storageService.getSiliconFlowSettings();
      const isFirstTimeSetup = provider === 'azure-openai' 
        ? !existingAzureSettings 
        : !existingSiliconFlowSettings;
      
      if (isFirstTimeSetup) {
        chrome.tabs.query({ currentWindow: true }, (tabs) => {
          const tabInfo = tabs.map(tab => ({
            id: tab.id,
            title: tab.title || '',
            url: tab.url || ''
          }));

          chrome.runtime.sendMessage({
            action: 'groupByAI',
            tabs: tabInfo
          });
        });
      }
      
      setError('Settings saved successfully!');
    } catch (err) {
      setError('Failed to save settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    onBack();
  };

  return (
    <div>
      <div className="header">
        <div className="section-title">AI Service Setings</div>
        <button className="button" onClick={onBack}>
          <span>←</span>
          Back
        </button>
      </div>

      <div className="form-group">
        <label>AI Service Provider</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as typeof provider)}
          className="button"
          style={{ width: '100%', marginBottom: '15px' }}
        >
          <option value="azure-openai">Azure OpenAI</option>
          <option value="siliconflow">SiliconFlow</option>
        </select>

        <label>API Key</label>
        <input
          type="password"
          value={provider === 'azure-openai' ? azureSettings.apiKey : siliconFlowSettings.apiKey}
          onChange={(e) => {
            if (provider === 'azure-openai') {
              setAzureSettings({ ...azureSettings, apiKey: e.target.value });
            } else {
              setSiliconFlowSettings({ ...siliconFlowSettings, apiKey: e.target.value });
            }
          }}
          placeholder="Enter your API key"
        />

        {provider === 'azure-openai' ? (
          <>
            <label>Endpoint URL</label>
            <input
              type="text"
              value={azureSettings.endpoint}
              onChange={(e) => setAzureSettings({ ...azureSettings, endpoint: e.target.value })}
              placeholder="https://your-resource.openai.azure.com/"
            />

            <label>Model</label>
            <select
              value={azureSettings.deploymentName}
              onChange={(e) => setAzureSettings({ ...azureSettings, deploymentName: e.target.value })}
              className="button"
              style={{ width: '100%', marginBottom: '15px' }}
            >
              <option value="">Select a model</option>
              <option value="gpt-4o">GPT-4O</option>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-35-turbo">GPT-3.5 Turbo</option>
              <option value="gpt-35-turbo-16k">GPT-3.5 Turbo 16K</option>
            </select>
          </>
        ) : (
          <>
            <label>Model</label>
            <select
              value={siliconFlowSettings.model}
              onChange={(e) => setSiliconFlowSettings({ ...siliconFlowSettings, model: e.target.value })}
              className="button"
              style={{ width: '100%', marginBottom: '15px' }}
            >
              <option value="">Select a model</option>
              <option value="deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B">DeepSeek R1 Distill Qwen 1.5B</option>
              <option value="Pro/deepseek-ai/DeepSeek-R1">Pro DeepSeek R1</option>
              <option value="deepseek-ai/DeepSeek-R1-Distill-Qwen-14B">DeepSeek R1 Distill Qwen 14B</option>
              <option value="Qwen/Qwen2.5-32B-Instruct">Qwen 2.5 32B Instruct</option>
            </select>
          </>
        )}
      </div>

      {error && (
        <div 
          style={{ 
            color: error === 'Settings saved successfully!' ? 'green' : 'red',
            marginBottom: '15px' 
          }}
        >
          {error}
        </div>
      )}

      <button
        className="button"
        onClick={handleSave}
        disabled={
          loading || 
          (provider === 'azure-openai' 
            ? !azureSettings.apiKey || !azureSettings.endpoint || !azureSettings.deploymentName
            : !siliconFlowSettings.apiKey || !siliconFlowSettings.model)
        }
        style={{ width: '100%', justifyContent: 'center', marginTop: '20px' }}
      >
        {loading ? 'Saving...' : 'Save Settings'}
      </button>

      <div className="info">
        {provider === 'azure-openai' ? (
          <span>
            Need an Azure OpenAI key?{' '}
            <a
              href="https://azure.microsoft.com/products/cognitive-services/openai-service"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn more
            </a>
          </span>
        ) : (
          <span>
            Need a SiliconFlow key?{' '}
            <a href="https://siliconflow.com" target="_blank" rel="noopener noreferrer">
              Register here
            </a>
          </span>
        )}
      </div>
    </div>
  );
};
