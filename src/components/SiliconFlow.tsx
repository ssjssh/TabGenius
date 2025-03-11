import { OpenAIResponse, SiliconConfig, TabInfo } from '../types';

export async function validateConfig(config: SiliconConfig): Promise<void> {
  console.log('SiliconFlow Config:', JSON.stringify(config, null, 2));

  if (!config.apiKey || !config.modelId) {
    throw new Error('Incomplete configuration');
  }

  // Test the API with a simple request
  const endpoint = 'https://api.siliconflow.cn/v1/chat/completions';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.modelId,
      messages: [
          {
            role: "user",
            content: "\nPlease respond with: {\"test\": [0]}"
          }
      ],
      temperature: 0.6,
      top_p: 0.95
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Silicon API test failed: ${response.status} - ${text}`);
  }
}

export async function categorizeTabs(tabs: { title: string; url: string }[], config: SiliconConfig): Promise<Record<string, number[]>> {
  const endpoint = 'https://api.siliconflow.cn/v1/chat/completions';
  console.log('Sending request to:', endpoint);

  try {
    console.log('Making Silicon API request for categorization');
    const prompt = `\nYou are a tab categorization assistant. Given a list of browser tabs, group them into 2-10 meaningful categories. 
The response should be ONLY a JSON object where keys are category names and values are arrays of tab indices (0-based). 
Example format: {"Work": [0,3,5], "Social": [1,4], "News": [2,6]}

Here are the tabs to categorize:
${JSON.stringify(tabs, null, 2)}`;
    console.log('Sending prompt:', prompt);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.modelId,
        messages: [
          {
            role: "user",
            content: `\nYou are a tab categorization assistant. Given a list of browser tabs, group them into 2-10 meaningful categories. 
The response should be ONLY a JSON object where keys are category names and values are arrays of tab indices (0-based). 
Example format: {"Work": [0,3,5], "Social": [1,4], "News": [2,6]}

Here are the tabs to categorize:
${JSON.stringify(tabs, null, 2)}`
          }
        ],
        temperature: 0.6,
        top_p: 0.95
      })
    });

    console.log('Response status:', response.status);
    const responseText = await response.text();
    console.log('Raw response:', responseText);

    if (!response.ok) {
      throw new Error(`Silicon API error: ${response.status} - ${responseText}`);
    }

    const data = JSON.parse(responseText) as OpenAIResponse;
    const categoriesText = data.choices[0].message.content;
    console.log('Categories from Silicon:', categoriesText);
    
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
    console.error('Error calling Silicon API:', error);
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
  config: SiliconConfig,
  existingGroups: Map<string, { groupId: number; tabs: TabInfo[] }>
): Promise<GroupDecision | null> {
  if (!newTab.url || !newTab.title) return null;
  
  const endpoint = 'https://api.siliconflow.cn/v1/chat/completions';

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

    const prompt = `\nYou are a tab grouping assistant that helps organize browser tabs into meaningful groups. 
Please analyze the following tab and decide whether it should join an existing group or start a new group.

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

Your response must be ONLY a JSON object:
- To add to existing group: {"action": "add", "name": "Existing Group Name"}
- To create new group: {"action": "new", "name": "New Group Name"}

For math problems, please show step-by-step reasoning and wrap final answers in \\boxed{}.

Here is the tab to analyze:
${JSON.stringify(context, null, 2)}`;
    console.log('Sending prompt:', prompt);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.modelId,
        messages: [
          {
            role: "user",
            content: `\nYou are a tab grouping assistant that helps organize browser tabs into meaningful groups. 
Please analyze the following tab and decide whether it should join an existing group or start a new group.

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

Your response must be ONLY a JSON object:
- To add to existing group: {"action": "add", "name": "Existing Group Name"}
- To create new group: {"action": "new", "name": "New Group Name"}

For math problems, please show step-by-step reasoning and wrap final answers in \\boxed{}.

Here is the tab to analyze:
${JSON.stringify(context, null, 2)}`
          }
        ],
        temperature: 0.6,
        top_p: 0.95
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
