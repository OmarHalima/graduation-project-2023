import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { userData } = req.body;

    try {
      const response = await fetch('YOUR_GEMINI_API_URL', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`,
        },
        body: JSON.stringify({ userData }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch from Gemini API');
      }

      const result = await response.json();
      res.status(200).json({ analysis: result.analysis });
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      res.status(500).json({ error: 'Error generating analysis' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 