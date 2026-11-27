import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

const requests: string[] = [];
const pages = new Map([
  ['/help/', '<a href="topic">Topic</a><a href="unavailable">Unavailable topic</a>'],
  [
    '/help/topic',
    '<a href="article">Article</a><a href="article#top">Copy</a><a href="/helpful/outsider">Outside</a>',
  ],
  ['/help/article', '<a href="deeper">Deeper article</a>'],
  ['/help/deeper', '<p>Beyond the discovery boundary</p>'],
  ['/helpful/outsider', '<p>Outside scope</p>'],
  ['/guide/', '<a href="start">Start</a><a href="areas">Areas</a><a href="missing">Missing</a>'],
  ['/guide/start', '<p>A directly linked article</p>'],
  ['/guide/areas', '<a href="reference">Reference</a>'],
  ['/guide/reference', '<p>A linked article</p>'],
]);
let sitemapEnabled = false;

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  fetch(request) {
    const url = new URL(request.url);
    requests.push(url.pathname);
    if (url.pathname === '/sitemap.xml' && sitemapEnabled) {
      return new Response(`<urlset><url><loc>${url.origin}/help/listed</loc></url></urlset>`, {
        headers: { 'content-type': 'application/xml' },
      });
    }
    const body = pages.get(url.pathname);
    return body === undefined
      ? new Response('Not found', { status: 404 })
      : new Response(body, { headers: { 'content-type': 'text/html' } });
  },
});

const root = new URL('/help/', server.url);
const fetchPage = async (url: string) => {
  assert.equal(new URL(url).origin, root.origin, 'fixture permits only its local site');
  const response = await fetch(url);
  return response.ok
    ? {
        body: await response.text(),
        contentType: response.headers.get('content-type') ?? '',
        url: response.url,
      }
    : undefined;
};
const paths = (urls: string[]) => urls.map(url => new URL(url).pathname);
const options = { pacing: { concurrency: 1, pauseMs: 0 } };
const result = {
  reward: 0,
  discovery: 0,
  crawl_boundary: 0,
  sitemap_precedence: 0,
  preserves_homepage_links: 0,
};

try {
  const { harvestUrls } = await import('./discover').catch(error => {
    console.error('Candidate discovery module failed to load:', error);
    return { harvestUrls: undefined };
  });
  const run = async (url: URL): Promise<string[]> => {
    if (harvestUrls === undefined) return [];
    try {
      return paths(await harvestUrls(url.href, fetchPage, options));
    } catch (error) {
      console.error(`Candidate discovery failed for ${url.pathname}:`, error);
      return [];
    }
  };
  const found = await run(root);
  if (
    found.includes('/help/topic') &&
    found.filter(path => path === '/help/article').length === 1
  ) {
    result.discovery = 1;
  }
  if (
    requests.includes('/help/topic') &&
    !requests.includes('/help/article') &&
    !requests.includes('/helpful/outsider') &&
    !found.includes('/help/deeper') &&
    !found.includes('/helpful/outsider')
  ) {
    result.crawl_boundary = 1;
  }

  const preserved = await run(new URL('/guide/', root));
  if (
    ['/guide/start', '/guide/areas', '/guide/missing', '/guide/reference'].every(
      path => preserved.filter(url => url === path).length === 1,
    )
  ) {
    result.preserves_homepage_links = 1;
  }

  sitemapEnabled = true;
  requests.length = 0;
  const listed = await run(root);
  if (
    listed.length === 1 &&
    listed[0] === '/help/listed' &&
    !requests.includes('/help/') &&
    !requests.includes('/help/topic')
  ) {
    result.sitemap_precedence = 1;
  }
  result.reward =
    result.discovery *
    result.crawl_boundary *
    result.sitemap_precedence *
    result.preserves_homepage_links;
  console.log(JSON.stringify({ found, preserved, listed, ...result }));
  writeFileSync('/logs/verifier/reward.json', JSON.stringify(result));
} finally {
  server.stop(true);
}
