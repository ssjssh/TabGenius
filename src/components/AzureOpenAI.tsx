import { AzureConfig, OpenAIResponse, TabInfo } from '../types';

export async function validateConfig(config: AzureConfig): Promise<void> {
  if (!config.endpoint || !config.apiKey || !config.deploymentName) {
    throw new Error('Incomplete configuration');
  }

  // Test the API with a simple request
  const endpoint = `${config.endpoint}/openai/deployments/${config.deploymentName}/chat/completions?api-version=2023-05-15`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.apiKey
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
    throw new Error(`API test failed: ${response.status} - ${text}`);
  }
}

export async function categorizeTabs(tabs: { title: string; url: string }[], config: AzureConfig): Promise<Record<string, number[]>> {
  const endpoint = `${config.endpoint}/openai/deployments/${config.deploymentName}/chat/completions?api-version=2023-05-15`;
  console.log('Sending request to:', endpoint);

  try {
    console.log('Making Azure OpenAI request for categorization');
    const prompt = `Categorize these tabs into groups:\n${JSON.stringify(tabs, null, 2)}`;
    console.log('Sending prompt:', prompt);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "You are a tab categorization assistant. Given a list of browser tabs, group them into 2-10 meaningful categories. The response should be ONLY a JSON object where keys are category names and values are arrays of tab indices (0-based). Example format: {\"Work\": [0,3,5], \"Social\": [1,4], \"News\": [2,6]}"
          },
          {
            role: "user",
            content: `Categorize these tabs into groups:\n${JSON.stringify(tabs, null, 2)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 800
      })
    });

    console.log('Response status:', response.status);
    const responseText = await response.text();
    console.log('Raw response:', responseText);

    if (!response.ok) {
      throw new Error(`Azure OpenAI API error: ${response.status} - ${responseText}`);
    }

    const data = JSON.parse(responseText) as OpenAIResponse;
    const categoriesText = data.choices[0].message.content;
    console.log('Categories from Azure:', categoriesText);
    
    // Remove markdown formatting and clean up whitespace/line breaks
    const cleanJson = categoriesText
      .replace(/```json\n|\n```|```/g, '')  // Remove markdown code blocks
      .replace(/\r?\n|\r/g, '')            // Remove all types of line breaks
      .replace(/\s+/g, ' ')                // Normalize whitespace
      .trim();                             // Remove leading/trailing whitespace
    console.log('Cleaned JSON:', cleanJson);
    
    const categories = JSON.parse(cleanJson);
    if (typeof categories !== 'object' || categories === null) {
      throw new Error('Invalid response format: not an object');
    }

    return categories;
  } catch (error) {
    console.error('Error calling Azure OpenAI:', error);
    throw error;
  }
}

interface GroupDecision {
  type: 'existing' | 'new';
  groupId?: number;
  groupTitle: string;
  color?: chrome.tabGroups.ColorEnum;
}

export async function decideTabGrouping(
  newTab: chrome.tabs.Tab,
  config: AzureConfig,
  existingGroups: Map<string, { groupId: number; tabs: TabInfo[] }>
): Promise<GroupDecision | null> {
  if (!newTab.url || !newTab.title) return null;
  
  const endpoint = `${config.endpoint}/openai/deployments/${config.deploymentName}/chat/completions?api-version=2023-05-15`;

  try {
    const context = {
      newTab: {
        title: newTab.title,
        url: new URL(newTab.url).hostname
      },
      existingGroups: Array.from(existingGroups.entries()).map(([name, group]) => ({
        id: group.groupId,
        name,
        tabs: group.tabs.map(tab => ({
          title: tab.title || '',
          url: new URL(tab.url || '').hostname
        }))
      }))
    };

    const prompt = `Decide grouping for this tab:\n${JSON.stringify(context, null, 2)}`;
    console.log('Sending prompt:', prompt);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: `You are a tab grouping assistant that helps organize browser tabs into meaningful groups. Your task is to decide whether a new tab should join an existing group or start a new group.

GROUPING CRITERIA:
1. Content Similarity: Check if the new tab's content aligns with any existing group's purpose
2. Topic Relationship: Look for semantic relationships between topics (e.g., 'React docs' and 'JavaScript tutorial' are related)
3. User Intent: Consider if tabs might be part of the same task or workflow
4. Domain Context: While not the only factor, related domains can indicate relationship

DECISION PROCESS:
1. First analyze the new tab's title and URL to understand its purpose
2. Review each existing group's tabs and title to understand their themes
3. Check for strong content/topic matches with existing groups
4. If no good match exists, suggest a meaningful new group name

Respond with ONLY a JSON object:
- To add to existing group: {"action": "add", "name": "Existing Group Name"}
- To create new group: {"action": "new", "name": "New Group Name"}

Example decisions:
- New tab 'React Hooks Guide' should join a group containing 'React Components Tutorial'
- New tab 'CNN News' should join a group named 'News' containing other news sites
- New tab 'Python Job Listing' should create new 'Job Search' group if no job-related group exists`
          },
          {
            role: "user",
            content: `Decide grouping for this tab:\n${JSON.stringify(context, null, 2)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 100
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = JSON.parse(await response.text()) as OpenAIResponse;
    const decisionText = data.choices[0].message.content;
    
    // Clean up any markdown formatting from the response
    const cleanJson = decisionText
      .replace(/```json\n|\n```|```/g, '')  // Remove markdown code blocks
      .replace(/\r?\n|\r/g, '')            // Remove all types of line breaks
      .replace(/\s+/g, ' ')                // Normalize whitespace
      .trim();                             // Remove leading/trailing whitespace
    console.log('Cleaned decision JSON:', cleanJson);
    
    const decision = JSON.parse(cleanJson);

    // Handle both 'new' and 'add' actions with the same logic
    if ((decision.action === 'new' || decision.action === 'add') && decision.name) {
      const groupName = decision.name;
      // Look for existing group with same name (case insensitive)
      const existingGroup = Array.from(existingGroups.entries()).find(
        ([groupTitle, _]) => groupTitle.toLowerCase().trim() === groupName.toLowerCase().trim()
      );

      // Return existing group if found
      if (existingGroup) {
        const [groupTitle, group] = existingGroup;
        return {
          type: 'existing',
          groupId: group.groupId,
          groupTitle: groupTitle
        };
      }

      // Only create new group if the action is 'new'
      if (decision.action === 'new') {
        return {
          type: 'new',
          groupTitle: groupName,
          color: ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan"][Math.floor(Math.random() * 8)] as chrome.tabGroups.ColorEnum
        };
      }
    }
  } catch (error) {
    console.error('Error getting grouping decision:', error);
  }

  return null;
}
