import { useState, useEffect } from 'react';
import { MoreVertical, Edit, Trash, Check, RefreshCw } from 'lucide-react';
import type { Task, TaskStatus, TaskPriority, TaskSuggestion } from '../../types/task';
import type { User } from '../../types/auth';
import type { Phase } from '../../types/phase';
import { format } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  Select,
  Box,
  Tooltip,
  Stack
} from '@mui/material';
import { EditTaskModal } from './EditTaskModal';
import { canUpdateTaskStatus, canEditTask } from '../../lib/permissions';

interface TaskTableProps {
  tasks: Task[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask?: (taskId: string) => Promise<void>;
  onEditTask?: (task: Task) => void;
  currentUser: User;
  canManageTasks: boolean;
  projectMembers?: User[];
}

export function TaskTable({ tasks, onUpdateTask, currentUser, canManageTasks, projectMembers = [], onDeleteTask, onEditTask }: TaskTableProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<keyof Task>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [phases, setPhases] = useState<Phase[]>([]);
  const [loadingPhases, setLoadingPhases] = useState(false);

  // Load phases when component mounts if we have tasks
  useEffect(() => {
    if (tasks.length > 0 && canManageTasks) {
      const projectId = tasks[0].project_id;
      fetchPhases(projectId);
    }
  }, [tasks, canManageTasks]);

  const fetchPhases = async (projectId: string) => {
    try {
      setLoadingPhases(true);
      
      // Get task phase IDs for reference
      const taskPhaseIds = tasks
        .filter(task => task.phase_id)
        .map(task => task.phase_id);
      
      // Get phases from project_phases table
      const { data: projectPhases, error: projectPhasesError } = await supabase
        .from('project_phases')
        .select('*')
        .eq('project_id', projectId)
        .order('sequence_order', { ascending: true });

      if (projectPhasesError) throw projectPhasesError;
      
      // Set phases from project_phases
      setPhases(projectPhases || []);
      setLoadingPhases(false);
    } catch (error) {
      console.error('Error fetching phases:', error);
      setLoadingPhases(false);
    }
  };

  const handleEditClick = (task: Task) => {
    if (onEditTask) {
      onEditTask(task);
    } else {
      setSelectedTask(task);
      setIsEditModalOpen(true);
    }
  };

  const handleDeleteClick = async (task: Task) => {
    if (!onDeleteTask) return;
    
    try {
      await onDeleteTask(task.id);
      toast.success('Task deleted successfully');
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  };

  const handleMarkComplete = async (task: Task) => {
    try {
      await onUpdateTask(task.id, { status: 'completed' });
      toast.success('Task marked as completed');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await onUpdateTask(taskId, { status: newStatus });
      toast.success('Task status updated');
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error('Failed to update task status');
    }
  };

  const handlePhaseChange = async (taskId: string, newPhaseId: string | null) => {
    try {
      // If we're setting a phase ID, make sure it exists in both tables
      if (newPhaseId) {
        // First check if this phase exists in the phases table
        const { data: existingPhase, error: checkError } = await supabase
          .from('phases')
          .select('id')
          .eq('id', newPhaseId)
          .maybeSingle();
          
        // If it doesn't exist in phases table but does in project_phases, create it
        if (!existingPhase && checkError?.code === 'PGRST116') {
          // Get the phase data from project_phases
          const { data: projectPhase, error: fetchError } = await supabase
            .from('project_phases')
            .select('*')
            .eq('id', newPhaseId)
            .single();
            
          if (fetchError) throw fetchError;
          
          // Insert into phases table with the same ID
          const { error: insertError } = await supabase
            .from('phases')
            .insert({
              id: projectPhase.id,
              project_id: projectPhase.project_id,
              name: projectPhase.name,
              description: projectPhase.description,
              order_index: projectPhase.sequence_order,
              // Map status from project_phases to phases format
              status: mapStatusToPhaseTable(projectPhase.status || ''),
              start_date: projectPhase.start_date,
              end_date: projectPhase.end_date,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            
          if (insertError) {
            console.error('Error syncing phase to phases table:', insertError);
            throw insertError;
          }
        } else if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }
      }
      
      // Now update the task with the phase_id
      await onUpdateTask(taskId, { phase_id: newPhaseId });
      toast.success('Task phase updated');
    } catch (error) {
      console.error('Error updating task phase:', error);
      toast.error('Failed to update task phase');
    }
  };
  
  // Helper function to map statuses between tables
  const mapStatusToPhaseTable = (projectPhaseStatus: string): string => {
    // Map from project_phases status to phases status
    switch (projectPhaseStatus) {
      case 'pending': return 'not_started';
      case 'in_progress': return 'in_progress';
      case 'completed': return 'completed';
      case 'cancelled': return 'not_started';  // Default fallback
      default: return 'not_started';
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

  const getPriorityColor = (priority: TaskPriority): "success" | "error" | "warning" | "info" | "default" => {
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

  // Sort tasks - always sort by created_at in ascending order by default
  const sortedTasks = [...tasks].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateA - dateB; // Always ascending order by created_at
  });

  const handleAddSuggestedTask = async (task: TaskSuggestion) => {
    try {
      // Find the user ID for the suggested assignee by matching their full name
      const assigneeUser = projectMembers.find(
        member => member.full_name.toLowerCase() === task.suggested_assignee?.toLowerCase()
      );

      // Implementation details...
      
    } catch (error: any) {
      console.error('Error adding task:', error);
      toast.error('Failed to add task: ' + (error.message || 'Unknown error'));
    }
  };

  return (
    <>
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Phase</TableCell>
            <TableCell>Assignee</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Estimated Hours</TableCell>
              {canManageTasks && <TableCell align="right">Actions</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
            {sortedTasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell>{task.title}</TableCell>
              <TableCell>
                  {canUpdateTaskStatus(currentUser, task) ? (
                    <FormControl size="small" fullWidth>
                  <Select
                    value={task.status}
                        onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                    size="small"
                        variant="outlined"
                        sx={{
                          '.MuiOutlinedInput-notchedOutline': {
                            borderColor: `${getStatusColor(task.status)}.main`
                          },
                          minWidth: 120
                        }}
                  >
                    <MenuItem value="todo">To Do</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="in_review">In Review</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                  </Select>
                    </FormControl>
                ) : (
                  <Chip
                    label={task.status}
                    color={getStatusColor(task.status)}
                    size="small"
                  />
                )}
              </TableCell>
              <TableCell>
                  <Chip 
                    label={task.priority} 
                    color={getPriorityColor(task.priority)} 
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {canManageTasks ? (
                    <Box display="flex" alignItems="center">
                      <FormControl size="small" fullWidth>
                        <Select
                          value={
                            loadingPhases ? '' : 
                            (task.phase_id && phases.some(p => p.id === task.phase_id)) ? task.phase_id : ''
                          }
                          onChange={(e) => handlePhaseChange(task.id, e.target.value || null)}
                      size="small"
                          variant="outlined"
                          displayEmpty
                          disabled={loadingPhases}
                          sx={{ minWidth: 120 }}
                        >
                          <MenuItem value="">No Phase</MenuItem>
                          {loadingPhases ? (
                            <MenuItem disabled>Loading phases...</MenuItem>
                          ) : (
                            phases.map((phase) => (
                              <MenuItem key={phase.id} value={phase.id}>{phase.name}</MenuItem>
                            ))
                          )}
                        </Select>
                      </FormControl>
                      {task.phase_id && !phases.some(p => p.id === task.phase_id) && (
                        <Chip
                          size="small"
                          color="warning"
                          label="Invalid Phase"
                          sx={{ ml: 1, height: 24 }}
                        />
                      )}
                      <IconButton
                        size="small"
                        onClick={() => fetchPhases(task.project_id)}
                        disabled={loadingPhases}
                        sx={{ ml: 0.5 }}
                      >
                        <RefreshCw size={14} />
                      </IconButton>
                    </Box>
                  ) : (
                    task.phase ? (
                      <Chip 
                        label={task.phase.name} 
                        size="small"
                        variant="outlined"
                        color="info"
                      />
                    ) : (
                      '-'
                    )
                  )}
                </TableCell>
                <TableCell>
                  {task.assignee ? task.assignee.full_name : 'Unassigned'}
                </TableCell>
                <TableCell>
                  {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : '-'}
                </TableCell>
                <TableCell>
                  {task.estimated_hours ? `${task.estimated_hours} ${task.estimated_hours === 1 ? 'hour' : 'hours'}` : '-'}
                </TableCell>
                {canManageTasks && (
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <IconButton 
                        onClick={() => handleEditClick(task)}
                        size="small"
                        color="primary"
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      
                      {onDeleteTask && (
                        <IconButton 
                          size="small" 
                          onClick={() => handleDeleteClick(task)}
                          sx={{ color: 'error.main' }}
                        >
                          <Trash size={16} />
                        </IconButton>
                      )}
                    </Stack>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {tasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManageTasks ? 8 : 7} align="center">
                  <Typography color="text.secondary" py={2}>
                    No tasks found. Create your first task to get started.
                  </Typography>
              </TableCell>
            </TableRow>
            )}
        </TableBody>
      </Table>
      </TableContainer>

      {/* Edit Modal */}
      {isEditModalOpen && selectedTask && (
        <EditTaskModal
          task={selectedTask}
          onClose={() => setIsEditModalOpen(false)}
          onSave={(taskId, updates) => {
            onUpdateTask(taskId, updates);
            setIsEditModalOpen(false);
          }}
          projectMembers={projectMembers}
          phases={phases}
          currentUser={currentUser}
        />
      )}
    </>
  );
} 