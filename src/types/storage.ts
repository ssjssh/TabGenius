export interface StoredOption {
  icon: string;
  text: string;
  id: string;
}

export interface AzureOpenAISettings {
  apiKey: string;
  endpoint: string;
  deploymentName: string;
}

export interface SiliconFlowSettings {
  apiKey: string;
  model: string;
}

export interface StorageData {
  selectedOptions: {
    [key: string]: StoredOption;
  };
  provider: 'azure-openai' | 'siliconflow';
  azureOpenAISettings?: AzureOpenAISettings;
  siliconFlowSettings?: SiliconFlowSettings;
  lastUpdated: number;
}

export interface StorageService {
  saveProvider(provider: StorageData['provider']): Promise<void>;
  getProvider(): Promise<StorageData['provider']>;
  saveAzureOpenAISettings(settings: AzureOpenAISettings): Promise<void>;
  getAzureOpenAISettings(): Promise<AzureOpenAISettings | null>;
  saveSiliconFlowSettings(settings: SiliconFlowSettings): Promise<void>;
  getSiliconFlowSettings(): Promise<SiliconFlowSettings | null>;
  saveSelection(key: string, option: StoredOption): Promise<void>;
  getSelection(key: string): Promise<StoredOption | null>;
  clearSelection(key: string): Promise<void>;
  getAllSelections(): Promise<StorageData['selectedOptions']>;
}
