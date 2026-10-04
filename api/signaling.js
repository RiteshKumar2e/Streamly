// In-memory store for signaling data.
// Note: Vercel serverless functions are stateless, but for low-traffic 
// rapid connections (like a 10 second pairing window), the lambda container 
// is usually reused, making this a viable free workaround without a DB.

let rooms = {};

export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { room } = req.query;

  if (!room) {
    return res.status(400).json({ error: 'Room required' });
  }

  if (!rooms[room]) {
    rooms[room] = { messages: [] };
  }

  if (req.method === 'POST') {
    const message = req.body;
    rooms[room].messages.push({
      ...message,
      timestamp: Date.now()
    });
    
    // Clean up old rooms (keep only last 50)
    const keys = Object.keys(rooms);
    if (keys.length > 50) {
      delete rooms[keys[0]];
    }

    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET') {
    const { since = 0 } = req.query;
    const newMessages = rooms[room].messages.filter(m => m.timestamp > Number(since));
    return res.status(200).json(newMessages);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
