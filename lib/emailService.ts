import { supabase } from './supabase';
import { 
  EmailTemplate, 
  getTaskAssignedTemplate,
  getTaskCompletedTemplate,
  getTaskDueTemplate
} from './emailTemplates';

interface ProjectMember {
  user: {
    email: string;
    full_name: string;
    role: string;
  };
}

export async function sendEmail(to: string, template: EmailTemplate) {
  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: {
        to,
        subject: template.subject,
        html: template.body,
      },
    });

    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return false;
  }
}

export async function sendTaskNotification(
  taskId: string,
  type: 'assigned' | 'completed' | 'due',
  additionalData?: Record<string, any>
) {
  try {
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select(`
        *,
        project:project_id(name),
        assignee:assigned_to(email, full_name),
        creator:created_by(email, full_name)
      `)
      .eq('id', taskId)
      .single();

    if (taskError) throw taskError;

    const { data: projectMembers, error: membersError } = await supabase
      .from('project_members')
      .select('user:user_id(email, full_name, role)')
      .eq('project_id', task.project_id);

    if (membersError) throw membersError;

    // Get project managers and team members
    const managers = (projectMembers as unknown as ProjectMember[])
      .filter(m => m.user.role === 'project_manager')
      .map(m => m.user.email);

    // Send notifications based on type
    switch (type) {
      case 'assigned':
        if (task.assignee?.email) {
          await sendEmail(task.assignee.email, getTaskAssignedTemplate(
            task.title,
            task.project.name,
            task.creator.full_name
          ));
        }
        break;

      case 'completed':
        // Notify project managers
        await Promise.all(managers.map(email =>
          sendEmail(email, getTaskCompletedTemplate(
            task.title,
            task.project.name,
            additionalData?.completedBy || task.assignee?.full_name || 'Someone'
          ))
        ));
        break;

      case 'due':
        if (task.assignee?.email) {
          await sendEmail(task.assignee.email, getTaskDueTemplate(
            task.title,
            task.project.name,
            new Date(task.due_date).toLocaleDateString()
          ));
        }
        break;
    }

    return true;
  } catch (error: any) {
    console.error('Failed to send task notification:', error);
    return false;
  }
} 