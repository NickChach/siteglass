# Siteglass

A Next.js implementation of the Siteglass HTML/CSS landing page. Built with the
App Router, TypeScript, React, and CSS Modules. The supplied IBM Plex Sans and
Space Grotesk fonts are served locally; their licenses are in `app/fonts/`.

## Development

```sh
bun install
bun dev
```

Open [localhost:3000](http://localhost:3000).

```sh
bun run build
bun start
```

## Project structure

- `app/page.tsx` composes the header, hero, how-it-works section, and footer.
- `components/` keeps section markup and CSS Modules together.
- `app/globals.css` owns shared tokens, resets, the page container, and focus styles.
- `WebsiteCheckForm` is the only client component; the surrounding page renders on the server.

CSS uses relative units, including the responsive breakpoints.

## Inspection form

This is a frontend implementation. The form validates HTTP/HTTPS website
addresses and announces that scanning is not connected yet. It does not send
website addresses anywhere or generate inspection results. Connect the form to
an inspection service when its API is available.

## Checks

```sh
bun run lint
bunx tsc --noEmit
bun run build
```

The current ESLint dependency cannot load TypeScript 7. Lint will remain blocked
until the tooling supports it; the production build still checks TypeScript.
