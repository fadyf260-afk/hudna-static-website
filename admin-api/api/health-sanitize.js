export async function GET() {
  try {
    const { default: sanitizeHtml } = await import('sanitize-html');
    return Response.json({ ok: sanitizeHtml('<p>ok</p>') === '<p>ok</p>' });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error.code || error.name, message: error.message }, { status: 500 });
  }
}
