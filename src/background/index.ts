import { TabInfo, RuntimeMessage, AzureConfig, SiliconConfig, GroupState } from '../types';
import { storageService } from '../services/storage';
import * as AzureOpenAI from '../components/AzureOpenAI';
import * as SiliconFlow from '../components/SiliconFlow';

let azureConfig: AzureConfig | null = null;
let siliconConfig: SiliconConfig | null = null;
let currentProvider: 'azure-openai' | 'siliconflow' = 'azure-openai';
// Store both group ID and tab info, using title as key
let existingGroups: Map<string, { groupId: number; tabs: TabInfo[] }> = new Map();
let pendingTabs: Set<number> = new Set();
const blankPagePatterns = [
  'about:blank',
  'chrome://newtab/',
  'edge://newtab/', 
  'about:newtab', 
  'opera://startpage/'
];

// Load configs on startup
const loadConfigs = async () => {
  console.log('Method called: loadConfigs');
  try {
    // Load provider selection
    currentProvider = await storageService.getProvider();
    console.log('Current provider:', currentProvider);
    
    // Load Azure config
    const azureSettings = await storageService.getAzureOpenAISettings();
    if (azureSettings) {
      await AzureOpenAI.validateConfig(azureSettings);
      azureConfig = azureSettings;
      console.log('Loaded Azure config:', azureSettings);
    }
    
    // Load Silicon config
    const siliconSettings = await storageService.getSiliconFlowSettings();
    if (siliconSettings) {
      const siliconConfigObj: SiliconConfig = {
        apiKey: siliconSettings.apiKey,
        endpoint: 'https://api.siliconflow.cn', 
        modelId: siliconSettings.model || 'deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B'
      };
      console.log('Loaded Silicon config:', JSON.stringify(siliconConfigObj, null, 2));
      try {
        await SiliconFlow.validateConfig(siliconConfigObj);
        siliconConfig = siliconConfigObj;
      } catch (error: unknown) {
        console.error('Silicon config validation failed:', error);
      }
    }
  } catch (error: unknown) {
    console.error('Error loading or validating configs:', error);
  }
};

loadConfigs();

// Listen for messages from popup
console.log('Event listener registered: chrome.runtime.onMessage');
chrome.runtime.onMessage.addListener((
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean => {
  console.log('Received message:', message);
  
  const typedMessage = message as RuntimeMessage;
  
if (typedMessage.action === 'groupByDomain' && Array.isArray(typedMessage.tabs)) {
    console.log('Starting domain grouping with tabs:', typedMessage.tabs);
    handleDomainGrouping(typedMessage.tabs)
      .then(() => {
        console.log('Domain grouping completed successfully');
        sendResponse({ success: true });
      })
      .catch((error: unknown) => {
        console.error('Error in handleDomainGrouping:', error);
        showError(error instanceof Error ? error.message : 'Domain grouping failed');
        sendResponse({ success: false, error: String(error) });
      });
    return true;
} else if (typedMessage.action === 'groupByAI' && Array.isArray(typedMessage.tabs)) {
    console.log('Starting AI grouping with tabs:', typedMessage.tabs);
    handleAIGrouping(typedMessage.tabs)
      .then(() => {
        console.log('Grouping completed successfully');
        sendResponse({ success: true });
      })
      .catch((error: unknown) => {
        console.error('Error in handleAIGrouping:', error);
        showError(error instanceof Error ? error.message : 'AI Grouping failed');
        sendResponse({ success: false, error: String(error) });
      });
    return true;
} else if (typedMessage.action === 'cancelGroup') {
    console.log('Starting to ungroup all tabs');
    handleCancelGroup()
      .then(() => {
        console.log('Successfully ungrouped all tabs');
        sendResponse({ success: true });
      })
      .catch((error: unknown) => {
        console.error('Error in handleCancelGroup:', error);
        showError(error instanceof Error ? error.message : 'Failed to ungroup tabs');
        sendResponse({ success: false, error: String(error) });
      });
    return true;
} else if (typedMessage.action === 'setApiKey' && typedMessage.config) {
    const config = typedMessage.config;
    const isAzureConfig = 'deploymentName' in config;
    const validateFn = isAzureConfig ? AzureOpenAI.validateConfig : SiliconFlow.validateConfig;
    
    validateFn(config as any)
      .then(() => {
        handleSetConfig(config);
        console.log('Config validated and saved successfully');
        sendResponse({ success: true });
      })
      .catch((error: unknown) => {
        console.error('Config validation failed:', error);
        sendResponse({ success: false, error: String(error) });
      });
    return true;
  }
  return false;
});

async function handleSetConfig(config: AzureConfig | SiliconConfig): Promise<void> {
  console.log('Method called: handleSetConfig');
  const isAzureConfig = 'deploymentName' in config;
  
if (isAzureConfig) {
    console.log('Setting Azure config');
    const azureCfg = config as AzureConfig;
    azureCfg.endpoint = azureCfg.endpoint.replace(/\/$/, '');
    await storageService.saveAzureOpenAISettings(azureCfg);
    
    // Update in-memory config
    azureConfig = azureCfg;
    console.log('Azure config saved:', azureConfig);
  } else {
    console.log('Setting Silicon config');
    const siliconCfg = config as SiliconConfig;
    // Create storage settings format
    const settings = {
      apiKey: siliconCfg.apiKey,
      model: siliconCfg.modelId
    };
    await storageService.saveSiliconFlowSettings(settings);
    
    // Update in-memory config with full SiliconConfig format
    siliconConfig = {
      apiKey: siliconCfg.apiKey,
      endpoint: 'https://api.siliconflow.cn',
      modelId: siliconCfg.modelId || 'gpt-4'
    };
    console.log('Silicon config saved:', JSON.stringify(siliconConfig, null, 2));
  }
}

function showError(message: string) {
  console.log('Method called: showError');
  console.error('Error:', message);
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '/icons/icon.jpg',
    title: 'TabGenius Error',
    message: message
  });
}

