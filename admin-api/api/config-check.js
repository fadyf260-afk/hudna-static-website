export function GET() {
  return Response.json({
    sessionSecretPresent: Boolean(process.env.SESSION_SECRET),
    sessionSecretLongEnough: (process.env.SESSION_SECRET?.length || 0) >= 32,
    clientIdPresent: Boolean(process.env.GITHUB_APP_CLIENT_ID),
    clientSecretPresent: Boolean(process.env.GITHUB_APP_CLIENT_SECRET),
    nodeOptionsPresent: Boolean(process.env.NODE_OPTIONS),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
