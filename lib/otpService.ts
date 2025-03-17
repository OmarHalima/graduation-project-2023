import { supabase } from './supabase';

// Time-to-live for OTP in seconds (5 minutes)
const OTP_TTL = 5 * 60;
// Maximum allowed attempts
const MAX_ATTEMPTS = 3;

interface OtpRecord {
  id: string;
  user_id: string;
  email: string;
  code: string;
  expires_at: string;
  attempts: number;
  created_at: string;
  verified: boolean;
}

/**
 * Generate a random 6-digit OTP
 */
function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate and store an OTP for a user
 */
export async function generateOtp(email: string): Promise<{ success: boolean; otp?: string; message?: string }> {
  try {
    // First verify if email exists and get user_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      console.error('Error finding user:', userError);
      return { success: false, message: 'User not found' };
    }

    // Generate a new OTP
    const otp = generateOtpCode();
    const userId = userData.id;
    
    // Calculate expiration time (5 minutes from now)
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + OTP_TTL);
    
    // Delete any existing OTPs for this user
    await supabase
      .from('user_otps')
      .delete()
      .eq('user_id', userId);
    
    // Store the new OTP
    const { error: insertError } = await supabase
      .from('user_otps')
      .insert({
        user_id: userId,
        email,
        code: otp,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
        verified: false
      });
    
    if (insertError) {
      console.error('Error storing OTP:', insertError);
      return { success: false, message: 'Failed to generate OTP' };
    }
    
    return { success: true, otp };
  } catch (error) {
    console.error('OTP generation error:', error);
    return { success: false, message: 'Internal server error' };
  }
}

/**
 * Verify an OTP for a user
 */
export async function verifyOtp(email: string, code: string): Promise<{ success: boolean; message?: string }> {
  try {
    // Get the OTP record
    const { data, error } = await supabase
      .from('user_otps')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error || !data) {
      console.error('Error retrieving OTP:', error);
      return { success: false, message: 'Invalid or expired OTP' };
    }
    
    const otpRecord = data as OtpRecord;
    
    // Check if OTP is already verified
    if (otpRecord.verified) {
      return { success: false, message: 'OTP already used' };
    }
    
    // Check if OTP is expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      return { success: false, message: 'OTP has expired' };
    }
    
    // Check if max attempts reached
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      return { success: false, message: 'Maximum attempts reached' };
    }
    
    // Increment attempt counter
    const { error: updateError } = await supabase
      .from('user_otps')
      .update({ attempts: otpRecord.attempts + 1 })
      .eq('id', otpRecord.id);
    
    if (updateError) {
      console.error('Error updating OTP attempts:', updateError);
    }
    
    // Verify the code
    if (otpRecord.code !== code) {
      return { 
        success: false, 
        message: `Invalid code. ${MAX_ATTEMPTS - otpRecord.attempts - 1} attempts remaining` 
      };
    }
    
    // Mark as verified
    await supabase
      .from('user_otps')
      .update({ verified: true })
      .eq('id', otpRecord.id);
    
    return { success: true };
  } catch (error) {
    console.error('OTP verification error:', error);
    return { success: false, message: 'Failed to verify OTP' };
  }
} 