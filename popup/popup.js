// Handle AI Group button and menu item clicks
document.querySelector('.ai-group-btn').addEventListener('click', handleAIGroup);
document.querySelector('.option:has(.option-text:contains("Group by AI"))').addEventListener('click', handleAIGroup);

async function handleAIGroup() {
  try {
    // Get all tabs in current window
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    if (tabs.length < 2) {
      alert('Need at least 2 tabs to group');
      return;
    }

    // Collect tab info for AI analysis
    const tabInfo = tabs.map(tab => ({
      id: tab.id,
      title: tab.title,
      url: tab.url
    }));

    // Send to background script for processing
    chrome.runtime.sendMessage({
      action: 'groupByAI',
      tabs: tabInfo
    });

    window.close(); // Close popup after initiating grouping
  } catch (error) {
    console.error('AI Grouping failed:', error);
    alert('AI Grouping failed, check console for details');
  }
}

// Existing random group code
document.getElementById('randomGroupBtn')?.addEventListener('click', async () => {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    if (tabs.length < 2) {
      alert('At least 2 tabs');
      return;
    }

    const selectedTabs = getRandomTabs(tabs, 2);
    
    const groupId = await chrome.tabs.group({
      tabIds: selectedTabs.map(tab => tab.id),
      createProperties: {
        windowId: tabs[0].windowId
      }
    });

    const colors = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan"];
    await chrome.tabGroups.update(groupId, {
      title: `Random Group-${Date.now().toString(36)}`,
      color: colors[Math.floor(Math.random() * colors.length)]
    });

    alert(`Already Create ${selectedTabs.length} Group`);
  } catch (error) {
    console.error('Group failed:', error);
    alert('Group failed, check console');
  }
});

function getRandomTabs(tabs, min=2) {
  const count = Math.max(min, Math.floor(Math.random() * tabs.length));
  const shuffled = tabs.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
