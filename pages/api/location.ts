import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../lib/storage';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { user, lat, lng, atRema } = req.body;

    if (!user || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    storage.updateLocation(user, lat, lng, atRema || false);

    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET') {
    const locations = storage.getLocations();
    return res.status(200).json(locations);
  }

  res.status(405).json({ error: 'Method not allowed' });
}
