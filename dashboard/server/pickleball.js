import {authorized} from './household.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Authorization');
  if (req.method !== 'GET') return res.status(405).json({error: 'Method not allowed'});
  if (!authorized(req)) return res.status(401).json({error: 'Connect this device with your family access code.'});
  try {
    const snapshot = JSON.parse(process.env.PICKLEBALL_SNAPSHOT || 'null');
    if (!snapshot || snapshot.version !== 1 || !Number.isFinite(Date.parse(snapshot.capturedAt)) ||
        !snapshot.ratings || !Array.isArray(snapshot.matches) || snapshot.matches.length > 200) {
      return res.status(503).json({error: 'Your pickleball snapshot is not available yet.'});
    }
    return res.status(200).json({snapshot});
  } catch {
    return res.status(503).json({error: 'Your pickleball snapshot is temporarily unavailable.'});
  }
}
