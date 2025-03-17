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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Paper,
  Container,
  ListItemIcon,
  Fade,
  Grow,
  Zoom,
} from '@mui/material';
import {
  User as UserIcon,
  Shield as ShieldIcon,
  Bell as BellIcon,
  Upload as UploadIcon,
  X as XIcon,
  Key as KeyIcon,
  History as HistoryIcon,
  Mail as MailIcon,
  AlertTriangle as AlertIcon,
  LogOut as LogOutIcon,
  Calendar as CalendarIcon,
  LockIcon,
} from 'lucide-react';
import { User } from '../types/auth';
import { supabase } from '../lib/supabase';
import { uploadAvatar, deleteAvatar, updateUserAvatar } from '../utils/avatarUtils';
import { UserAvatar } from '../components/UserAvatar';
import { RlsDebugger } from '../components/RlsDebugger';
import { BackupCodesDialog } from '../components/BackupCodesDialog';

interface SettingsPageProps {
  user: User;
  onEnableMFA: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Fade in={value === index} timeout={500}>
          <Box sx={{ py: 3 }}>
            {children}
          </Box>
        </Fade>
      )}
    </div>
  );
}

export function SettingsPage({ user: initialUser, onEnableMFA }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [user, setUser] = useState<User>(initialUser);
  const [profileForm, setProfileForm] = useState({
    full_name: initialUser.full_name || '',
    email: initialUser.email || '',
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialUser.avatar_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security settings
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [sessions, setSessions] = useState<any[]>([]);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [securitySettings, setSecuritySettings] = useState({
    notifyOnNewLogin: true,
    notifyOnPasswordChange: true,
    notifyOnMFAChange: true,
    requireMFAForSensitiveActions: false,
  });
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Fetch latest user data including avatar_url
  const fetchLatestUserData = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', initialUser.id)
        .single();

      if (error) {
        console.error('[Settings] Error fetching user data:', error);
        return;
      }

      if (data) {
        console.log('[Settings] Latest user data fetched:', data);
        setUser({ ...initialUser, ...data });
        setAvatarUrl(data.avatar_url);
      }
    } catch (error) {
      console.error('[Settings] Error:', error);
    }
  };

  // Load avatar on component mount and when user prop changes
  useEffect(() => {
    setAvatarUrl(initialUser.avatar_url || null);
    fetchLatestUserData();
  }, [initialUser.id]);

  // Add validation logging
  useEffect(() => {
    console.log('[Settings] User Data Validation:', {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      avatar_url: user.avatar_url
    });

    // Validate avatar URL
    if (user.avatar_url) {
      const img = new Image();
      img.onload = () => {
        console.log('[Settings] Avatar image loaded successfully:', user.avatar_url);
      };
      img.onerror = () => {
        console.error('[Settings] Avatar image failed to load:', user.avatar_url);
        // If avatar fails to load, try to fetch latest user data
        fetchLatestUserData();
      };
      img.src = user.avatar_url;
    } else {
      console.log('[Settings] No avatar URL found, using initials fallback');
      // If no avatar URL, try to fetch latest user data
      fetchLatestUserData();
    }
  }, [user]);

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
      // Refresh user data after successful update
      await fetchLatestUserData();
    } catch (error: any) {
      setSaveError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarClick = () => {
    console.log('[Settings] Avatar click - opening file picker');
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      console.log('[Settings] No file selected for upload');
      return;
    }

    const file = files[0];
    console.log('[Settings] Starting avatar upload:', { fileName: file.name, fileSize: file.size });
    setUploadingAvatar(true);
    setAvatarError(null);

    try {
      // Upload avatar using utility function
      const { url, error } = await uploadAvatar(user.id, file);
      
      if (error) {
        throw error;
      }
      
      if (url) {
        console.log('[Settings] Avatar uploaded successfully:', url);
        // Update avatar URL in database
        const { success, error: updateError } = await updateUserAvatar(user.id, url);
        
        if (updateError) {
          throw updateError;
        }
        
        console.log('[Settings] Avatar URL updated in database');
        // Update local state and refresh user data
        setAvatarUrl(url);
        await fetchLatestUserData();
      }
    } catch (error: any) {
      console.error('[Settings] Error uploading avatar:', error.message);
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
    if (!avatarUrl) {
      console.log('[Settings] No avatar to remove');
      return;
    }
    
    console.log('[Settings] Starting avatar removal');
    setUploadingAvatar(true);
    setAvatarError(null);
    
    try {
      // Delete avatar using utility function
      const { success, error } = await deleteAvatar(avatarUrl, user.id);
      
      if (error) {
        throw error;
      }
      
      console.log('[Settings] Avatar deleted from storage');
      // Update avatar URL in database
      const { success: updateSuccess, error: updateError } = await updateUserAvatar(user.id, null);
      
      if (updateError) {
        throw updateError;
      }
      
      console.log('[Settings] Avatar URL removed from database');
      // Update local state and refresh user data
      setAvatarUrl(null);
      await fetchLatestUserData();
    } catch (error: any) {
      console.error('[Settings] Error removing avatar:', error.message);
      setAvatarError(error.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Fetch active sessions
  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      // getSession returns the current session, so we put it in an array
      setSessions(data?.session ? [data.session] : []);
    } catch (error: any) {
      console.error('[Settings] Error fetching sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Fetch login history
  const fetchLoginHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('auth_audit_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) {
        if (error.code === '42P01') { // Table doesn't exist yet
          setLoginHistory([]);
          return;
        }
        throw error;
      }
      
      setLoginHistory(data || []);
    } catch (error: any) {
      console.error('[Settings] Error fetching login history:', error);
      setLoginHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Handle password change
  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setSaveError('New passwords do not match');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (error) throw error;

      // Log the password change
      await supabase.from('auth_audit_log').insert({
        user_id: user.id,
        action: 'password_change',
        ip_address: await fetch('https://api.ipify.org?format=json').then(r => r.json()).then(data => data.ip),
        user_agent: navigator.userAgent
      });

      // Send notification if enabled
      if (securitySettings.notifyOnPasswordChange) {
        await supabase.functions.invoke('send-security-notification', {
          body: {
            type: 'password_change',
            userId: user.id,
            email: user.email
          }
        });
      }

      setShowPasswordDialog(false);
      setSaveSuccess(true);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      setSaveError(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle session termination
  const handleTerminateSession = async (sessionId: string) => {
    try {
      // To terminate a session, we can use signOut method
      const { error } = await supabase.auth.signOut({
        scope: 'others' // This will sign out all other sessions except the current one
      });
      if (error) throw error;
      await fetchSessions();
    } catch (error: any) {
      console.error('[Settings] Error terminating session:', error);
    }
  };

  // Handle security settings update
  const handleSecuritySettingsUpdate = async (setting: keyof typeof securitySettings) => {
    try {
      const newSettings = {
        ...securitySettings,
        [setting]: !securitySettings[setting]
      };
      
      const { error } = await supabase
        .from('user_security_settings')
        .upsert({
          user_id: user.id,
          settings: newSettings
        });

      if (error) throw error;
      setSecuritySettings(newSettings);
    } catch (error: any) {
      console.error('[Settings] Error updating security settings:', error);
    }
  };

  // Ensure required tables exist
  const ensureTablesExist = async () => {
    try {
      // Check if the tables exist by querying them
      const { error: auditLogError } = await supabase
        .from('auth_audit_log')
        .select('id')
        .limit(1);

      const { error: settingsError } = await supabase
        .from('user_security_settings')
        .select('user_id')
        .limit(1);

      // If the tables don't exist and we get errors, create default settings for user
      if (auditLogError || settingsError) {
        console.log('[Settings] Creating default security settings for user');
        
        // Create default security settings for the user
        const { error } = await supabase
          .from('user_security_settings')
          .upsert({
            user_id: user.id,
            settings: securitySettings,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (error && error.code !== '42P01') { // Ignore 'relation does not exist' errors
          console.error('[Settings] Error creating default security settings:', error);
        }
      }
    } catch (error: any) {
      console.error('[Settings] Error ensuring tables exist:', error);
    }
  };

  // Load security settings on mount
  useEffect(() => {
    const loadSecuritySettings = async () => {
      try {
        await ensureTablesExist();
        
        const { data, error } = await supabase
          .from('user_security_settings')
          .select('settings')
          .eq('user_id', user.id)
          .maybeSingle(); // Use maybeSingle instead of expecting a single result

        if (error && error.code !== 'PGRST116') {
          // Log and handle any errors other than "No rows returned"
          console.error('[Settings] Error loading security settings:', error);
          return;
        }

        // If we have data, use it, otherwise create default settings
        if (data?.settings) {
          setSecuritySettings(data.settings);
        } else {
          // No settings found, create default ones
          const defaultSettings = {
            notifyOnNewLogin: true,
            notifyOnPasswordChange: true,
            notifyOnMFAChange: true,
            requireMFAForSensitiveActions: false
          };
          
          setSecuritySettings(defaultSettings);
          
          // Save default settings to database
          const { error: upsertError } = await supabase
            .from('user_security_settings')
            .upsert({
              user_id: user.id,
              settings: defaultSettings,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            
          if (upsertError) {
            console.error('[Settings] Error creating default security settings:', upsertError);
          }
        }
      } catch (error: any) {
        console.error('[Settings] Error in loadSecuritySettings:', error);
      }
    };

    if (user?.id) {
      fetchSessions();
      fetchLoginHistory();
      loadSecuritySettings();
    }
  }, [user?.id]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 5 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          Account Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your profile, security preferences, and notification settings
        </Typography>
      </Box>

      <Paper 
        elevation={0} 
        sx={{ 
          mb: 5, 
          borderRadius: 2, 
          overflow: 'hidden', 
          border: '1px solid', 
          borderColor: 'divider',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          variant="fullWidth" 
          sx={{ 
            borderBottom: 1, 
            borderColor: 'divider',
            bgcolor: 'background.paper',
            px: 2,
          }}
        >
          <Tab 
            icon={<UserIcon size={18} />} 
            label="Profile" 
            id="settings-tab-0"
            aria-controls="settings-tabpanel-0"
            sx={{ py: 3 }}
          />
          <Tab 
            icon={<ShieldIcon size={18} />} 
            label="Security" 
            id="settings-tab-1"
            aria-controls="settings-tabpanel-1"
            sx={{ py: 3 }}
          />
          <Tab 
            icon={<BellIcon size={18} />} 
            label="Notifications" 
            id="settings-tab-2"
            aria-controls="settings-tabpanel-2"
            sx={{ py: 3 }}
          />
        </Tabs>

        {/* Profile Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ px: { xs: 2, sm: 4 } }}>
            {/* Profile photo section */}
            <Box 
              display="flex" 
              flexDirection={{ xs: 'column', sm: 'row' }} 
              alignItems="center" 
              mb={5}
              p={4}
              bgcolor="background.default"
              borderRadius={2}
            >
              <Zoom in={true} timeout={500}>
                <Box position="relative" mb={{ xs: 3, sm: 0 }} mr={{ sm: 5 }}>
                  <UserAvatar
                    user={user}
                    showTooltip={false}
                    sx={{ 
                      width: 140, 
                      height: 140, 
                      cursor: 'pointer',
                      border: '2px solid',
                      borderColor: 'primary.main',
                      fontSize: '2.8rem',
                      transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'scale(1.05)',
                        boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
                      },
                    }}
                    onClick={handleAvatarClick}
                  />
                  
                  {uploadingAvatar && (
                    <CircularProgress
                      size={140}
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
              </Zoom>
              
              <Box>
                <Typography variant="h6" gutterBottom>
                  Profile Photo
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 3 }}>
                  Upload a photo to personalize your account
                </Typography>
                
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
                  size="medium"
                  sx={{ px: 3, py: 1 }}
                >
                  {avatarUrl ? 'Change Photo' : 'Upload Photo'}
                </Button>
                
                {avatarError && (
                  <Typography color="error" variant="caption" sx={{ mt: 2, display: 'block' }}>
                    {avatarError}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Personal information section */}
            <Box mb={5}>
              <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                Personal Information
              </Typography>
              <Divider sx={{ mb: 4 }} />
              
              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Full Name"
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    variant="outlined"
                    sx={{ mb: { xs: 0, md: 2 } }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Email Address"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} sx={{ mt: 2 }}>
                  {saveError && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                      {saveError}
                    </Alert>
                  )}
                  {saveSuccess && (
                    <Alert severity="success" sx={{ mb: 3 }}>
                      Profile updated successfully
                    </Alert>
                  )}
                  <Button
                    variant="contained"
                    onClick={handleProfileUpdate}
                    disabled={isSaving}
                    sx={{ px: 4, py: 1.2 }}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </Grid>
              </Grid>
            </Box>
            
            {/* Account information section */}
            <Box>
              <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                Account Information
              </Typography>
              <Divider sx={{ mb: 4 }} />
              
              <List disablePadding sx={{ pl: 2 }}>
                <ListItem sx={{ px: 0, py: 2 }}>
                  <ListItemIcon sx={{ minWidth: 50 }}>
                    <UserIcon size={22} />
                  </ListItemIcon>
                  <ListItemText 
                    primary={<Typography variant="subtitle1" fontWeight="medium">Account Type</Typography>} 
                    secondary={user.role || 'Standard User'} 
                  />
                </ListItem>
                <ListItem sx={{ px: 0, py: 2 }}>
                  <ListItemIcon sx={{ minWidth: 50 }}>
                    <CalendarIcon size={22} />
                  </ListItemIcon>
                  <ListItemText 
                    primary={<Typography variant="subtitle1" fontWeight="medium">Account Created</Typography>} 
                    secondary={new Date(user.created_at).toLocaleDateString()} 
                  />
                </ListItem>
              </List>
            </Box>
          </Box>
        </TabPanel>

        {/* Security Tab */}
        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={4} sx={{ px: { xs: 2, sm: 4 } }}>
            {/* Two-Factor Authentication */}
            <Grid item xs={12}>
              <Box 
                p={4} 
                bgcolor="background.default" 
                borderRadius={2}
                border={1}
                borderColor={user.mfa_enabled ? 'success.main' : 'divider'}
              >
                <Box display="flex" alignItems="center" mb={3}>
                  <ShieldIcon 
                    size={28} 
                    style={{ 
                      marginRight: 16, 
                      color: user.mfa_enabled ? '#4caf50' : undefined 
                    }} 
                  />
                  <Box>
                    <Typography variant="h6">Two-Factor Authentication (2FA)</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {user.mfa_enabled 
                        ? 'Your account is protected with two-factor authentication' 
                        : 'Add an extra layer of security to your account'}
                    </Typography>
                  </Box>
                </Box>
                
                <Box mt={3} display="flex" alignItems="center" flexWrap="wrap" gap={2}>
                  <Button
                    variant={user.mfa_enabled ? "outlined" : "contained"}
                    onClick={onEnableMFA}
                    startIcon={<ShieldIcon size={16} />}
                    sx={{ px: 3, py: 1 }}
                  >
                    {user.mfa_enabled ? 'Manage 2FA' : 'Enable 2FA'}
                  </Button>
                  
                  {user.mfa_enabled && (
                    <Button
                      variant="outlined"
                      color="secondary"
                      startIcon={<KeyIcon size={16} />}
                      onClick={() => setShowBackupCodes(true)}
                      sx={{ px: 3, py: 1 }}
                    >
                      Backup Codes
                    </Button>
                  )}
                </Box>
              </Box>
            </Grid>
            
            {/* Password Section */}
            <Grid item xs={12} md={6}>
              <Grow in={true} timeout={500} style={{ transformOrigin: '0 0 0' }}>
                <Card variant="outlined" sx={{ 
                  borderRadius: 2,
                  height: '100%',
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.08)',
                  },
                }}>
                  <Box p={4}>
                    <Box display="flex" alignItems="center" mb={3}>
                      <LockIcon size={24} style={{ marginRight: 16 }} />
                      <Typography variant="h6">Password</Typography>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 4 }}>
                      Change your password regularly to keep your account secure. Your password should be at least 8 characters long and include a mix of letters, numbers, and symbols.
                    </Typography>
                    
                    <Button 
                      variant="outlined"
                      onClick={() => setShowPasswordDialog(true)}
                      startIcon={<KeyIcon size={16} />}
                      sx={{ px: 3, py: 1 }}
                    >
                      Change Password
                    </Button>
                  </Box>
                </Card>
              </Grow>
            </Grid>
            
            {/* Sessions Section */}
            <Grid item xs={12} md={6}>
              <Grow in={true} timeout={500} style={{ transformOrigin: '0 0 0' }}>
                <Card variant="outlined" sx={{ 
                  borderRadius: 2,
                  height: '100%',
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.08)',
                  },
                }}>
                  <Box p={4}>
                    <Box display="flex" alignItems="center" mb={3}>
                      <HistoryIcon size={24} style={{ marginRight: 16 }} />
                      <Typography variant="h6">Active Sessions</Typography>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 4 }}>
                      Manage your active sessions across different devices. Sign out from other devices if you suspect unauthorized access.
                    </Typography>
                    
                    {loadingSessions ? (
                      <CircularProgress size={24} />
                    ) : sessions.length > 0 ? (
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<LogOutIcon size={16} />}
                        onClick={() => handleTerminateSession('')}
                        sx={{ px: 3, py: 1 }}
                      >
                        Sign Out Other Devices
                      </Button>
                    ) : (
                      <Typography variant="body2">No other active sessions</Typography>
                    )}
                  </Box>
                </Card>
              </Grow>
            </Grid>
            
            {/* Login History */}
            <Grid item xs={12}>
              <Grow in={true} timeout={500} style={{ transformOrigin: '0 0 0' }}>
                <Card variant="outlined" sx={{ 
                  borderRadius: 2,
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.08)',
                  },
                }}>
                  <Box p={4}>
                    <Box display="flex" alignItems="center" mb={3}>
                      <HistoryIcon size={24} style={{ marginRight: 16 }} />
                      <Typography variant="h6">Login History</Typography>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 3 }}>
                      Review recent account activity to ensure no unauthorized access
                    </Typography>
                    
                    {loadingHistory ? (
                      <CircularProgress size={24} />
                    ) : loginHistory.length > 0 ? (
                      <List sx={{ bgcolor: 'background.default', borderRadius: 1, p: 2 }}>
                        {loginHistory.slice(0, 5).map((log) => (
                          <ListItem key={log.id} divider sx={{ py: 2 }}>
                            <ListItemIcon sx={{ minWidth: 50 }}>
                              <HistoryIcon size={20} />
                            </ListItemIcon>
                            <ListItemText
                              primary={<Typography fontWeight="medium">{log.action}</Typography>}
                              secondary={`From ${log.ip_address || 'Unknown'} • ${new Date(log.created_at).toLocaleString()}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Alert severity="info">No recent login activity recorded</Alert>
                    )}
                  </Box>
                </Card>
              </Grow>
            </Grid>
            
            {/* Security Notifications */}
            <Grid item xs={12}>
              <Grow in={true} timeout={500} style={{ transformOrigin: '0 0 0' }}>
                <Card variant="outlined" sx={{ 
                  borderRadius: 2,
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.08)',
                  },
                }}>
                  <Box p={4}>
                    <Box display="flex" alignItems="center" mb={3}>
                      <AlertIcon size={24} style={{ marginRight: 16 }} />
                      <Typography variant="h6">Security Notifications</Typography>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 3 }}>
                      Choose when to receive security alerts about your account
                    </Typography>
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={securitySettings.notifyOnNewLogin}
                              onChange={() => handleSecuritySettingsUpdate('notifyOnNewLogin')}
                              color="primary"
                            />
                          }
                          label="New login notifications"
                          sx={{ py: 1 }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={securitySettings.notifyOnPasswordChange}
                              onChange={() => handleSecuritySettingsUpdate('notifyOnPasswordChange')}
                              color="primary"
                            />
                          }
                          label="Password change notifications"
                          sx={{ py: 1 }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={securitySettings.notifyOnMFAChange}
                              onChange={() => handleSecuritySettingsUpdate('notifyOnMFAChange')}
                              color="primary"
                            />
                          }
                          label="2FA settings change notifications"
                          sx={{ py: 1 }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={securitySettings.requireMFAForSensitiveActions}
                              onChange={() => handleSecuritySettingsUpdate('requireMFAForSensitiveActions')}
                              color="primary"
                            />
                          }
                          label="Require 2FA for sensitive actions"
                          sx={{ py: 1 }}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </Card>
              </Grow>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Notifications Tab */}
        <TabPanel value={activeTab} index={2}>
          <Box p={4} bgcolor="background.default" borderRadius={2} sx={{ mx: { xs: 2, sm: 4 } }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 1 }}>
              Notification Preferences
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 4 }}>
              Control how you receive notifications from the system
            </Typography>
            
            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Grow in={true} timeout={500} style={{ transformOrigin: '0 0 0' }}>
                  <Card variant="outlined" sx={{ 
                    borderRadius: 2,
                    height: '100%',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.08)',
                    },
                  }}>
                    <Box p={4}>
                      <Typography variant="subtitle1" fontWeight="medium" gutterBottom sx={{ mb: 2 }}>
                        Email Notifications
                      </Typography>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={notifications.email}
                            onChange={(e) => setNotifications({ ...notifications, email: e.target.checked })}
                            color="primary"
                          />
                        }
                        label="Enable email notifications"
                        sx={{ py: 1 }}
                      />
                    </Box>
                  </Card>
                </Grow>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Grow in={true} timeout={500} style={{ transformOrigin: '0 0 0' }}>
                  <Card variant="outlined" sx={{ 
                    borderRadius: 2,
                    height: '100%',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.08)',
                    },
                  }}>
                    <Box p={4}>
                      <Typography variant="subtitle1" fontWeight="medium" gutterBottom sx={{ mb: 2 }}>
                        Push Notifications
                      </Typography>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={notifications.push}
                            onChange={(e) => setNotifications({ ...notifications, push: e.target.checked })}
                            color="primary"
                          />
                        }
                        label="Enable push notifications"
                        sx={{ py: 1 }}
                      />
                    </Box>
                  </Card>
                </Grow>
              </Grid>
            </Grid>
            
            <Typography variant="h6" sx={{ mt: 5, mb: 3 }}>
              Notification Types
            </Typography>
            
            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Grow in={true} timeout={500} style={{ transformOrigin: '0 0 0' }}>
                  <Card variant="outlined" sx={{ 
                    borderRadius: 2,
                    height: '100%',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.08)',
                    },
                  }}>
                    <Box p={4}>
                      <Box display="flex" alignItems="center" mb={3}>
                        <BellIcon size={20} style={{ marginRight: 12 }} />
                        <Typography variant="subtitle1" fontWeight="medium">
                          Tasks
                        </Typography>
                      </Box>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={notifications.taskUpdates}
                            onChange={(e) => setNotifications({ ...notifications, taskUpdates: e.target.checked })}
                            color="primary"
                          />
                        }
                        label="Task updates and reminders"
                        sx={{ py: 1 }}
                      />
                    </Box>
                  </Card>
                </Grow>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Grow in={true} timeout={500} style={{ transformOrigin: '0 0 0' }}>
                  <Card variant="outlined" sx={{ 
                    borderRadius: 2,
                    height: '100%',
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.08)',
                    },
                  }}>
                    <Box p={4}>
                      <Box display="flex" alignItems="center" mb={3}>
                        <BellIcon size={20} style={{ marginRight: 12 }} />
                        <Typography variant="subtitle1" fontWeight="medium">
                          Projects
                        </Typography>
                      </Box>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={notifications.projectUpdates}
                            onChange={(e) => setNotifications({ ...notifications, projectUpdates: e.target.checked })}
                            color="primary"
                          />
                        }
                        label="Project status changes"
                        sx={{ py: 1 }}
                      />
                    </Box>
                  </Card>
                </Grow>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>
      </Paper>

      {/* Developer Tools - only visible to admins */}
      {user.role === 'admin' && (
        <Box mt={5} mb={5}>
          <Typography variant="h5" sx={{ mb: 3 }}>
            Developer Tools
          </Typography>
          <RlsDebugger userId={user.id} />
        </Box>
      )}

      {/* Password Change Dialog */}
      <Dialog 
        open={showPasswordDialog} 
        onClose={() => setShowPasswordDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" sx={{ p: 1 }}>
            <KeyIcon size={22} style={{ marginRight: 12 }} />
            <Typography variant="h6">Change Password</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 1 }}>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              type="password"
              label="Current Password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              sx={{ mb: 4 }}
              variant="outlined"
            />
            <TextField
              fullWidth
              type="password"
              label="New Password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              sx={{ mb: 4 }}
              variant="outlined"
            />
            <TextField
              fullWidth
              type="password"
              label="Confirm New Password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              variant="outlined"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 4, py: 4 }}>
          <Button 
            onClick={() => setShowPasswordDialog(false)}
            variant="outlined"
            sx={{ px: 3, py: 1, mr: 2 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePasswordChange}
            disabled={isSaving || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
            variant="contained"
            sx={{ px: 3, py: 1 }}
          >
            {isSaving ? 'Changing...' : 'Change Password'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Backup Codes Dialog */}
      <BackupCodesDialog
        open={showBackupCodes}
        onClose={() => setShowBackupCodes(false)}
        user={user}
      />
    </Container>
  );
} 