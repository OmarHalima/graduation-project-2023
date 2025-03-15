import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  Grid,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  User as UserIcon,
  Shield as ShieldIcon,
  Bell as BellIcon,
  Upload as UploadIcon,
  X as XIcon,
} from 'lucide-react';
import { User } from '../types/auth';
import { supabase } from '../lib/supabase';
import { uploadAvatar, deleteAvatar, updateUserAvatar } from '../utils/avatarUtils';
import { UserAvatar } from '../components/UserAvatar';
import { RlsDebugger } from '../components/RlsDebugger';

interface SettingsPageProps {
  user: User;
  onEnableMFA: () => void;
}

export function SettingsPage({ user, onEnableMFA }: SettingsPageProps) {
  const [profileForm, setProfileForm] = useState({
    full_name: user.full_name || '',
    email: user.email || '',
  });
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    taskUpdates: true,
    projectUpdates: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatar_url);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load avatar on component mount
  useEffect(() => {
    if (user.avatar_url) {
      setAvatarUrl(user.avatar_url);
    }
  }, [user.avatar_url]);

  const handleProfileUpdate = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: profileForm.full_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      if (profileForm.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: profileForm.email,
        });
        if (emailError) throw emailError;
      }

      setSaveSuccess(true);
    } catch (error: any) {
      setSaveError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    setUploadingAvatar(true);
    setAvatarError(null);

    try {
      // Upload avatar using utility function
      const { url, error } = await uploadAvatar(user.id, file);
      
      if (error) {
        throw error;
      }
      
      if (url) {
        // Update avatar URL in database
        const { success, error: updateError } = await updateUserAvatar(user.id, url);
        
        if (updateError) {
          throw updateError;
        }
        
        // Update local state
        setAvatarUrl(url);
      }
    } catch (error: any) {
      console.error('Error uploading avatar:', error.message);
      setAvatarError(error.message);
    } finally {
      setUploadingAvatar(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!avatarUrl) return;
    
    setUploadingAvatar(true);
    setAvatarError(null);
    
    try {
      // Delete avatar using utility function
      const { success, error } = await deleteAvatar(avatarUrl);
      
      if (error) {
        throw error;
      }
      
      // Update avatar URL in database
      const { success: updateSuccess, error: updateError } = await updateUserAvatar(user.id, null);
      
      if (updateError) {
        throw updateError;
      }
      
      // Update local state
      setAvatarUrl(null);
    } catch (error: any) {
      console.error('Error removing avatar:', error.message);
      setAvatarError(error.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>

      <Grid container spacing={4}>
        {/* Profile Settings */}
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" mb={3}>
              <UserIcon size={24} style={{ marginRight: 8 }} />
              <Typography variant="h6">Profile Settings</Typography>
            </Box>

            {/* Avatar Upload Section */}
            <Box display="flex" flexDirection="column" alignItems="center" mb={4}>
              <Box position="relative" mb={2}>
                <UserAvatar
                  user={user}
                  showTooltip={false}
                  sx={{ 
                    width: 100, 
                    height: 100, 
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: 'primary.main',
                    fontSize: '2rem'
                  }}
                  onClick={handleAvatarClick}
                />
                
                {uploadingAvatar && (
                  <CircularProgress
                    size={100}
                    thickness={2}
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      zIndex: 1,
                    }}
                  />
                )}
                
                {avatarUrl && (
                  <IconButton
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      right: -10,
                      bgcolor: 'error.main',
                      color: 'white',
                      '&:hover': {
                        bgcolor: 'error.dark',
                      },
                    }}
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                  >
                    <XIcon size={16} />
                  </IconButton>
                )}
              </Box>
              
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleAvatarUpload}
              />
              
              <Button
                variant="outlined"
                startIcon={<UploadIcon size={16} />}
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
                size="small"
              >
                {avatarUrl ? 'Change Avatar' : 'Upload Avatar'}
              </Button>
              
              {avatarError && (
                <Typography color="error" variant="caption" sx={{ mt: 1 }}>
                  {avatarError}
                </Typography>
              )}
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Full Name"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                {saveError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {saveError}
                  </Alert>
                )}
                {saveSuccess && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Profile updated successfully
                  </Alert>
                )}
                <Button
                  variant="contained"
                  onClick={handleProfileUpdate}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </Grid>
            </Grid>
          </Card>
        </Grid>

        {/* Security Settings */}
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" mb={3}>
              <ShieldIcon size={24} style={{ marginRight: 8 }} />
              <Typography variant="h6">Security Settings</Typography>
            </Box>

            <Box mb={3}>
              <Typography variant="subtitle2" gutterBottom>
                Two-Factor Authentication
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Add an extra layer of security to your account
              </Typography>
              <Button
                variant="outlined"
                onClick={onEnableMFA}
                startIcon={<ShieldIcon size={16} />}
              >
                {user.mfa_enabled ? 'Manage 2FA' : 'Enable 2FA'}
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Password
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Change your password regularly to keep your account secure
              </Typography>
              <Button variant="outlined">
                Change Password
              </Button>
            </Box>
          </Card>
        </Grid>

        {/* Notification Settings */}
        <Grid item xs={12}>
          <Card sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" mb={3}>
              <BellIcon size={24} style={{ marginRight: 8 }} />
              <Typography variant="h6">Notification Settings</Typography>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notifications.email}
                      onChange={(e) => setNotifications({ ...notifications, email: e.target.checked })}
                    />
                  }
                  label="Email Notifications"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notifications.push}
                      onChange={(e) => setNotifications({ ...notifications, push: e.target.checked })}
                    />
                  }
                  label="Push Notifications"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notifications.taskUpdates}
                      onChange={(e) => setNotifications({ ...notifications, taskUpdates: e.target.checked })}
                    />
                  }
                  label="Task Updates"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notifications.projectUpdates}
                      onChange={(e) => setNotifications({ ...notifications, projectUpdates: e.target.checked })}
                    />
                  }
                  label="Project Updates"
                />
              </Grid>
            </Grid>
          </Card>
        </Grid>
        
        {/* Developer Tools - only visible in development mode */}
        {import.meta.env.DEV && (
          <Grid item xs={12}>
            <Typography variant="h5" sx={{ mt: 2, mb: 2 }}>
              Developer Tools
            </Typography>
            <RlsDebugger userId={user.id} />
          </Grid>
        )}
      </Grid>
    </Box>
  );
} 