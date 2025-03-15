import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  AlertTitle,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import {
  ChevronDown as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  CheckCircle as CheckIcon,
  AlertCircle as AlertIcon,
  HelpCircle as HelpIcon,
} from 'lucide-react';
import { runAllDiagnostics, getRlsRecommendations } from '../utils/supabaseRlsCheck';

interface RlsDebuggerProps {
  userId: string | undefined;
}

export function RlsDebugger({ userId }: RlsDebuggerProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleAccordionChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  const runDiagnostics = async () => {
    if (!userId) {
      setError('User ID is required to run diagnostics');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const diagnosticResults = await runAllDiagnostics(userId);
      setResults(diagnosticResults);
    } catch (err: any) {
      console.error('Error running diagnostics:', err);
      setError(err.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const recommendations = getRlsRecommendations();

  // If no user ID is provided, show a warning
  if (!userId) {
    return (
      <Box sx={{ my: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Alert severity="warning">
            <AlertTitle>User ID Required</AlertTitle>
            A valid user ID is required to run RLS diagnostics.
          </Alert>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ my: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          RLS Policy Debugger
        </Typography>
        
        <Typography variant="body2" color="text.secondary" paragraph>
          This tool helps diagnose Row Level Security (RLS) policy issues in your Supabase database.
          It will check for common problems with table permissions and storage buckets.
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <Button 
            variant="contained" 
            onClick={runDiagnostics} 
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <HelpIcon size={20} />}
          >
            {loading ? 'Running Diagnostics...' : 'Run RLS Diagnostics'}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <AlertTitle>Error</AlertTitle>
            {error}
          </Alert>
        )}

        {results && (
          <Box sx={{ mt: 3 }}>
            <Alert 
              severity={results.hasIssues ? "warning" : "success"}
              sx={{ mb: 3 }}
            >
              <AlertTitle>
                {results.hasIssues 
                  ? "Found potential RLS policy issues" 
                  : "All tests passed successfully"}
              </AlertTitle>
              {results.hasIssues 
                ? "There are some RLS policy issues that need to be addressed." 
                : "No RLS policy issues were detected."}
            </Alert>

            {results.suggestions.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Suggested Fixes:
                </Typography>
                <List>
                  {results.suggestions.map((suggestion: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemText primary={suggestion} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            <Typography variant="h6" gutterBottom>
              Diagnostic Results:
            </Typography>
            
            {Object.entries(results.results).map(([key, value]: [string, any]) => (
              <Accordion 
                key={key}
                expanded={expanded === key}
                onChange={handleAccordionChange(key)}
                sx={{ mb: 1 }}
              >
                <AccordionSummary
                  expandIcon={expanded === key ? <ExpandMoreIcon size={20} /> : <ChevronRightIcon size={20} />}
                >
                  <Box display="flex" alignItems="center">
                    <Box mr={1}>
                      {value.success ? (
                        <CheckIcon size={20} color="success" />
                      ) : (
                        <AlertIcon size={20} color="error" />
                      )}
                    </Box>
                    <Typography>{key}</Typography>
                    <Chip 
                      label={value.success ? "Passed" : "Failed"} 
                      color={value.success ? "success" : "error"}
                      size="small"
                      sx={{ ml: 2 }}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <pre style={{ 
                    whiteSpace: 'pre-wrap', 
                    wordBreak: 'break-word',
                    backgroundColor: '#f5f5f5',
                    padding: '8px',
                    borderRadius: '4px',
                    fontSize: '0.875rem'
                  }}>
                    {JSON.stringify(value, null, 2)}
                  </pre>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}

        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Common RLS Recommendations:
          </Typography>
          
          <Accordion sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon size={20} />}>
              <Typography>Table RLS Policies</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {recommendations.tableRecommendations.map((rec, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Table: {rec.table}
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f8f8f8' }}>
                    {rec.policies.map((policy, i) => (
                      <Typography key={i} component="pre" sx={{ fontSize: '0.8rem', overflow: 'auto' }}>
                        {policy}
                      </Typography>
                    ))}
                  </Paper>
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>
          
          <Accordion sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon size={20} />}>
              <Typography>Storage Bucket Policies</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {recommendations.storageBuckets.map((rec, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Bucket: {rec.bucket}
                  </Typography>
                  <List dense>
                    {rec.policies.map((policy, i) => (
                      <ListItem key={i}>
                        <ListItemText primary={policy} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>
          
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon size={20} />}>
              <Typography>General RLS Tips</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {recommendations.generalTips.map((tip, index) => (
                  <ListItem key={index}>
                    <ListItemText primary={tip} />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        </Box>
      </Paper>
    </Box>
  );
} 