# votyer.js — The HTML5 Retro Game Language

**votyer** is a tiny new programming language that compiles in the browser into a complete **retro 3D raycasting engine**. One script tag, zero dependencies — walls, water, dynamic lights, sprites, items, enemy AI, physics, audio, menus and HUD are all built in.

Write a world in ~100 lines. Get a playable first-person game.

```html
<script src="votyer.js"></script>
<script type="text/votyer">
game "Water Temple" {
    size 960 540
    fog 0.5
    ceiling off        // open sky + twinkling stars
}

water {
    color #1a6f92
    wave 0.55
    reflect 0.7
}

map {
    "############"
    "#P...~~....#"
    "#.#C.~~.##.#"
    "#...#~~.c..#"
    "############"
}

item "gem" {
    char "C"
    shape crystal
    color #5eead4
    on take {
        score += 50
        sound pickup
        say "Gem secured!"
    }
}

rules {
    on enter water     { sound splash }
    on all items taken { unlock exit }
    on reach exit      { win }
}

on start { say "Swim the temple. Reach the portal." }
</script>
```

## Highlights (v1.1 — the Water & Light update)

- **A real language** — lexer, parser and interpreter (`Votyer.compile`) with line-numbered error reporting, `if/else`, `let`, `repeat`, `wait`, expressions and string concatenation
- **Animated water** — per-pixel wave displacement, sky reflections, specular shimmer and ripple bands in the floor caster; splash sound, drag physics, underwater tint, `on enter/exit water` rules
- **Dynamic lights** — glowing sprites become real light sources with distance falloff and torch flicker, baked into every wall and floor pixel; player lamp included
- **Textured raycasting renderer** — procedural brick/block/panel walls, floor & ceiling casting, open-sky mode with a parallax starfield, adjustable `detail` for the framebuffer pipeline
- **Procedural everything** — 15 pixel-art sprite shapes and 13 chiptune synth sounds generated at boot: games need **zero asset files**
- **World rules** — `on touch enemy`, `on all items taken`, `on reach exit`, `on enemy dead`, `on bump wall`, `on enter water`, `on exit water`
- **Game shell included** — title screen, pause, win/lose screens, health bar, score, minimap, message toasts, pointer-lock mouse look
- **E# — the site-building sibling language** — `site { hero { galaxy on } ... }` compiles to complete responsive HTML pages with galaxy backgrounds and live votyer games embedded inline

## Quick start

1. Copy `votyer.js` next to an HTML file
2. Paste the snippet above into it
3. Open the file in a browser. Click. Play.

No build step, no npm, no server needed — works from `file://`, GitHub Pages or any CDN.

## Documentation

| Page | What's inside |
|------|---------------|
| [Landing page](https://gefrus112.github.io/votyer/) | Galaxy hero, water showcase, live embedded demo |
| [docs.html](docs.html) | Full language reference: every block, command, shape and sound — plus the complete **E# reference** |
| [tutorial.html](tutorial.html) | Build *Vault Runner* in 10 minutes, step by step (with a water & light bonus chapter) |
| [sprites.html](sprites.html) | The sprite asset gallery — every built-in shape, drawn live by the engine |
| [playground.html](playground.html) | Real code editor with syntax highlighting, votyer **and E#** modes, presets and shareable links |
| [votyer.html](votyer.html) | **Crystal Quest** — the flagship demo, now with a water channel and torches |

## Examples

- [`examples/vault-runner.votyer`](examples/vault-runner.votyer) — the tutorial game: gem, coins, sentinel, locked vault
- [`examples/arena.votyer`](examples/arena.votyer) — combat sandbox showing `enemies left` and timed wins
- [`examples/site-nova.e#`](examples/site-nova.e#) — a complete portfolio website in E#, with a votyer game embedded
- [`examples/site-product.e#`](examples/site-product.e#) — a product landing page in E#

## The language in 30 seconds

```
game "Name" { size 960 560  sky #101426  fog 0.45 }   // world settings
game "Name" { ceiling off  detail 0.7  fogcolor #0d1524 } // atmosphere (new)
water { color #1a6f92  wave 0.55  reflect 0.7 }       // liquids (new)
palette { "1" #5a3b8f }                               // wall colors
map { "####" "#P.#" "#C.#" "####" }                   // ASCII level (~ = water)
item "gem" { char "C" shape crystal value 50 }        // pickups
item "torch" { char "t" shape torch pickup off glow on } // lights (new)
enemy "ghost" { char "E" speed 1.2 hp 30 damage 15 }  // creatures
exit { char "G" locked on }                           // the way out
rules { on all items taken { unlock exit } }          // cause & effect
on start { say "Good luck!" }                         // lifecycle events
```

Handlers give you `score`, `health`, `time`, `items left`, `enemies left`, `random 6`, and commands like `say`, `sound`, `shake`, `heal`, `hurt`, `spawn`, `win`, `lose`, `unlock exit`.

## E# in 30 seconds

```
site "Nova — Design Engineer" {
    theme { accent #7c6cff  bg #0b0d17 }
    nav  { brand "NOVA"  link "Work" "#work" }
    hero { title "Feel alive."  galaxy on }
    features "What I do" { item "Interfaces" "Systems." }
    game  { preset water-temple }      // live votyer game embedded
    footer { text "© 2026 Nova" }
}
```

## JavaScript API

```js
const result = Votyer.compile(source);     // { ok, spec, ast, errors }
const game   = Votyer.run(source, canvas); // boots a live engine
game.destroy();                            // stop it cleanly
Votyer.version;                            // "1.1.0"
Votyer.spritePreview(canvas, 'crystal', '#5eead4', true); // draw any shape

const site = ESharp.compile(esharpSource); // { ok, html, errors }
```

## Contributing

The whole runtime is a single dependency-free, ES5-compatible file (`votyer.js`), organized into clearly labeled stages: lexer → parser → spec builder → runtime → engine → renderer → textures → audio. PRs welcome — especially new sprite shapes and synth sounds, which are each ~20 lines.

## License

[MIT](LICENSE) — build cool things.
