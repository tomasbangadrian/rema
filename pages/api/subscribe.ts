import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../lib/storage';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { user, subscription } = req.body;

    if (!user || !subscription) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    storage.savePushSubscription(user, subscription);

    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
