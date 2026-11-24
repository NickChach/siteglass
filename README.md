# Siteglass

Siteglass checks WordPress websites for signs of SEO poisoning hacks. Enter a website address and Siteglass checks for signs that the site
runs on WordPress. If it does, Siteglass looks for selected terms in public blog post URL paths.

## What is SEO poisoning?

SEO poisoning can happen when hackers publish spam content on a compromised website in order to manipulate search engine rankings for their
own, often malicious, websites. The compromised website may still look normal to its owner and its visitors, even though it contains posts
about unrelated topics.

## How the check works

1. Enter a website's address.
2. Siteglass looks for publicly visible signs that the website uses WordPress.
3. If the website uses WordPress, then Siteglass tries to find public post URLs through the WordPress REST API. If the API is unavailable,
   it may look for WordPress post sitemaps instead.
4. Siteglass checks the URL paths for selected terms related to adult content, cryptocurrency, gambling, pharmaceuticals and illegal
   streaming.

The check runs in the browser when supported and otherwise uses the Siteglass server. Sitemap checks are performed by the server.

## Understanding the results

The report shows how many post URLs were checked and how many contained matching terms indicating potential spam content. It lists the
matching paths and terms for up to 50 URLs so you can review them in WordPress, or with your developer and hosting provider.

A matching term is a reason to review a post, not proof that the site was hacked: legitimate posts may also contain these terms. Likewise,
finding no matches doesn't mean the website is free of hacks.

The report marks a check as incomplete when some URLs may have been missed. Siteglass may also be unable to complete a check if it cannot
confirm WordPress or access public post URLs.

## Scope and limitations

Siteglass checks up to 1,000 public post URLs per scan. Access restrictions, timeouts and scan limits can reduce coverage. It searches URL
paths for a fixed set of terms; it doesn't inspect post content for spam, scan files for malware or check every type of page or security
issue.
