# votyer.js — The HTML5 Retro Game Language

**votyer** is a tiny new programming language that compiles in the browser into a complete **retro 3D raycasting engine**. One script tag, zero dependencies — walls, sprites, items, enemy AI, physics, audio, menus and HUD are all built in.

Write a world in ~100 lines. Get a playable first-person game.

```html
<script src="votyer.js"></script>
<script type="text/votyer">
game "Star Vault" {
    size 960 540
    fog 0.5
}

map {
    "############"
    "#P...#.....#"
    "#.#C.#.###.#"
    "#...#.G.#..#"
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
    on all items taken { unlock exit }
    on reach exit      { win }
}

on start { say "Find the gem. Reach the portal." }
</script>
```

## Highlights

- **A real language** — lexer, parser and interpreter (`Votyer.compile`) with line-numbered error reporting, `if/else`, `let`, `repeat`, `wait`, expressions and string concatenation
- **Retro raycasting renderer** — DDA algorithm, textured walls, distance fog, head-bob, screen shake, billboarded depth-sorted sprites, all at 60 fps
- **Procedural everything** — 8 pixel-art sprite shapes and 10 chiptune synth sounds generated at boot: games need **zero asset files**
- **World rules** — `on touch enemy`, `on all items taken`, `on reach exit`, `on enemy dead`, `on bump wall`
- **Game shell included** — title screen, pause, win/lose screens, health bar, score, minimap, message toasts, pointer-lock mouse look

## Quick start

1. Copy `votyer.js` next to an HTML file
2. Paste the snippet above into it
3. Open the file in a browser. Click. Play.

No build step, no npm, no server needed — works from `file://`, GitHub Pages or any CDN.

## Documentation

| Page | What's inside |
|------|---------------|
| [Landing page](https://gefrus112.github.io/votyer/) | Interactive galaxy hero + live embedded demo |
| [docs.html](docs.html) | Full language reference: every block, command, shape and sound |
| [tutorial.html](tutorial.html) | Build *Vault Runner* in 10 minutes, step by step |
| [playground.html](playground.html) | Live editor — compile and run votyer in your browser |
| [votyer.html](votyer.html) | **Crystal Quest** — the flagship demo game, written 100% in votyer |

## Examples

- [`examples/vault-runner.votyer`](examples/vault-runner.votyer) — the tutorial game: gem, coins, sentinel, locked vault
- [`examples/arena.votyer`](examples/arena.votyer) — combat sandbox showing `enemies left` and timed wins

## The language in 30 seconds

```
game "Name" { size 960 560  sky #101426  fog 0.45 }   // world settings
palette { "1" #5a3b8f }                               // wall colors
map { "####" "#P.#" "#C.#" "####" }                   // ASCII level
item "gem" { char "C" shape crystal value 50 }        // pickups
enemy "ghost" { char "E" speed 1.2 hp 30 damage 15 }  // creatures
exit { char "G" locked on }                           // the way out
rules { on all items taken { unlock exit } }          // cause & effect
on start { say "Good luck!" }                         // lifecycle events
```

Handlers give you `score`, `health`, `time`, `items left`, `enemies left`, `random 6`, and commands like `say`, `sound`, `shake`, `heal`, `hurt`, `spawn`, `win`, `lose`, `unlock exit`.

## JavaScript API

```js
const result = Votyer.compile(source);   // { ok, spec, ast, errors }
const game   = Votyer.run(source, canvas); // boots a live engine
game.destroy();                          // stop it cleanly
Votyer.version;                          // "1.0.0"
```

## Contributing

The whole runtime is a single dependency-free, ES5-compatible file (`votyer.js`) organized into clearly labeled stages: lexer → parser → spec builder → runtime → engine → renderer → audio. PRs welcome — especially new sprite shapes and synth sounds, which are each ~20 lines.

## License

[MIT](LICENSE) — build cool things.