// Helper function to get all groups and tabs, excluding a specific tab
async function getAllGroupsAndTabs(excludeTabId?: number): Promise<Map<string, { groupId: number; tabs: TabInfo[] }>> {
  console.log('Method called: getAllGroupsAndTabs');
  const groups = new Map<string, { groupId: number; tabs: TabInfo[] }>();
  
  // Get all windows and their tabs
  const windows = await chrome.windows.getAll({ populate: true });
  
  for (const window of windows) {
    if (window.type !== 'normal' || !window.tabs) continue;
    
    // Get all tab groups in this window
    const tabGroups = await chrome.tabGroups.query({ windowId: window.id });
    
    // Process each group
    for (const group of tabGroups) {
      // Get all tabs in this group, excluding the specified tab
      const groupTabs = window.tabs.filter(tab => 
        tab.groupId === group.id && 
        (excludeTabId === undefined || tab.id !== excludeTabId)
      );
      
      if (group.title) {
        groups.set(group.title, {
          groupId: group.id,
          tabs: groupTabs.map(tab => ({
            id: tab.id,
            title: tab.title || '',
            url: tab.url || '',
            windowId: window.id
          }))
        });
      }
    }
  }
  
  return groups;
}

// Helper function to wait for tab to load
async function waitForTabLoad(tabId: number | undefined): Promise<chrome.tabs.Tab | null> {
  console.log('Method called: waitForTabLoad');
  if (!tabId) return null;
  
  return new Promise((resolve) => {
    const checkTab = async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete') {
          resolve(tab);
        } else {
          setTimeout(checkTab, 100);
        }
      } catch (error) {
        console.error('Error checking tab:', error);
        resolve(null);
      }
    };
    checkTab();
  });
}

// Helper function to filter tabs in normal windows
async function filterNormalWindowTabs(tabs: TabInfo[]): Promise<TabInfo[]> {
  console.log('Method called: filterNormalWindowTabs');
  const normalTabs: TabInfo[] = [];
  
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      const tabInfo = await chrome.tabs.get(tab.id);
      if (!tabInfo.windowId) continue;
      
      const window = await chrome.windows.get(tabInfo.windowId);
      if (window && window.type === 'normal') {
        normalTabs.push(tab);
      }
    } catch (error) {
      console.warn('Error checking tab window type:', error);
    }
  }
  
  return normalTabs;
}

// Helper function to extract domain from URL
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Handle special cases
    if (urlObj.protocol === 'file:') {
      return 'Local Files';
    } else if (urlObj.protocol === 'chrome:' || urlObj.protocol === 'chrome-extension:') {
      return 'Browser Pages';
    }
    
    // Remove 'www.' if present for consistent grouping
    return urlObj.hostname.replace(/^www\./, '');
  } catch (error) {
    console.warn('Error parsing URL:', url, error);
    return 'Other';
  }
}

