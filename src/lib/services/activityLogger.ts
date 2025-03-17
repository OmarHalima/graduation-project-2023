import { supabase } from '../supabase';
import { format } from 'date-fns';
import type { ActivityType } from '../../types/activity';
import type { User } from '../../types/auth';

/**
 * Logs an activity and updates project documentation
 */
export async function logActivity({
  projectId,
  userId,
  activityType,
  title,
  description,
  relatedEntityId = null,
  relatedEntityType = null,
  metadata = {}
}: {
  projectId: string;
  userId: string;
  activityType: ActivityType;
  title: string;
  description: string;
  relatedEntityId?: string | null;
  relatedEntityType?: string | null;
  metadata?: any;
}) {
  try {
    // Get user information
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    // Insert into activity logs
    const { data: activityData, error: activityError } = await supabase
      .from('project_activity_logs')
      .insert([
        {
          project_id: projectId,
          user_id: userId,
          activity_type: activityType,
          title,
          description,
          related_entity_id: relatedEntityId,
          related_entity_type: relatedEntityType,
          metadata: {
            ...metadata,
            created_by: userId,
            created_by_name: userData?.full_name || 'Unknown User'
          }
        }
      ])
      .select()
      .single();

    if (activityError) throw activityError;

    // Determine document title based on activity type
    let docTitle = '';
    switch (activityType) {
      case 'task_completed':
        docTitle = 'Task Logs';
        break;
      case 'phase_completed':
        docTitle = 'Phase Logs';
        break;
      case 'decision':
        docTitle = 'Project Decisions Log';
        break;
      case 'note':
        docTitle = 'Project Notes Log';
        break;
      default:
        docTitle = 'Project Activity Log';
    }

    const category = getCategoryFromActivityType(activityType);

    // Check if document already exists - also check for legacy document titles
    const { data: existingDoc, error: docError } = await supabase
      .from('project_documents')
      .select('id, content, title')
      .eq('project_id', projectId)
      .or(`title.eq.${docTitle},title.eq.Completed Tasks Log,title.eq.Project Phases Progress`)
      .eq('category', category)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    let docContent = '';
    const currentDate = format(new Date(), 'yyyy-MM-dd');
    
    // Format entry based on activity type
    const entryContent = formatActivityEntry(activityType, {
      title,
      description,
      userName: userData?.full_name || 'Unknown User',
      date: currentDate,
      metadata
    });

    if (existingDoc) {
      // Update existing document
      docContent = existingDoc.content + '\n\n' + entryContent;
      
      const { error: updateError } = await supabase
        .from('project_documents')
        .update({ 
          content: docContent,
          title: docTitle, // Ensure we update to the new title format
          updated_at: new Date().toISOString()
        })
        .eq('id', existingDoc.id);
      
      if (updateError) throw updateError;
    } else {
      // Create new document
      docContent = getDocumentHeader(activityType) + '\n\n' + entryContent;
      
      const { error: insertError } = await supabase
        .from('project_documents')
        .insert([{
          project_id: projectId,
          title: docTitle,
          content: docContent,
          category: category,
          created_by: userId
        }]);
      
      if (insertError) throw insertError;
    }

    return activityData;
  } catch (error) {
    console.error('Error logging activity:', error);
    throw error;
  }
}

/**
 * Formats an activity entry based on its type
 */
function formatActivityEntry(
  activityType: ActivityType, 
  data: { 
    title: string; 
    description: string; 
    userName: string; 
    date: string;
    metadata: any;
  }
): string {
  const { title, description, userName, date, metadata } = data;
  
  switch (activityType) {
    case 'task_completed':
      return `### ${title} (${date})\n` +
        `**Completed by:** ${userName}\n` +
        `**Phase:** ${metadata.phase_name || 'No Phase'}\n` +
        `**Description:** ${description}\n` +
        `**Priority:** ${metadata.priority || 'Not set'}\n` +
        (metadata.estimated_hours ? `**Estimated Hours:** ${metadata.estimated_hours}\n` : '') +
        (metadata.due_date ? `**Due Date:** ${format(new Date(metadata.due_date), 'yyyy-MM-dd')}\n` : '');
    
    case 'phase_completed':
      return `### ${title} - Completed (${date})\n` +
        `**Description:** ${description}\n` +
        `**Tasks Completed:** ${metadata.task_count || 0}\n` +
        `**Phase Duration:** ${
          metadata.start_date && metadata.end_date 
            ? `${format(new Date(metadata.start_date), 'yyyy-MM-dd')} to ${format(new Date(metadata.end_date), 'yyyy-MM-dd')}`
            : 'Not specified'
        }\n`;
    
    case 'decision':
    case 'note':
    default:
      return `### ${title} (${date})\n` +
        `**Added by:** ${userName}\n\n` +
        description;
  }
}

/**
 * Gets the document header based on activity type
 */
function getDocumentHeader(activityType: ActivityType): string {
  switch (activityType) {
    case 'task_completed':
      return '# Task Logs\n\n' +
        'This document automatically tracks completed tasks in the project.';
    
    case 'phase_completed':
      return '# Phase Logs\n\n' +
        'This document automatically tracks completed phases in the project.';
    
    case 'decision':
      return '# Project Decisions Log\n\n' +
        'This document tracks important decisions for the project.';
    
    case 'note':
      return '# Project Notes Log\n\n' +
        'This document tracks notes for the project.';
    
    default:
      return '# Project Activity Log\n\n' +
        'This document tracks activities for the project.';
  }
}

/**
 * Gets the document category based on activity type
 */
function getCategoryFromActivityType(activityType: ActivityType): string {
  switch (activityType) {
    case 'task_completed':
      return 'Task Logs';
    case 'phase_completed':
      return 'Phase Logs';
    case 'decision':
      return 'Decisions';
    case 'note':
      return 'Notes';
    default:
      return 'Project Progress';
  }
} 