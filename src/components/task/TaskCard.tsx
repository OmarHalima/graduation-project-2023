import React from 'react';
import { Clock, User, AlertTriangle } from 'lucide-react';
import type { Task } from '../../../types/task';
import type { User as UserType } from '../../../types/auth';
import { formatDistanceToNow } from 'date-fns';
import { Box, Typography, Chip } from '@mui/material';

interface TaskCardProps {
  task: Task;
  onUpdate: () => void;
  currentUser: UserType;
}

export const TaskCard = React.memo(function TaskCard({ task, onUpdate, currentUser }: TaskCardProps) {
  const getPriorityColor = (priority: Task['priority']) => {
    const colors = {
      low: 'success',
      medium: 'info',
      high: 'warning',
      urgent: 'error',
    } as const;
    return colors[priority];
  };

  return (
    <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Typography variant="subtitle1" component="h4" sx={{ fontWeight: 'medium' }}>
          {task.title}
        </Typography>
        <Chip
          label={task.priority}
          color={getPriorityColor(task.priority)}
          size="small"
        />
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {task.description}
      </Typography>

      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box display="flex" alignItems="center" gap={1}>
          <User className="h-4 w-4" />
          <Typography variant="caption" color="text.secondary">
            {task.assignee?.full_name || 'Unassigned'}
          </Typography>
        </Box>
        {task.due_date && (
          <Box display="flex" alignItems="center" gap={1}>
            <Clock className="h-4 w-4" />
            <Typography variant="caption" color="text.secondary">
              {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
            </Typography>
          </Box>
        )}
      </Box>

      {task.ai_insights?.risk_assessment && (
        <Box mt={2} p={1} bgcolor="warning.light" borderRadius={1} display="flex" gap={1} alignItems="flex-start">
          <AlertTriangle className="h-4 w-4" style={{ color: 'warning.main', marginTop: '2px' }} />
          <Typography variant="caption" color="warning.main">
            {task.ai_insights.risk_assessment}
          </Typography>
        </Box>
      )}
    </Box>
  );
}); 