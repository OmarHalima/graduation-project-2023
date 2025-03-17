import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service key for admin access
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateDocuments() {
  console.log('Starting document migration...');
  
  try {
    // 1. Update task log documents
    const { data: taskLogs, error: taskError } = await supabase
      .from('project_documents')
      .update({
        title: 'Task Logs',
        category: 'Task Logs'
      })
      .eq('title', 'Completed Tasks Log')
      .eq('category', 'Project Progress');
    
    if (taskError) {
      console.error('Error updating task logs:', taskError);
    } else {
      console.log('Updated task logs successfully');
    }
    
    // 2. Update phase log documents
    const { data: phaseLogs, error: phaseError } = await supabase
      .from('project_documents')
      .update({
        title: 'Phase Logs',
        category: 'Phase Logs'
      })
      .eq('title', 'Project Phases Progress')
      .eq('category', 'Project Progress');
    
    if (phaseError) {
      console.error('Error updating phase logs:', phaseError);
    } else {
      console.log('Updated phase logs successfully');
    }
    
    // 3. Get count of documents for verification
    const { count, error: countError } = await supabase
      .from('project_documents')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error getting document count:', countError);
    } else {
      console.log(`Total documents in system: ${count}`);
    }
    
    // 4. List all unique categories for verification
    const { data: categories, error: catError } = await supabase
      .from('project_documents')
      .select('category')
      .not('category', 'is', null);
    
    if (catError) {
      console.error('Error getting categories:', catError);
    } else {
      const uniqueCategories = [...new Set(categories.map(doc => doc.category))];
      console.log('Current categories in system:', uniqueCategories);
    }
    
    console.log('Document migration completed');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the migration
migrateDocuments(); 