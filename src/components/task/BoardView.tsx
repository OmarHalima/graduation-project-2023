import { useState } from 'react';
import type { Task, TaskStatus } from '../../types/task';
import type { User } from '../../types/auth';
import type { Phase } from '../../types/phase';
import { toast } from 'react-hot-toast';
import { 
  Box, 
  Paper, 
  Typography, 
  Card, 
  CardContent, 
  CardActions,
  IconButton,
  Chip,
  Grid
} from '@mui/material';
import { Edit, Trash } from 'lucide-react';
import { canUpdateTaskStatus } from '../../lib/permissions';

interface BoardViewProps {
  tasks: Task[];
  phases: Phase[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<any>;
  onDeleteTask?: (taskId: string) => Promise<void>;
  currentUser: User;
  canManageTasks: boolean;
}

export function BoardView({ 
  tasks, 
  phases, 
  onUpdateTask, 
  onDeleteTask, 
  currentUser, 
  canManageTasks 
}: BoardViewProps) {
  
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('taskId', task.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) return;
    
    // Check if user can update this task's status
    if (!canUpdateTaskStatus(currentUser, task)) {
      toast.error("You don't have permission to update this task");
      return;
    }
    
    try {
      await onUpdateTask(taskId, { status });
      toast.success('Task status updated');
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error('Failed to update task status');
    }
  };

  const getStatusColor = (status: TaskStatus): "success" | "error" | "warning" | "info" | "default" => {
    switch (status) {
      case 'todo':
        return 'info';
      case 'in_progress':
        return 'warning';
      case 'in_review':
        return 'warning';
      case 'completed':
        return 'success';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string): "success" | "error" | "warning" | "info" | "default" => {
    switch (priority) {
      case 'low':
        return 'success';
      case 'medium':
        return 'info';
      case 'high':
        return 'warning';
      case 'urgent':
        return 'error';
      default:
        return 'default';
    }
  };

  const getAssigneeName = (assigneeId: string | null) => {
    if (!assigneeId) return 'Unassigned';
    const task = tasks.find(t => t.assigned_to === assigneeId);
    return task?.assignee?.full_name || 'Unknown';
  };

  // Prepare tasks grouped by status
  const tasksByStatus: Record<TaskStatus, Task[]> = {
    'todo': tasks.filter(task => task.status === 'todo'),
    'in_progress': tasks.filter(task => task.status === 'in_progress'),
    'in_review': tasks.filter(task => task.status === 'in_review'),
    'completed': tasks.filter(task => task.status === 'completed'),
  };

  const statusLabels: Record<TaskStatus, string> = {
    'todo': 'To Do',
    'in_progress': 'In Progress',
    'in_review': 'In Review',
    'completed': 'Completed',
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'auto' }}>
      <Grid container spacing={2}>
        {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
          <Grid item xs={12} sm={6} md={3} key={status}>
            <Paper
              sx={{ 
                p: 2, 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                bgcolor: theme => theme.palette.background.default
              }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status as TaskStatus)}
            >
              <Typography variant="h6" sx={{ mb: 2, px: 1 }}>
                {statusLabels[status as TaskStatus]} ({statusTasks.length})
              </Typography>
              
              <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {statusTasks.map(task => (
                  <Card 
                    key={task.id} 
                    sx={{ 
                      mb: 2,
                      cursor: canUpdateTaskStatus(currentUser, task) ? 'grab' : 'default',
                      '&:hover': {
                        boxShadow: 3
                      }
                    }}
                    draggable={canUpdateTaskStatus(currentUser, task)}
                    onDragStart={(e) => handleDragStart(e, task)}
                  >
                    <CardContent sx={{ pb: 1 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        {task.title}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                        <Chip 
                          label={task.priority} 
                          color={getPriorityColor(task.priority)} 
                          size="small"
                        />
                        
                        {task.phase && (
                          <Chip 
                            label={task.phase.name} 
                            size="small" 
                            variant="outlined"
                          />
                        )}
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary">
                        {task.assignee ? task.assignee.full_name : 'Unassigned'}
                      </Typography>
                      
                      {task.due_date && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Due: {new Date(task.due_date).toLocaleDateString()}
                        </Typography>
                      )}
                    </CardContent>
                    
                    {canManageTasks && (
                      <CardActions sx={{ pt: 0 }}>
                        <Box sx={{ ml: 'auto', display: 'flex' }}>
                          <IconButton size="small" onClick={() => onDeleteTask?.(task.id)}>
                            <Trash size={16} />
                          </IconButton>
                        </Box>
                      </CardActions>
                    )}
                  </Card>
                ))}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
} 