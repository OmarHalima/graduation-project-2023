import { useState, useEffect } from 'react';
import type { Task, TaskPriority, TaskStatus } from '../../types/task';
import type { Phase } from '../../types/phase';
import type { User } from '../../types/auth';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Grid,
  Typography,
  Alert,
} from '@mui/material';
import { canEditTask } from '../../lib/permissions';
import { format } from 'date-fns';

// Define a simplified Phase type for the props
interface SimplePhase {
  id: string;
  name: string;
}

interface EditTaskModalProps {
  task: Task;
  projectMembers: Array<{ id: string; full_name: string }>;
  phases?: Array<SimplePhase>;
  onClose: () => void;
  onSave: (taskId: string, updates: Partial<Task>) => void;
  currentUser: User;
}

export function EditTaskModal({ task, projectMembers, phases: initialPhases, onClose, onSave, currentUser }: EditTaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: task.title,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    assigned_to: task.assigned_to || '',
    due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '',
    phase_id: task.phase_id || '',
    estimated_hours: task.estimated_hours || null,
  });
  const [phases, setPhases] = useState<Phase[]>([]);

  // Check if the current user can edit all fields
  const canEditAllFields = canEditTask(currentUser, task);
  const isAssignedToCurrentUser = task.assigned_to === currentUser.id;

  useEffect(() => {
    // Initialize phases from props if available, otherwise fetch them
    if (initialPhases && initialPhases.length > 0) {
      // Convert SimplePhase to Phase when setting state
      setPhases(initialPhases.map(p => ({
        id: p.id,
        name: p.name,
        project_id: task.project_id, // Use task's project_id
        status: 'pending' as any, // Default value
        sequence_order: 0, // Default value
        // Add any other required properties with default values
      })));
    } else {
      fetchPhases();
    }
  }, []);

  const formatDate = (dateString: string): string => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch (error) {
      return 'Invalid date';
    }
  };

  const fetchPhases = async () => {
    try {
      const { data, error } = await supabase
        .from('project_phases')
        .select('*')
        .eq('project_id', task.project_id)
        .order('sequence_order', { ascending: true });

      if (error) throw error;
      setPhases(data || []);
    } catch (error: any) {
      console.error('Error fetching phases:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setLoading(true);
    try {
      // Handle new phase creation if needed
      let phaseId = formData.phase_id;
      
      await onSave(task.id, {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        status: formData.status,
        priority: formData.priority,
        assigned_to: formData.assigned_to || null,
        due_date: formData.due_date || null,
        phase_id: phaseId || null,
        estimated_hours: formData.estimated_hours || null,
        updated_at: new Date().toISOString()
      });
      
      toast.success('Task updated successfully');
      onClose();
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast.error('Error updating task: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Task</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Box mb={3}>
            <Typography variant="body2" color="textSecondary">
              Last updated: {formatDate(task.updated_at)}
            </Typography>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                fullWidth
                required
                disabled={!canEditAllFields}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={4}
                fullWidth
                disabled={!canEditAllFields}
              />
            </Grid>

            {/* Status field - always editable for assigned user */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                  label="Status"
                  disabled={!canEditAllFields && !isAssignedToCurrentUser}
                >
                  <MenuItem value="todo">To Do</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="in_review">In Review</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                  label="Priority"
                  disabled={!canEditAllFields}
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Phase</InputLabel>
                <Select
                  value={formData.phase_id || ''}
                  onChange={(e) => setFormData({ ...formData, phase_id: e.target.value })}
                  label="Phase"
                  disabled={!canEditAllFields}
                >
                  <MenuItem value="">No Phase</MenuItem>
                  {phases.map((phase) => (
                    <MenuItem key={phase.id} value={phase.id}>
                      {phase.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Assignee</InputLabel>
                <Select
                  value={formData.assigned_to || ''}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  label="Assignee"
                  disabled={!canEditAllFields}
                >
                  <MenuItem value="">Unassigned</MenuItem>
                  {projectMembers.map((member) => (
                    <MenuItem key={member.id} value={member.id}>
                      {member.full_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Due Date"
                type="date"
                value={formData.due_date || ''}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                fullWidth
                InputLabelProps={{
                  shrink: true,
                }}
                disabled={!canEditAllFields}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Estimated Hours"
                type="number"
                value={formData.estimated_hours || ''}
                onChange={(e) => setFormData({ ...formData, estimated_hours: parseFloat(e.target.value) || null })}
                fullWidth
                InputProps={{
                  inputProps: { min: 0, step: 0.5 }
                }}
                disabled={!canEditAllFields}
              />
            </Grid>
          </Grid>
          
          {!canEditAllFields && isAssignedToCurrentUser && (
            <Box mt={2}>
              <Alert severity="info">
                As an employee, you can only update the status of your assigned tasks.
              </Alert>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
} 