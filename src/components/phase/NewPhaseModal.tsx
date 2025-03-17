import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import type { PhaseStatus } from '../../types/phase';
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
  Checkbox,
  FormControlLabel,
  Typography,
  List,
  ListItem,
  Divider,
} from '@mui/material';

interface NewPhaseModalProps {
  projectId?: string;
  projects?: Array<{ id: string; name: string }>;
  currentUser: User;
  onClose: () => void;
  onCreated: () => void;
  suggestedTasks?: string[];
  phaseDates?: {
    startDate: string;
    endDate: string;
  };
  phaseDetails?: {
    name: string;
    description: string;
    status: PhaseStatus;
    sequence_order: number;
    startDate: string;
    endDate: string;
  };
}

export function NewPhaseModal({ 
  projectId, 
  projects, 
  currentUser, 
  onClose, 
  onCreated,
  suggestedTasks = [],
  phaseDates,
  phaseDetails
}: NewPhaseModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: phaseDetails?.name || '',
    description: phaseDetails?.description || '',
    status: phaseDetails?.status || 'pending' as PhaseStatus,
    sequence_order: phaseDetails?.sequence_order || 1,
    start_date: phaseDetails?.startDate || phaseDates?.startDate || '',
    end_date: phaseDetails?.endDate || phaseDates?.endDate || '',
    project_id: projectId || '',
  });
  
  // State for selected tasks
  const [selectedTasks, setSelectedTasks] = useState<{[key: string]: boolean}>({});
  const [showTaskSelection, setShowTaskSelection] = useState(suggestedTasks.length > 0);

  // Initialize selected tasks
  useEffect(() => {
    if (suggestedTasks.length > 0) {
      const initialSelectedTasks = suggestedTasks.reduce((acc, task) => {
        acc[task] = true; // Default to selected
        return acc;
      }, {} as {[key: string]: boolean});
      
      setSelectedTasks(initialSelectedTasks);
    }
  }, [suggestedTasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    if (!formData.project_id) {
      toast.error('Project is required');
      return;
    }

    try {
      setLoading(true);
      
      // Create the phase
      const { data: phaseData, error: phaseError } = await supabase
        .from('project_phases')
        .insert([
          {
            project_id: formData.project_id,
            name: formData.name,
            description: formData.description,
            status: formData.status,
            sequence_order: formData.sequence_order,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
            created_by: currentUser.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();
        
      if (phaseError) throw phaseError;
      
      // If there are selected tasks, create them
      const selectedTaskDescriptions = Object.entries(selectedTasks)
        .filter(([_, isSelected]) => isSelected)
        .map(([taskDescription]) => taskDescription);
      
      if (selectedTaskDescriptions.length > 0) {
        // Create tasks for the phase
        const tasksToCreate = selectedTaskDescriptions.map(taskDescription => ({
          project_id: formData.project_id,
          title: taskDescription.split('.')[0].trim(), // Use first sentence as title
          description: taskDescription,
          status: 'todo',
          priority: 'medium',
          phase_id: phaseData.id,
          created_by: currentUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          due_date: formData.end_date || null
        }));
        
        // First, check if we need to update the task table's foreign key reference
        const { data: taskFKData, error: taskFKError } = await supabase
          .rpc('check_task_phase_fk');
          
        if (taskFKError) {
          console.error('Error checking task phase foreign key:', taskFKError);
        }
        
        // Insert the tasks
        const { error: tasksError } = await supabase
          .from('tasks')
          .insert(tasksToCreate);
          
        if (tasksError) {
          console.error('Error creating tasks:', tasksError);
          
          // If there's a foreign key error, try to create tasks without phase_id
          if (tasksError.code === '23503' && tasksError.message.includes('tasks_phase_id_fkey')) {
            const tasksWithoutPhase = tasksToCreate.map(task => {
              const { phase_id, ...taskWithoutPhase } = task;
              return taskWithoutPhase;
            });
            
            const { error: fallbackError } = await supabase
              .from('tasks')
              .insert(tasksWithoutPhase);
              
            if (fallbackError) {
              console.error('Error creating tasks without phase:', fallbackError);
              toast.error('Phase created but there was an error creating tasks');
            } else {
              toast.success(`Phase created with ${selectedTaskDescriptions.length} tasks (without phase association)`);
            }
          } else {
            toast.error('Phase created but there was an error creating tasks');
          }
        } else {
          toast.success(`Phase created with ${selectedTaskDescriptions.length} tasks`);
        }
      } else {
        toast.success('Phase created successfully');
      }
      
      onCreated();
      onClose();
    } catch (error) {
      console.error('Error creating phase:', error);
      toast.error('Failed to create phase');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskSelectionChange = (taskDescription: string, checked: boolean) => {
    setSelectedTasks(prev => ({
      ...prev,
      [taskDescription]: checked
    }));
  };

  const handleSelectAllTasks = (checked: boolean) => {
    const updatedTasks = { ...selectedTasks };
    Object.keys(updatedTasks).forEach(task => {
      updatedTasks[task] = checked;
    });
    setSelectedTasks(updatedTasks);
  };

  return (
    <Dialog 
      open={true} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {phaseDetails ? 'Add Suggested Phase' : 'Create New Phase'}
        <IconButton onClick={onClose} size="small">
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Grid container spacing={3}>
            {!projectId && projects && (
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Project</InputLabel>
                  <Select
                    value={formData.project_id}
                    onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                    label="Project"
                  >
                    {projects.map((project) => (
                      <MenuItem key={project.id} value={project.id}>
                        {project.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                label="Phase Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                fullWidth
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as PhaseStatus })}
                  label="Status"
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Sequence Order"
                type="number"
                value={formData.sequence_order}
                onChange={(e) => setFormData({ ...formData, sequence_order: parseInt(e.target.value) || 1 })}
                fullWidth
                InputProps={{ inputProps: { min: 1 } }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Start Date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="End Date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            {/* Suggested Tasks Section */}
            {suggestedTasks.length > 0 && (
              <Grid item xs={12}>
                <Box sx={{ mt: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1" gutterBottom>
                      Suggested Tasks
                    </Typography>
                    <Button 
                      size="small" 
                      onClick={() => setShowTaskSelection(!showTaskSelection)}
                    >
                      {showTaskSelection ? 'Hide Tasks' : 'Show Tasks'}
                    </Button>
                  </Box>
                  
                  {showTaskSelection && (
                    <>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={Object.values(selectedTasks).every(value => value)}
                              onChange={(e) => handleSelectAllTasks(e.target.checked)}
                            />
                          }
                          label="Select All"
                        />
                        <Typography variant="body2" color="text.secondary">
                          {Object.values(selectedTasks).filter(Boolean).length} of {suggestedTasks.length} selected
                        </Typography>
                      </Box>
                      
                      <Divider sx={{ mb: 2 }} />
                      
                      <List sx={{ maxHeight: 300, overflow: 'auto', bgcolor: 'background.paper' }}>
                        {suggestedTasks.map((task, index) => (
                          <ListItem key={index} disablePadding sx={{ py: 0.5 }}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={selectedTasks[task] || false}
                                  onChange={(e) => handleTaskSelectionChange(task, e.target.checked)}
                                />
                              }
                              label={task}
                              sx={{ width: '100%' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </>
                  )}
                </Box>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button 
            type="submit" 
            variant="contained" 
            color="primary"
            disabled={loading}
          >
            {loading ? 'Creating...' : phaseDetails ? 'Add Phase' : 'Create Phase'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
} 