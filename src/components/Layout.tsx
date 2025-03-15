import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User } from '../types/auth';
import {
  Users,
  LayoutDashboard,
  Settings,
  FolderKanban,
  LogOut,
  UserCircle,
  Search,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '../contexts/ThemeContext';

interface LayoutProps {
  user: User | null;
  children: React.ReactNode;
}

export function Layout({ user, children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const { theme } = useTheme();

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Signed out successfully');
      navigate('/login');
    } catch (error: any) {
      toast.error('Error signing out');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return theme === 'light' 
          ? 'bg-purple-100 text-purple-800' 
          : 'bg-purple-900 text-purple-100';
      case 'project_manager':
        return theme === 'light' 
          ? 'bg-blue-100 text-blue-800' 
          : 'bg-blue-900 text-blue-100';
      case 'employee':
        return theme === 'light' 
          ? 'bg-green-100 text-green-800' 
          : 'bg-green-900 text-green-100';
      default:
        return theme === 'light' 
          ? 'bg-gray-100 text-gray-800' 
          : 'bg-gray-800 text-gray-100';
    }
  };

  // If no user is present, redirect to login
  if (!user) {
    navigate('/login');
    return null;
  }

  // Destructure user properties for type safety
  const { 
    avatar_url, 
    full_name, 
    email, 
    role 
  } = user;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-background dark:text-dark-text-primary transition-colors">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="hidden md:flex flex-col w-64 bg-white dark:bg-dark-surface shadow-lg h-full border-r dark:border-dark-border transition-colors">
          <div className="p-6 border-b dark:border-dark-border">
            <div className="flex justify-between items-center">
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">Admin Panel</h1>
              <ThemeToggle />
            </div>
            {/* User Profile Section */}
            <div className="mt-4 flex items-center space-x-3">
              {avatar_url ? (
                <img 
                  src={avatar_url} 
                  alt={full_name}
                  className="h-10 w-10 rounded-full"
                />
              ) : (
                <UserCircle className="h-10 w-10 text-gray-400 dark:text-gray-300" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {full_name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {email}
                </p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${getRoleColor(role)}`}>
                  {role?.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-2 overflow-y-auto">
            {[
              { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
              { icon: Users, label: 'Users', path: '/users' },
              { icon: FolderKanban, label: 'Projects', path: '/projects' },
              { icon: Search, label: 'Deepsearch', path: '/deepsearch' },
              { icon: Settings, label: 'Settings', path: '/settings' },
            ].map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center w-full px-4 py-2 text-sm rounded-lg transition-colors ${
                  currentPath === item.path
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-dark-border'
                }`}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t dark:border-dark-border">
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => navigate('/settings')}
                className="flex items-center text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white"
              >
                <Settings className="h-5 w-5 mr-2" />
                Profile Settings
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 mt-2"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-y-auto dark:bg-dark-background">
          {children}
        </main>
      </div>
    </div>
  );
} 