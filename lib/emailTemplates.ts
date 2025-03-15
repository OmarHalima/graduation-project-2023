export interface EmailTemplate {
  subject: string;
  body: string;
}

export function getTaskAssignedTemplate(
  taskTitle: string,
  projectName: string,
  assignerName: string
): EmailTemplate {
  return {
    subject: `[${projectName}] New task assigned: ${taskTitle}`,
    body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Task Assignment</h2>
        <p>You have been assigned a new task by ${assignerName}:</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0;">${taskTitle}</h3>
          <p style="margin: 0; color: #4b5563;">Project: ${projectName}</p>
        </div>
        <a href="${import.meta.env.VITE_APP_URL}/tasks" 
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 6px; margin-top: 16px;">
          View Task
        </a>
      </div>
    `,
  };
}

export function getTaskCompletedTemplate(
  taskTitle: string,
  projectName: string,
  completedBy: string
): EmailTemplate {
  return {
    subject: `[${projectName}] Task completed: ${taskTitle}`,
    body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Task Completed</h2>
        <p>${completedBy} has completed the following task:</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0;">${taskTitle}</h3>
          <p style="margin: 0; color: #4b5563;">Project: ${projectName}</p>
        </div>
        <a href="${import.meta.env.VITE_APP_URL}/tasks" 
           style="display: inline-block; background: #059669; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 6px; margin-top: 16px;">
          View Details
        </a>
      </div>
    `,
  };
}

export function getTaskDueTemplate(
  taskTitle: string,
  projectName: string,
  dueDate: string
): EmailTemplate {
  return {
    subject: `[${projectName}] Task due soon: ${taskTitle}`,
    body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #DC2626;">Task Due Soon</h2>
        <p>A task assigned to you is due soon:</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 8px 0;">${taskTitle}</h3>
          <p style="margin: 0; color: #4b5563;">Project: ${projectName}</p>
          <p style="margin: 8px 0 0 0; color: #DC2626;">Due: ${dueDate}</p>
        </div>
        <a href="${import.meta.env.VITE_APP_URL}/tasks" 
           style="display: inline-block; background: #DC2626; color: white; padding: 12px 24px; 
                  text-decoration: none; border-radius: 6px; margin-top: 16px;">
          View Task
        </a>
      </div>
    `,
  };
}

// Add more email templates... 