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
    const { user, lat, lng, atRema } = req.body;

    if (!user || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get previous location to check if status changed
    const prevLocation = storage.getLocation(user);
    const wasAtRema = prevLocation?.atRema || false;

    storage.updateLocation(user, lat, lng, atRema || false);

    // Send push notification if user just arrived at Rema
    if (atRema && !wasAtRema) {
      console.log(`${user} just arrived at Rema! Sending push notifications...`);

      // Send push to ALL users (including self for testing)
      const subscriptions = storage.getAllPushSubscriptions();

      for (const [targetUser, subscription] of subscriptions) {
        try {
          const payload = JSON.stringify({
            title: 'Rema Tracker 🛒',
            body: `${user} er nå på Rema 1000 Solsiden!`,
            icon: '/icon.svg',
            badge: '/icon.svg',
            data: { user, atRema: true },
          });

          await webpush.sendNotification(subscription, payload);
          console.log(`Push sent to ${targetUser}`);
        } catch (error: any) {
          console.error(`Error sending push to ${targetUser}:`, error.message);

          // If subscription is no longer valid, remove it
          if (error.statusCode === 410) {
            storage.removePushSubscription(targetUser);
          }
        }
      }
    }

    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET') {
    const locations = storage.getLocations();
    return res.status(200).json(locations);
  }

  res.status(405).json({ error: 'Method not allowed' });
}
