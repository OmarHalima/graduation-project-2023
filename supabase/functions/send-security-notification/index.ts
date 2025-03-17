// @ts-ignore: Deno module import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore: Deno module import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationRequest {
  type: 'new_login' | 'password_change' | 'mfa_change';
  userId: string;
  email: string;
  metadata?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { type, userId, email, metadata = {} } = await req.json() as NotificationRequest

    // Get user's notification preferences
    const { data: settings, error: settingsError } = await supabaseClient
      .from('user_security_settings')
      .select('settings')
      .eq('user_id', userId)
      .single()

    if (settingsError) {
      throw settingsError
    }

    // Check if the user wants to receive this type of notification
    const notificationKey = {
      new_login: 'notifyOnNewLogin',
      password_change: 'notifyOnPasswordChange',
      mfa_change: 'notifyOnMFAChange',
    }[type]

    if (!settings?.settings[notificationKey]) {
      return new Response(
        JSON.stringify({ message: 'Notification disabled by user preferences' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Prepare email content
    const subject = {
      new_login: 'New Login Detected',
      password_change: 'Password Changed',
      mfa_change: '2FA Settings Updated',
    }[type]

    const content = {
      new_login: `
        A new login was detected on your account.
        Device: ${metadata.userAgent || 'Unknown'}
        Location: ${metadata.location || 'Unknown'}
        IP Address: ${metadata.ipAddress || 'Unknown'}
        Time: ${new Date().toLocaleString()}
        
        If this wasn't you, please change your password immediately and contact support.
      `,
      password_change: `
        Your password was recently changed.
        Time: ${new Date().toLocaleString()}
        
        If you didn't make this change, please contact support immediately.
      `,
      mfa_change: `
        Your two-factor authentication settings were updated.
        Action: ${metadata.action || 'Unknown'}
        Time: ${new Date().toLocaleString()}
        
        If you didn't make this change, please contact support immediately.
      `,
    }[type]

    // Send email using Supabase's built-in email service
    const { error: emailError } = await supabaseClient.auth.admin.sendEmail(
      email,
      {
        subject,
        template_data: {
          content,
          action_url: `${Deno.env.get('SITE_URL')}/settings`,
          action_text: 'Review Security Settings',
        },
      }
    )

    if (emailError) {
      throw emailError
    }

    // Log the notification
    await supabaseClient.from('auth_audit_log').insert({
      user_id: userId,
      action: `security_notification_${type}`,
      metadata: {
        notification_type: type,
        ...metadata,
      },
    })

    return new Response(
      JSON.stringify({ message: 'Security notification sent successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
}) 