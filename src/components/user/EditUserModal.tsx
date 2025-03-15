import { useState } from 'react';
import { supabaseAdmin } from '../../../lib/supabase';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { User, UserRole, UserStatus } from '../../types/auth';
import { useAuth } from '../../contexts/auth/AuthContext';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Box,
  Grid,
} from '@mui/material';

interface EditUserModalProps {
  user: User;
  onClose: () => void;
  onUpdated: (updatedUser: User) => void;
}

export function EditUserModal({ user, onClose, onUpdated }: EditUserModalProps) {
  const [loading, setLoading] = useState(false);
  const { user: currentUser, session } = useAuth();
  const [formData, setFormData] = useState({
    email: user.email,
    full_name: user.full_name,
    role: user.role as UserRole,
    status: user.status as UserStatus,
    department: user.department || '',
    position: user.position || '',
    avatar_url: user.avatar_url || '',
    mfa_enabled: user.mfa_enabled
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!session?.access_token) {
        throw new Error('No active session found');
      }

      if (!currentUser?.id) {
        throw new Error('No authenticated user found');
      }

      if (!supabaseAdmin) {
        throw new Error('Admin client not available');
      }

      console.log('Updating user with session:', {
        currentUser,
        sessionToken: session.access_token.substring(0, 10) + '...',
        targetUser: user.id
      });

      // First update the auth user metadata
      if (currentUser.role === 'admin') {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          user.id,
          {
            email: formData.email,
            user_metadata: {
              full_name: formData.full_name,
              role: formData.role,
              status: formData.status,
              department: formData.department,
              position: formData.position,
              avatar_url: formData.avatar_url,
              mfa_enabled: formData.mfa_enabled
            }
          }
        );

        if (authError) {
          console.error('Error updating auth user:', authError);
          throw authError;
        }
      }

      // Then update the user profile in the database
      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          status: formData.status,
          department: formData.department || null,
          position: formData.position || null,
          avatar_url: formData.avatar_url || null,
          mfa_enabled: formData.mfa_enabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user profile:', updateError);
        throw updateError;
      }

      toast.success('User updated successfully');
      onUpdated(updatedUser as User);
      onClose();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error('Error updating user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          Edit User
          <IconButton onClick={onClose} size="small">
            <X />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={currentUser?.role !== 'admin'}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Full Name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </Grid>
            {currentUser?.role === 'admin' && (
              <>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Role</InputLabel>
                    <Select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                      label="Role"
                    >
                      <MenuItem value="employee">Employee</MenuItem>
                      <MenuItem value="project_manager">Project Manager</MenuItem>
                      <MenuItem value="admin">Admin</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as UserStatus })}
                      label="Status"
                    >
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Position"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Avatar URL"
                value={formData.avatar_url}
                onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
              />
            </Grid>
            {currentUser?.role === 'admin' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>MFA Enabled</InputLabel>
                  <Select
                    value={formData.mfa_enabled}
                    onChange={(e) => setFormData({ ...formData, mfa_enabled: e.target.value === 'true' })}
                    label="MFA Enabled"
                  >
                    <MenuItem value="true">Yes</MenuItem>
                    <MenuItem value="false">No</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={loading}
        >
          {loading ? 'Updating...' : 'Update User'}
        </Button>
      </DialogActions>
    </Dialog>
  );
} 