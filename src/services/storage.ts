import { StorageData, StoredOption, StorageService, AzureOpenAISettings, SiliconFlowSettings } from '../types/storage';

const STORAGE_KEY = 'tabgenius_selections';

class ChromeStorageService implements StorageService {
  private async getStorageData(): Promise<StorageData> {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        const data = result[STORAGE_KEY] || {
          selectedOptions: {},
          provider: 'azure-openai',
          azureOpenAISettings: null,
          siliconFlowSettings: null,
          lastUpdated: Date.now()
        };
        resolve(data as StorageData);
      });
    });
  }

  private async setStorageData(data: StorageData): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: data }, () => {
        resolve();
      });
    });
  }

  public async saveSelection(key: string, option: StoredOption): Promise<void> {
    try {
      const data = await this.getStorageData();
      data.selectedOptions[key] = option;
      data.lastUpdated = Date.now();
      await this.setStorageData(data);
    } catch (error) {
      console.error('Error saving selection:', error);
      throw new Error('Failed to save selection');
    }
  }

  public async getSelection(key: string): Promise<StoredOption | null> {
    try {
      const data = await this.getStorageData();
      return data.selectedOptions[key] || null;
    } catch (error) {
      console.error('Error getting selection:', error);
      return null;
    }
  }

  public async clearSelection(key: string): Promise<void> {
    try {
      const data = await this.getStorageData();
      delete data.selectedOptions[key];
      data.lastUpdated = Date.now();
      await this.setStorageData(data);
    } catch (error) {
      console.error('Error clearing selection:', error);
      throw new Error('Failed to clear selection');
    }
  }

  public async getAllSelections(): Promise<StorageData['selectedOptions']> {
    try {
      const data = await this.getStorageData();
      return data.selectedOptions;
    } catch (error) {
      console.error('Error getting all selections:', error);
      return {};
    }
  }

  public async saveProvider(provider: StorageData['provider']): Promise<void> {
    try {
      const data = await this.getStorageData();
      data.provider = provider;
      data.lastUpdated = Date.now();
      await this.setStorageData(data);
    } catch (error) {
      console.error('Error saving provider:', error);
      throw new Error('Failed to save provider');
    }
  }

  public async getProvider(): Promise<StorageData['provider']> {
    try {
      const data = await this.getStorageData();
      return data.provider;
    } catch (error) {
      console.error('Error getting provider:', error);
      return 'azure-openai'; // Default provider
    }
  }

  public async saveAzureOpenAISettings(settings: AzureOpenAISettings): Promise<void> {
    try {
      const data = await this.getStorageData();
      data.azureOpenAISettings = settings;
      data.lastUpdated = Date.now();
      await this.setStorageData(data);
    } catch (error) {
      console.error('Error saving Azure OpenAI settings:', error);
      throw new Error('Failed to save Azure OpenAI settings');
    }
  }

  public async getAzureOpenAISettings(): Promise<AzureOpenAISettings | null> {
    try {
      const data = await this.getStorageData();
      return data.azureOpenAISettings || null;
    } catch (error) {
      console.error('Error getting Azure OpenAI settings:', error);
      return null;
    }
  }

  public async saveSiliconFlowSettings(settings: SiliconFlowSettings): Promise<void> {
    try {
      const data = await this.getStorageData();
      data.siliconFlowSettings = settings;
      data.lastUpdated = Date.now();
      await this.setStorageData(data);
    } catch (error) {
      console.error('Error saving SiliconFlow settings:', error);
      throw new Error('Failed to save SiliconFlow settings');
    }
  }

  public async getSiliconFlowSettings(): Promise<SiliconFlowSettings | null> {
    try {
      const data = await this.getStorageData();
      return data.siliconFlowSettings || null;
    } catch (error) {
      console.error('Error getting SiliconFlow settings:', error);
      return null;
    }
  }
}

// Export singleton instance
export const storageService = new ChromeStorageService();
