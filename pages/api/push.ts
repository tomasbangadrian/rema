import type { NextApiRequest, NextApiResponse } from 'next';
import webpush from 'web-push';
import { storage } from '../../lib/storage';
import { VAPID_KEYS, VAPID_CONTACT } from '../../lib/vapid';

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  VAPID_CONTACT,
  VAPID_KEYS.publicKey,
  VAPID_KEYS.privateKey
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { targetUser, title, body } = req.body;

    if (!targetUser || !title || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const subscription = storage.getPushSubscription(targetUser);

    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found for user' });
    }

    try {
      const payload = JSON.stringify({
        title,
        body,
        icon: '/icon.svg',
        badge: '/icon.svg',
      });

      await webpush.sendNotification(subscription, payload);

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Error sending push notification:', error);

      // If subscription is no longer valid, remove it
      if (error.statusCode === 410) {
        storage.removePushSubscription(targetUser);
      }

      return res.status(500).json({ error: 'Failed to send notification', details: error.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
