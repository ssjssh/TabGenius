import { AzureOpenAISettings, SiliconFlowSettings } from '../types/storage';

const validateAzureOpenAI = async (settings: AzureOpenAISettings): Promise<boolean> => {
  try {
    const trimmedEndpoint = settings.endpoint.trim().replace(/\/$/, '');
    const url = `${trimmedEndpoint}/openai/deployments/${settings.deploymentName}/chat/completions?api-version=2023-05-15`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': settings.apiKey
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "Test request. Respond with: {\"test\": [0]}"
          },
          {
            role: "user",
            content: "test"
          }
        ],
        temperature: 0.3,
        max_tokens: 50
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Azure OpenAI validation error:', text);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Azure OpenAI validation error:', error);
    return false;
  }
};

const validateSiliconFlow = async (settings: SiliconFlowSettings): Promise<boolean> => {
  try {
    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: 'user',
            content: 'test'
          }
        ],
        max_tokens: 10
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('SiliconFlow validation error:', text);
      return false;
    }

    return true;
  } catch (error) {
    console.error('SiliconFlow validation error:', error);
    return false;
  }
};

export const validateAISettings = async (
  provider: 'azure-openai' | 'siliconflow',
  settings: AzureOpenAISettings | SiliconFlowSettings
): Promise<{
  isValid: boolean;
  error?: string;
}> => {
  try {
    let isValid = false;

    if (!settings.apiKey) {
      return { isValid: false, error: 'API key is required' };
    }

    if (provider === 'azure-openai') {
      const azureSettings = settings as AzureOpenAISettings;
      if (!azureSettings.endpoint) {
        return { isValid: false, error: 'Endpoint URL is required' };
      }
      if (!azureSettings.endpoint.startsWith('https://')) {
        return { isValid: false, error: 'Endpoint URL must start with https://' };
      }
      if (!azureSettings.deploymentName) {
        return { isValid: false, error: 'Model deployment name is required' };
      }
      isValid = await validateAzureOpenAI(azureSettings);
    } else if (provider === 'siliconflow') {
      const siliconFlowSettings = settings as SiliconFlowSettings;
      if (!siliconFlowSettings.model) {
        return { isValid: false, error: 'Model is required' };
      }
      isValid = await validateSiliconFlow(siliconFlowSettings);
    }

    return {
      isValid,
      error: isValid ? undefined : 'Failed to validate settings. Please check your configuration.'
    };
  } catch (error) {
    console.error('API validation error:', error);
    return {
      isValid: false,
      error: 'Failed to validate API key. Please check your connection.'
    };
  }
};
