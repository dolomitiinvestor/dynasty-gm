/* Dynasty GM — game engine (no DOM). Exposes window.Engine / globalThis.Engine */
(function (G) {
'use strict';

// ---------- constants ----------
const POS = ['QB', 'RB', 'WR', 'TE'];
const SLOTS = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX'];
const FLEX_OK = { RB: 1, WR: 1, TE: 1 };
const C = {
  ROSTER_MAX: 22, REG_WEEKS: 14, PLAYOFF_TEAMS: 4, ROOKIE_ROUNDS: 4,
  STARTUP_ROUNDS: 17, TRADE_DEADLINE: 10, FUTURE_YEARS: 3, START_YEAR: 2026,
};
const DIFF = {
  easy:   { margin: 0.00, offer: 0.98 },
  normal: { margin: 0.08, offer: 0.93 },
  hard:   { margin: 0.18, offer: 0.86 },
};
const PCFG = {
  QB: { base: 6,   scale: 22, repl: 14, peakEnd: 33, declineAge: 34, decline: 3.5, inj: 0.015, cap: 3 },
  RB: { base: 2.5, scale: 20, repl: 7,  peakEnd: 26, declineAge: 27, decline: 5.5, inj: 0.035, cap: 8 },
  WR: { base: 2,   scale: 19, repl: 7,  peakEnd: 28, declineAge: 29, decline: 4,   inj: 0.022, cap: 9 },
  TE: { base: 1.5, scale: 15, repl: 5,  peakEnd: 29, declineAge: 30, decline: 4,   inj: 0.022, cap: 3 },
};
const NFL = {
  ARI: 'Arizona Cardinals', ATL: 'Atlanta Falcons', BAL: 'Baltimore Ravens', BUF: 'Buffalo Bills', CAR: 'Carolina Panthers',
  CHI: 'Chicago Bears', CIN: 'Cincinnati Bengals', CLE: 'Cleveland Browns', DAL: 'Dallas Cowboys', DEN: 'Denver Broncos',
  DET: 'Detroit Lions', GB: 'Green Bay Packers', HOU: 'Houston Texans', IND: 'Indianapolis Colts', JAX: 'Jacksonville Jaguars',
  KC: 'Kansas City Chiefs', LV: 'Las Vegas Raiders', LAC: 'Los Angeles Chargers', LAR: 'Los Angeles Rams', MIA: 'Miami Dolphins',
  MIN: 'Minnesota Vikings', NE: 'New England Patriots', NO: 'New Orleans Saints', NYG: 'New York Giants', NYJ: 'New York Jets',
  PHI: 'Philadelphia Eagles', PIT: 'Pittsburgh Steelers', SF: 'San Francisco 49ers', SEA: 'Seattle Seahawks', TB: 'Tampa Bay Buccaneers',
  TEN: 'Tennessee Titans', WAS: 'Washington Commanders',
};
const NFL_ABBRS = Object.keys(NFL);

// Per-game chance a player suffers an injury. Calibrated so that, like the real NFL,
// RBs miss the most time (~3 games/season on average), then WR/TE (~2.5), then QB (~1.5).
const INJ_RATE = { QB: 0.034, RB: 0.07, WR: 0.052, TE: 0.049 };
// Severity mix: most injuries cost a game or two, a few end the season.
const INJ_TIERS = [['minor', 0.53], ['moderate', 0.27], ['major', 0.12], ['season', 0.08]];
const INJURIES = [
  { n: 'Ankle sprain', t: 'minor', w: [1, 2] },
  { n: 'Hamstring tightness', t: 'minor', w: [1, 2] },
  { n: 'Concussion', t: 'minor', w: [1, 2], pos: { QB: 2, WR: 2 } },
  { n: 'Quad strain', t: 'minor', w: [1, 2] },
  { n: 'Shoulder sprain', t: 'minor', w: [1, 2], pos: { QB: 2 } },
  { n: 'Back spasms', t: 'minor', w: [1, 1] },
  { n: 'Rib contusion', t: 'minor', w: [1, 2], pos: { QB: 2 } },
  { n: 'Knee bruise', t: 'minor', w: [1, 1] },
  { n: 'Groin strain', t: 'minor', w: [1, 2] },
  { n: 'High ankle sprain', t: 'moderate', w: [3, 6], pos: { RB: 2 } },
  { n: 'Hamstring strain', t: 'moderate', w: [2, 4], pos: { WR: 2, RB: 1.5 } },
  { n: 'MCL sprain', t: 'moderate', w: [3, 6] },
  { n: 'Broken hand', t: 'moderate', w: [3, 5], pos: { WR: 1.5, TE: 1.5 } },
  { n: 'Turf toe', t: 'moderate', w: [3, 6] },
  { n: 'AC joint sprain', t: 'moderate', w: [2, 4], pos: { QB: 2 } },
  { n: 'Calf strain', t: 'moderate', w: [2, 4] },
  { n: 'Broken collarbone', t: 'major', w: [6, 9], pos: { QB: 2 } },
  { n: 'Lisfranc injury', t: 'major', w: [6, 10] },
  { n: 'Fractured ribs', t: 'major', w: [5, 8] },
  { n: 'Torn hamstring', t: 'major', w: [6, 9], pos: { WR: 1.5, RB: 1.5 } },
  { n: 'Broken ankle', t: 'major', w: [8, 12] },
  { n: 'Torn ACL', t: 'season', carry: 4, pos: { RB: 1.5, WR: 1.3 } },
  { n: 'Torn Achilles', t: 'season', carry: 6 },
  { n: 'Broken leg', t: 'season', carry: 2 },
  { n: 'Torn pectoral', t: 'season', carry: 1, pos: { TE: 1.5 } },
  { n: 'Torn labrum', t: 'season', carry: 1, pos: { QB: 2 } },
];

const MODE = {
  contend:  { now: 1.35, disc: 0.62, pick: 0.75 },
  balanced: { now: 1.0,  disc: 0.80, pick: 0.92 },
  rebuild:  { now: 0.55, disc: 0.92, pick: 1.10 },
};

const FIRST = ['Aaron','Andre','Bryce','Brock','Caleb','Cam','CeeDee','Chase','Cole','Dak','Dalvin','Damien','Darius','Davante','Deebo','Derrick','Devin','DJ','Drake','Elijah','Emmanuel','Garrett','George','Isaiah','Jaden','Jalen','Jamal','Jameson','Javonte','Jaxon','Jayden','Jordan','Josh','Justin','Kadarius','Keenan','Kenneth','Kyler','Kyle','Lamar','Malik','Marcus','Mark','Marvin','Matt','Micah','Mike','Nico','Patrick','Quentin','Rashee','Rome','Russell','Sam','Saquon','Stefon','Terry','Trey','Tre','Travis','Treylon','Tua','Tyler','Tyreek','Xavier','Zach','Zay','Bo','Ladd','Rhamondre','Kenny','Brian','Chris','Austin','Gabe','Hollis','Tank','Jahmyr','Bijan','Puka','Rashid','Tee','Romeo','Amari','Dontayvion','Keon','Brenton','Luther','Malachi','Omarion','Quinshon','Tetairoa','Colston','Harold','Kaleb','Trevor','Dillon','Carson','Shedeur','Ollie'];
const LAST = ['Adams','Allen','Barnes','Bell','Bowers','Brooks','Brown','Burrow','Carter','Chubb','Coleman','Collins','Cook','Cooper','Davis','Diggs','Dobbins','Douglas','Edwards','Ellis','Evans','Fields','Flowers','Ford','Gibbs','Godwin','Goff','Graham','Green','Hall','Harris','Harrison','Henry','Hill','Hockenson','Holmes','Hunt','Irving','Jackson','Jefferson','Johnson','Jones','Kelce','Kincaid','Lamb','Lewis','London','Love','Mack','Marshall','Mason','McBride','McCaffrey','Metcalf','Miller','Mixon','Moore','Morgan','Murray','Nabers','Nacua','Olave','Parker','Pierce','Pitts','Prescott','Reed','Rice','Ridley','Robinson','Rogers','Ross','Samuel','Sanders','Smith','Stroud','Sutton','Swift','Taylor','Thomas','Tucker','Turner','Walker','Waddle','Ward','Warren','Washington','Watson','White','Williams','Wilson','Worthy','Wright','Young','Odunze','Achane','Bowman','Kirk','Stevenson','Hampton','Judkins','Egbuka','Tracy','Ayomanor'];
const COLLEGES = ['Alabama','Georgia','Ohio State','Michigan','LSU','Texas','Oklahoma','USC','Oregon','Clemson','Florida','Penn State','Notre Dame','Auburn','Tennessee','Wisconsin','Iowa','Miami','Florida State','Utah','Washington','TCU','Baylor','Ole Miss','Kentucky','Arizona State','Colorado','Boise State','Toledo','App State','North Dakota St','Purdue','Missouri','Texas A&M','Stanford','UCLA','Pittsburgh','Louisville','Tulane','Memphis'];
const CITIES = ['Austin','Boise','Charleston','Denver','El Paso','Fargo','Honolulu','Indy','Juneau','Kansas City','Lansing','Memphis','Nashville','Omaha','Portland','Reno','Sacramento','Salt Lake','Spokane','Tucson','Tulsa','Albany','Anchorage','Birmingham','Cheyenne','Des Moines','Halifax','Louisville','Mobile','Orlando','Pittsburgh','Raleigh'];
const MASCOTS = ['Bison','Comets','Cyclones','Dragons','Falcons','Foxes','Gators','Hornets','Jackals','Knights','Lumberjacks','Mammoths','Mustangs','Outlaws','Owls','Pilots','Raptors','Rattlers','Rhinos','Sasquatch','Scorpions','Sentinels','Stallions','Thunder','Titans','Vipers','Vultures','Wolves','Yetis','Zephyrs','Krakens','Moose'];
const COLORS = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4','#e11d48','#a855f7','#eab308','#22c55e'];

// ---------- helpers ----------
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sum = a => a.reduce((s, x) => s + x, 0);
function gauss(m = 0, s = 1) {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

let L = null;
const P = id => L.players[id];
const T = id => L.teams[id];
const nid = () => L.nextId++;
const isUser = id => id === L.userId;
const N = () => L.teams.length;

function news(text, type = 'info', mine = false) {
  L.news.unshift({ year: L.year, week: L.week, phase: L.phase, text, type, mine });
  if (L.news.length > 250) L.news.length = 250;
}

// ---------- player model ----------
function ppg(ovr, pos) {
  const c = PCFG[pos];
  return c.base + c.scale * Math.pow(clamp(ovr, 0, 100) / 100, 2.6);
}
const proj = p => (p.inj > 0 ? 0 : ppg(p.ovr, p.pos));
const fullName = p => p.first + ' ' + p.last;

function newRookie(pos, year, persist = true) {
  const age = pick([21, 21, 22, 22, 22, 23]);
  const pot = Math.round(clamp(gauss(60, 14), 28, 99));
  const ovr = Math.round(clamp(pot - rnd(6, 30) + (age - 22) * 2, 22, 88));
  const p = {
    id: persist ? nid() : -1, first: pick(FIRST), last: pick(LAST), pos, age, ovr, pot,
    dev: +rnd(0.2, 0.65).toFixed(2), college: pick(COLLEGES), teamId: null,
    rookieYear: year, draft: null, revealed: false, inj: 0, injury: null, hist: [], wk: [],
    nfl: pick(NFL_ABBRS),
  };
  p.scoutOvr = Math.round(clamp(ovr + gauss(0, 7), 20, 95));
  p.scoutPot = Math.round(clamp(pot + gauss(0, 9), p.scoutOvr, 99));
  p.potEst = p.scoutPot;
  if (persist) L.players[p.id] = p;
  return p;
}

function newVeteran(pos, year) {
  let target = 21 + Math.floor(Math.abs(gauss(0, pos === 'QB' ? 6 : 4.5)));
  target = clamp(target, 21, pos === 'QB' ? 37 : 33);
  const p = newRookie(pos, year);
  p.age = 21;
  p.ovr = Math.min(p.ovr, p.pot);
  while (p.age < target) ageOne(p);
  p.rookieYear = year - Math.max(1, target - 21);
  p.revealed = true;
  p.potEst = estPot(p);
  return p;
}

function ageOne(p) {
  p.age++;
  const c = PCFG[p.pos];
  if (p.age <= c.peakEnd && p.ovr < p.pot) {
    p.ovr += (p.pot - p.ovr) * p.dev * rnd(0.5, 1.4) + gauss(0, 2);
  } else if (p.age >= c.declineAge) {
    p.ovr -= c.decline * (1 + (p.age - c.declineAge) * 0.35) * rnd(0.4, 1.6);
  } else {
    p.ovr += gauss(0, 2.5);
  }
  if (Math.random() < 0.06) p.ovr += gauss(0, 8); // breakout or collapse
  p.ovr = Math.round(clamp(p.ovr, 20, 99));
  p.pot = Math.max(p.pot, p.ovr);
}

function estPot(p) {
  return Math.round(clamp(p.pot + gauss(0, p.age < 25 ? 6 : 3), p.ovr, 99));
}

function retireChanceAt(pos, age, ovr) {
  const c = PCFG[pos];
  let ch = 0;
  if (age >= c.declineAge) ch += 0.06 + (age - c.declineAge) * 0.09;
  if (ovr < 40 && age >= 25) ch += 0.25;
  if (age >= 37) ch += 0.4;
  return Math.min(0.95, ch);
}

function rollScore(p) {
  const m = ppg(p.ovr, p.pos);
  let s = gauss(m, m * 0.42 + 1.5);
  if (Math.random() < 0.04) s += rnd(8, 20); // boom game
  return Math.round(Math.max(-3, s) * 10) / 10;
}

function weighted(list) { // [[item, weight], ...]
  let r = Math.random() * sum(list.map(x => x[1]));
  for (const [item, wt] of list) { r -= wt; if (r <= 0) return item; }
  return list[list.length - 1][0];
}

// Injure a player during week w. Returns the injury record.
function injure(p, w) {
  const tier = weighted(INJ_TIERS);
  const def = weighted(INJURIES.filter(i => i.t === tier).map(i => [i, (i.pos && i.pos[p.pos]) || 1]));
  let weeks, est, short;
  if (tier === 'season') { weeks = 99; est = 'out for the season'; short = 'IR'; }
  else {
    weeks = ri(def.w[0], def.w[1]);
    if (Math.random() < 0.1) weeks++; // occasional setback beyond the initial estimate
    est = def.w[0] === def.w[1] ? `out ~${def.w[0]} week${def.w[0] > 1 ? 's' : ''}` : `out ${def.w[0]}–${def.w[1]} weeks`;
    short = def.w[0] === def.w[1] ? `${def.w[0]}w` : `${def.w[0]}-${def.w[1]}w`;
  }
  p.inj = weeks;
  p.injury = { name: def.n, est, short, season: tier === 'season', carry: def.carry || 0, year: L.year, week: w, tier };
  if (p.teamId != null) {
    L.injuryLog.push({ year: L.year, week: w, id: p.id, team: p.teamId, pname: fullName(p), pos: p.pos, nfl: p.nfl, name: def.n, est, season: p.injury.season, tier });
    if (p.teamId === L.userId) news(`🚑 ${p.pos} ${fullName(p)} (${p.nfl}) — ${def.n}, ${est}.`, 'bad', true);
    else if (p.injury.season && ppg(p.ovr, p.pos) > PCFG[p.pos].repl + 3) news(`🚑 ${T(p.teamId).abbr}'s ${p.pos} ${fullName(p)} (${p.nfl}) suffers a ${def.n.toLowerCase()} — out for the season.`);
  }
  return p.injury;
}

function seasonPts(p) { return Math.round(sum(p.wk.filter(x => x != null)) * 10) / 10; }
function seasonGP(p) { return p.wk.filter(x => x != null).length; }

// ---------- valuation ----------
function seasonFrac() {
  if (L.phase === 'regular') return Math.max(0.15, (C.REG_WEEKS - L.week + 1) / C.REG_WEEKS);
  if (L.phase === 'playoffs') return 0.1;
  return 1;
}

function projectPath(p, years, view) {
  const hidden = view === 'public' && !p.revealed;
  let o = hidden ? p.scoutOvr : p.ovr;
  const pot = view === 'public' ? (hidden ? p.scoutPot : p.potEst) : p.pot;
  const c = PCFG[p.pos];
  let a = p.age;
  const out = [o];
  for (let y = 1; y < years; y++) {
    a++;
    if (a <= c.peakEnd && o < pot) o += (pot - o) * Math.min(0.9, p.dev);
    else if (a >= c.declineAge) o -= c.decline * (1 + (a - c.declineAge) * 0.35);
    out.push(Math.max(20, o));
  }
  return out;
}

function valueCore(p, mode, view, frac) {
  const m = MODE[mode] || MODE.balanced;
  const c = PCFG[p.pos];
  const path = projectPath(p, 5, view);
  let v = 0, surv = 1, a = p.age;
  for (let y = 0; y < 5; y++) {
    if (y > 0) { a++; surv *= 1 - retireChanceAt(p.pos, a, path[y]); }
    const above = Math.max(0, ppg(path[y], p.pos) - c.repl + 2);
    const w = y === 0 ? m.now * frac : Math.pow(m.disc, y);
    v += Math.pow(above, 1.6) * w * surv;
  }
  return v / 2;
}

function playerValue(p, mode = 'balanced', view = 'true') {
  let frac = seasonFrac();
  if (p.inj > 0 && (L.phase === 'regular' || L.phase === 'playoffs')) {
    const remaining = Math.max(1, C.REG_WEEKS + 3 - L.week);
    frac *= Math.max(0, 1 - p.inj / remaining); // season-ending injury wipes out this year's value
  }
  return valueCore(p, mode, view, frac);
}

const curveCache = {};
function rookieCurve() {
  const n = N() * C.ROOKIE_ROUNDS;
  if (curveCache[n]) return curveCache[n];
  const K = 8, sums = new Array(n).fill(0);
  for (let k = 0; k < K; k++) {
    const cls = rookieClassPositions(n * 2).map(pos => newRookie(pos, 0, false));
    const vals = cls.map(p => valueCore(p, 'balanced', 'true', 1)).sort((a, b) => b - a);
    for (let i = 0; i < n; i++) sums[i] += vals[i];
  }
  const curve = sums.map(s => (s / K) * 0.88); // uncertainty discount
  curveCache[n] = curve;
  return curve;
}
function curveAt(x) { // x = 1-based overall pick, may be fractional
  const c = rookieCurve();
  const i = clamp(x - 1, 0, c.length - 1);
  const lo = Math.floor(i), hi = Math.min(c.length - 1, lo + 1);
  return c[lo] + (c[hi] - c[lo]) * (i - lo);
}

function nextDraftYear() { return L.phase === 'draft' ? L.year : L.year + 1; }

function standingsOrder() { // best first
  return L.teams.slice().sort((a, b) => (b.w + b.t * 0.5) - (a.w + a.t * 0.5) || b.pf - a.pf).map(t => t.id);
}

function pickSlot(pk) { // 1-based slot within round (may be fractional estimate), plus whether known
  const ord = L.draftOrders[pk.year];
  if (ord) return { slot: ord.indexOf(pk.origId) + 1, known: true };
  if (pk.year === nextDraftYear() && L.phase === 'regular' && L.week > 3) {
    const s = standingsOrder().reverse();
    const est = s.indexOf(pk.origId) + 1;
    return { slot: (est + (N() + 1) / 2) / 2, known: false };
  }
  if (pk.year === nextDraftYear() && L.phase === 'playoffs') {
    const s = standingsOrder().reverse();
    return { slot: s.indexOf(pk.origId) + 1, known: false };
  }
  return { slot: (N() + 1) / 2, known: false };
}

function pickValue(pk, mode = 'balanced') {
  const m = MODE[mode] || MODE.balanced;
  const yearsAway = Math.max(0, pk.year - nextDraftYear());
  const { slot } = pickSlot(pk);
  const overall = (pk.round - 1) * N() + slot;
  return curveAt(overall) * m.pick * Math.pow(0.85, yearsAway);
}

function pickLabel(pk) {
  const { slot, known } = pickSlot(pk);
  const rnd = ['1st', '2nd', '3rd', '4th', '5th'][pk.round - 1];
  let s = `${pk.year} ${rnd}`;
  if (known) s = `${pk.year} ${pk.round}.${String(slot).padStart(2, '0')}`;
  if (pk.origId !== pk.ownerId) s += ` (${T(pk.origId).abbr})`;
  return s;
}

function assetValue(a, mode, view = 'true') {
  if (a.kind === 'p') return playerValue(P(a.id), mode, view);
  return pickValue(L.picks.find(k => k.id === a.id), mode);
}
function teamAssets(teamId) {
  const t = T(teamId);
  return t.roster.map(id => ({ kind: 'p', id }))
    .concat(L.picks.filter(k => k.ownerId === teamId && !k.used).map(k => ({ kind: 'k', id: k.id })));
}
function assetName(a) {
  if (a.kind === 'p') { const p = P(a.id); return `${p.pos} ${fullName(p)}`; }
  return pickLabel(L.picks.find(k => k.id === a.id));
}

// ---------- teams & lineups ----------
const elig = (pos, slot) => (slot === 'FLEX' ? !!FLEX_OK[pos] : pos === slot);

function bestLineup(t) {
  const avail = t.roster.map(P).filter(p => p && p.inj === 0).sort((a, b) => proj(b) - proj(a));
  const used = new Set();
  return SLOTS.map(s => {
    const p = avail.find(x => !used.has(x.id) && elig(x.pos, s));
    if (p) { used.add(p.id); return p.id; }
    return null;
  });
}
function sanitizeLineup(t) {
  const seen = new Set();
  t.lineup = SLOTS.map((s, i) => {
    const id = t.lineup ? t.lineup[i] : null;
    const p = id != null ? P(id) : null;
    if (p && p.teamId === t.id && elig(p.pos, s) && !seen.has(id)) { seen.add(id); return id; }
    return null;
  });
}
function teamPower(t) {
  return sum(bestLineup(t).map(id => (id != null ? ppg(P(id).ovr, P(id).pos) : 0)));
}

function setModes() {
  const ranked = L.teams.map(t => {
    let s = teamPower(t);
    if (L.phase === 'regular' && L.week > 6) s += ((t.w + 0.5 * t.t) / Math.max(1, t.w + t.l + t.t)) * 25;
    return { t, s };
  }).sort((a, b) => b.s - a.s);
  const k = Math.round(N() * 0.3);
  ranked.forEach((x, i) => { x.t.mode = i < k ? 'contend' : i >= N() - k ? 'rebuild' : 'balanced'; });
}

function removeFromTeam(p) {
  if (p.teamId == null) return;
  const t = T(p.teamId);
  t.roster = t.roster.filter(id => id !== p.id);
  if (t.lineup) t.lineup = t.lineup.map(id => (id === p.id ? null : id));
  p.teamId = null;
}
function addToTeam(p, teamId) {
  removeFromTeam(p);
  p.teamId = teamId;
  T(teamId).roster.push(p.id);
}

function freeAgents() {
  return Object.values(L.players).filter(p => p.teamId == null && !p.retired && (p.revealed || L.phase !== 'draft' || p.rookieYear !== L.year));
}

function aiCutDown(t, max = C.ROSTER_MAX) {
  while (t.roster.length > max) {
    const worst = t.roster.map(P).sort((a, b) => playerValue(a, t.mode) - playerValue(b, t.mode))[0];
    removeFromTeam(worst);
  }
}

function aiFill(t, target) {
  const fas = freeAgents().sort((a, b) => playerValue(b, t.mode) - playerValue(a, t.mode));
  let i = 0;
  while (t.roster.length < target && i < fas.length) { addToTeam(fas[i], t.id); i++; }
}

function aiWaivers(t) {
  // fill empty lineup slots with best free agent at that slot
  const lu = bestLineup(t);
  SLOTS.forEach((s, i) => {
    if (lu[i] != null) return;
    const fa = freeAgents().filter(p => p.inj === 0 && elig(p.pos, s)).sort((a, b) => proj(b) - proj(a))[0];
    if (!fa) return;
    if (t.roster.length >= C.ROSTER_MAX) {
      const drop = t.roster.map(P).filter(p => p.pos !== 'QB' || s === 'QB')
        .sort((a, b) => playerValue(a, t.mode) - playerValue(b, t.mode))[0];
      if (!drop || playerValue(drop, t.mode) > playerValue(fa, t.mode) * 3 + 5) return;
      removeFromTeam(drop);
    }
    addToTeam(fa, t.id);
  });
}

// ---------- league creation ----------
function rookieClassPositions(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    out.push(r < 0.15 ? 'QB' : r < 0.45 ? 'RB' : r < 0.83 ? 'WR' : 'TE');
  }
  return out;
}

function makeTeams(n, userName) {
  const cities = shuffle(CITIES.slice()), mascots = shuffle(MASCOTS.slice()), colors = shuffle(COLORS.slice());
  const used = new Set();
  const teams = [];
  for (let i = 0; i < n; i++) {
    const name = i === 0 && userName ? userName : `${cities[i]} ${mascots[i]}`;
    let base = (i === 0 && userName ? userName.replace(/[^A-Za-z]/g, '') : mascots[i]).toUpperCase();
    if (base.length < 3) base = (base + 'XXX');
    let abbr = base.slice(0, 3), k = 3;
    while (used.has(abbr) && k < base.length) abbr = base.slice(0, 2) + base[k++];
    while (used.has(abbr)) abbr = base.slice(0, 2) + String.fromCharCode(65 + ri(0, 25));
    used.add(abbr);
    teams.push({
      id: i, name, abbr, color: colors[i % colors.length], human: i === 0, mode: 'balanced',
      roster: [], lineup: SLOTS.map(() => null), autoLineup: true,
      w: 0, l: 0, t: 0, pf: 0, pa: 0, hist: [], titles: 0,
    });
  }
  return teams;
}

function newLeague({ teamName = 'My Team', numTeams = 10, difficulty = 'normal' } = {}) {
  L = {
    version: 1, year: C.START_YEAR, phase: 'startup', week: 0, nextId: 1, userId: 0,
    settings: { numTeams, difficulty },
    teams: makeTeams(numTeams, teamName.trim() || 'My Team'),
    players: {}, picks: [], schedule: [], results: [], playoffs: null, draft: null,
    news: [], offers: [], history: [], retired: [], draftOrders: {}, draftHistory: {}, injuryLog: [],
  };
  const counts = { QB: 3.5, RB: 8, WR: 10, TE: 3.5 };
  POS.forEach(pos => {
    const made = [];
    for (let i = 0; i < Math.round(counts[pos] * numTeams * 1.6); i++) made.push(newVeteran(pos, L.year));
    made.sort((a, b) => valueCore(b, 'balanced', 'true', 1) - valueCore(a, 'balanced', 'true', 1) || b.ovr - a.ovr)
      .slice(Math.round(counts[pos] * numTeams)).forEach(p => delete L.players[p.id]);
  });
  for (let y = 1; y <= C.FUTURE_YEARS; y++) createPicks(L.year + y);
  setupStartupDraft();
  news(`Welcome to the ${L.year} startup draft! ${numTeams} teams, ${C.STARTUP_ROUNDS} rounds, snake order.`, 'big');
  return L;
}

function createPicks(year) {
  for (let r = 1; r <= C.ROOKIE_ROUNDS; r++) {
    L.teams.forEach(t => L.picks.push({ id: nid(), year, round: r, origId: t.id, ownerId: t.id, used: false }));
  }
}

// ---------- drafts ----------
function setupStartupDraft() {
  const order = shuffle(L.teams.map(t => t.id));
  const picks = [];
  for (let r = 1; r <= C.STARTUP_ROUNDS; r++) {
    const ord = r % 2 ? order : order.slice().reverse();
    ord.forEach((tid, i) => picks.push({ round: r, no: i + 1, teamId: tid, playerId: null }));
  }
  L.draft = { year: L.year, type: 'startup', picks, cur: 0 };
}

function setupRookieDraft() {
  let order = L.draftOrders[L.year];
  if (!order) { order = standingsOrder().reverse(); L.draftOrders[L.year] = order; }
  const picks = L.picks.filter(k => k.year === L.year && !k.used)
    .sort((a, b) => a.round - b.round || order.indexOf(a.origId) - order.indexOf(b.origId))
    .map(k => ({ round: k.round, no: order.indexOf(k.origId) + 1, teamId: k.ownerId, pickId: k.id, origId: k.origId, playerId: null }));
  L.draft = { year: L.year, type: 'rookie', picks, cur: 0 };
}

function draftPool() {
  if (!L.draft) return [];
  if (L.draft.type === 'startup') return Object.values(L.players).filter(p => p.teamId == null && !p.retired);
  return Object.values(L.players).filter(p => p.teamId == null && !p.retired && p.rookieYear === L.year && !p.revealed);
}

function currentPick() { return L.draft ? L.draft.picks[L.draft.cur] : null; }

function aiDraftChoice(teamId) {
  const t = T(teamId);
  const pool = draftPool();
  const counts = { QB: 0, RB: 0, WR: 0, TE: 0 };
  t.roster.forEach(id => counts[P(id).pos]++);
  const startup = L.draft.type === 'startup';
  const round = currentPick().round;
  let best = null, bestS = -1;
  pool.forEach(p => {
    let v = startup ? playerValue(p, t.mode) : valueCore(p, t.mode, 'public', 1);
    v *= 1 + gauss(0, startup ? 0.08 : 0.15);
    if (startup) {
      if (counts[p.pos] >= PCFG[p.pos].cap) v *= 0.3;
      const need = { QB: 1, RB: 2, WR: 3, TE: 1 }[p.pos];
      if (counts[p.pos] < need && round > 5) v *= 1.5;
    } else if (counts[p.pos] >= PCFG[p.pos].cap + 2) v *= 0.6;
    if (v > bestS) { bestS = v; best = p; }
  });
  return best;
}

function makeDraftPick(playerId) {
  const dp = currentPick();
  if (!dp) return;
  const p = P(playerId);
  if (!p || p.teamId != null) return;
  addToTeam(p, dp.teamId);
  dp.playerId = p.id;
  if (L.draft.type === 'rookie') {
    p.draft = { year: L.year, round: dp.round, no: dp.no, teamId: dp.teamId };
    const k = L.picks.find(x => x.id === dp.pickId);
    if (k) k.used = true;
    if (isUser(dp.teamId)) news(`You drafted ${p.pos} ${fullName(p)} (${p.college}) at pick ${dp.round}.${String(dp.no).padStart(2, '0')}.`, 'good', true);
    else if (dp.round === 1 && dp.no <= 3) news(`${T(dp.teamId).name} take ${p.pos} ${fullName(p)} at ${dp.round}.${String(dp.no).padStart(2, '0')}.`);
  }
  L.draft.cur++;
  if (L.draft.cur >= L.draft.picks.length) finishDraft();
}

function draftAdvance(stopAtUser = true) {
  while (L.draft && L.draft.cur < L.draft.picks.length) {
    const dp = currentPick();
    if (isUser(dp.teamId) && stopAtUser) return;
    const choice = aiDraftChoice(dp.teamId);
    if (!choice) { finishDraft(); return; }
    makeDraftPick(choice.id);
  }
}

function finishDraft() {
  const d = L.draft;
  L.draftHistory[d.year + (d.type === 'startup' ? '-startup' : '')] = d.picks.map(x => ({ round: x.round, no: x.no, teamId: x.teamId, playerId: x.playerId }));
  if (d.type === 'rookie') {
    Object.values(L.players).forEach(p => {
      if (p.rookieYear === L.year && !p.revealed) { p.revealed = true; p.potEst = estPot(p); }
    });
    createPicks(L.year + C.FUTURE_YEARS);
    news(`The ${L.year} rookie draft is complete. Undrafted rookies are now free agents.`, 'big');
  } else {
    news(`Startup draft complete! Set your lineup and start the ${L.year} season.`, 'big');
  }
  L.draft = null;
  L.phase = 'preseason';
  L.teams.forEach(t => { if (!t.human) { aiCutDown(t); aiFill(t, 19); } });
  setModes();
}

// ---------- season ----------
function makeSchedule(ids) {
  const arr = ids.slice();
  if (arr.length % 2) arr.push(null);
  const m = arr.length, rounds = [];
  for (let r = 0; r < m - 1; r++) {
    const games = [];
    for (let i = 0; i < m / 2; i++) {
      const a = arr[i], b = arr[m - 1 - i];
      if (a != null && b != null) games.push(Math.random() < 0.5 ? [a, b] : [b, a]);
    }
    rounds.push(games);
    arr.splice(1, 0, arr.pop());
  }
  shuffle(rounds);
  const weeks = [];
  for (let w = 0; w < C.REG_WEEKS; w++) weeks.push(rounds[w % rounds.length]);
  return weeks;
}

function userRosterProblem() {
  const u = T(L.userId);
  if (u.roster.length > C.ROSTER_MAX) return `Your roster has ${u.roster.length} players — release ${u.roster.length - C.ROSTER_MAX} to get down to ${C.ROSTER_MAX}.`;
  return null;
}

function startSeason() {
  if (L.phase !== 'preseason') return;
  const prob = userRosterProblem();
  if (prob) return prob;
  L.teams.forEach(t => {
    Object.assign(t, { w: 0, l: 0, t: 0, pf: 0, pa: 0 });
    if (!t.human) { aiCutDown(t); aiFill(t, 19); }
    if (!t.human || t.autoLineup) t.lineup = bestLineup(t);
  });
  Object.values(L.players).forEach(p => { p.wk = []; });
  L.schedule = makeSchedule(L.teams.map(t => t.id));
  L.results = [];
  L.playoffs = null;
  L.offers = [];
  L.injuryLog = L.injuryLog.filter(x => x.year >= L.year - 1);
  L.phase = 'regular';
  L.week = 1;
  setModes();
  news(`The ${L.year} season kicks off!`, 'big');
  return null;
}

function opponentOf(teamId, week) {
  if (week <= C.REG_WEEKS) {
    const g = (L.schedule[week - 1] || []).find(g => g.includes(teamId));
    return g ? (g[0] === teamId ? g[1] : g[0]) : null;
  }
  if (!L.playoffs) return null;
  const games = week === C.REG_WEEKS + 1 ? L.playoffs.semis : (L.playoffs.final ? [L.playoffs.final] : []);
  const g = games.find(g => g.includes(teamId));
  return g ? (g[0] === teamId ? g[1] : g[0]) : null;
}

function lineupScore(t, week) {
  return Math.round(sum(t.lineup.map(id => (id != null ? (P(id).wk[week - 1] || 0) : 0))) * 10) / 10;
}

function simWeek() {
  if (L.phase !== 'regular' && L.phase !== 'playoffs') return 'Not in season.';
  const prob = userRosterProblem();
  if (prob) return prob;
  const w = L.week;
  L.teams.forEach(t => {
    if (!t.human) aiWaivers(t);
    if (!t.human || t.autoLineup) t.lineup = bestLineup(t);
    else sanitizeLineup(t);
  });
  // score every active player
  Object.values(L.players).forEach(p => {
    if (p.retired) return;
    if (p.inj > 0) { p.wk[w - 1] = null; p.inj--; if (!p.inj) p.injury = null; return; }
    let s = rollScore(p);
    if (Math.random() < INJ_RATE[p.pos]) {
      injure(p, w);
      s = Math.round(s * rnd(0.1, 0.7) * 10) / 10; // left the game early
    }
    p.wk[w - 1] = s;
    // in-season development
    if (p.age <= 25 && p.ovr < p.pot && Math.random() < 0.12) p.ovr++;
    if (p.age >= PCFG[p.pos].declineAge && Math.random() < 0.08) p.ovr--;
  });

  const play = (a, b) => {
    const ta = T(a), tb = T(b);
    const sa = lineupScore(ta, w), sb = lineupScore(tb, w);
    // snapshot of each lineup: [playerId, points (null = injured/out), projection] per slot
    // [playerId, points (null = out), projection, hurt in this game (1/0)] per slot
    const snap = t => t.lineup.map(id => {
      if (id == null) return null;
      const p = P(id);
      const hurt = p.injury && p.injury.year === L.year && p.injury.week === w ? 1 : 0;
      return [id, p.wk[w - 1], Math.round(ppg(p.ovr, p.pos) * 10) / 10, hurt];
    });
    return { a, b, sa, sb, la: snap(ta), lb: snap(tb), year: L.year };
  };

  if (L.phase === 'regular') {
    const res = L.schedule[w - 1].map(([a, b]) => play(a, b));
    res.forEach(g => {
      const ta = T(g.a), tb = T(g.b);
      ta.pf += g.sa; ta.pa += g.sb; tb.pf += g.sb; tb.pa += g.sa;
      if (g.sa > g.sb) { ta.w++; tb.l++; } else if (g.sb > g.sa) { tb.w++; ta.l++; } else { ta.t++; tb.t++; }
      if (g.a === L.userId || g.b === L.userId) {
        const mine = g.a === L.userId ? g.sa : g.sb, theirs = g.a === L.userId ? g.sb : g.sa;
        const opp = T(g.a === L.userId ? g.b : g.a);
        news(`Week ${w}: ${mine > theirs ? 'W' : mine < theirs ? 'L' : 'T'} ${mine.toFixed(1)}–${theirs.toFixed(1)} vs ${opp.name}`, mine > theirs ? 'good' : mine < theirs ? 'bad' : 'info', true);
      }
    });
    L.teams.forEach(t => { t.pf = Math.round(t.pf * 10) / 10; t.pa = Math.round(t.pa * 10) / 10; });
    L.results[w - 1] = res;
    if (w <= C.TRADE_DEADLINE) {
      if (Math.random() < 0.35) aiMakeOffer();
      if (Math.random() < 0.18) aiAiTrade();
    }
    if (w === 7) setModes();
    L.offers = L.offers.filter(o => w - o.week < 2 && w < C.TRADE_DEADLINE);
    L.week++;
    if (L.week > C.REG_WEEKS) startPlayoffs();
  } else {
    const pl = L.playoffs;
    const winner = g => (g.sa > g.sb ? g.a : g.sb > g.sa ? g.b : (pl.seeds.indexOf(g.a) < pl.seeds.indexOf(g.b) ? g.a : g.b));
    if (w === C.REG_WEEKS + 1) {
      pl.semiRes = pl.semis.map(([a, b]) => play(a, b));
      L.results[w - 1] = pl.semiRes;
      pl.final = pl.semiRes.map(winner);
      pl.semiRes.forEach(g => {
        const mine = g.a === L.userId || g.b === L.userId;
        if (mine) news(winner(g) === L.userId ? `Semifinal WIN! ${Math.max(g.sa, g.sb).toFixed(1)}–${Math.min(g.sa, g.sb).toFixed(1)}. On to the championship!` : `Eliminated in the semifinals (${g.sa.toFixed(1)}–${g.sb.toFixed(1)}).`, winner(g) === L.userId ? 'good' : 'bad', true);
      });
      L.week++;
    } else {
      const g = play(pl.final[0], pl.final[1]);
      pl.finalRes = g;
      L.results[w - 1] = [g];
      pl.champ = winner(g);
      pl.runnerUp = pl.champ === g.a ? g.b : g.a;
      endSeason();
    }
  }
  return null;
}

function startPlayoffs() {
  const seeds = standingsOrder().slice(0, C.PLAYOFF_TEAMS);
  L.playoffs = { seeds, semis: [[seeds[0], seeds[3]], [seeds[1], seeds[2]]], semiRes: null, final: null };
  L.phase = 'playoffs';
  L.offers = [];
  const ui = seeds.indexOf(L.userId);
  news(ui >= 0 ? `You clinched the #${ui + 1} seed! Playoffs begin.` : `Regular season over — you missed the playoffs.`, ui >= 0 ? 'good' : 'bad', true);
}

function endSeason() {
  const pl = L.playoffs;
  const champ = T(pl.champ), ru = T(pl.runnerUp);
  champ.titles++;
  const all = Object.values(L.players).filter(p => !p.retired);
  const byPts = all.slice().sort((a, b) => seasonPts(b) - seasonPts(a));
  const mvp = byPts[0];
  const roty = byPts.find(p => p.rookieYear === L.year);
  const semiLosers = pl.semis.flat().filter(id => !pl.final.includes(id));
  const finishOf = id => (id === pl.champ ? 1 : id === pl.runnerUp ? 2 : semiLosers.includes(id) ? 3 : standingsOrder().indexOf(id) + 1);
  const userT = T(L.userId);
  L.history.push({
    year: L.year, champ: champ.id, champName: champ.name, runnerUp: ru.id, runnerUpName: ru.name,
    mvp: mvp ? { id: mvp.id, name: fullName(mvp), pos: mvp.pos, pts: seasonPts(mvp), team: mvp.teamId != null ? T(mvp.teamId).abbr : 'FA' } : null,
    roty: roty ? { id: roty.id, name: fullName(roty), pos: roty.pos, pts: seasonPts(roty), team: roty.teamId != null ? T(roty.teamId).abbr : 'FA' } : null,
    user: { w: userT.w, l: userT.l, t: userT.t, pf: userT.pf, finish: finishOf(L.userId) },
  });
  L.teams.forEach(t => t.hist.push({ year: L.year, w: t.w, l: t.l, t: t.t, pf: t.pf, finish: finishOf(t.id) }));
  all.forEach(p => {
    const gp = seasonGP(p);
    if (gp > 0 || p.teamId != null) p.hist.push({ year: L.year, team: p.teamId != null ? T(p.teamId).abbr : 'FA', gp, pts: seasonPts(p), ovr: p.ovr, age: p.age });
  });
  // draft order for next year: non-playoff worst->best, semifinal losers, runner-up, champion
  const st = standingsOrder();
  const nonPO = st.filter(id => !pl.seeds.includes(id)).reverse();
  const semiL = st.filter(id => semiLosers.includes(id)).reverse();
  L.draftOrders[L.year + 1] = nonPO.concat(semiL, [pl.runnerUp, pl.champ]);
  L.phase = 'offseason';
  L.offers = [];
  news(`🏆 ${champ.name} win the ${L.year} championship over ${ru.name}!`, 'big', pl.champ === L.userId);
  if (mvp) news(`${L.year} MVP: ${mvp.pos} ${fullName(mvp)} (${seasonPts(mvp)} pts).`);
}

function startOffseason() {
  if (L.phase !== 'offseason') return;
  L.year++;
  L.offers = [];
  const retiring = [];
  Object.values(L.players).forEach(p => {
    if (p.retired) return;
    // serious injuries (ACL, Achilles...) can sap some ability the following year
    if (p.injury && p.injury.carry) p.ovr = Math.max(20, p.ovr - Math.round(p.injury.carry * rnd(0.5, 1.5)));
    p.inj = 0;
    p.injury = null;
    ageOne(p);
    // NFL free agency / trades: some veterans change NFL teams
    if (p.age >= 25 && Math.random() < (p.age >= 29 ? 0.22 : 0.14)) {
      const old = p.nfl;
      p.nfl = pick(NFL_ABBRS.filter(x => x !== old));
      if (p.teamId === L.userId) news(`${p.pos} ${fullName(p)} signed with the ${NFL[p.nfl]} (from ${old}).`, 'info', true);
    }
    p.potEst = estPot(p);
    const ch = retireChanceAt(p.pos, p.age, p.ovr);
    if (Math.random() < ch) retiring.push(p);
  });
  // thin out an oversized free agent pool
  const fas = Object.values(L.players).filter(p => !p.retired && p.teamId == null && !retiring.includes(p))
    .sort((a, b) => valueCore(a, 'balanced', 'true', 1) - valueCore(b, 'balanced', 'true', 1));
  const maxFA = N() * 6;
  if (fas.length > maxFA) fas.slice(0, fas.length - maxFA).forEach(p => retiring.push(p));
  retiring.forEach(p => retire(p));
  // rookie class
  rookieClassPositions(N() * C.ROOKIE_ROUNDS * 2).forEach(pos => newRookie(pos, L.year));
  setModes();
  setupRookieDraft();
  L.phase = 'draft';
  L.week = 0;
  news(`${L.year} offseason: players aged, ${retiring.length} retirements. The rookie draft is on!`, 'big');
}

function retire(p) {
  const career = sum(p.hist.map(h => h.pts));
  if (p.teamId === L.userId) news(`${p.pos} ${fullName(p)} has retired (age ${p.age}).`, 'bad', true);
  removeFromTeam(p);
  if (career >= 700) {
    L.retired.push({
      name: fullName(p), pos: p.pos, from: p.hist.length ? p.hist[0].year : L.year, to: L.year - 1,
      pts: Math.round(career), best: Math.round(Math.max(0, ...p.hist.map(h => h.pts))), seasons: p.hist.length,
      draft: p.draft,
    });
    if (career >= 1500) news(`Legend ${p.pos} ${fullName(p)} retires with ${Math.round(career)} career points.`);
  }
  delete L.players[p.id];
}

// ---------- trades ----------
function evalTrade(teamId, give, get) {
  const t = T(teamId), mode = t.mode;
  let gain = sum(get.map(a => assetValue(a, mode)));
  let loss = sum(give.map(a => assetValue(a, mode)));
  const inP = get.filter(a => a.kind === 'p'), outP = give.filter(a => a.kind === 'p');
  const after = t.roster.length + inP.length - outP.length;
  if (after > C.ROSTER_MAX) {
    const outIds = new Set(outP.map(a => a.id));
    const pool = t.roster.filter(id => !outIds.has(id)).map(id => playerValue(P(id), mode))
      .concat(inP.map(a => playerValue(P(a.id), mode))).sort((a, b) => a - b);
    loss += sum(pool.slice(0, after - C.ROSTER_MAX));
  }
  // positional need: incoming player who would start gets a small bump
  const lu = bestLineup(t).filter(x => x != null).map(P);
  inP.forEach(a => {
    const p = P(a.id);
    const weakest = lu.filter(x => elig(x.pos, p.pos) || (x.pos === p.pos)).sort((x, y) => proj(x) - proj(y))[0];
    if (!weakest || proj(p) > proj(weakest) + 2) gain += playerValue(p, mode) * 0.08;
  });
  return { gain, loss, net: gain - loss };
}

function tradesClosed() {
  if (L.phase === 'regular' && L.week > C.TRADE_DEADLINE) return 'The trade deadline has passed. Trading reopens in the offseason.';
  if (L.phase === 'startup') return 'Trading opens after the startup draft.';
  if (!['preseason', 'regular', 'draft'].includes(L.phase)) return 'Trades are closed right now. Trading reopens when the offseason begins.';
  return null;
}

function tradeValid(aId, bId, aGives, bGives) {
  const owns = (tid, a) => (a.kind === 'p' ? P(a.id) && P(a.id).teamId === tid : L.picks.some(k => k.id === a.id && k.ownerId === tid && !k.used));
  const closed = tradesClosed();
  if (closed) return closed;
  if (!aGives.length && !bGives.length) return 'Add something to the trade.';
  if (!aGives.every(a => owns(aId, a)) || !bGives.every(a => owns(bId, a))) return 'Some assets are no longer owned by those teams.';
  return null;
}

function aiAccepts(teamId, give, get) {
  const r = evalTrade(teamId, give, get);
  const margin = DIFF[L.settings.difficulty].margin;
  return r.gain > 0.5 && r.gain >= r.loss * (1 + margin) + 0.5;
}

// user proposes: userGives -> partner, userGets <- partner
function proposeTrade(partnerId, userGives, userGets) {
  const err = tradeValid(L.userId, partnerId, userGives, userGets);
  if (err) return { ok: false, msg: err };
  if (aiAccepts(partnerId, userGets, userGives)) {
    executeTrade(L.userId, partnerId, userGives, userGets);
    return { ok: true, msg: `${T(partnerId).name} accepted the trade!` };
  }
  const r = evalTrade(partnerId, userGets, userGives);
  const ratio = r.loss > 0 ? r.gain / r.loss : 0;
  const msg = ratio > 0.9 ? "Close — but we need a little more." : ratio > 0.7 ? "Not quite there. Sweeten it a bit." : ratio > 0.4 ? "That's well short of what we'd need." : "No chance. Come back with a real offer.";
  return { ok: false, msg: `${T(partnerId).name}: "${msg}"` };
}

// AI asks for extra assets from the user to make a deal work
function balanceTrade(partnerId, userGives, userGets) {
  const err = tradeValid(L.userId, partnerId, userGives, userGets);
  if (err) return { ok: false, msg: err };
  const t = T(partnerId), margin = DIFF[L.settings.difficulty].margin;
  const give = userGives.slice();
  const key = a => a.kind + a.id;
  for (let step = 0; step < 3; step++) {
    const r = evalTrade(partnerId, userGets, give);
    const deficit = r.loss * (1 + margin) + 0.5 - r.gain;
    if (deficit <= 0 && r.gain > 0.5) return { ok: true, give, msg: step ? `${t.name} would do it if you add the highlighted assets.` : `${t.name} would already accept this deal.` };
    const have = new Set(give.map(key));
    const cands = teamAssets(L.userId).filter(a => !have.has(key(a)))
      .map(a => ({ a, v: assetValue(a, t.mode) })).filter(x => x.v > 0.3).sort((x, y) => x.v - y.v);
    if (!cands.length) break;
    const fit = cands.find(x => x.v >= deficit * 1.02) || cands[cands.length - 1];
    give.push(fit.a);
  }
  const r = evalTrade(partnerId, userGets, give);
  if (r.gain >= r.loss * (1 + margin) + 0.5 && r.gain > 0.5) return { ok: true, give, msg: `${t.name} would do it if you add the highlighted assets.` };
  return { ok: false, msg: `${t.name} can't find a deal that works with your assets.` };
}

function executeTrade(aId, bId, aGives, bGives) {
  const move = (assets, to) => assets.forEach(a => {
    if (a.kind === 'p') addToTeam(P(a.id), to);
    else L.picks.find(k => k.id === a.id).ownerId = to;
  });
  move(aGives, bId);
  move(bGives, aId);
  [aId, bId].forEach(id => {
    const t = T(id);
    if (!t.human) { aiCutDown(t); t.lineup = bestLineup(t); }
    else if (t.autoLineup) t.lineup = bestLineup(t); else sanitizeLineup(t);
  });
  const desc = (ass) => ass.map(assetName).join(', ') || 'nothing';
  const mine = aId === L.userId || bId === L.userId;
  news(`TRADE: ${T(aId).abbr} send ${desc(aGives)} to ${T(bId).abbr} for ${desc(bGives)}.`, 'trade', mine);
  L.offers = L.offers.filter(o => !tradeValid(o.from, L.userId, o.give, o.get));
}

function aiMakeOffer() {
  const user = T(L.userId);
  const t = pick(L.teams.filter(x => !x.human));
  const mode = t.mode;
  const targets = user.roster.map(id => ({ id, v: playerValue(P(id), mode) })).filter(x => x.v > 4).sort((a, b) => b.v - a.v).slice(0, 10);
  if (!targets.length) return;
  const tgt = pick(targets);
  const budget = tgt.v * rnd(0.88, 1.0) * DIFF[L.settings.difficulty].offer;
  const assets = teamAssets(t.id).map(a => ({ a, v: assetValue(a, mode) })).filter(x => x.v < budget && x.v > 0.5).sort((x, y) => y.v - x.v);
  // pick a randomized lead asset among the bigger ones
  const pkg = [];
  let total = 0;
  const lead = assets.slice(0, 4);
  if (!lead.length) return;
  const first = pick(lead);
  pkg.push(first.a); total += first.v;
  for (const x of assets) {
    if (pkg.length >= 3) break;
    if (x === first) continue;
    if (total + x.v <= budget) { pkg.push(x.a); total += x.v; }
  }
  if (total < tgt.v * 0.6) return;
  const get = [{ kind: 'p', id: tgt.id }];
  if (evalTrade(t.id, pkg, get).net <= 0) return;
  L.offers.push({ id: nid(), from: t.id, give: pkg, get, week: L.week, year: L.year });
  news(`${t.name} sent you a trade offer for ${P(tgt.id).pos} ${fullName(P(tgt.id))}.`, 'trade', true);
}

function respondOffer(offerId, accept) {
  const o = L.offers.find(x => x.id === offerId);
  if (!o) return 'Offer no longer available.';
  L.offers = L.offers.filter(x => x.id !== offerId);
  if (!accept) return null;
  const err = tradeValid(o.from, L.userId, o.give, o.get);
  if (err) return err;
  executeTrade(o.from, L.userId, o.give, o.get);
  return null;
}

function aiAiTrade() {
  const cpus = L.teams.filter(t => !t.human);
  if (cpus.length < 2) return;
  const buyers = cpus.filter(t => t.mode === 'contend');
  const sellers = cpus.filter(t => t.mode === 'rebuild');
  const A = pick(buyers.length ? buyers : cpus);
  const B = pick((sellers.length ? sellers : cpus).filter(t => t !== A)) || pick(cpus.filter(t => t !== A));
  if (!B) return;
  const tgt = B.roster.map(P).map(p => ({ p, va: playerValue(p, A.mode), vb: playerValue(p, B.mode) }))
    .filter(x => x.va > 8).sort((x, y) => y.va / Math.max(1, y.vb) - x.va / Math.max(1, x.vb))[0];
  if (!tgt) return;
  const assets = teamAssets(A.id).map(a => ({ a, va: assetValue(a, A.mode), vb: assetValue(a, B.mode) }))
    .filter(x => x.va < tgt.va * 0.9 && x.vb > 0.5).sort((x, y) => y.vb / Math.max(0.5, y.va) - x.vb / Math.max(0.5, x.va));
  const pkg = [];
  let vb = 0;
  for (const x of assets) {
    if (pkg.length >= 3 || vb >= tgt.vb * 1.05) break;
    pkg.push(x.a); vb += x.vb;
  }
  const get = [{ kind: 'p', id: tgt.p.id }];
  if (vb < tgt.vb * 1.05) return;
  if (evalTrade(A.id, pkg, get).net > 0 && evalTrade(B.id, get, pkg).net > 0) executeTrade(A.id, B.id, pkg, get);
}

// ---------- user roster moves ----------
function signFA(playerId) {
  const p = P(playerId), u = T(L.userId);
  if (!p || p.teamId != null || p.retired) return 'Player is not available.';
  if (L.phase === 'startup' || (L.phase === 'draft' && !p.revealed)) return 'Not available during the draft.';
  if (u.roster.length >= C.ROSTER_MAX) return `Roster full (${C.ROSTER_MAX}). Release someone first.`;
  addToTeam(p, L.userId);
  if (u.autoLineup) u.lineup = bestLineup(u);
  news(`You signed ${p.pos} ${fullName(p)}.`, 'info', true);
  return null;
}
function releasePlayer(playerId) {
  const p = P(playerId);
  if (!p || p.teamId !== L.userId) return 'Not on your roster.';
  if (L.phase === 'startup') return 'Not during the startup draft.';
  removeFromTeam(p);
  const u = T(L.userId);
  if (u.autoLineup) u.lineup = bestLineup(u);
  news(`You released ${p.pos} ${fullName(p)}.`, 'info', true);
  return null;
}

// ---------- persistence ----------
function serialize() { return JSON.stringify(L); }
function load(json) {
  L = typeof json === 'string' ? JSON.parse(json) : json;
  if (L) { // migrate older saves
    if (!L.injuryLog) L.injuryLog = [];
    Object.values(L.players).forEach(p => {
      if (!p.nfl) p.nfl = pick(NFL_ABBRS);
      if (p.injury === undefined) p.injury = null;
      if (p.inj > 0 && !p.injury) p.injury = { name: 'Undisclosed injury', est: `out ~${p.inj} weeks`, short: `${p.inj}w`, season: false, carry: 0, year: L.year, week: L.week, tier: 'moderate' };
    });
  }
  return L;
}

G.Engine = {
  C, POS, SLOTS, PCFG, DIFF, MODE, NFL, INJ_RATE,
  get L() { return L; },
  newLeague, load, serialize,
  P, T, fullName, ppg, proj, seasonPts, seasonGP, playerValue, valueCore, pickValue, pickLabel, pickSlot,
  assetValue, assetName, teamAssets, bestLineup, sanitizeLineup, elig, teamPower, standingsOrder,
  freeAgents, draftPool, currentPick, makeDraftPick, draftAdvance, aiDraftChoice,
  startSeason, simWeek, startOffseason, opponentOf, lineupScore, userRosterProblem,
  evalTrade, proposeTrade, balanceTrade, respondOffer, tradeValid, tradesClosed,
  signFA, releasePlayer, nextDraftYear,
};
})(typeof window !== 'undefined' ? window : globalThis);
