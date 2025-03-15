import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { 
  Users, Settings, LayoutDashboard, FolderKanban, 
  Search, Plus, UserCircle, LogOut, Clock
} from 'lucide-react';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppMuiThemeProvider } from './theme/MuiThemeProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AppMuiThemeProvider>
        <App />
      </AppMuiThemeProvider>
    </ThemeProvider>
  </StrictMode>
);
