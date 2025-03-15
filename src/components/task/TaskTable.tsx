import { useState } from 'react';
import { ChevronUp, ChevronDown, Clock, User as UserIcon, Edit, Trash2 } from 'lucide-react';
import type { Task, TaskStatus } from '../../types/task';
import type { User } from '../../types/auth';
import { formatDistanceToNow } from 'date-fns';
import { EditTaskModal } from './EditTaskModal';
import { DeleteTaskModal } from './DeleteTaskModal';
import { toast } from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Box,
  Typography,
  Select,
  MenuItem,
} from '@mui/material';

interface TaskTableProps {
  tasks: Task[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  currentUser: User;
  canManageTasks: boolean;
  projectMembers: User[];
}

type SortField = 'title' | 'priority' | 'status' | 'due_date' | 'estimated_hours';
type SortDirection = 'asc' | 'desc';

export function TaskTable({ tasks, onUpdateTask, onDeleteTask, currentUser, canManageTasks, projectMembers }: TaskTableProps) {
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const { theme } = useTheme();

  const getStatusColor = (status: TaskStatus) => {
    const colors = {
      todo: 'default',
      in_progress: 'info',
      in_review: 'warning',
      completed: 'success'
    } as const;
    return colors[status];
  };

  const getPriorityColor = (priority: Task['priority']) => {
    const colors = {
      low: 'success',
      medium: 'info',
      high: 'warning',
      urgent: 'error'
    } as const;
    return colors[priority];
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'title':
        return direction * a.title.localeCompare(b.title);
      case 'priority':
        return direction * a.priority.localeCompare(b.priority);
      case 'status':
        return direction * a.status.localeCompare(b.status);
      case 'due_date':
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return direction * (new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      default:
        return 0;
    }
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (field !== sortField) return null;
    return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
  };

  const closeEditModal = () => {
    setEditingTask(null);
  };

  const handleDeleteTask = async (task: Task) => {
    try {
      await onDeleteTask(task.id);
      closeDeleteModal();
      toast.success('Task deleted successfully');
    } catch (error: any) {
      console.error('Error deleting task:', error);
      toast.error('Error deleting task: ' + (error.message || 'Unknown error'));
    }
  };

  const closeDeleteModal = () => {
    setDeletingTask(null);
  };

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell onClick={() => handleSort('title')} sx={{ cursor: 'pointer' }}>
              <Box display="flex" alignItems="center" gap={0.5}>
                Title <SortIcon field="title" />
              </Box>
            </TableCell>
            <TableCell>Description</TableCell>
            <TableCell onClick={() => handleSort('priority')} sx={{ cursor: 'pointer' }}>
              <Box display="flex" alignItems="center" gap={0.5}>
                Priority <SortIcon field="priority" />
              </Box>
            </TableCell>
            <TableCell>Assignee</TableCell>
            <TableCell onClick={() => handleSort('due_date')} sx={{ cursor: 'pointer' }}>
              <Box display="flex" alignItems="center" gap={0.5}>
                Due Date <SortIcon field="due_date" />
              </Box>
            </TableCell>
            <TableCell onClick={() => handleSort('status')} sx={{ cursor: 'pointer' }}>
              <Box display="flex" alignItems="center" gap={0.5}>
                Status <SortIcon field="status" />
              </Box>
            </TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedTasks.map(task => (
            <TableRow key={task.id} hover>
              <TableCell>
                <Typography variant="body2" fontWeight="medium">
                  {task.title}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {task.description}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={task.priority}
                  color={getPriorityColor(task.priority)}
                  size="small"
                />
              </TableCell>
              <TableCell>
                <Box display="flex" alignItems="center" gap={1}>
                  <UserIcon className="h-4 w-4" />
                  <Typography variant="body2">
                    {task.assigned_user?.full_name || 'Unassigned'}
                  </Typography>
                </Box>
              </TableCell>
              <TableCell>
                {task.due_date && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <Clock className="h-4 w-4" />
                    <Typography variant="body2">
                      {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                    </Typography>
                  </Box>
                )}
              </TableCell>
              <TableCell>
                {canManageTasks || task.assigned_to === currentUser.id ? (
                  <Select
                    value={task.status}
                    onChange={(e) => onUpdateTask(task.id, { status: e.target.value as TaskStatus })}
                    size="small"
                    sx={{ minWidth: 120 }}
                  >
                    <MenuItem value="todo">To Do</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="in_review">In Review</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                  </Select>
                ) : (
                  <Chip
                    label={task.status}
                    color={getStatusColor(task.status)}
                    size="small"
                  />
                )}
              </TableCell>
              <TableCell>
                {(canManageTasks || task.assigned_to === currentUser.id) && (
                  <Box display="flex" gap={1}>
                    <IconButton
                      size="small"
                      onClick={() => handleEditTask(task)}
                      color="primary"
                    >
                      <Edit className="h-4 w-4" />
                    </IconButton>
                    {canManageTasks && (
                      <IconButton
                        size="small"
                        onClick={() => setDeletingTask(task)}
                        color="error"
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    )}
                  </Box>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onClose={closeEditModal}
          onUpdate={onUpdateTask}
          canEdit={canManageTasks || editingTask.assigned_to === currentUser.id}
          projectMembers={projectMembers}
        />
      )}

      {deletingTask && (
        <DeleteTaskModal
          task={deletingTask}
          onClose={closeDeleteModal}
          onDelete={() => handleDeleteTask(deletingTask)}
        />
      )}
    </TableContainer>
  );
} 