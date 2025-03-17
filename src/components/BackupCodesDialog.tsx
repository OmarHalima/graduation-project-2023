import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  CircularProgress,
  Alert,
  Paper,
  Divider,
  Tooltip,
  IconButton,
  Grid,
} from '@mui/material';
import {
  Key as KeyIcon,
  Copy as CopyIcon,
  Printer as PrinterIcon,
  AlertTriangle as AlertIcon,
  Shield as ShieldIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User } from '../types/auth';

interface BackupCodesDialogProps {
  open: boolean;
  onClose: () => void;
  user: User;
}

export function BackupCodesDialog({ open, onClose, user }: BackupCodesDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showCodes, setShowCodes] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  const generateBackupCodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc('generate_backup_codes', {
        p_user_id: user.id
      });

      if (error) {
        // Check if this is because the function doesn't exist
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          setError("Backup codes functionality is not set up yet. Please run database migrations first.");
          return;
        }
        throw error;
      }

      // Extract codes from the response
      const codes = data.map((item: any) => item.code);
      setBackupCodes(codes);
      setShowCodes(true);

      // Try to log the security event, but don't fail if it doesn't work
      try {
        await supabase.rpc('log_security_event', {
          p_user_id: user.id,
          p_action: 'generate_backup_codes',
          p_ip_address: await fetch('https://api.ipify.org?format=json').then(r => r.json()).then(data => data.ip),
          p_user_agent: navigator.userAgent
        });
      } catch (logError) {
        console.error('[BackupCodes] Error logging security event:', logError);
      }

    } catch (error: any) {
      console.error('[BackupCodes] Error generating backup codes:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printContent = `
      BACKUP CODES FOR ${user.email}
      Generated on ${new Date().toLocaleString()}
      
      Keep these codes in a safe place. Each code can only be used once.
      
      ${backupCodes.join('\n')}
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>2FA Backup Codes</title>
            <style>
              body {
                font-family: monospace;
                padding: 20px;
                white-space: pre-wrap;
                line-height: 1.5;
              }
              h1 {
                font-size: 18px;
                margin-bottom: 16px;
              }
              .code-list {
                margin: 20px 0;
              }
              .code {
                font-size: 16px;
                letter-spacing: 1px;
                margin: 8px 0;
              }
              .footer {
                margin-top: 30px;
                font-size: 12px;
                color: #666;
              }
            </style>
          </head>
          <body>
            <h1>BACKUP CODES FOR ${user.email}</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p>Keep these codes in a safe place. Each code can only be used once.</p>
            
            <div class="code-list">
              ${backupCodes.map(code => `<div class="code">${code}</div>`).join('')}
            </div>
            
            <div class="footer">
              If you lose your authenticator device and these backup codes, you will lose access to your account.
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(backupCodes.join('\n')).then(() => {
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    });
  };

  const handleClose = () => {
    setShowCodes(false);
    setBackupCodes([]);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: 3,
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" sx={{ py: 1 }}>
          <KeyIcon size={22} style={{ marginRight: 14 }} />
          <Typography variant="h6">Two-Factor Authentication Backup Codes</Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ px: { xs: 3, sm: 4 }, pb: 2 }}>
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 4 }}
            icon={<AlertIcon size={20} />}
          >
            {error}
          </Alert>
        )}

        {!showCodes ? (
          <Box sx={{ py: 2 }}>
            <Box display="flex" alignItems="center" mb={4} p={3} bgcolor="background.default" borderRadius={1}>
              <ShieldIcon size={28} style={{ marginRight: 16, color: '#4caf50' }} />
              <Box>
                <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                  Backup Codes Provide Emergency Access
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  If you lose access to your authenticator app, you can use these backup codes to sign in.
                </Typography>
              </Box>
            </Box>
            
            <Typography variant="body1" paragraph sx={{ mb: 3 }}>
              Backup codes allow you to access your account if you lose your device or authenticator app.
              Each code can only be used once for security reasons.
            </Typography>
            
            <Alert 
              severity="warning" 
              sx={{ mb: 4 }}
              icon={<AlertIcon size={20} />}
            >
              Generating new codes will invalidate any existing backup codes. Store your codes in a secure location.
            </Alert>
            
            <Button
              variant="contained"
              onClick={generateBackupCodes}
              disabled={loading}
              startIcon={<KeyIcon size={18} />}
              fullWidth
              size="large"
              sx={{ py: 1.5, mb: 2 }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Generate New Backup Codes'
              )}
            </Button>
          </Box>
        ) : (
          <Box sx={{ py: 2 }}>
            <Alert 
              severity="success" 
              sx={{ mb: 4 }}
            >
              Your backup codes have been generated successfully. Save them in a secure location.
            </Alert>
            
            <Typography variant="body1" paragraph sx={{ mb: 3 }}>
              Each code can only be used once. Store them in a safe place but not with your authenticator device.
            </Typography>
            
            <Paper 
              elevation={0} 
              sx={{ 
                bgcolor: 'background.default',
                borderRadius: 2,
                p: 3,
                mb: 4,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle2" color="text.secondary">
                  Your Backup Codes
                </Typography>
                <Box>
                  <Tooltip title={copiedToClipboard ? "Copied!" : "Copy to clipboard"}>
                    <IconButton onClick={handleCopyToClipboard} size="small">
                      <CopyIcon size={16} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Print codes">
                    <IconButton onClick={handlePrint} size="small" sx={{ ml: 1 }}>
                      <PrinterIcon size={16} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              
              <Divider sx={{ mb: 3 }} />
              
              <Grid container spacing={2}>
                {backupCodes.map((code, index) => (
                  <Grid item xs={6} key={index}>
                    <Typography
                      variant="h6"
                      fontFamily="monospace"
                      sx={{
                        p: 1.5,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        textAlign: 'center',
                        letterSpacing: 1.5,
                      }}
                    >
                      {code}
                    </Typography>
                  </Grid>
                ))}
              </Grid>
            </Paper>
            
            <Box display="flex" gap={3} mb={4}>
              <Button
                variant="outlined"
                onClick={handlePrint}
                startIcon={<PrinterIcon size={16} />}
                fullWidth
                sx={{ py: 1.2 }}
              >
                Print Codes
              </Button>
              <Button
                variant="outlined"
                onClick={handleCopyToClipboard}
                startIcon={<CopyIcon size={16} />}
                fullWidth
                sx={{ py: 1.2 }}
              >
                {copiedToClipboard ? 'Copied!' : 'Copy Codes'}
              </Button>
            </Box>
            
            <Alert 
              severity="warning" 
              icon={<AlertIcon size={20} />}
              sx={{ mt: 2 }}
            >
              Make sure to save these codes now. You won't be able to see them again!
            </Alert>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 4, py: 4 }}>
        <Button 
          onClick={handleClose} 
          variant={showCodes ? "contained" : "outlined"}
          sx={{ px: 4, py: 1.2 }}
        >
          {showCodes ? 'Done' : 'Cancel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
} 