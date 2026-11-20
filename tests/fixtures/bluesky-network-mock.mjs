import { readFileSync, appendFileSync } from 'node:fs';
globalThis.fetch = async (url, options = {}) => {
  if (String(url).endsWith('/feed.xml')) return new Response(readFileSync(process.env.TEST_FEED_FILE, 'utf8'));
  if (String(url).endsWith('/com.atproto.server.createSession')) return Response.json({ did: 'did:plc:test', accessJwt: 'mock-token' });
  if (String(url).endsWith('/com.atproto.repo.putRecord')) {
    const body = JSON.parse(options.body);
    appendFileSync(process.env.TEST_REQUEST_LOG, `${JSON.stringify({ rkey: body.rkey, record: body.record })}\n`);
    return process.env.TEST_POST_FAIL === '1' ? Response.json({ error: 'temporary' }, { status: 503 }) : Response.json({ uri: 'at://did:plc:test/app.bsky.feed.post/test' });
  }
  throw new Error('Unexpected URL');
};
