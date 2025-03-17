import { GoogleGenerativeAI } from '@google/generative-ai';
import { TaskSuggestion } from '../../types/task';
import { supabase } from '../../lib/supabase';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export async function suggestTasks(projectData: any, knowledgeBase: any, existingTasks: any): Promise<TaskSuggestion[]> {
  try {
    // If knowledgeBase is empty or missing key components, fetch the data again
    if (!knowledgeBase?.teamMembers || knowledgeBase.teamMembers.length === 0) {
      // Fetch enhanced team member details
      const { data: teamMembers, error: teamError } = await supabase
        .from('project_members')
        .select(`
          id,
          project_id,
          user_id,
          role,
          joined_at,
          user:users(
            id,
            full_name,
            email,
            avatar_url,
            department,
            position
          )
        `)
        .eq('project_id', projectData.id);

      if (teamError) {
        console.error('Error fetching team members:', teamError);
      } else {
        knowledgeBase = knowledgeBase || {};
        knowledgeBase.teamMembers = teamMembers || [];
      }
    }
    
    // Get user IDs for fetching additional data
    const userIds = knowledgeBase?.teamMembers?.map((member: any) => member.user_id) || [];
    
    // If CV data is missing, fetch it
    if (!knowledgeBase?.teamMemberCVs || knowledgeBase.teamMemberCVs.length === 0) {
      const { data: cvData, error: cvError } = await supabase
        .from('cv_parsed_data')
        .select(`
          user_id,
          education,
          skills,
          languages,
          certifications,
          work_experience
        `)
        .in('user_id', userIds);

      if (cvError) {
        console.error('Error fetching CV data:', cvError);
      } else {
        knowledgeBase = knowledgeBase || {};
        knowledgeBase.teamMemberCVs = cvData || [];
      }
    }
    
    // If interview data is missing, fetch it
    if (!knowledgeBase?.interviews || knowledgeBase.interviews.length === 0) {
      const { data: interviewData, error: interviewError } = await supabase
        .from('user_interviews')
        .select(`
          user_id,
          interview_date,
          notes,
          result
        `)
        .in('user_id', userIds);

      if (interviewError) {
        console.error('Error fetching interview data:', interviewError);
      } else {
        knowledgeBase = knowledgeBase || {};
        knowledgeBase.interviews = interviewData || [];
      }
    }
    
    // If project phases data is missing, fetch it
    if (!knowledgeBase?.projectPhases || knowledgeBase.projectPhases.length === 0) {
      const { data: projectPhases, error: phasesError } = await supabase
        .from('project_phases')
        .select('*')
        .eq('project_id', projectData.id)
        .order('sequence_order', { ascending: true });

      if (phasesError) {
        console.error('Error fetching project phases:', phasesError);
      } else {
        knowledgeBase = knowledgeBase || {};
        knowledgeBase.projectPhases = projectPhases || [];
      }
    }

    // Prepare the prompt
    const prompt = `You are an AI project management assistant. Based on the following project information, suggest 5 new tasks.
Return ONLY a JSON array without any markdown formatting or additional text.

Project Details:
${JSON.stringify(projectData, null, 2)}

Team Knowledge Base (including team member details, skills, interview results, and project phases):
${JSON.stringify(knowledgeBase, null, 2)}

Existing Tasks:
${JSON.stringify(existingTasks, null, 2)}

Format each task exactly like this, with no additional fields or text:
[
  {
    "title": "string",
    "description": "string",
    "priority": "low" | "medium" | "high" | "urgent",
    "estimated_hours": number,
    "suggested_assignee": "full_name_of_team_member",
    "suggested_phase": "name_of_phase",
    "suggested_due_date": "YYYY-MM-DD",
    "rationale": "Brief explanation of why this task is needed and why this team member is the best fit for it, citing their skills, department, position, or experience."
  }
]

Important: 
- For suggested_assignee, use the team member's full name (e.g. "John Smith") from the team knowledge base, not their ID.
- Make intelligent assignments based on team member department, position, skills, and past interview performance.
- For estimated_hours, provide a realistic estimation based on task complexity.
- For priority, assess task importance using "low", "medium", "high", or "urgent".
- For suggested_phase, suggest a logical project phase name that this task belongs to (e.g. "Planning", "Development", "Testing", etc.)
- The phase can be an existing one from project_phases or a new one you think would be appropriate.
- For suggested_due_date, provide a realistic date (YYYY-MM-DD format) that falls between the project start and end dates. If the task belongs to a specific phase, the due date should be before the phase end date (if available).
- Include a concise rationale explaining task importance and assignee fit.`;

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

    // Validate the suggestions and ensure required fields
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      throw new Error('Invalid task suggestions format');
    }

    // Process each suggestion to ensure it meets our requirements
    suggestions.forEach((task) => {
      // Validate title and description
      if (!task.title || !task.description) {
        throw new Error('Invalid task suggestion format: missing title or description');
      }

      // Validate and default priority if needed
      if (!task.priority || !['low', 'medium', 'high', 'urgent'].includes(task.priority)) {
        task.priority = 'medium';
      }

      // Validate and default estimated hours if needed
      if (typeof task.estimated_hours !== 'number' || task.estimated_hours <= 0) {
        task.estimated_hours = 4;
      }

      // Validate suggested_due_date format and fallback if needed
      if (task.suggested_due_date) {
        // Check if it's a valid date in YYYY-MM-DD format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(task.suggested_due_date)) {
          // If invalid format, set to undefined so it will be calculated later
          task.suggested_due_date = undefined;
        }
      }
      
      // For enhancement feature, ensure we have a rationale
      if (!task.rationale) {
        task.rationale = "Task created by AI suggestion system based on project requirements.";
      }
    });

    return suggestions;
  } catch (error) {
    console.error('Error generating task suggestions:', error);
    throw error;
  }
} 