# Siteglass

Siteglass checks WordPress websites for signs of SEO poisoning hacks. Enter a website address and Siteglass checks for signs that the site
runs on WordPress. If it does, Siteglass looks for selected terms in public blog post URL paths.

## What is SEO poisoning?

SEO poisoning can happen when hackers publish spam content on a compromised website in order to manipulate search engine rankings for their
own, often malicious, websites. The compromised website may still look normal to its owner and its visitors, even though it contains posts
about unrelated topics.

## How the check works

1. The browser validates the address and reduces it to the site root. A missing protocol defaults to HTTPS, a leading `www.` is removed, and
   any path, query or fragment is excluded from the scan address. Addresses with credentials or non-default ports are rejected.
2. When the browser supports the required protections, Siteglass tries to identify WordPress and check public post URLs directly through the
   site's REST API.
3. If the browser cannot get a result, it sends the submitted address to the Siteglass server. The server validates it again and runs its
   own WordPress and post URL checks, with a sitemap fallback when needed.
4. Whichever route finds the post URLs checks their paths against the same list of terms. The browser displays the result.

Siteglass checks the domain root, even when the entered address points to a subdirectory. WordPress installations hosted only in a
subdirectory may therefore not be detected.

### Checks in the browser

The browser-first scan runs only for an HTTPS domain containing a dot when Siteglass itself is loaded over HTTPS and the browser reports
that its permissions policy blocks local-network requests. IP addresses and `.local` or `.localhost` names skip the browser check. If these
conditions are not met, the check goes straight to the server. See [`browser-scan.ts`](lib/website-check/browser-scan.ts) and
[`next.config.ts`](next.config.ts).

For an eligible address, the browser:

- Tries the conventional WordPress REST API indexes (`/wp-json/` and `/?rest_route=/`) and verifies that the response identifies a WordPress
  API for the same site root.
- Requests public post links from the API and checks their URL paths locally. It requests only the `link` field, up to 100 posts per page.
- Makes requests without credentials or a referrer, and does not follow redirects. For cross-origin checks, the target site must allow the
  browser to read its API responses through CORS. The target site receives the requests from the visitor's browser.

If the API cannot be discovered or the first page of posts cannot be read, Siteglass tries the server. This includes cases such as CORS
restrictions, redirects, or an unavailable API. If at least one post page was read and a later page fails, the browser returns an
**incomplete** result instead; it does not retry that scan on the server. A browser scan that returns a result does not call the server scan
action.

### Checks on the server

The server is used when the browser scan is ineligible or does not produce a result. The submitted form data, including the entered address,
is sent to the server for this fallback. The target website receives these requests from the Siteglass server. The server:

1. Validates and normalizes the address again, then applies the server scan limits.
2. Tries the WordPress REST API. If that does not confirm WordPress, it fetches the homepage and looks for signs such as a WordPress
   generator tag, WordPress core or theme/plugin asset paths, and a REST discovery link. Two different signals can confirm WordPress; one
   signal can also be corroborated by a same-origin `/wp-admin/` redirect to `/wp-login.php`. The server parses the HTML without executing
   the site's scripts.
3. If a usable API was found, requests and checks public post links from it. If the API produces no post result, the server checks
   `robots.txt` and conventional sitemap locations for recognized WordPress post sitemaps, then checks the URLs in those sitemaps.
4. Returns a result, or reports that it could not confirm WordPress or access post URLs.

Sitemap discovery and parsing run only on the server. A generic sitemap containing URLs is not necessarily recognized as a post sitemap. As
with the browser scan, a partial API result is returned as incomplete and does not trigger a sitemap retry. See
[`server-scan.ts`](lib/website-check/server-scan.ts), [`wordpress.ts`](lib/website-check/wordpress.ts), and
[`sitemap.ts`](lib/website-check/sitemap.ts).

### URL matching and results

The browser and server use the same matching code and [keyword list](lib/website-check/dictionary.ts). Siteglass checks the URL path, not
the post title, content, hostname, query string or fragment. It decodes and normalizes the path, ignores case and treats punctuation as word
separators before looking for the selected terms. See [`post-urls.ts`](lib/website-check/post-urls.ts) and
[`post-path.ts`](lib/website-check/post-path.ts).

The report shows how many post URLs were checked and how many contained matching terms indicating potential spam content. It lists the
matching paths and terms for up to 50 URLs so you can review them in WordPress, or with your developer and hosting provider.

A matching term is a reason to review a post, not proof that the site was hacked: legitimate posts may also contain these terms. Likewise,
finding no matches doesn't mean the website is free of hacks.

The report marks a check as incomplete when some URLs may have been missed, for example because a later API page was inaccessible, a limit
was reached, or a post URL could not be checked. Siteglass may also be unable to complete a check if it cannot confirm WordPress or access
public post URLs.

## Limits and server configuration

- Both routes check at most 1,000 distinct public post URLs. The API scan reads at most 10 pages of 100 posts; the sitemap scan attempts at
  most eight sitemap files, including indexes.
- The browser scan has an eight-second overall timeout, a 1.5-second request timeout and a 1 MiB response limit. The server scan has a
  12-second overall timeout, a three-second timeout per fetch, a 1 MiB response limit and a budget of 26 request attempts, including
  redirects.
- Server requests must resolve exclusively to public IP addresses. The server connects to a validated address, rechecks redirect
  destinations, follows at most three redirects and rejects HTTPS-to-HTTP downgrades.
- Server scans are limited in memory per application instance to 30 starts per minute and four concurrent scans. These limits do not apply
  to scans completed in the browser and are not shared across application instances.
- To enable the additional limit of three server scan starts per client IP per minute, set `SITEGLASS_CLIENT_IP_HEADER` to the name of a
  header supplied by a trusted ingress. The ingress must overwrite that header with a single client IP; do not trust a header that clients
  can supply themselves. If the header is configured but missing or invalid, those requests share an `unknown` caller limit. Without the
  setting, only the per-instance limits above apply. See [`check-website.ts`](app/actions/check-website.ts) and
  [`scan-limiter.ts`](lib/website-check/scan-limiter.ts).

## Scope and limitations

Access restrictions, timeouts and scan limits can reduce coverage. Siteglass searches URL paths for a fixed set of terms related to adult
content, cryptocurrency, gambling, pharmaceuticals and streaming. It doesn't inspect post content for spam, scan files for malware or check
every type of page or security issue.
