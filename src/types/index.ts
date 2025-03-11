export interface TabInfo {
  id: number | undefined;
  title: string;
  url: string;
  groupId?: number;
  windowId?: number;
}

export interface RuntimeMessage {
  action: 'groupByAI' | 'setApiKey' | 'groupByDomain' | 'cancelGroup';
  tabs?: TabInfo[];
  config?: AzureConfig | SiliconConfig;
}

export interface AzureConfig {
  apiKey: string;
  endpoint: string;
  deploymentName: string;
}

export interface SiliconConfig {
  apiKey: string;
  endpoint: string;
  modelId: string;
}

export interface Category {
  title: string;
  color: chrome.tabGroups.ColorEnum;
  tabIds: number[];
}

export type TabGroupOptions = {
  tabIds: number[];
  createProperties?: {
    windowId?: number;
  };
};

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface GroupState {
  grouping: 'ai' | 'domain' | 'cancel';
  autoGroup: 'always' | 'disable';
  sortOrder: 'desc' | 'asc' | 'disable';
}
