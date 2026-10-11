# @gefrus112/esharp

**E#** (`.e#`) — the site-building language that combines everything together: markup, styling, layout and interactivity compiled into one complete, standalone, responsive HTML page. Galaxy effects, game embeds and code highlighting included — no build step, no runtime dependencies.

> Docs & playground: <https://github.com/gefrus112/votyer> · Live site: <https://gefrus112.github.io/votyer/>

## Install — GitHub Packages

This package is published to **GitHub Packages** (npm.pkg.github.com).

1. Add a `.npmrc` next to your project:

```ini
@gefrus112:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

> The token needs the `read:packages` scope. Public packages still require GitHub authentication on this registry.

2. Install:

```bash
npm install @gefrus112/esharp
```

## Usage — Node (compile to HTML)

```js
const ESharp = require('@gefrus112/esharp');
const fs = require('fs');

const src = `
site "Nova — Design Engineer" {

  theme { accent #7c6cff  accent2 #22d3ee  bg #0b0d17  mode dark }

  nav {
    brand "NOVA"
    link "Work" "#work"
    cta "Hire me" "#contact"
  }

  hero {
    kicker "DESIGN ENGINEER — PORTFOLIO"
    title "I build products that feel alive."
    sub "Interfaces, motion and real-time 3D for the modern web."
    button "See the work" "#work"
  }

  features {
    title "What I do"
    card { icon "◆" title "Interfaces" text "Design systems that scale." }
    card { icon "✦" title "Motion" text "Micro-interactions everywhere." }
  }

  footer { text "© 2026 Nova Studio" }
}
`;

const result = ESharp.compile(src);
if (!result.ok) {
  console.error(result.errors.join('\n'));
  process.exit(1);
}
fs.writeFileSync('index.html', result.html); // complete standalone page
```

## Usage — Browser (auto-embed)

```html
<script src="node_modules/@gefrus112/esharp/esharp.js"></script>
<iframe id="preview"></iframe>

<script type="text/esharp" data-target="preview">
site "Hello" {
  hero { title "Hi from E#" sub "Compiled to full HTML." }
}
</script>
```

Sections available: `theme`, `nav`, `hero`, `features`, `work`, `stats`, `quote`, `game` (embeds a votyer.js game), `code`, `contact`, `footer`.

API: `ESharp.compile(src)`, `ESharp.parse(src)`, `ESharp.presets`.

## Version

`ESharp.version` → `1.2.0` (GitHub Packages release).

MIT licensed.
