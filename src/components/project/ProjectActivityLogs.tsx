import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Box, 
  Typography, 
  Paper, 
  List, 
  ListItem, 
  ListItemText, 
  Chip, 
  CircularProgress,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  SelectChangeEvent
} from '@mui/material';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { CheckCircle, AlertCircle, FileText, MessageSquare, Plus, X } from 'lucide-react';
import { useAuth } from '../../contexts/auth/AuthContext';
import type { ActivityLog, ActivityType } from '../../types/activity';
import { logActivity } from '../../lib/services/activityLogger';

interface ProjectActivityLogsProps {
  projectId: string;
  canEdit: boolean;
  onActivityAdded?: () => void;
}

export function ProjectActivityLogs({ projectId, canEdit, onActivityAdded }: ProjectActivityLogsProps) {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    activity_type: 'decision' as 'decision' | 'note',
    title: '',
    description: ''
  });
  
  const { user } = useAuth();

  useEffect(() => {
    fetchActivityLogs();
  }, [projectId]);

  const fetchActivityLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('project_activity_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActivityLogs(data || []);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setOpenDialog(true);
    setFormData({
      activity_type: 'decision',
      title: '',
      description: ''
    });
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name as string]: value
    });
  };

  const handleSubmit = async () => {
    try {
      if (!formData.title.trim()) {
        toast.error('Title is required');
        return;
      }

      if (!formData.description.trim()) {
        toast.error('Description is required');
        return;
      }

      if (!user) {
        toast.error('You must be logged in to add an activity log');
        return;
      }

      // Use the logActivity service
      await logActivity({
        projectId,
        userId: user.id,
        activityType: formData.activity_type,
        title: formData.title,
        description: formData.description,
        metadata: {
          created_by: user.id,
          created_by_name: user.full_name
        }
      });

      toast.success(formData.activity_type === 'decision' 
        ? 'Decision recorded successfully' 
        : 'Note added successfully');
      
      handleCloseDialog();
      fetchActivityLogs();
      
      // Notify parent component that an activity was added
      if (onActivityAdded) {
        onActivityAdded();
      }
    } catch (error) {
      console.error('Error adding activity log:', error);
      toast.error('Failed to add activity log');
    }
  };

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'task_completed':
        return <CheckCircle size={20} color="#4caf50" />;
      case 'phase_completed':
        return <CheckCircle size={20} color="#2196f3" />;
      case 'decision':
        return <AlertCircle size={20} color="#ff9800" />;
      case 'note':
        return <MessageSquare size={20} color="#9c27b0" />;
      default:
        return <FileText size={20} />;
    }
  };

  const getActivityTypeLabel = (type: ActivityType) => {
    switch (type) {
      case 'task_completed':
        return 'Task Completed';
      case 'phase_completed':
        return 'Phase Completed';
      case 'decision':
        return 'Decision';
      case 'note':
        return 'Note';
      default:
        return type;
    }
  };

  const getActivityTypeColor = (type: ActivityType): "success" | "info" | "warning" | "error" | "default" | "primary" | "secondary" => {
    switch (type) {
      case 'task_completed':
        return 'success';
      case 'phase_completed':
        return 'primary';
      case 'decision':
        return 'warning';
      case 'note':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Activity Logs</Typography>
        {canEdit && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={18} />}
            onClick={handleOpenDialog}
          >
            Add Decision/Note
          </Button>
        )}
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : activityLogs.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}>
          <Typography color="text.secondary">
            No activity logs found for this project
          </Typography>
          {canEdit && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<Plus size={18} />}
              onClick={handleOpenDialog}
              sx={{ mt: 2 }}
            >
              Add First Decision/Note
            </Button>
          )}
        </Paper>
      ) : (
        <Paper variant="outlined">
          <List sx={{ p: 0 }}>
            {activityLogs.map((log, index) => (
              <Box key={log.id}>
                {index > 0 && <Divider />}
                <ListItem
                  sx={{
                    py: 2,
                    px: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                  }}
                >
                  <Box display="flex" width="100%" justifyContent="space-between" mb={1}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getActivityIcon(log.activity_type)}
                      <Typography variant="subtitle1" fontWeight="medium">
                        {log.title}
                      </Typography>
                    </Box>
                    <Chip
                      label={getActivityTypeLabel(log.activity_type)}
                      color={getActivityTypeColor(log.activity_type)}
                      size="small"
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                    {log.description}
                  </Typography>
                  
                  <Box display="flex" justifyContent="space-between" width="100%" alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {log.created_by || 'Unknown User'} • {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                    </Typography>
                    
                    {log.metadata && (
                      <Box>
                        {log.activity_type === 'task_completed' && log.metadata.priority && (
                          <Chip
                            label={`Priority: ${log.metadata.priority}`}
                            size="small"
                            variant="outlined"
                            sx={{ ml: 1 }}
                          />
                        )}
                        {log.activity_type === 'phase_completed' && log.metadata.task_count !== undefined && (
                          <Chip
                            label={`${log.metadata.task_count} tasks`}
                            size="small"
                            variant="outlined"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Box>
                    )}
                  </Box>
                </ListItem>
              </Box>
            ))}
          </List>
        </Paper>
      )}

      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Add Project Decision/Note</Typography>
            <IconButton onClick={handleCloseDialog} size="small">
              <X size={18} />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 2 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel id="activity-type-label">Type</InputLabel>
              <Select
                labelId="activity-type-label"
                name="activity_type"
                value={formData.activity_type}
                onChange={handleInputChange}
                label="Type"
              >
                <MenuItem value="decision">Decision</MenuItem>
                <MenuItem value="note">Note</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              margin="normal"
              label="Title"
              name="title"
              fullWidth
              value={formData.title}
              onChange={handleInputChange}
              required
            />
            
            <TextField
              margin="normal"
              label="Description"
              name="description"
              fullWidth
              multiline
              rows={4}
              value={formData.description}
              onChange={handleInputChange}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            color="primary"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 