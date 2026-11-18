# 🏈 Dynasty GM

A generative fantasy football **dynasty** game you play in the browser against CPU managers, season after season.

**Play:** https://dolomitiinvestor.github.io/dynasty-gm/

Every player, rookie class, career arc and league is procedurally generated. No real players.

## Features

- **Startup draft** — 17-round snake draft to build your roster from scratch.
- **Rookie drafts every offseason** — 4 rounds, order set by final standings. Rookie ratings are *scouting estimates* until the draft ends, so you get booms and busts.
- **Trades** — trade players and draft picks (3 future years) with any CPU team. Ask "What would it take?" to have the CPU counter by asking for more.
- **CPU managers with personalities** — each team is *Contending*, *Balanced* or *Rebuilding*, which changes how it values vets versus youth and picks. CPU teams send you offers and trade with each other.
- **Season over season** — players develop toward their potential, peak, decline (RBs fall off earlier than QBs), get hurt, and retire.
- **Free agency** — sign and release players. Undrafted rookies hit the waiver pool.
- **Lineups** — QB, 2 RB, 2 WR, TE, FLEX. Auto-set or manage it each week.
- **14-week season, 4-team playoffs**, MVP and Rookie of the Year awards, champions list, draft history and retired legends.
- **Saves** — auto-saves to your browser (localStorage). Export or import a JSON save file.

## Difficulty

| Level  | CPU trade behavior |
|--------|--------------------|
| Easy   | Accepts fair deals |
| Normal | Wants about 8% more value |
| Hard   | Wants about 18% more value and sends stingier offers |

## Run locally

It's static HTML/JS with no build step. Open `index.html` in a browser, or:

```sh
npx serve .
```

## Code layout

- `engine.js`: game simulation with no DOM (player generation, aging, scoring, valuation, drafts, trades and the CPU managers)
- `ui.js`: rendering and input handling
- `style.css`: styles
