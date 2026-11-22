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
- **Real NFL teams** — every generated player plays for one of the 32 NFL teams (veterans sometimes change teams in the offseason) and has a hometown, jersey number, play-style traits and a placeholder stick-figure portrait.
- **The NFL plays alongside you** — all 32 teams in their real divisions play a real-format 17-game, 18-week schedule with bye weeks (5–14), in step with your league. Teams with healthy stars win more (lose your QB and your team suffers). NFL playoffs (7 seeds per conference) and the Super Bowl set the NFL Draft order. League → NFL shows scores, standings, byes, the bracket and the draft board.
- **NFL Draft and draft capital** — each offseason the NFL teams draft the new rookie class in standings order, before your rookie draft. NFL scouts read talent better than your scouts do, so draft capital is a real signal, and early picks get a bigger role (more touches) in their first three seasons. Rookies join the team that drafted them, and better NFL offenses score more touchdowns.
- **Bye weeks and auto-sub** — players on bye score nothing that week. One click on **🔄 Auto-sub** swaps injured and bye-week starters for your best healthy bench players.
- **Realistic injuries** — position-based rates (RBs miss ~3 games a season, WR/TE ~2, QB ~1.5), named injuries from a 1-game ankle sprain to a season-ending torn ACL, expected return timelines, occasional setbacks, and lingering effects from major injuries. Injuries show up in the end-of-game injury report.
- **Real box scores** — every game simulates actual stat lines (completions, yards, TDs, INTs, carries, targets, receptions, return yards, fumbles, first downs) and scores them with your league settings. Player cards show a game log and career stat totals.
- **Custom scoring** — presets (Standard, Half PPR, Full PPR, PPR + TE Premium, 6-pt passing TD) or fully custom: yardage rates, TDs, INTs, completions, PPR, TE premium, kick/punt return yards and TDs, first downs, 2-pt conversions, fumbles and 100/300-yard bonuses. Projections and trade values adapt to your scoring.
- **Lineups** — QB, 2 RB, 2 WR, TE, FLEX. Auto-set or manage it each week.
- **Game day** — single-week sims play out slot by slot on slot-machine reels (jackpots, injuries, confetti). Box scores and replays for every game.
- **Record book** — League → Records tracks this season and all-time marks: most/fewest points in a week, biggest blowout, closest loss, most points in a loss, fewest in a win, highest-scoring matchup, longest win streak, best single-game player scores by position, single-game yardage/reception/TD records, and season records for teams and players by position. New records show on the end-of-game screen and in the news feed.
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
