import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../../lib/supabase';
import { suggestPhases } from '../../../lib/ai/suggest-phases';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication using supabase directly
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !sessionData.session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const session = sessionData.session;
    const userId = session.user.id;

    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Check if the user has access to the project
    const { data: projectAccess, error: projectError } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError || !projectAccess) {
      return res.status(403).json({ error: 'You do not have access to this project' });
    }

    // Get project data
    const { data: projectData, error: projectDataError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectDataError || !projectData) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get team members data for the knowledge base
    const { data: teamMembers, error: teamError } = await supabase
      .from('project_members')
      .select(`
        user_id,
        role,
        users (
          id,
          full_name,
          email,
          role
        )
      `)
      .eq('project_id', projectId);

    if (teamError) {
      console.error('Error fetching team members:', teamError);
      return res.status(500).json({ error: 'Failed to fetch team members' });
    }

    // Get knowledge base entries
    const { data: knowledgeBase, error: kbError } = await supabase
      .from('project_knowledge_base')
      .select('*')
      .eq('project_id', projectId);

    if (kbError) {
      console.error('Error fetching knowledge base:', kbError);
      return res.status(500).json({ error: 'Failed to fetch knowledge base' });
    }

    // Get project documentation
    const { data: projectDocuments, error: docsError } = await supabase
      .from('project_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (docsError) {
      console.error('Error fetching project documents:', docsError);
      return res.status(500).json({ error: 'Failed to fetch project documents' });
    }

    // Get project FAQs
    const { data: projectFaqs, error: faqsError } = await supabase
      .from('project_faqs')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (faqsError) {
      console.error('Error fetching project FAQs:', faqsError);
      return res.status(500).json({ error: 'Failed to fetch project FAQs' });
    }

    // Get project resources
    const { data: projectResources, error: resourcesError } = await supabase
      .from('project_resources')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (resourcesError) {
      console.error('Error fetching project resources:', resourcesError);
      return res.status(500).json({ error: 'Failed to fetch project resources' });
    }

    // Get existing phases
    const { data: existingPhases, error: phasesError } = await supabase
      .from('project_phases')
      .select('*')
      .eq('project_id', projectId)
      .order('sequence_order', { ascending: true });

    if (phasesError) {
      console.error('Error fetching existing phases:', phasesError);
      return res.status(500).json({ error: 'Failed to fetch existing phases' });
    }

    // Prepare AI inputs
    const aiProjectData = {
      id: projectData.id,
      name: projectData.name,
      description: projectData.description,
      objectives: projectData.objectives,
      start_date: projectData.start_date,
      end_date: projectData.end_date,
      status: projectData.status,
    };

    // Generate phase suggestions
    const suggestions = await suggestPhases(
      aiProjectData,
      {
        team: teamMembers,
        knowledge: knowledgeBase,
        documentation: {
          documents: projectDocuments || [],
          faqs: projectFaqs || [],
          resources: projectResources || []
        }
      },
      existingPhases,
      [] // Empty array for existingTasks parameter
    );

    return res.status(200).json({ suggestions });
  } catch (error: any) {
    console.error('Error in suggest-phases API:', error);
    return res.status(500).json({ error: error.message || 'An error occurred during phase suggestion' });
  }
} 


