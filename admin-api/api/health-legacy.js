export default function handler(req, res) {
  return res.status(200).json({ ok: true, action: req.query.action || null });
}
