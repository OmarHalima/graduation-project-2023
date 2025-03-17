import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
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
  IconButton,
  Box,
  Grid,
  Autocomplete,
  Chip,
} from '@mui/material';

interface NewTaskModalProps {
  projectId: string;
  currentUser: User;
  projectMembers: User[];
  onClose: () => void;
  onCreated: () => void;
}

export function NewTaskModal({ projectId, currentUser, projectMembers, onClose, onCreated }: NewTaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo' as TaskStatus,
    priority: 'medium' as TaskPriority,
    assigned_to: '',
    due_date: '',
    phase_id: ''
  });
  const [phases, setPhases] = useState<Phase[]>([]);
  const [phaseInputValue, setPhaseInputValue] = useState('');
  const [suggestedPhases, setSuggestedPhases] = useState<Phase[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    fetchPhases();
  }, [projectId]);

  useEffect(() => {
    if (phaseInputValue && phaseInputValue.length > 1) {
      suggestPhases(phaseInputValue);
    }
  }, [phaseInputValue]);

  const fetchPhases = async () => {
    try {
      const { data, error } = await supabase
        .from('project_phases')
        .select('*')
        .eq('project_id', projectId)
        .order('sequence_order', { ascending: true });

      if (error) throw error;
      setPhases(data || []);
    } catch (error: any) {
      console.error('Error fetching phases:', error);
    }
  };

  const suggestPhases = async (query: string) => {
    setLoadingSuggestions(true);
    try {
      const { data, error } = await supabase
        .from('project_phases')
        .select('*')
        .eq('project_id', projectId)
        .ilike('name', `%${query}%`)
        .order('sequence_order', { ascending: true });

      if (error) throw error;
      setSuggestedPhases(data || []);
    } catch (error: any) {
      console.error('Error suggesting phases:', error);
    } finally {
      setLoadingSuggestions(false);
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
      // Handle new phase creation if entered text doesn't match an existing phase
      let phaseId = formData.phase_id;
      if (phaseInputValue && !phaseId) {
        // Check if a phase with this name already exists
        const matchingPhase = phases.find(p => 
          p.name.toLowerCase() === phaseInputValue.toLowerCase()
        );
        
        if (matchingPhase) {
          phaseId = matchingPhase.id;
        } else {
          // Create a new phase
          const { data: newPhase, error: phaseError } = await supabase
            .from('project_phases')
            .insert({
              project_id: projectId,
              name: phaseInputValue.trim(),
              description: null,
              status: 'pending',
              sequence_order: phases.length + 1,
              created_by: currentUser.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (phaseError) throw phaseError;
          phaseId = newPhase.id;
          toast.success('New phase created');
        }
      }

      // We need to make sure the phase exists in the phases table
      // since tasks have a foreign key reference to phases, not project_phases
      if (phaseId) {
        try {
          // Check if this phase ID already exists in the phases table
          const { data: existingPhase, error: checkError } = await supabase
            .from('phases')
            .select('id')
            .eq('id', phaseId)
            .single();
            
          // If not found, create it
          if (checkError && checkError.code === 'PGRST116') { // Not found
            // Get the phase data from project_phases
            const { data: projectPhase, error: fetchError } = await supabase
              .from('project_phases')
              .select('*')
              .eq('id', phaseId)
              .single();
              
            if (fetchError) throw fetchError;
            
            // Run a server-side function to insert with admin rights
            // This bypasses RLS policies
            const { error: functionError } = await supabase.rpc('create_phase_with_admin_rights', {
              phase_id: projectPhase.id,
              project_id: projectPhase.project_id,
              phase_name: projectPhase.name,
              phase_description: projectPhase.description || '',
              phase_order: projectPhase.sequence_order,
              // Map project_phases status to phases status
              phase_status: mapStatusToPhaseTable(projectPhase.status || ''),
              phase_start_date: projectPhase.start_date || null,
              phase_end_date: projectPhase.end_date || null
            });
            
            if (functionError) {
              console.error('Error creating phase with admin rights:', functionError);
              // If the function doesn't exist or fails, we'll set phase_id to null to avoid the foreign key error
              phaseId = null;
            }
          } else if (checkError) {
            // Some other error occurred
            console.error('Error checking for existing phase:', checkError);
            phaseId = null;
          }
        } catch (error: any) {
          console.error('Error handling phase synchronization:', error);
          phaseId = null;
        }
      }
      
      const { error } = await supabase
        .from('tasks')
        .insert({
          project_id: projectId,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          status: formData.status,
          priority: formData.priority,
          assigned_to: formData.assigned_to || null,
          due_date: formData.due_date || null,
          phase_id: phaseId || null,
          created_by: currentUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      toast.success('Task created successfully');
      onCreated();
      onClose();
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast.error('Error creating task: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
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

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          New Task
          <IconButton onClick={onClose} size="small">
            <X />
          </IconButton>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Title"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={4}
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                freeSolo
                loading={loadingSuggestions}
                options={suggestedPhases}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                value={phases.find(p => p.id === formData.phase_id) || null}
                inputValue={phaseInputValue}
                onInputChange={(_, newInputValue) => {
                  setPhaseInputValue(newInputValue);
                }}
                onChange={(_, newValue) => {
                  if (typeof newValue === 'string') {
                    setPhaseInputValue(newValue);
                    setFormData({ ...formData, phase_id: '' });
                  } else if (newValue) {
                    setPhaseInputValue(newValue.name);
                    setFormData({ ...formData, phase_id: newValue.id });
                  } else {
                    setPhaseInputValue('');
                    setFormData({ ...formData, phase_id: '' });
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Phase"
                    helperText="Select existing or type a new phase name"
                    fullWidth
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                  label="Status"
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
                <InputLabel>Assignee</InputLabel>
                <Select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  label="Assignee"
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
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                fullWidth
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
          </Grid>
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
            {loading ? 'Creating...' : 'Create Task'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
} 