import { GoogleGenerativeAI } from '@google/generative-ai';
import { Task, TaskSuggestion } from '../../types/task';
import { supabase } from '../../lib/supabase';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

/**
 * Enhances existing tasks with AI-powered suggestions for missing properties
 * like user assignments, estimated hours, and priorities
 */
export async function enhanceTasks(
  tasks: Task[], 
  projectId: string
): Promise<TaskSuggestion[]> {
  try {
    // Fetch project data
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError) throw projectError;

    // Fetch team members with their details
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
      .eq('project_id', projectId);

    if (teamError) throw teamError;

    // Get user IDs from team members
    const userIds = teamMembers?.map((member: any) => member.user_id) || [];
    
    // Fetch users to verify they exist in the users table
    const { data: validUsers, error: usersError } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', userIds);
      
    if (usersError) {
      console.error('Error fetching valid users:', usersError);
      throw usersError;
    }
    
    // Create a map of valid user IDs for quick lookups
    const validUserIds = new Map();
    validUsers?.forEach((user: any) => {
      validUserIds.set(user.id, user.full_name);
    });
    
    // Get CV data for team members
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

    if (cvError) console.error('Error fetching CV data:', cvError);
    
    // Fetch project education data
    const { data: educationData, error: eduError } = await supabase
      .from('project_education')
      .select('*')
      .eq('project_id', projectId)
      .in('user_id', userIds);
      
    if (eduError) console.error('Error fetching education data:', eduError);
    
    // Fetch project experience data
    const { data: experienceData, error: expError } = await supabase
      .from('project_experience')
      .select('*')
      .eq('project_id', projectId)
      .in('user_id', userIds);
      
    if (expError) console.error('Error fetching experience data:', expError);

    // Fetch interview results if available
    const { data: interviewData, error: interviewError } = await supabase
      .from('user_interviews')
      .select('*')
      .in('user_id', userIds);
      
    if (interviewError) console.error('Error fetching interview data:', interviewError);
    
    // Fetch project phases for context
    const { data: phases, error: phaseError } = await supabase
      .from('project_phases')
      .select('*')
      .eq('project_id', projectId)
      .order('sequence_order', { ascending: true });

    if (phaseError) console.error('Error fetching project phases:', phaseError);

    // Prepare the prompt
    const prompt = `You are an AI project management assistant. Analyze the following tasks and enhance them with appropriate missing properties.
Return ONLY a JSON array without any markdown formatting or additional text.

Project Details:
${JSON.stringify(projectData, null, 2)}

Project Phases:
${JSON.stringify(phases, null, 2)}

Team Members:
${JSON.stringify(teamMembers, null, 2)}

Team Member CV Data:
${JSON.stringify(cvData, null, 2)}

Team Member Education:
${JSON.stringify(educationData, null, 2)}

Team Member Experience:
${JSON.stringify(experienceData, null, 2)}

Team Member Interviews:
${JSON.stringify(interviewData, null, 2)}

Valid User IDs (users that exist in the database):
${JSON.stringify(Array.from(validUserIds.entries()), null, 2)}

Tasks to Enhance:
${JSON.stringify(tasks, null, 2)}

For each task in the list, provide enhanced properties in the following JSON format:
[
  {
    "id": "task_id_from_input",
    "title": "original_task_title",
    "assigned_to": "user_id_of_best_fit_team_member",
    "suggested_assignee": "full_name_of_best_fit_team_member",
    "priority": "low" | "medium" | "high" | "urgent",
    "estimated_hours": number,
    "rationale": "Brief explanation of why this team member is the best fit for this task, highlighting their skills, department, position, experience, etc. that make them suitable. Also explain the priority and hour estimation logic."
  }
]

Important:
- ONLY use user IDs from the "Valid User IDs" list to ensure database integrity
- Make smart assignments based on team member department, position, skills, experience, and interview results
- Assign appropriate priorities based on task importance, dependencies, and project timeline
- Estimate hours realistically based on task complexity and similar past tasks
- Provide a concise rationale for your choices to help project managers understand your reasoning
- For assigned_to, use the user ID from the team members data
- For suggested_assignee, use the team member's full name for display purposes`;

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
    let enhancedTasks: TaskSuggestion[];
    try {
      enhancedTasks = JSON.parse(text);
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      console.error('Raw response:', text);
      throw new Error('Failed to generate valid task enhancements');
    }

    // Validate the enhancements and ensure required fields
    if (!Array.isArray(enhancedTasks) || enhancedTasks.length === 0) {
      throw new Error('Invalid task enhancements format');
    }

    // Add any missing fields and validate each task
    enhancedTasks = enhancedTasks.map(enhancement => {
      // Find the original task to preserve existing fields
      const originalTask = tasks.find(t => t.id === enhancement.id);
      
      if (!originalTask) {
        console.warn(`Original task with ID ${enhancement.id} not found`);
        return enhancement;
      }
      
      // Set defaults for missing values
      if (!enhancement.priority) {
        enhancement.priority = originalTask.priority || 'medium';
      }
      
      if (!enhancement.estimated_hours && enhancement.estimated_hours !== 0) {
        enhancement.estimated_hours = originalTask.estimated_hours || 4;
      }
      
      // Verify assigned_to is a valid user ID in our database
      if (enhancement.assigned_to) {
        if (!validUserIds.has(enhancement.assigned_to)) {
          console.warn(`User ID ${enhancement.assigned_to} does not exist in users table, setting to null`);
          enhancement.assigned_to = null;
          
          // Update suggested_assignee for consistency
          if (enhancement.suggested_assignee) {
            enhancement.suggested_assignee = 'Unassigned (user not found)';
          }
        } else if (!enhancement.suggested_assignee) {
          // If we have a valid user ID but no name, set the name from our valid users map
          enhancement.suggested_assignee = validUserIds.get(enhancement.assigned_to);
        }
      }
      
      // If we have a suggested_assignee but no assigned_to, try to find the ID
      if (!enhancement.assigned_to && enhancement.suggested_assignee) {
        // Try to find the team member ID from the name
        const teamMember = teamMembers?.find((member: any) => 
          member.user?.full_name === enhancement.suggested_assignee
        );
        
        if (teamMember && teamMember.user_id && validUserIds.has(teamMember.user_id)) {
          enhancement.assigned_to = teamMember.user_id;
        } else {
          // If we can't find a valid user ID, update the suggested_assignee for clarity
          enhancement.suggested_assignee = 'Unassigned (user not found)';
        }
      }
      
      return enhancement;
    });

    return enhancedTasks;
  } catch (error) {
    console.error('Error enhancing tasks:', error);
    throw error;
  }
} 