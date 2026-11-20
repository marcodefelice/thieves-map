import { getReportStore } from '../lib/db.mjs';
import { fetchRss, rssConfig } from '../lib/rss-fetch.mjs';

const store = getReportStore();
try {
  const result = await fetchRss({ store, config: rssConfig() });
  console.log('RSS:', JSON.stringify(result));
  if (result.failures) process.exitCode = 1;
} finally { store.close(); }
