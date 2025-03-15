import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface MFASetupProps {
  onClose: () => void;
  onComplete: () => void;
}

export function MFASetup({ onClose, onComplete }: MFASetupProps) {
  const [step, setStep] = useState<'generate' | 'verify'>('generate');
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [factorId, setFactorId] = useState<string>('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const generateMFA = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp'
      });
      
      if (error) throw error;
      if (!data?.totp) throw new Error('Failed to generate TOTP');

      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setStep('verify');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyMFA = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.mfa.challenge({
        factorId: factorId
      });
      
      if (error) throw error;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factorId,
        challengeId: data.id,
        code: token
      });

      if (verifyError) throw verifyError;

      toast.success('MFA enabled successfully');
      onComplete();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">Setup Two-Factor Authentication</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">×</button>
        </div>

        {step === 'generate' ? (
          <div className="space-y-4">
            <p className="text-gray-600">
              Enhance your account security by enabling two-factor authentication.
              You'll need an authenticator app like Google Authenticator or Authy.
            </p>
            <button
              onClick={generateMFA}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate QR Code'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              {qrCode && (
                <img src={qrCode} alt="QR Code" className="w-48 h-48" />
              )}
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Secret Key:</p>
              <code className="bg-gray-100 px-2 py-1 rounded select-all">{secret}</code>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enter Verification Code
              </label>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter 6-digit code"
                maxLength={6}
                pattern="\d{6}"
              />
            </div>
            <button
              onClick={verifyMFA}
              disabled={loading || token.length !== 6}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Enable'}
            </button>
            <p className="text-sm text-gray-500 text-center">
              Scan the QR code with your authenticator app or manually enter the secret key.
              Then enter the 6-digit code shown in your app.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 