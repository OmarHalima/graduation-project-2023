import { useState, useEffect } from 'react';
import { X, Search, UserPlus, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { User } from '../../types/auth';
import type { ProjectMember } from '../../types/project';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Paper,
  Avatar,
  Radio,
  Checkbox,
} from '@mui/material';
import { UserAvatar } from '../UserAvatar';

interface TeamManagementModalProps {
  projectId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function TeamManagementModal({ projectId, onClose, onUpdate }: TeamManagementModalProps) {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<'member' | 'manager'>('member');
  const [teamMembers, setTeamMembers] = useState<ProjectMember[]>([]);

  useEffect(() => {
    fetchTeamMembers();
  }, [projectId]);

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('project_members')
        .select(`
          project_id,
          user_id,
          role,
          joined_at,
          created_at,
          updated_at,
          user:users!project_members_user_id_fkey (
            id,
            full_name,
            email,
            avatar_url,
            role,
            status,
            department,
            position,
            mfa_enabled,
            created_at
          )
        `)
        .eq('project_id', projectId);

      if (error) throw error;
      const formattedData = (data || []).map(item => ({
        project_id: item.project_id,
        user_id: item.user_id,
        role: item.role as 'member' | 'manager',
        joined_at: item.joined_at,
        created_at: item.created_at || new Date().toISOString(),
        updated_at: item.updated_at || new Date().toISOString(),
        user: {
          id: item.user.id,
          email: item.user.email,
          full_name: item.user.full_name,
          avatar_url: item.user.avatar_url,
          role: item.user.role,
          status: item.user.status,
          department: item.user.department,
          position: item.user.position,
          mfa_enabled: item.user.mfa_enabled,
          created_at: item.user.created_at
        }
      })) as ProjectMember[];
      setTeamMembers(formattedData);
    } catch (error: any) {
      console.error('Error fetching team members:', error);
      toast.error('Error loading team members');
    }
  };

  const fetchUsers = async () => {
    if (!searchQuery.trim()) {
      setAvailableUsers([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('full_name', `%${searchQuery}%`)
        .eq('status', 'active')
        .limit(5);

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
    }
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAddMembers = async () => {
    if (selectedUserIds.length === 0) {
      toast.error('Please select at least one user');
      return;
    }

    setLoading(true);
    try {
      for (const userId of selectedUserIds) {
        // First, add the member to project_members
        const { error: memberError } = await supabase
          .from('project_members')
          .insert({
            project_id: projectId,
            user_id: userId,
            role: selectedRole,
            joined_at: new Date().toISOString(),
          });

        if (memberError) throw memberError;

        // Try to fetch user's CV data, but don't block if it fails
        try {
          const { data: cvData } = await supabase
            .from('cv_parsed_data')
            .select('education, work_experience, skills, languages, certifications')
            .eq('user_id', userId)
            .single();

          // Create team member record with CV data if available
          await supabase
            .from('team_member_records')
            .insert({
              project_id: projectId,
              user_id: userId,
              cv_data: cvData || null,
              joined_at: new Date().toISOString(),
            });
        } catch (cvError) {
          console.warn('Warning: Could not fetch CV data:', cvError);
          // Create team member record without CV data
          await supabase
            .from('team_member_records')
            .insert({
              project_id: projectId,
              user_id: userId,
              joined_at: new Date().toISOString(),
            });
        }
      }

      toast.success(`${selectedUserIds.length} team member${selectedUserIds.length > 1 ? 's' : ''} added successfully`);
      setSelectedUserIds([]);
      setSearchQuery('');
      setAvailableUsers([]);
      onUpdate();
    } catch (error: any) {
      console.error('Error adding team members:', {
        error,
        details: error.details,
        message: error.message,
        hint: error.hint,
        code: error.code
      });
      toast.error(`Error adding team members: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setLoading(true);
    try {
      // First update the team_member_records to mark the departure
      const { error: recordError } = await supabase
        .from('team_member_records')
        .update({ left_at: new Date().toISOString() })
        .match({ project_id: projectId, user_id: userId });

      if (recordError) {
        console.warn('Warning: Could not update team member record:', recordError);
        // Continue with removal even if record update fails
      }

      // Then remove from project_members
      const { error } = await supabase
        .from('project_members')
        .delete()
        .match({ project_id: projectId, user_id: userId });

      if (error) throw error;

      toast.success('Team member removed successfully');
      onUpdate();
    } catch (error: any) {
      console.error('Error removing team member:', {
        error,
        details: error.details,
        message: error.message,
        hint: error.hint,
        code: error.code
      });
      toast.error(`Error removing team member: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'member' | 'manager') => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('project_members')
        .update({ role: newRole })
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Role updated successfully');
      fetchTeamMembers();
      onUpdate();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error('Error updating role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" fontWeight="medium">
            Manage Team Members
          </Typography>
          <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
            <X />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 4 }}>
        <Box mb={4}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Add New Members
            </Typography>
            {selectedUserIds.length > 0 && (
              <Typography variant="body2" color="primary">
                {selectedUserIds.length} user{selectedUserIds.length > 1 ? 's' : ''} selected
              </Typography>
            )}
          </Box>
          <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
            <Box display="flex" gap={2} mb={2}>
              <TextField
                label="Search Users"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  fetchUsers();
                }}
                fullWidth
                variant="outlined"
                placeholder="Search by name..."
                InputProps={{
                  startAdornment: (
                    <Box component="span" sx={{ color: 'text.secondary', mr: 1 }}>
                      <Search size={20} />
                    </Box>
                  ),
                }}
              />
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Role</InputLabel>
                <Select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as 'member' | 'manager')}
                  label="Role"
                >
                  <MenuItem value="member">Team Member</MenuItem>
                  <MenuItem value="manager">Team Manager</MenuItem>
                </Select>
              </FormControl>
            </Box>
            {availableUsers.length > 0 && (
              <Box sx={{ maxHeight: 300, overflowY: 'auto', bgcolor: 'background.paper', borderRadius: 1 }}>
                <List disablePadding>
                  {availableUsers.map((user) => (
                    <ListItem
                      key={user.id}
                      sx={{ 
                        cursor: 'pointer',
                        bgcolor: selectedUserIds.includes(user.id) ? 'action.selected' : 'transparent',
                        '&:hover': {
                          bgcolor: 'action.hover'
                        },
                        borderBottom: '1px solid',
                        borderColor: 'divider'
                      }}
                      onClick={() => handleToggleUser(user.id)}
                    >
                      <Box display="flex" alignItems="center" gap={2} width="100%">
                        <UserAvatar 
                          user={user}
                          sx={{ width: 40, height: 40 }}
                        />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {user.full_name}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {user.email} • {user.department || 'No Department'}
                          </Typography>
                        </Box>
                        <Checkbox
                          checked={selectedUserIds.includes(user.id)}
                          sx={{ p: 1 }}
                        />
                      </Box>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            <Button
              variant="contained"
              onClick={handleAddMembers}
              disabled={selectedUserIds.length === 0 || loading}
              sx={{ mt: 2 }}
              startIcon={<UserPlus size={20} />}
              fullWidth
            >
              Add Selected Members ({selectedUserIds.length})
            </Button>
          </Paper>
        </Box>

        <Box>
          <Typography variant="h6" gutterBottom>
            Current Team Members ({teamMembers.length})
          </Typography>
          <Paper variant="outlined" sx={{ bgcolor: 'background.paper' }}>
            {teamMembers.length > 0 ? (
              <List disablePadding>
                {teamMembers.map((member, index) => (
                  <ListItem
                    key={member.user_id}
                    sx={{
                      borderBottom: index < teamMembers.length - 1 ? '1px solid' : 'none',
                      borderColor: 'divider',
                      py: 2
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={2} width="100%">
                      {member.user.avatar_url ? (
                        <Avatar src={member.user.avatar_url} />
                      ) : (
                        <Avatar>{member.user.full_name?.[0]}</Avatar>
                      )}
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {member.user.full_name}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {member.user.email} • {member.user.department || 'No Department'}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1}>
                        <FormControl size="small" sx={{ minWidth: 130 }}>
                          <Select
                            value={member.role}
                            onChange={(e) => handleUpdateRole(member.user_id, e.target.value as 'member' | 'manager')}
                            variant="outlined"
                            sx={{ height: 36 }}
                          >
                            <MenuItem value="member">Team Member</MenuItem>
                            <MenuItem value="manager">Team Manager</MenuItem>
                          </Select>
                        </FormControl>
                        <IconButton
                          onClick={() => handleRemoveMember(member.user_id)}
                          color="error"
                          size="small"
                          sx={{ 
                            '&:hover': { 
                              bgcolor: 'error.lighter',
                              color: 'error.main'
                            }
                          }}
                        >
                          <Trash2 size={18} />
                        </IconButton>
                      </Box>
                    </Box>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box py={4} textAlign="center">
                <Typography color="text.secondary">
                  No team members added yet
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: 'grey.50' }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
} 