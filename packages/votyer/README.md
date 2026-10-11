# @gefrus112/votyer

**votyer.js** — the next-gen language for retro HTML5 games. One file, zero dependencies: a tiny game language (`.votyer`) plus a complete 3D raycasting engine with animated water, dynamic lights, textured walls, procedural sprites, an audio synth, physics, menus and a HUD.

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
npm install @gefrus112/votyer
```

## Usage — Node (language tooling)

Compile, lint and inspect `.votyer` source without a browser — great for build scripts, CI validation and editor tooling.

```js
const Votyer = require('@gefrus112/votyer');

const src = `
game "Arena" {
  size 800 500
  sky #1a0f14
}

map {
  "#######"
  "#P..E.#"
  "#######"
}

enemy "drone" { char "E" shape blob color #a78bfa }
`;

const result = Votyer.compile(src);
if (!result.ok) {
  console.error(result.errors.join('\n')); // language errors with line:col
  process.exit(1);
}
console.log('Compiles! Sprites available:', Votyer.shapes);
```

API: `Votyer.compile(src)`, `Votyer.lex(src)`, `Votyer.Parser`, `Votyer.buildSpec`, `Votyer.VError`, `Votyer.sounds`, `Votyer.shapes`, `Votyer.spritePreview(canvas, shape, color)`.

## Usage — Browser (render games)

The same file is a browser library. Reference it straight from the package or via CDN/jsDelivr (`https://cdn.jsdelivr.net/gh/gefrus112/votyer@main/votyer.js`):

```html
<script src="node_modules/@gefrus112/votyer/votyer.js"></script>

<canvas id="game" width="800" height="500"></canvas>

<script type="text/votyer" data-canvas="game">
game "My Game" { size 800 500 }
map {
  "########"
  "#P....E#"
  "#......#"
  "########"
}
on take { say "Got it!" }
</script>
```

Water, lights, fog, textures, minimap, HUD, audio and menus are all built into the language — see the full docs at the repo site.

## Version

`Votyer.version` → `1.2.0` (Water & Light edition, GitHub Packages release).

MIT licensed.
