import { GoogleGenerativeAI } from '@google/generative-ai';
import { TaskSuggestion } from '../../types/task';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export async function suggestTasks(projectData: any, knowledgeBase: any, existingTasks: any): Promise<TaskSuggestion[]> {
  try {
    // Prepare the prompt
    const prompt = `You are a project management AI assistant. Based on the following project information, suggest 5 new tasks.
Return ONLY a JSON array without any markdown formatting or additional text.

Project Details:
${JSON.stringify(projectData, null, 2)}

Team Knowledge Base:
${JSON.stringify(knowledgeBase, null, 2)}

Existing Tasks:
${JSON.stringify(existingTasks, null, 2)}

Format each task exactly like this, with no additional fields or text:
[
  {
    "title": "string",
    "description": "string",
    "priority": "low" | "medium" | "high",
    "estimated_hours": number,
    "suggested_assignee": "full_name_of_team_member"
  }
]

Important: For suggested_assignee, use the team member's full name (e.g. "John Smith") from the team knowledge base, not their ID.`;

    // Generate content using Gemini
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Remove any markdown formatting if present
    if (text.includes('```')) {
      text = text.replace(/```json\n/g, '').replace(/```\n/g, '').replace(/```/g, '');
    }

    // Clean up any leading/trailing whitespace
    text = text.trim();

    // Parse and validate the response
    let suggestions: TaskSuggestion[];
    try {
      suggestions = JSON.parse(text);
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      console.error('Raw response:', text);
      throw new Error('Failed to generate valid task suggestions');
    }

    // Validate suggestions
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      throw new Error('Invalid task suggestions format');
    }

    // Validate each suggestion
    suggestions.forEach((task) => {
      if (!task.title || !task.description || !task.priority || !task.estimated_hours || !task.suggested_assignee) {
        throw new Error('Invalid task suggestion format: missing required fields');
      }

      if (!['low', 'medium', 'high'].includes(task.priority)) {
        task.priority = 'medium';
      }

      if (typeof task.estimated_hours !== 'number' || task.estimated_hours <= 0) {
        task.estimated_hours = 4;
      }
    });

    return suggestions;
  } catch (error) {
    console.error('Error generating task suggestions:', error);
    throw error;
  }
} 