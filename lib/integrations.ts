import { supabase } from './supabase';

interface IntegrationPayload {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  fields?: Record<string, string>;
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
}

export async function sendToSlack(webhookUrl: string, payload: IntegrationPayload) {
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: payload.title,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: payload.message,
      },
    },
  ];

  if (payload.fields) {
    blocks.push({
      type: 'section',
      fields: Object.entries(payload.fields).map(([key, value]) => ({
        type: 'mrkdwn',
        text: `*${key}:*\n${value}`,
      })),
    });
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });

  if (!response.ok) {
    throw new Error('Failed to send Slack notification');
  }
}

export async function sendToTeams(webhookUrl: string, payload: IntegrationPayload) {
  const card = {
    type: 'MessageCard',
    context: 'http://schema.org/extensions',
    themeColor: payload.type === 'success' ? '0076D7' :
                payload.type === 'warning' ? 'FFA500' :
                payload.type === 'error' ? 'FF0000' : '0076D7',
    title: payload.title,
    text: payload.message,
    sections: payload.fields ? [{
      facts: Object.entries(payload.fields).map(([key, value]) => ({
        name: key,
        value: value,
      })),
    }] : [],
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  });

  if (!response.ok) {
    throw new Error('Failed to send Teams notification');
  }
}

export async function sendIntegrationNotification(
  projectId: string,
  payload: IntegrationPayload
) {
  try {
    const { data: settings, error } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('project_id', projectId)
      .eq('enabled', true);

    if (error) throw error;

    await Promise.all(settings.map(async (setting) => {
      if (setting.type === 'slack') {
        await sendToSlack(setting.webhook_url, payload);
      } else if (setting.type === 'teams') {
        await sendToTeams(setting.webhook_url, payload);
      }
    }));
  } catch (error: any) {
    console.error('Failed to send integration notification:', error);
    throw error;
  }
} 