async function handleDomainGrouping(tabs: TabInfo[]): Promise<void> {
  console.log('Method called: handleDomainGrouping');
  try {
    console.log('Starting domain grouping for', tabs.length, 'tabs');
    
    // Filter out tabs that aren't in normal windows
    const normalTabs = await filterNormalWindowTabs(tabs);
    if (normalTabs.length === 0) {
      throw new Error('No valid tabs found in normal windows');
    }
    console.log('Filtered to', normalTabs.length, 'tabs in normal windows');
    
    // Group tabs by windowId first
    const tabsByWindow = new Map<number, TabInfo[]>();
    
    for (const tab of normalTabs) {
      if (!tab.windowId) continue;
      if (!tabsByWindow.has(tab.windowId)) {
        tabsByWindow.set(tab.windowId, []);
      }
      tabsByWindow.get(tab.windowId)!.push(tab);
    }
    
    // Process each window separately
    for (const [windowId, windowTabs] of tabsByWindow) {
      // First ungroup any tabs that are in groups
      const tabIds = windowTabs
        .map(tab => tab.id)
        .filter((id): id is number => id !== undefined);
      
      await chrome.tabs.ungroup(tabIds);
      
      // Group tabs by domain
      const domainGroups = new Map<string, TabInfo[]>();
    
      for (const tab of windowTabs) {
        try {
          const domain = extractDomain(tab.url);
          
          // Add tab to its domain group
          if (!domainGroups.has(domain)) {
            domainGroups.set(domain, []);
          }
          domainGroups.get(domain)!.push(tab);
        } catch (error) {
          console.warn('Error parsing URL for tab:', tab, error);
          // Add to "Other" group if URL parsing fails
          const otherGroup = 'Other';
          if (!domainGroups.has(otherGroup)) {
            domainGroups.set(otherGroup, []);
          }
          domainGroups.get(otherGroup)!.push(tab);
        }
      }
      
      // Create tab groups for each domain that has at least 2 tabs
      const colors: chrome.tabGroups.ColorEnum[] = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan"];
      let colorIndex = 0;
      
      for (const [domain, domainTabs] of domainGroups) {
        const tabIds = domainTabs
          .map(tab => tab.id)
          .filter((id): id is number => id !== undefined);
        
        if (tabIds.length === 0) {
          console.log('No valid tab IDs for domain:', domain);
          continue;
        }
        
        console.log('Creating group for domain:', domain, 'tabs:', tabIds);
        const groupId = await chrome.tabs.group({ 
          tabIds,
          createProperties: { windowId }
        });
        
        await chrome.tabGroups.update(groupId, {
          title: domain,
          color: colors[colorIndex % colors.length]
        });
        
        // Update existingGroups using domain name as key
        existingGroups.set(domain, {
          groupId,
          tabs: domainTabs
        });
        
        colorIndex++;
      }
    }
    
    console.log('Domain grouping completed successfully');
  } catch (error: unknown) {
    console.error('Domain Grouping failed:', error);
    throw error;
  }
}

// Helper function to handle domain grouping for a single tab
async function handleDomainGroupingForTab(tab: chrome.tabs.Tab): Promise<void> {
  console.log('Method called: handleDomainGroupingForTab');
  try {
    if (!tab.url || !tab.id) {
      console.log('Tab has no URL or ID, skipping domain grouping');
      return;
    }

    // Wait for tab to load
    const loadedTab = await waitForTabLoad(tab.id);
    if (!loadedTab || !loadedTab.url || 
      blankPagePatterns.some(pattern => loadedTab.url === pattern) ||
      loadedTab.url.startsWith('about:blank?')) {
      console.log('Skipping empty or new tab page');
      return;
    }

    // Get current groups
    existingGroups = await getAllGroupsAndTabs(tab.id);

    const domain = extractDomain(loadedTab.url);

    // Find existing group with same domain
    const existingGroup = Array.from(existingGroups.entries()).find(
      ([groupTitle, _]) => groupTitle.toLowerCase().trim() === domain.toLowerCase().trim()
    );

    const colors: chrome.tabGroups.ColorEnum[] = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    if (existingGroup) {
      // Add to existing domain group
      const [groupTitle, group] = existingGroup;
      console.log('Found existing domain group:', groupTitle);
      
      if (loadedTab.id) {
        const tabIds = [loadedTab.id] as number[];
        await chrome.tabs.group({
          tabIds,
          groupId: group.groupId
        });
      }

      // Update color for visual consistency
      await chrome.tabGroups.update(group.groupId, {
        color: randomColor
      });
      
      // Update the existing group's tabs
      group.tabs.push({
        id: loadedTab.id,
        title: loadedTab.title || '',
        url: loadedTab.url || ''
      });
      
      console.log('Added tab to existing domain group:', groupTitle);
    } else {
      // Create new domain group
      console.log('Creating new domain group:', domain);
      if (loadedTab.id) {
        const tabIds = [loadedTab.id] as number[];
        const newGroupId = await chrome.tabs.group({ tabIds });
        if (newGroupId) {
          await chrome.tabGroups.update(newGroupId, {
            title: domain,
            color: randomColor
          });

          // Update existingGroups
          existingGroups.set(domain, {
            groupId: newGroupId,
            tabs: [{
              id: loadedTab.id,
              title: loadedTab.title || '',
              url: loadedTab.url || ''
            }]
          });
        }
      }
    }
  } catch (error: unknown) {
    console.error('Error in handleDomainGroupingForTab:', error);
  }
}

