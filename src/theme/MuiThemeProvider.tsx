import React, { ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useMuiTheme } from './mui-theme';

interface MuiThemeProviderProps {
  children: ReactNode;
}

export function AppMuiThemeProvider({ children }: MuiThemeProviderProps) {
  const theme = useMuiTheme();

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
} 