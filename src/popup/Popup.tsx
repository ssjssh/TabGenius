import React, { useState, useEffect } from 'react';
import { Option } from '../components/Option';
import { Section } from '../components/Section';
import { GroupState, AzureConfig } from '../types';
import { Settings } from '../settings/Settings';
import { storageService } from '../services/storage';
import '../styles/global.css';

const getIconForOption = (section: keyof GroupState, value: string): string => {
  const iconMap: Record<keyof GroupState, Record<string, string>> = {
    grouping: {
      ai: '✨',
      domain: '🔗',
      cancel: '⊗'
    },
    autoGroup: {
      always: '⚫',
      disable: '⊗'
    },
    sortOrder: {
      desc: '↓',
      asc: '↑',
      disable: '⊗'
    }
  };

  return iconMap[section]?.[value] || '⊗';
};

export const Popup: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<GroupState>({
    grouping: 'ai',
    autoGroup: 'always',
    sortOrder: 'disable'
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load saved selections on mount
    const loadSavedSelections = async () => {
      try {
        const savedGrouping = await storageService.getSelection('grouping');
        const savedAutoGroup = await storageService.getSelection('autoGroup');
        const savedSortOrder = await storageService.getSelection('sortOrder');

        setSelectedOptions(prev => ({
          grouping: (savedGrouping?.text as GroupState['grouping']) || prev.grouping,
          autoGroup: (savedAutoGroup?.text as GroupState['autoGroup']) || prev.autoGroup,
          sortOrder: (savedSortOrder?.text as GroupState['sortOrder']) || prev.sortOrder
        }));
      } catch (error) {
        console.error('Error loading saved selections:', error);
      }
    };

    loadSavedSelections();

    // Check for Azure config on mount
    chrome.storage.sync.get(['azure_config'], (result) => {
      console.log('Current Azure config:', result.azure_config);
    });
  }, []);

  // Add or remove settings-open class and update window size
  useEffect(() => {
    const updateWindowSize = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.windowId) {
          const win = await chrome.windows.get(tab.windowId);
          if (win?.type === 'popup' && win.id) {
            await chrome.windows.update(win.id, {
              height: showSettings ? 1200 : 800
            });
          }
        }
      } catch (error) {
        console.error('Error updating window size:', error);
      }
    };

    if (showSettings) {
      document.body.classList.add('settings-open');
    } else {
      document.body.classList.remove('settings-open');
    }
    
    updateWindowSize();
  }, [showSettings]);

  const checkAndOpenApiKeyPage = () => {
    chrome.storage.sync.get(['azure_config'], (result) => {
      if (!result.azure_config) {
        console.log('No API key found, opening config page');
        chrome.windows.create({
          url: 'api-key.html',
          type: 'popup',
          width: 520,
          height: 1200
        });
      }
    });
  };

  const handleGroup = async () => {
    console.log('Group button clicked');
    setLoading(true);
    
    try {
      if (selectedOptions.grouping === 'cancel') {
        // Handle cancel group and prevent further grouping operations
        chrome.runtime.sendMessage({ action: 'cancelGroup' }, (response) => {
          console.log('Cancel group response:', response);
          if (response?.error) {
            alert(`Error: ${response.error}`);
          }
          setLoading(false);
        });
        
        // Disable the group button
        if (loading) {
          setLoading(false);
        }
        return;
      }

      // Prevent grouping operations when cancel is selected
      const currentGrouping = await storageService.getSelection('grouping');
      if (currentGrouping?.text === 'cancel') {
        console.log('Grouping is cancelled, not performing any group operations');
        setLoading(false);
        return;
      }

      // Only check Azure config for AI grouping
      if (selectedOptions.grouping === 'ai') {
        const config = await new Promise<AzureConfig | null>((resolve) => {
          chrome.storage.sync.get(['azure_config'], (result) => {
            resolve(result.azure_config || null);
          });
        });

        if (!config) {
          console.log('No API key found, opening config page');
          await chrome.windows.create({
            url: 'api-key.html',
            type: 'popup',
            width: 520,
            height: 1200
          });
          return;
        }
      }

      const tabs = await chrome.tabs.query({ currentWindow: true });
      console.log('Found tabs:', tabs);
      
      if (tabs.length < 2) {
        alert('Need at least 2 tabs to group');
        return;
      }

      // Include groupId and windowId in the tab info
      const tabInfo = tabs.map(tab => ({
        id: tab.id,
        title: tab.title ?? '',
        url: tab.url ?? '',
        groupId: tab.groupId,
        windowId: tab.windowId
      }));

      console.log('Sending tabs to background:', tabInfo);
      
      // Send message and wait for response
      chrome.runtime.sendMessage({
        action: selectedOptions.grouping === 'ai' ? 'groupByAI' : 'groupByDomain',
        tabs: tabInfo
      }, (response) => {
        console.log('Background response:', response);
        if (response?.error) {
          alert(`Error: ${response.error}`);
          if (response.error.includes('configuration')) {
            checkAndOpenApiKeyPage();
          }
        }
        setLoading(false);
      });
    } catch (error) {
      console.error('Error in handleAIGroup:', error);
      alert('Failed to group tabs. Check console for details.');
      setLoading(false);
    }
  };

  const handleOptionClick = async (section: keyof typeof selectedOptions, value: string) => {
    console.log('Option clicked:', section, value);
    
    try {
      // Save selection to storage
      await storageService.saveSelection(section, {
        id: `${section}-${value}`,
        text: value,
        icon: getIconForOption(section, value)
      });

      // Update state
      setSelectedOptions(prev => ({
        ...prev,
        [section]: value
      }));

    } catch (error) {
      console.error('Error saving selection:', error);
      alert('Failed to save selection. Please try again.');
    }
  };

  return (
    <div>
      <div className="header">
        <h1>TabGenius</h1>
        <button 
          className="button" 
          onClick={handleGroup}
          disabled={loading}
        >
          <span>{selectedOptions.grouping === 'ai' ? '✨' : selectedOptions.grouping === 'cancel' ? '⊗' : '🔗'}</span> 
          {loading ? 'Loading...' : 
           selectedOptions.grouping === 'ai' ? 'AI Group' : 
           selectedOptions.grouping === 'cancel' ? 'Cancel Group' : 
           'Domain Group'}
        </button>
      </div>

      <div className="content">
        <Section title="Group by">
        <Option
          icon="✨"
          text="Group by AI (Pro)"
          checked={selectedOptions.grouping === 'ai'}
          onClick={() => {
            handleOptionClick('grouping', 'ai');
          }}
        />
        <Option
          icon="🔗"
          text="Group by domain"
          checked={selectedOptions.grouping === 'domain'}
          onClick={() => handleOptionClick('grouping', 'domain')}
        />
        <Option
          icon="⊗"
          text="Cancel Group"
          checked={selectedOptions.grouping === 'cancel'}
          onClick={() => handleOptionClick('grouping', 'cancel')}
        />
      </Section>

      <Section title="Auto Grouping">
        <Option
          icon="⚫"
          text="Always"
          checked={selectedOptions.autoGroup === 'always'}
          onClick={() => handleOptionClick('autoGroup', 'always')}
        />
        <Option
          icon="⊗"
          text="Disable"
          checked={selectedOptions.autoGroup === 'disable'}
          onClick={() => handleOptionClick('autoGroup', 'disable')}
        />
      </Section>

      <Section title="Sort by Tab Count">
        <Option
          icon="↓"
          text="Descending"
          checked={selectedOptions.sortOrder === 'desc'}
          onClick={() => handleOptionClick('sortOrder', 'desc')}
        />
        <Option
          icon="↑"
          text="Ascending"
          checked={selectedOptions.sortOrder === 'asc'}
          onClick={() => handleOptionClick('sortOrder', 'asc')}
        />
        <Option
          icon="⊗"
          text="Disable"
          checked={selectedOptions.sortOrder === 'disable'}
          onClick={() => handleOptionClick('sortOrder', 'disable')}
        />
      </Section>

      {showSettings ? (
        <Settings onBack={() => setShowSettings(false)} />
      ) : (
        <>
          <Section title="Actions">
            <Option
              icon="⚙️"
              text="Settings"
              onClick={() => setShowSettings(true)}
            />
          </Section>
        </>
      )}
      </div>
    </div>
  );
};