async function handleCancelGroup(): Promise<void> {
  console.log('Method called: handleCancelGroup');
  try {
    console.log('Getting all tabs in current window');
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    // Get all tabs that are in a group
    const groupedTabs = tabs.filter(tab => tab.groupId !== undefined)
                           .map(tab => tab.id)
                           .filter((id): id is number => id !== undefined);
    
    if (groupedTabs.length === 0) {
      console.log('No grouped tabs found');
      return;
    }
    
    // Ungroup all grouped tabs
    console.log('Ungrouping tabs:', groupedTabs);
    await chrome.tabs.ungroup(groupedTabs);
    
    // Clear existing groups map
    existingGroups.clear();
    
    // Disable auto-grouping
    await storageService.saveSelection('autoGroup', {
      id: 'autoGroup-disable',
      text: 'disable',
      icon: '⊗'
    });
    
    console.log('Successfully ungrouped all tabs and disabled auto-grouping');
  } catch (error: unknown) {
    console.error('Error in handleCancelGroup:', error);
    throw error;
  }
}

async function handleAIGrouping(tabs: TabInfo[]): Promise<void> {
  console.log('Method called: handleAIGrouping');
  try {
    console.log('Starting AI grouping for', tabs.length, 'tabs');
    
    // Filter out tabs that aren't in normal windows
    const normalTabs = await filterNormalWindowTabs(tabs);
    if (normalTabs.length === 0) {
      throw new Error('No valid tabs found in normal windows');
    }
    console.log('Filtered to', normalTabs.length, 'tabs in normal windows');

    // Get current provider and config
    const provider = await storageService.getProvider();
    const config = provider === 'azure-openai' ? azureConfig : siliconConfig;
    
    if (!config) {
      throw new Error(`No configuration found for provider: ${provider}`);
    }

    // Validate config before proceeding
    const validateFn = provider === 'azure-openai' ? AzureOpenAI.validateConfig : SiliconFlow.validateConfig;
    await validateFn(config as any);

    // Prepare tab data
    const tabsData = normalTabs.map(tab => ({
      title: tab.title || '',
      url: new URL(tab.url || '').hostname
    }));

    console.log(`Sending to ${provider}:`, tabsData);

    // Get categories from selected provider
    const categorizeFn = provider === 'azure-openai' ? AzureOpenAI.categorizeTabs : SiliconFlow.categorizeTabs;
    const categories = await categorizeFn(tabsData, config as any);
    console.log('Received categories:', categories);
    
    if (!categories || Object.keys(categories).length === 0) {
      throw new Error('No categories received from AI provider');
    }

    // Create groups and assign tabs
    for (const [category, tabIndices] of Object.entries(categories)) {
      console.log('Processing category:', category, 'with indices:', tabIndices);
      
      const tabIds = tabIndices
        .map(index => normalTabs[index]?.id)
        .filter((id): id is number => id !== undefined);
      
      if (tabIds.length === 0) {
        console.log('No valid tab IDs for category:', category);
        continue;
      }

      console.log('Creating group for tabs:', tabIds);
      const groupId = await chrome.tabs.group({ tabIds });
      
      const colors: chrome.tabGroups.ColorEnum[] = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan"];
      await chrome.tabGroups.update(groupId, {
        title: category,
        color: colors[Math.floor(Math.random() * colors.length)]
      });

      // Update existingGroups using category name as key
      const groupTabs = normalTabs.filter(tab => tabIds.includes(tab.id ?? -1));
      existingGroups.set(category, {
        groupId,
        tabs: groupTabs
      });
    }

    console.log('Grouping completed successfully');
  } catch (error: unknown) {
    console.error('AI Grouping failed:', error);
    throw error;
  }
}

