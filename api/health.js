module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }
  res.status(200).json({
    ok: true,
    service: "signaldesk",
    runtime: process.env.VERCEL ? "vercel" : "node",
    time: new Date().toISOString()
  });
};
