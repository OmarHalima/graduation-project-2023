import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, Lock, User, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import { generateOtp } from '../../lib/otpService';
import { sendEmail } from '../../lib/emailService';
import { getOTPTemplate } from '../../lib/emailTemplates';
import { OTPVerification } from './OTPVerification';

interface AuthFormProps {
  mode: 'login' | 'signup';
  onModeChange: (mode: 'login' | 'signup') => void;
}

export function AuthForm({ mode, onModeChange }: AuthFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'employee' as const,
  });
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [credentialsValid, setCredentialsValid] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              role: formData.role,
              status: 'active',
            },
          },
        });
        if (error) throw error;
        toast.success('Check your email to confirm your account');
      } else {
        // First validate credentials
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;
        
        // Credentials are valid, generate and send OTP
        const otpResult = await generateOtp(formData.email);
        
        if (!otpResult.success) {
          throw new Error(otpResult.message || 'Failed to generate OTP');
        }
        
        // Send OTP email
        const emailTemplate = getOTPTemplate(otpResult.otp!);
        await sendEmail(formData.email, emailTemplate);
        
        // Set state to show OTP verification screen
        setCredentialsValid(true);
        setShowOtpVerification(true);
        toast.success('Verification code sent to your email');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          skipBrowserRedirect: false
        }
      });

      if (error) throw error;
      
      // The user will be redirected to Google at this point
    } catch (error: any) {
      console.error('Google Sign In Error:', error);
      toast.error(error.message || 'Failed to sign in with Google');
    }
  };

  // Handle OAuth errors in the component
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    if (error) {
      console.error('OAuth Error:', error, errorDescription);
      toast.error(errorDescription || 'Authentication failed');
      
      // Clean up the URL
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  const handleForgotPassword = async () => {
    if (!formData.email) {
      toast.error('Please enter your email address');
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Password reset instructions sent to your email');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleOtpVerified = async () => {
    // Complete the sign-in process after OTP verification
    try {
      // Use the stored credentials which were already validated
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      
      if (error) throw error;
      
      setShowOtpVerification(false);
      toast.success('Successfully logged in');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCancelOtp = () => {
    setShowOtpVerification(false);
    setCredentialsValid(false);
    // Generate and send a new OTP if the user requests it
    if (credentialsValid) {
      handleSubmit({ preventDefault: () => {} } as React.FormEvent);
    }
  };

  // If showing OTP verification, render that component
  if (showOtpVerification) {
    return (
      <OTPVerification 
        email={formData.email} 
        onVerified={handleOtpVerified} 
        onCancel={handleCancelOtp} 
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 relative overflow-hidden">
      {/* Abstract Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1557264337-e8a93017fe92?auto=format&fit=crop&q=80')] bg-no-repeat bg-cover blur-sm"></div>
      </div>

      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden max-w-5xl w-full mx-4 md:mx-0 flex flex-col md:flex-row">
        {/* Left Panel - Form */}
        <div className="w-full md:w-1/2 p-8 md:p-12">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Briefcase className="h-12 w-12 text-blue-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-gray-600">
              {mode === 'login'
                ? 'Sign in to access your workspace'
                : 'Join our AI-powered project management platform'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    <option value="employee">Employee</option>
                    <option value="project_manager">Project Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {mode === 'login' && (
              <div className="text-right">
                <button 
                  type="button" 
                  onClick={handleForgotPassword}
                  className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>

            <div className="relative flex items-center justify-center mt-6">
              <div className="border-t border-gray-300 absolute w-full"></div>
              <div className="bg-white px-4 relative text-sm text-gray-500">or continue with</div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              Sign {mode === 'login' ? 'in' : 'up'} with Google
            </button>
          </form>

          <p className="text-center mt-8 text-sm text-gray-600">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            <button
              type="button"
              onClick={() => onModeChange(mode === 'login' ? 'signup' : 'login')}
              className="ml-1 text-blue-600 hover:text-blue-800 transition-colors"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        {/* Right Panel - Info */}
        <div className="hidden md:block w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 p-12 text-white relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-3xl font-bold mb-6">AI-Powered Project Management</h3>
            <p className="text-lg mb-8">
              Transform your workflow with intelligent project management. Our AI-driven platform helps
              you make better decisions and streamline your processes.
            </p>
            
            <div className="space-y-6">
              <div className="flex items-start">
                <div className="h-10 w-10 rounded-full bg-blue-500 bg-opacity-50 flex items-center justify-center mr-4">
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xl font-semibold mb-1">Enhanced Security</h4>
                  <p className="text-blue-100">Two-factor authentication for secure access to your account</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="h-10 w-10 rounded-full bg-blue-500 bg-opacity-50 flex items-center justify-center mr-4">
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xl font-semibold mb-1">Smart Task Management</h4>
                  <p className="text-blue-100">AI-powered task prioritization and allocation</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="h-10 w-10 rounded-full bg-blue-500 bg-opacity-50 flex items-center justify-center mr-4">
                  <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xl font-semibold mb-1">Real-time Collaboration</h4>
                  <p className="text-blue-100">Work together seamlessly with your team</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Abstract shape decoration */}
          <div className="absolute bottom-0 right-0 opacity-10">
            <svg width="400" height="400" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
              <path fill="#FFFFFF" d="M37.5,-65.1C46.9,-55.3,51.5,-42.6,58.8,-31.3C66.1,-20,76.1,-10,74.9,-0.7C73.7,8.7,61.3,17.4,52.5,27.4C43.7,37.4,38.5,48.7,29.7,53.3C20.9,57.9,8.4,55.7,-3.1,60.6C-14.7,65.5,-25.2,77.5,-38.3,78.2C-51.3,78.9,-66.9,68.4,-71.3,54.1C-75.7,39.8,-68.9,21.9,-67.7,5.6C-66.4,-10.6,-70.7,-21.3,-69.1,-34.6C-67.5,-47.9,-60,-63.8,-47.4,-72.5C-34.9,-81.2,-17.5,-82.8,-1.9,-79.8C13.7,-76.7,28.1,-74.9,37.5,-65.1Z" transform="translate(100 100)" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthForm;