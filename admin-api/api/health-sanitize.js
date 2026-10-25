import sanitizeHtml from 'sanitize-html';

export function GET() {
  return Response.json({ ok: sanitizeHtml('<p>ok</p>') === '<p>ok</p>' });
}
