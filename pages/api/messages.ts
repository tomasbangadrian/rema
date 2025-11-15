import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../lib/storage';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { sender, text } = req.body;

    if (!sender || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const message = storage.addMessage(sender, text);

    return res.status(200).json(message);
  }

  if (req.method === 'GET') {
    const { since } = req.query;
    const sinceTimestamp = since ? parseInt(since as string) : undefined;
    const messages = storage.getMessages(sinceTimestamp);

    return res.status(200).json(messages);
  }

  res.status(405).json({ error: 'Method not allowed' });
}
