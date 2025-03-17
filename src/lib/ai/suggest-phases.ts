import { GoogleGenerativeAI } from '@google/generative-ai';
import type { PhaseSuggestion } from '../../types/phase';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export async function suggestPhases(projectData: any, teamData: any, existingPhases: any, existingTasks: any = []): Promise<PhaseSuggestion[]> {
  try {
    // Extract documentation from teamData
    const documentation = teamData.documentation || { documents: [], faqs: [], resources: [] };
    
    // Format documentation for the prompt
    let documentationText = '';
    
    // Add documents
    if (documentation.documents && documentation.documents.length > 0) {
      documentationText += '\nProject Documentation:\n';
      documentation.documents.forEach((doc: any, index: number) => {
        documentationText += `Document ${index + 1}: ${doc.title}\n`;
        documentationText += `Category: ${doc.category || 'General'}\n`;
        documentationText += `Content: ${doc.content}\n\n`;
      });
    }
    
    // Add FAQs
    if (documentation.faqs && documentation.faqs.length > 0) {
      documentationText += '\nProject FAQs:\n';
      documentation.faqs.forEach((faq: any, index: number) => {
        documentationText += `Q${index + 1}: ${faq.question}\n`;
        documentationText += `A${index + 1}: ${faq.answer}\n\n`;
      });
    }
    
    // Add resources
    if (documentation.resources && documentation.resources.length > 0) {
      documentationText += '\nProject Resources:\n';
      documentation.resources.forEach((resource: any, index: number) => {
        documentationText += `Resource ${index + 1}: ${resource.title}\n`;
        documentationText += `Type: ${resource.type}\n`;
        documentationText += `URL: ${resource.url}\n`;
        if (resource.description) documentationText += `Description: ${resource.description}\n`;
        documentationText += '\n';
      });
    }
    
    // Extract existing phase names for easier comparison
    const existingPhaseNames = existingPhases.map((phase: any) => phase.name.toLowerCase());
    
    // Prepare the prompt
    const prompt = `You are a project management AI assistant. Based on the following project information, suggest 5 logical project phases.
Return ONLY a JSON array without any markdown formatting or additional text.

Project Details:
${JSON.stringify(projectData, null, 2)}

Team Knowledge Base:
${JSON.stringify(teamData.team || [], null, 2)}

${documentationText}

Existing Phases:
${JSON.stringify(existingPhases, null, 2)}

Existing Tasks:
${JSON.stringify(existingTasks, null, 2)}

Format each phase exactly like this, with no additional fields or text:
[
  {
    "name": "string",
    "description": "string",
    "suggested_status": "pending" | "in_progress" | "completed" | "cancelled",
    "suggested_sequence_order": number,
    "estimated_start_date": "YYYY-MM-DD",
    "estimated_end_date": "YYYY-MM-DD",
    "suggested_tasks": ["Task description 1", "Task description 2", "Task description 3"]
  }
]

Important: 
- DO NOT suggest phases with names identical or very similar to existing phases
- DO NOT duplicate any existing phases
- Create phases that are logical, sequential, and follow standard project management practices
- For sequence_order, start with 1 and increment sequentially
- Make sure start and end dates are within the project's timeframe
- Include 3-5 suggested tasks for each phase
- If the project already has phases, suggest ONLY new phases that complement or extend the existing ones
- If all basic phases already exist, suggest more specialized or advanced phases
- Use the project documentation, FAQs, and resources to inform your phase suggestions
- Ensure phases align with technical requirements and project goals mentioned in the documentation`;

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
    let suggestions: PhaseSuggestion[];
    try {
      suggestions = JSON.parse(text);
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      console.error('Raw response:', text);
      throw new Error('Failed to generate valid phase suggestions');
    }

    // Validate suggestions
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      throw new Error('Invalid phase suggestions format');
    }

    // Filter out suggestions that are too similar to existing phases
    suggestions = suggestions.filter((suggestion) => {
      const suggestionName = suggestion.name.toLowerCase();
      
      // Check for exact match or high similarity with existing phase names
      const isTooSimilar = existingPhaseNames.some((existingName: string) => {
        // Check for exact match
        if (suggestionName === existingName) {
          return true;
        }
        
        // Check if one is a substring of the other (indicating high similarity)
        if (suggestionName.includes(existingName) || existingName.includes(suggestionName)) {
          return true;
        }
        
        return false;
      });
      
      return !isTooSimilar;
    });
    
    // If all suggestions were filtered out, create a message
    if (suggestions.length === 0) {
      return [{
        name: "No New Phases Suggested",
        description: "All appropriate phases for this project already exist. Consider refining existing phases or adding specific tasks to them.",
        suggested_status: "pending",
        suggested_sequence_order: 1,
        estimated_start_date: null,
        estimated_end_date: null,
        suggested_tasks: ["Review existing phases", "Add specific tasks to existing phases", "Consider project milestones within phases"]
      }];
    }

    // Validate each suggestion
    suggestions.forEach((phase) => {
      if (!phase.name || !phase.description || !phase.suggested_sequence_order) {
        throw new Error('Invalid phase suggestion format: missing required fields');
      }

      if (!['pending', 'in_progress', 'completed', 'cancelled'].includes(phase.suggested_status)) {
        phase.suggested_status = 'pending';
      }

      if (typeof phase.suggested_sequence_order !== 'number' || phase.suggested_sequence_order <= 0) {
        phase.suggested_sequence_order = 1;
      }

      // Ensure dates are valid or null
      try {
        if (phase.estimated_start_date) new Date(phase.estimated_start_date);
        if (phase.estimated_end_date) new Date(phase.estimated_end_date);
      } catch (error) {
        phase.estimated_start_date = null;
        phase.estimated_end_date = null;
      }

      // Ensure suggested_tasks is an array
      if (!Array.isArray(phase.suggested_tasks)) {
        phase.suggested_tasks = [];
      }
    });

    return suggestions;
  } catch (error) {
    console.error('Error generating phase suggestions:', error);
    throw error;
  }
} 