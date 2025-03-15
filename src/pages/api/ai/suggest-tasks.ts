import { GoogleGenerativeAI } from '@google/generative-ai';
import { TaskSuggestion } from '../../../types/task';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

export async function suggestTasks(projectData: any, knowledgeBase: any, existingTasks: any): Promise<TaskSuggestion[]> {
  try {
    // Prepare the prompt
    const prompt = `As an AI project management assistant, analyze the following project information and suggest 5 new tasks:

Project Details:
${JSON.stringify(projectData, null, 2)}

Team Knowledge Base:
${JSON.stringify(knowledgeBase, null, 2)}

Existing Tasks:
${JSON.stringify(existingTasks, null, 2)}

Please suggest 5 new tasks in the following JSON format:
[
  {
    "title": "Task title",
    "description": "Detailed task description",
    "priority": "low|medium|high",
    "estimated_hours": number,
    "suggested_assignee": "team member name based on skills"
  }
]

Consider team members' skills, existing workload, and project progress when making suggestions.`;

    // Generate content using Gemini
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse and validate the response
    let suggestions: TaskSuggestion[];
    try {
      suggestions = JSON.parse(text);
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
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