// Function to automatically group a single tab using AI decisions
async function handleAutoGroupSingleTab(tab: chrome.tabs.Tab): Promise<void> {
  console.log('Method called: handleAutoGroupSingleTab');
  try {
    // Check grouping and auto-group preferences
    const [groupingPref, autoGroupPref, provider] = await Promise.all([
      storageService.getSelection('grouping'),
      storageService.getSelection('autoGroup'),
      storageService.getProvider()
    ]);

    if (groupingPref?.text === 'cancel' || autoGroupPref?.text === 'disable') {
      console.log('Auto-grouping is disabled or cancelled, skipping');
      return;
    }

    // Skip tabs in incognito windows
    if (tab.incognito) {
      console.log('Skipping incognito tab');
      return;
    }

    // Check if we should use domain grouping
    if (groupingPref?.text === 'domain') {
      console.log('Using domain grouping for new tab');
      await handleDomainGroupingForTab(tab);
      return;
    }

    // Get current config for AI grouping
    const config = provider === 'azure-openai' ? azureConfig : siliconConfig;
    if (!config) {
      console.log('No config found for provider:', provider);
      return;
    }
    
    // Get all current groups and tabs, excluding the current tab
    existingGroups = await getAllGroupsAndTabs(tab.id);
    console.log('Retrieved current groups and tabs:', 
      Array.from(existingGroups.entries()).map(([name, group]) => ({
        name,
        id: group.groupId,
        tabCount: group.tabs.length
      }))
    );

    // Ensure tab has loaded
    const loadedTab = await waitForTabLoad(tab.id);
    if (!loadedTab || !loadedTab.url || 
      blankPagePatterns.some(pattern => loadedTab.url === pattern) ||
      loadedTab.url.startsWith('about:blank?')) {
        console.log('Skipping empty or new tab page');
        return;
    }

    console.log('Processing new tab:', loadedTab.title);

    // Get AI decision for the new tab
    // Log existing groups before decision
    console.log('Current groups before decision:', 
      Array.from(existingGroups.entries()).map(([name, group]) => ({
        name,
        id: group.groupId,
        tabCount: group.tabs.length
      }))
    );

    // Use correct provider's decideTabGrouping function
    const decideTabGroupingFn = provider === 'azure-openai' 
      ? AzureOpenAI.decideTabGrouping 
      : SiliconFlow.decideTabGrouping;
    
    const groupDecision = await decideTabGroupingFn(loadedTab, config as any, existingGroups);
    if (!groupDecision) {
      console.log('No grouping decision received, leaving tab ungrouped');
      return;
    }

    if (loadedTab.id) {
      const colors: chrome.tabGroups.ColorEnum[] = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan"];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      // Check for existing group with same name regardless of decision type
      const existingGroup = Array.from(existingGroups.entries()).find(
        ([title, _]) => title.toLowerCase().trim() === groupDecision.groupTitle.toLowerCase().trim()
      );

      if (existingGroup) {
        // Always use existing group if name matches
        const [groupTitle, group] = existingGroup;
        console.log('Found existing group with name:', groupTitle);
        
        const tabIds = [loadedTab.id] as number[];
        await chrome.tabs.group({
          tabIds,
          groupId: group.groupId
        });

        // Update color for visual consistency
        await chrome.tabGroups.update(group.groupId, {
          color: randomColor
        });
        
        // Update the existing group's tabs
        group.tabs.push({
          id: loadedTab.id,
          title: loadedTab.title || '',
          url: loadedTab.url || ''
        });
        
        console.log('Added tab to existing group:', groupTitle);
      } else {
        console.log('Creating new group:', groupDecision.groupTitle);
        const tabIds = [loadedTab.id] as number[];
        const groupId = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, {
          title: groupDecision.groupTitle,
          color: randomColor
        });

        // Update existingGroups using title as key
        existingGroups.set(groupDecision.groupTitle, {
          groupId,
          tabs: [{
            id: loadedTab.id,
            title: loadedTab.title || '',
            url: loadedTab.url || ''
          }]
        });
      }

      // Log groups after update
      console.log('Current groups after update:', 
        Array.from(existingGroups.entries()).map(([name, group]) => ({
          name,
          id: group.groupId,
          tabCount: group.tabs.length
        }))
      );
    }
  } catch (error: unknown) {
    console.error('Error handling new tab:', error);
  }
}

// Listen for tab URL updates
console.log('Event listener registered: chrome.tabs.onUpdated');
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    console.log(`Tab ${tabId} URL changed to: ${changeInfo.url}`);
    handleAutoGroupSingleTab(tab);
  }
});

console.log('TabGenius background script loaded with domain and AI grouping functionality');
