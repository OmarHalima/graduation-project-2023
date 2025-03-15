import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts';

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
}

const client = new SmtpClient();

serve(async (req: Request) => {
  try {
    const { to, subject, html } = await req.json() as EmailRequest;

    await client.connect({
      hostname: Deno.env.get('SMTP_HOST') ?? '',
      port: Number(Deno.env.get('SMTP_PORT')),
      username: Deno.env.get('SMTP_USER') ?? '',
      password: Deno.env.get('SMTP_PASS') ?? '',
    });

    await client.send({
      from: Deno.env.get('SMTP_FROM') ?? '',
      to,
      subject,
      content: html,
      html,
    });

    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}); 