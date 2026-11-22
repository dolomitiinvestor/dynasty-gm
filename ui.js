/* Dynasty GM — UI layer */
(function () {
'use strict';
const E = window.Engine;
const C = E.C;
const SAVE_KEY = 'dynastyGM_save_v1';
const $ = s => document.querySelector(s);
const UI = {
  tab: 'home',
  trade: { partner: null, give: [], get: [], msg: null, ok: false, hl: [] },
  players: { status: 'FA', pos: 'ALL', q: '', sort: 'value', dir: -1 },
  draftPos: 'ALL', league: 'standings', week: null, histDraft: null, modal: null,
};

// ---------- utils ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const L = () => E.L;
const user = () => E.T(L().userId);
const posTag = pos => `<span class="pos ${pos}">${pos}</span>`;
function gradeOf(n) {
  const g = n >= 90 ? 'A+' : n >= 84 ? 'A' : n >= 79 ? 'B+' : n >= 74 ? 'B' : n >= 69 ? 'C+' : n >= 63 ? 'C' : n >= 55 ? 'D' : 'F';
  return `<span class="grade ${g[0]}">${g}</span>`;
}
const ovrStr = p => (p.revealed ? p.ovr : `~${p.scoutOvr}`);
const potStr = p => gradeOf(p.revealed ? p.potEst : p.scoutPot);
const projStr = p => E.ppg(p.revealed ? p.ovr : p.scoutOvr, p.pos, p).toFixed(1);
const val = p => Math.round(E.playerValue(p, 'balanced', 'public'));
const teamAbbr = id => (id == null ? '<span class="muted">FA</span>' : `<a data-act="team" data-id="${id}"><span class="teamdot" style="background:${E.T(id).color}"></span>${esc(E.T(id).abbr)}</a>`);
const teamName = id => `<a data-act="team" data-id="${id}"><span class="teamdot" style="background:${E.T(id).color}"></span>${esc(E.T(id).name)}</a>`;
const pLink = p => `<a data-act="player" data-id="${p.id}">${esc(E.fullName(p))}</a>`;
const nflTag = p => (p.nfl ? ` <span class="nfl" title="${esc(E.NFL[p.nfl] || p.nfl)}${E.byeWeek(p.nfl) ? ' · bye week ' + E.byeWeek(p.nfl) : ''}">${p.nfl}</span>` : '');
const capStr = d => (!d ? '' : d.udfa ? 'UDFA' : `${d.round}.${String(d.pick).padStart(2, '0')}`);
const capTxt = d => (!d ? '' : d.udfa ? `Undrafted free agent (${d.year})` : `${d.year} NFL Draft: round ${d.round}, pick ${d.pick} (#${d.overall} overall)`);
function statusBadges(p) {
  let s = '';
  if (p.inj > 0) {
    const i = p.injury;
    s += i ? ` <span class="badge inj" title="${esc(i.name)} — ${esc(i.est)}">🚑 ${i.season ? 'IR' : 'OUT ' + esc(i.short)}</span>` : ' <span class="badge inj">OUT</span>';
  }
  if (E.onBye(p)) s += ' <span class="badge bye">BYE</span>';
  if (p.rookieYear === L().year) s += ' <span class="badge rook">R</span>';
  return s;
}
const modeBadge = m => `<span class="badge ${m}">${m === 'contend' ? 'Contending' : m === 'rebuild' ? 'Rebuilding' : 'Balanced'}</span>`;
const rec = t => `${t.w}-${t.l}${t.t ? '-' + t.t : ''}`;
const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

function toast(msg, ms = 2800) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}
function save() { try { localStorage.setItem(SAVE_KEY, E.serialize()); } catch (e) { /* storage full or blocked */ } }
function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); if (s) { E.load(s); return true; } } catch (e) { /* ignore */ } return false; }

// ---------- phase text & actions ----------
function phaseText() {
  const l = L();
  switch (l.phase) {
    case 'startup': return `${l.year} Startup Draft`;
    case 'preseason': return `${l.year} Preseason`;
    case 'regular': return `${l.year} · Week ${l.week} of ${C.REG_WEEKS}`;
    case 'playoffs': return `${l.year} Playoffs · ${l.week === C.REG_WEEKS + 1 ? 'Semifinals' : 'Championship'}`;
    case 'offseason': return `${l.year} season complete`;
    case 'draft': return `${l.year} Rookie Draft`;
  }
  return '';
}
function actionButtons() {
  const l = L();
  switch (l.phase) {
    case 'startup': case 'draft':
      return `<button class="primary" data-act="tab" data-tab="draft">Go to Draft Room →</button>`;
    case 'preseason':
      return `<button class="primary" data-act="startSeason">Start ${l.year} Season ▶</button>`;
    case 'regular':
      return `<button class="primary" data-act="sim" data-n="1">Sim Week ${l.week} ▶</button>` +
        (l.week <= C.TRADE_DEADLINE ? `<button data-act="sim" data-n="deadline">Sim to Deadline</button>` : '') +
        `<button data-act="sim" data-n="season">Sim to Playoffs ⏩</button>`;
    case 'playoffs': {
      const inIt = l.playoffs && (l.week === C.REG_WEEKS + 1 ? l.playoffs.seeds.includes(l.userId) : l.playoffs.final && l.playoffs.final.includes(l.userId));
      return `<button class="primary" data-act="sim" data-n="1">${l.week === C.REG_WEEKS + 1 ? 'Play Semifinals' : 'Play Championship'} ${inIt ? '🏈' : '▶'}</button>`;
    }
    case 'offseason':
      return `<button class="primary" data-act="offseason">Begin ${l.year + 1} Offseason →</button>`;
  }
  return '';
}

// ---------- top-level render ----------
function render() {
  if (!L()) { renderSetup(); return; }
  const l = L(), u = user();
  $('#top').innerHTML = `
    <div class="logo">🏈 Dynasty<span>GM</span></div>
    <div><b>${esc(u.name)}</b> <span class="muted">${l.phase === 'regular' || l.phase === 'playoffs' ? rec(u) : ''}</span></div>
    <div class="status">${phaseText()}</div>
    <div class="spacer"></div>
    <div class="row">${actionButtons()}</div>
    <div class="row"><button class="sm" data-act="export">Export</button><button class="sm" data-act="import">Import</button><button class="sm danger" data-act="newLeague">New League</button></div>`;
  const tabs = [['home', 'Home'], ['roster', 'Roster'], ['players', 'Players'], ['trade', 'Trade']];
  if (l.draft) tabs.push(['draft', 'Draft Room']);
  tabs.push(['league', 'League'], ['history', 'History']);
  if (UI.tab === 'draft' && !l.draft) UI.tab = 'home';
  $('#nav').style.display = '';
  $('#nav').innerHTML = tabs.map(([k, n]) => `<button class="${UI.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${n}${k === 'home' && l.offers.length ? `<span class="dot">${l.offers.length}</span>` : ''}${k === 'roster' && u.roster.length > C.ROSTER_MAX ? '<span class="dot">!</span>' : ''}</button>`).join('');
  const views = { home: viewHome, roster: viewRoster, players: viewPlayers, trade: viewTrade, draft: viewDraft, league: viewLeague, history: viewHistory };
  $('#app').innerHTML = (views[UI.tab] || viewHome)();
  if (UI.modal) renderModal();
  save();
}

// ---------- setup ----------
UI.setup = { name: 'Gridiron Dynasty', n: 10, d: 'normal', scoring: E.presetScoring('half') };
function captureSetup() {
  if ($('#s-name')) Object.assign(UI.setup, { name: $('#s-name').value, n: +$('#s-n').value, d: $('#s-d').value });
}

const SC_GROUPS = [
  ['Passing', [['passYd', 'Passing yards per point', 'ypp'], ['passTd', 'Passing TD'], ['int', 'Interception thrown'], ['passComp', 'Completion'], ['passInc', 'Incompletion'], ['b300', 'Bonus: 300+ passing yds']]],
  ['Rushing', [['rushYd', 'Rushing yards per point', 'ypp'], ['rushTd', 'Rushing TD'], ['b100r', 'Bonus: 100+ rushing yds']]],
  ['Receiving', [['rec', 'Reception (PPR)'], ['tePrem', 'TE premium (extra per TE catch)'], ['recYd', 'Receiving yards per point', 'ypp'], ['recTd', 'Receiving TD'], ['b100c', 'Bonus: 100+ receiving yds']]],
  ['Returns & misc', [['krYd', 'Kick return yards per point', 'ypp'], ['prYd', 'Punt return yards per point', 'ypp'], ['retTd', 'Kick/punt return TD'], ['fd', 'First down (rush or rec)'], ['twoPt', '2-pt conversion'], ['fumLost', 'Fumble lost']]],
];
function scoringForm(S, scope, editable) {
  const dis = editable ? '' : 'disabled';
  const preset = E.presetOf(S);
  return `<div class="row" style="margin-bottom:10px"><span class="muted">Preset</span>
    <select data-chg="scpreset" data-scope="${scope}" ${dis}>${Object.keys(E.SCORING_PRESETS).map(k => `<option value="${k}" ${preset === k ? 'selected' : ''}>${E.SCORING_PRESETS[k].label}</option>`).join('')}<option value="custom" ${preset === 'custom' ? 'selected' : ''}>Custom</option></select></div>
    <div class="sc-grid">${SC_GROUPS.map(([g, fields]) => `<div class="sc-group"><h4>${g}</h4>${fields.map(([k, label, t]) => {
      const v = S[k] || 0;
      const shown = t === 'ypp' ? (v ? +(1 / v).toFixed(2) : 0) : v;
      return `<label class="sc-f"><span>${label}</span><input type="number" step="${t === 'ypp' ? 1 : 0.5}" value="${shown}" data-chg="sc" data-k="${k}" data-t="${t || ''}" data-scope="${scope}" ${dis}></label>`;
    }).join('')}</div>`).join('')}</div>
    <p class="muted" style="font-size:12px">"Yards per point" fields: 25 = 1 point per 25 yards (0.04/yd), 10 = 1 per 10 yds. Set 0 to turn a category off.</p>`;
}
const scoringEditable = () => ['startup', 'preseason', 'offseason', 'draft'].includes(L().phase);

function renderSetup() {
  $('#top').innerHTML = `<div class="logo">🏈 Dynasty<span>GM</span></div>`;
  $('#nav').style.display = 'none';
  $('#app').innerHTML = `
  <div class="setup wide">
    <div class="hero"><h1>Dynasty<span>GM</span></h1><p class="muted">A generative fantasy football dynasty. Every player, rookie class and career is procedurally generated. Draft, trade and build a dynasty against CPU managers — season after season.</p></div>
    <div class="card">
      <h2>Start a new league</h2>
      <label>Your team name</label><input id="s-name" maxlength="28" value="${esc(UI.setup.name)}">
      <label>League size</label>
      <select id="s-n">${[8, 10, 12].map(n => `<option value="${n}" ${UI.setup.n === n ? 'selected' : ''}>${n} teams</option>`).join('')}</select>
      <label>Difficulty (how hard CPU managers bargain)</label>
      <select id="s-d">${['easy', 'normal', 'hard'].map(d => `<option value="${d}" ${UI.setup.d === d ? 'selected' : ''}>${d[0].toUpperCase() + d.slice(1)}</option>`).join('')}</select>
      <h3 style="margin-top:22px">Scoring</h3>
      ${scoringForm(UI.setup.scoring, 'setup', true)}
      <p class="muted">Lineup: QB, 2 RB, 2 WR, TE, FLEX · ${C.ROSTER_MAX}-man rosters · ${C.REG_WEEKS}-week season · top ${C.PLAYOFF_TEAMS} make playoffs · ${C.ROOKIE_ROUNDS}-round rookie drafts.</p>
      <div class="row"><button class="primary" data-act="create">Create League &amp; Start Draft</button><button data-act="import">Import Save</button></div>
    </div>
  </div>`;
}

// ---------- home ----------
function viewHome() {
  const l = L(), u = user();
  let left = '';
  const prob = E.userRosterProblem();
  left += `<div class="card"><h2>${phaseText()}</h2>${phaseBlurb()}${prob ? `<div class="msg no">${esc(prob)} <a data-act="tab" data-tab="roster">Go to roster</a></div>` : ''}
    <div class="big-action" style="margin-top:12px">${actionButtons()}</div></div>`;
  if (l.phase === 'regular' || l.phase === 'playoffs') left += matchupCard();
  if (l.phase === 'offseason' || (l.phase === 'draft' || l.phase === 'preseason') && l.history.length) left += recapCard();
  left += offersCard();
  const right = `<div class="card"><h2>Standings</h2>${standingsTable(true)}</div>
    <div class="card"><h2>News <span class="r"><label><input type="checkbox" data-chg="mynews" ${UI.myNews ? 'checked' : ''}> mine only</label></span></h2>${newsList()}</div>`;
  return `<div class="grid g3"><div class="grid">${left}</div><div class="grid">${right}</div></div>`;
}

function phaseBlurb() {
  const l = L(), u = user();
  switch (l.phase) {
    case 'startup': return `<p>Build your roster from scratch in a ${C.STARTUP_ROUNDS}-round snake draft. Head to the Draft Room.</p>`;
    case 'preseason': return `<p>Roster: <b>${u.roster.length}/${C.ROSTER_MAX}</b>. Sign free agents, make trades, and set your lineup — then kick off the season.</p>`;
    case 'regular': return `<p>${l.week <= C.TRADE_DEADLINE ? `Trade deadline after week ${C.TRADE_DEADLINE}.` : 'The trade deadline has passed.'} Top ${C.PLAYOFF_TEAMS} make the playoffs. ${u.autoLineup ? 'Auto-lineup is <b>on</b>.' : 'Auto-lineup is <b>off</b> — check your lineup each week.'}</p>`;
    case 'playoffs': return `<p>Single elimination. ${l.playoffs.seeds.includes(l.userId) ? `You're the #${l.playoffs.seeds.indexOf(l.userId) + 1} seed.` : 'You missed the playoffs — watch and plan for next year.'}</p>`;
    case 'offseason': return `<p>The season is over. Advancing will age every player (young players develop, veterans decline), process retirements, and generate a new rookie class for the draft.</p>`;
    case 'draft': return `<p>The ${l.year} rookie draft is underway. Rookie ratings are <b>scouting estimates</b> (~) — true ratings are revealed after the draft. Boom or bust awaits.</p>`;
  }
  return '';
}

function matchupCard() {
  const l = L(), u = user();
  const w = l.week;
  const opp = E.opponentOf(l.userId, w);
  let last = '';
  if (w > 1 && l.results[w - 2]) {
    const g = l.results[w - 2].find(g => g.a === l.userId || g.b === l.userId);
    if (g) {
      const mine = g.a === l.userId ? g.sa : g.sb, th = g.a === l.userId ? g.sb : g.sa, o = g.a === l.userId ? g.b : g.a;
      last = `<p class="muted">Last week: <b style="color:${mine > th ? 'var(--accent)' : 'var(--bad)'}">${mine > th ? 'W' : mine < th ? 'L' : 'T'}</b> ${mine.toFixed(1)}–${th.toFixed(1)} vs ${teamName(o)} · <a data-act="replay" data-w="${w - 1}">▶ Replay</a></p>`;
    }
  }
  if (opp == null) return `<div class="card"><h2>This week</h2><p class="muted">No game this week.</p>${last}</div>`;
  const ot = E.T(opp);
  const luOf = t => (t.human && !t.autoLineup ? t.lineup : E.bestLineup(t));
  const projOf = t => luOf(t).reduce((s, id) => s + (id != null ? E.proj(E.P(id)) : 0), 0);
  const la = luOf(u), lb = luOf(ot);
  const h2h = E.SLOTS.map((s, i) => {
    const pa = la[i] != null ? E.P(la[i]) : null, pb = lb[i] != null ? E.P(lb[i]) : null;
    const ja = pa ? E.proj(pa) : 0, jb = pb ? E.proj(pb) : 0;
    return `<div class="h2h-row"><div class="l">${pa ? pLink(pa) + nflTag(pa) + statusBadges(pa) : '<span class="muted">empty</span>'}</div>
      <div class="pj ${ja > jb ? 'edge' : ''}">${ja.toFixed(1)}</div><div style="text-align:center">${posTag(s)}</div>
      <div class="pj ${jb > ja ? 'edge' : ''}">${jb.toFixed(1)}</div><div class="r">${pb ? pLink(pb) + nflTag(pb) + statusBadges(pb) : '<span class="muted">empty</span>'}</div></div>`;
  }).join('');
  const empties = u.lineup.filter(id => id == null).length;
  const injStarters = u.lineup.filter(id => id != null && E.P(id).inj > 0).length;
  const byeStarters = u.lineup.filter(id => id != null && E.onBye(E.P(id))).length;
  const byes = Object.keys(E.NFL).filter(a => E.byeWeek(a) === w);
  const myByes = u.roster.map(E.P).filter(p => E.onBye(p));
  return `<div class="card"><h2>${l.phase === 'playoffs' ? 'Playoff matchup' : `Week ${w} matchup`}</h2>
    <div class="matchup">
      <div><div>${teamName(u.id)}</div><div class="muted">${rec(u)}</div><div class="score">${projOf(u).toFixed(1)}</div><div class="muted">projected</div></div>
      <div class="vs">vs</div>
      <div><div>${teamName(ot.id)}</div><div class="muted">${rec(ot)} ${modeBadge(ot.mode)}</div><div class="score">${projOf(ot).toFixed(1)}</div><div class="muted">projected</div></div>
    </div>
    <div class="h2h">${h2h}</div>
    <div class="row" style="margin-top:10px;align-items:center"><button class="${!u.autoLineup && (empties || injStarters || byeStarters) ? 'blue' : ''}" data-act="autoSub">🔄 Auto-sub hurt &amp; bye players</button>
      <span class="muted" style="font-size:12px">${byes.length ? `NFL byes this week: ${byes.join(', ')}` : 'No NFL byes this week.'}${myByes.length ? ` · yours: ${myByes.map(p => esc(p.last)).join(', ')}` : ''}</span></div>
    ${!u.autoLineup && (empties || injStarters || byeStarters) ? `<div class="msg no">⚠ Your lineup has ${[empties ? empties + ' empty slot(s)' : '', injStarters ? injStarters + ' injured starter(s)' : '', byeStarters ? byeStarters + ' starter(s) on bye' : ''].filter(Boolean).join(', ')}. Hit Auto-sub or <a data-act="tab" data-tab="roster">fix your lineup</a>.</div>` : ''}
    ${last}</div>`;
}

function recapCard() {
  const l = L();
  const h = l.history[l.history.length - 1];
  if (!h) return '';
  return `<div class="card"><h2>🏆 ${h.year} Season Recap</h2>
    <p>Champion: <b>${teamName(h.champ)}</b> · Runner-up: ${teamName(h.runnerUp)}</p>
    <p>Your finish: <b>${ord(h.user.finish)}</b> (${h.user.w}-${h.user.l}${h.user.t ? '-' + h.user.t : ''}, ${h.user.pf.toFixed(1)} PF)</p>
    ${h.mvp ? `<p>MVP: ${posTag(h.mvp.pos)} ${E.P(h.mvp.id) ? pLink(E.P(h.mvp.id)) : esc(h.mvp.name)} (${h.mvp.team}) — ${h.mvp.pts} pts</p>` : ''}
    ${h.roty ? `<p>Rookie of the Year: ${posTag(h.roty.pos)} ${E.P(h.roty.id) ? pLink(E.P(h.roty.id)) : esc(h.roty.name)} (${h.roty.team}) — ${h.roty.pts} pts</p>` : ''}
    </div>`;
}

function offersCard() {
  const l = L();
  if (!l.offers.length) return '';
  return `<div class="card"><h2>📨 Trade offers <span class="r">offers expire after a week</span></h2>${l.offers.map(o => {
    const t = E.T(o.from);
    const vGet = o.give.reduce((s, a) => s + E.assetValue(a, 'balanced', 'public'), 0);
    const vGive = o.get.reduce((s, a) => s + E.assetValue(a, 'balanced', 'public'), 0);
    const room = user().roster.length + o.give.filter(a => a.kind === 'p').length - o.get.filter(a => a.kind === 'p').length;
    return `<div class="offer"><div>${teamName(t.id)} ${modeBadge(t.mode)} proposes:</div>
      <div class="cols"><div><div class="muted">You receive (${Math.round(vGet)})</div>${o.give.map(assetLine).join('')}</div>
      <div><div class="muted">You give (${Math.round(vGive)})</div>${o.get.map(assetLine).join('')}</div></div>
      ${room > C.ROSTER_MAX ? `<div class="muted" style="margin-bottom:6px">⚠ Accepting puts you at ${room}/${C.ROSTER_MAX} — you'll need to release players.</div>` : ''}
      <div class="row"><button class="primary sm" data-act="offerYes" data-id="${o.id}">Accept</button><button class="sm" data-act="offerNo" data-id="${o.id}">Decline</button><button class="sm" data-act="offerCounter" data-id="${o.id}">Open in Trade tab</button></div></div>`;
  }).join('')}</div>`;
}

function assetLine(a) {
  if (a.kind === 'p') { const p = E.P(a.id); return `<div>${posTag(p.pos)} ${pLink(p)}${nflTag(p)}${statusBadges(p)} <span class="muted">${p.age}y · ${ovrStr(p)} ovr</span> <span class="muted">· ${val(p)}</span></div>`; }
  const k = L().picks.find(x => x.id === a.id);
  return `<div><span class="pos" style="background:#94a3b8">PK</span> ${esc(E.pickLabel(k))} <span class="muted">· ${Math.round(E.pickValue(k))}</span></div>`;
}

function newsList() {
  const items = L().news.filter(n => !UI.myNews || n.mine).slice(0, 80);
  if (!items.length) return '<p class="muted">Nothing yet.</p>';
  return `<ul class="news">${items.map(n => `<li class="${n.type}"><span class="when">${n.year}${n.phase === 'regular' ? ' W' + n.week : n.phase === 'playoffs' ? ' PO' : n.phase === 'draft' || n.phase === 'startup' ? ' Draft' : ''}</span>${esc(n.text)}</li>`).join('')}</ul>`;
}

function standingsTable(compact) {
  const l = L();
  const ids = E.standingsOrder();
  const inSeason = l.phase === 'regular' || l.phase === 'playoffs' || l.phase === 'offseason';
  return `<div class="tbl-wrap"><table><thead><tr><th>#</th><th>Team</th>${inSeason ? '<th class="num">W-L</th><th class="num">PF</th><th class="num">PA</th>' : ''}${compact ? '' : '<th class="num">Power</th><th>Mode</th><th class="num">Titles</th>'}</tr></thead><tbody>
    ${ids.map((id, i) => { const t = E.T(id); return `<tr class="${t.human ? 'me' : ''}"><td>${i + 1}${inSeason && i === C.PLAYOFF_TEAMS - 1 ? '' : ''}</td><td>${teamName(id)}</td>${inSeason ? `<td class="num">${rec(t)}</td><td class="num">${t.pf.toFixed(1)}</td><td class="num">${t.pa.toFixed(1)}</td>` : ''}${compact ? '' : `<td class="num">${E.teamPower(t).toFixed(1)}</td><td>${t.human ? '<span class="badge">You</span>' : modeBadge(t.mode)}</td><td class="num">${t.titles ? '🏆'.repeat(Math.min(t.titles, 5)) + (t.titles > 5 ? t.titles : '') : ''}</td>`}</tr>${inSeason && i === C.PLAYOFF_TEAMS - 1 ? '<tr><td colspan="9" style="padding:0;border-bottom:2px dashed var(--line)"></td></tr>' : ''}`; }).join('')}
  </tbody></table></div>`;
}

// ---------- roster ----------
function viewRoster() {
  const l = L(), u = user();
  E.sanitizeLineup(u);
  const starters = new Set(u.lineup.filter(x => x != null));
  const roster = u.roster.map(E.P).sort((a, b) => E.POS.indexOf(a.pos) - E.POS.indexOf(b.pos) || E.proj(b) - E.proj(a));
  const lastWk = l.phase === 'regular' ? l.week - 1 : l.phase === 'playoffs' ? l.week - 1 : 0;
  const slots = E.SLOTS.map((s, i) => {
    const opts = roster.filter(p => E.elig(p.pos, s));
    const cur = u.lineup[i];
    const cp = cur != null ? E.P(cur) : null;
    return `<div class="lineup-slot">${posTag(s)}
      <select data-chg="slot" data-i="${i}"><option value="">— empty —</option>${opts.map(p => `<option value="${p.id}" ${p.id === cur ? 'selected' : ''}>${esc(E.fullName(p))} (${p.pos}${p.inj ? ', OUT' : E.onBye(p) ? ', BYE' : ''})${starters.has(p.id) && p.id !== cur ? ' *' : ''}</option>`).join('')}</select>
      <span class="num muted">${cp ? E.proj(cp).toFixed(1) + ' proj' : ''}</span>
      <span class="num">${cp && lastWk > 0 && cp.wk[lastWk - 1] != null ? cp.wk[lastWk - 1].toFixed(1) : ''}</span></div>`;
  }).join('');
  const picks = l.picks.filter(k => k.ownerId === u.id && !k.used).sort((a, b) => a.year - b.year || a.round - b.round);
  const over = u.roster.length > C.ROSTER_MAX;
  return `<div class="grid g3">
    <div class="card"><h2>Roster <span class="r" style="${over ? 'color:var(--bad)' : ''}">${u.roster.length}/${C.ROSTER_MAX}</span></h2>
      ${over ? `<div class="msg no" style="margin-bottom:10px">Over the roster limit — release ${u.roster.length - C.ROSTER_MAX} player(s) before you can continue.</div>` : ''}
      ${playerTable(roster, { starters, mine: true })}</div>
    <div class="grid">
      <div class="card"><h2>Lineup <span class="r"><label><input type="checkbox" data-chg="auto" ${u.autoLineup ? 'checked' : ''}> auto-set each week</label></span></h2>
        ${slots}<div class="row" style="margin-top:10px"><button class="sm" data-act="autoNow">Optimize now</button><button class="sm" data-act="autoSub">🔄 Auto-sub hurt/bye</button><span class="muted">Projected: <b>${u.lineup.reduce((s, id) => s + (id != null ? E.proj(E.P(id)) : 0), 0).toFixed(1)}</b></span></div></div>
      <div class="card"><h2>Draft picks <span class="r">${picks.length}</span></h2>
        ${picks.length ? picks.map(k => `<div class="asset" style="cursor:default"><span class="pos" style="background:#94a3b8">PK</span>${esc(E.pickLabel(k))}<span class="v">${Math.round(E.pickValue(k))}</span></div>`).join('') : '<p class="muted">No picks — you traded them all!</p>'}
      </div>
    </div></div>`;
}

function playerTable(list, opts = {}) {
  const l = L();
  const showTeam = opts.showTeam;
  const sortable = opts.sortable;
  const th = (k, label, num = true) => sortable ? `<th class="sort ${num ? 'num' : ''}" data-act="sort" data-k="${k}">${label}${UI.players.sort === k ? (UI.players.dir < 0 ? ' ▼' : ' ▲') : ''}</th>` : `<th class="${num ? 'num' : ''}">${label}</th>`;
  const inSeason = l.phase === 'regular' || l.phase === 'playoffs' || l.phase === 'offseason';
  return `<div class="tbl-wrap"><table><thead><tr><th>Pos</th><th>Player</th>${showTeam ? '<th>Team</th>' : ''}${th('age', 'Age')}${th('ovr', 'OVR')}${th('pot', 'POT')}${th('proj', 'Proj')}${inSeason ? th('pts', 'Pts') : ''}${th('value', 'Value')}<th></th></tr></thead><tbody>
    ${list.map(p => `<tr class="${opts.starters && opts.starters.has(p.id) ? 'sel' : ''}"><td>${posTag(p.pos)}</td><td>${pLink(p)}${nflTag(p)}${statusBadges(p)}</td>${showTeam ? `<td>${teamAbbr(p.teamId)}</td>` : ''}
      <td class="num">${p.age}</td><td class="num">${ovrStr(p)}</td><td class="num">${potStr(p)}</td><td class="num">${projStr(p)}</td>${inSeason ? `<td class="num">${E.seasonPts(p).toFixed(1)}</td>` : ''}<td class="num">${val(p)}</td>
      <td>${actionFor(p)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function actionFor(p) {
  const l = L();
  if (p.teamId === l.userId) return l.phase === 'startup' ? '' : `<button class="sm danger" data-act="release" data-id="${p.id}">Release</button>`;
  if (p.teamId == null) return l.phase === 'startup' || (l.phase === 'draft' && !p.revealed) ? '' : `<button class="sm" data-act="sign" data-id="${p.id}">Sign</button>`;
  return `<button class="sm" data-act="tradeFor" data-id="${p.id}">Trade</button>`;
}

// ---------- players ----------
function viewPlayers() {
  const f = UI.players, l = L();
  let list = Object.values(l.players).filter(p => !p.retired);
  if (l.draft) list = list.filter(p => p.revealed || p.teamId != null);
  if (f.status === 'FA') list = list.filter(p => p.teamId == null);
  else if (f.status === 'ROSTERED') list = list.filter(p => p.teamId != null);
  else if (f.status === 'ROOKIES') list = list.filter(p => p.rookieYear === l.year);
  if (f.pos !== 'ALL') list = list.filter(p => p.pos === f.pos);
  if (f.q) { const q = f.q.toLowerCase(); list = list.filter(p => E.fullName(p).toLowerCase().includes(q) || p.college.toLowerCase().includes(q)); }
  const key = { age: p => p.age, ovr: p => (p.revealed ? p.ovr : p.scoutOvr), pot: p => (p.revealed ? p.potEst : p.scoutPot), proj: p => E.proj(p), pts: p => E.seasonPts(p), value: p => E.playerValue(p, 'balanced', 'public') }[f.sort];
  list.sort((a, b) => (key(a) - key(b)) * f.dir);
  const total = list.length;
  list = list.slice(0, 150);
  return `<div class="card"><h2>Players <span class="r">${total} shown${total > 150 ? ' (top 150)' : ''}</span></h2>
    <div class="row" style="margin-bottom:12px">
      <select data-chg="pstatus">${[['FA', 'Free agents'], ['ALL', 'All players'], ['ROSTERED', 'Rostered'], ['ROOKIES', `${l.year} rookies`]].map(([k, n]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <select data-chg="ppos">${['ALL', ...E.POS].map(k => `<option ${f.pos === k ? 'selected' : ''}>${k}</option>`).join('')}</select>
      <input data-chg="pq" placeholder="Search name or college" value="${esc(f.q)}">
      <span class="muted">Your roster: ${user().roster.length}/${C.ROSTER_MAX}</span>
    </div>
    ${playerTable(list, { showTeam: true, sortable: true })}</div>`;
}

// ---------- trade ----------
function viewTrade() {
  const l = L(), tr = UI.trade, u = user();
  const cpus = l.teams.filter(t => !t.human);
  if (tr.partner == null || !cpus.some(t => t.id === tr.partner)) tr.partner = cpus[0].id;
  const pt = E.T(tr.partner);
  const closedMsg = E.tradesClosed();
  const has = (list, a) => list.some(x => x.kind === a.kind && x.id === a.id);
  const assetRow = (a, side) => {
    const on = has(side === 'give' ? tr.give : tr.get, a);
    const hl = side === 'give' && has(tr.hl, a);
    if (a.kind === 'p') {
      const p = E.P(a.id);
      return `<div class="asset ${on ? 'on' : ''} ${hl ? 'hl' : ''}" data-act="tsel" data-side="${side}" data-kind="p" data-id="${p.id}"><input type="checkbox" ${on ? 'checked' : ''} tabindex="-1">${posTag(p.pos)}<span>${esc(E.fullName(p))}${nflTag(p)}${statusBadges(p)} <span class="muted">${p.age}y · ${p.ovr}</span></span><span class="v">${val(p)}</span></div>`;
    }
    const k = l.picks.find(x => x.id === a.id);
    return `<div class="asset ${on ? 'on' : ''} ${hl ? 'hl' : ''}" data-act="tsel" data-side="${side}" data-kind="k" data-id="${k.id}"><input type="checkbox" ${on ? 'checked' : ''} tabindex="-1"><span class="pos" style="background:#94a3b8">PK</span><span>${esc(E.pickLabel(k))}</span><span class="v">${Math.round(E.pickValue(k))}</span></div>`;
  };
  const sortAssets = list => list.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'p' ? -1 : 1) || E.assetValue(b, 'balanced', 'public') - E.assetValue(a, 'balanced', 'public'));
  const mine = sortAssets(E.teamAssets(u.id));
  const theirs = sortAssets(E.teamAssets(pt.id));
  const vGive = tr.give.reduce((s, a) => s + E.assetValue(a, 'balanced', 'public'), 0);
  const vGet = tr.get.reduce((s, a) => s + E.assetValue(a, 'balanced', 'public'), 0);
  const tot = Math.max(1, vGive + vGet);
  return `<div class="card"><h2>Trade Center <span class="r">Deadline: after week ${C.TRADE_DEADLINE}</span></h2>
    <div class="row" style="margin-bottom:12px">Trade with
      <select data-chg="partner">${cpus.map(t => `<option value="${t.id}" ${t.id === pt.id ? 'selected' : ''}>${esc(t.name)} (${t.abbr})</option>`).join('')}</select>
      ${modeBadge(pt.mode)} <span class="muted">${pt.mode === 'contend' ? 'Wants proven producers now; discounts picks and prospects.' : pt.mode === 'rebuild' ? 'Wants youth and draft picks; will sell aging vets.' : 'Values present and future evenly.'}</span>
    </div>
    ${closedMsg ? `<div class="msg no">${esc(closedMsg)}</div>` : ''}
    <div class="trade-cols">
      <div><h3>You give <span class="muted">(${Math.round(vGive)})</span></h3><div style="max-height:460px;overflow-y:auto">${mine.map(a => assetRow(a, 'give')).join('')}</div></div>
      <div><h3>You get from ${esc(pt.abbr)} <span class="muted">(${Math.round(vGet)})</span></h3><div style="max-height:460px;overflow-y:auto">${theirs.map(a => assetRow(a, 'get')).join('')}</div></div>
    </div>
    <div style="margin-top:14px">
      <div class="row muted" style="justify-content:space-between"><span>Give ${Math.round(vGive)}</span><span>Market value (neutral)</span><span>Get ${Math.round(vGet)}</span></div>
      <div class="bar"><div style="width:${(vGive / tot) * 100}%;background:var(--bad);float:left"></div><div style="width:${(vGet / tot) * 100}%;background:var(--accent);float:left"></div></div>
      <p class="muted" style="font-size:12px">Values shown are a neutral market estimate. Each CPU manager values players differently based on their team's mode, age curves and roster needs — and they see true potential, while you see scouting estimates.</p>
    </div>
    <div class="row"><button class="primary" data-act="propose" ${closedMsg ? 'disabled' : ''}>Propose Trade</button><button class="blue" data-act="balance" ${closedMsg ? 'disabled' : ''}>What would it take?</button><button data-act="tclear">Clear</button></div>
    ${tr.msg ? `<div class="msg ${tr.ok ? 'ok' : 'no'}">${esc(tr.msg)}</div>` : ''}
  </div>`;
}

// ---------- draft ----------
function viewDraft() {
  const l = L(), d = l.draft;
  if (!d) return '<div class="card">No draft in progress.</div>';
  const dp = E.currentPick();
  const myTurn = dp && dp.teamId === l.userId;
  let pool = E.draftPool();
  if (UI.draftPos !== 'ALL') pool = pool.filter(p => p.pos === UI.draftPos);
  const pv = p => E.valueCore(p, 'balanced', 'public', 1);
  pool.sort((a, b) => pv(b) - pv(a));
  pool = pool.slice(0, 120);
  const u = user();
  const counts = E.POS.map(pos => `${posTag(pos)} ${u.roster.filter(id => E.P(id).pos === pos).length}`).join(' ');
  const recent = d.picks.slice(Math.max(0, d.cur - 12), d.cur).reverse();
  const upcoming = d.picks.slice(d.cur, d.cur + 12);
  const myNext = d.picks.slice(d.cur).filter(x => x.teamId === l.userId).length;
  const pickNo = x => `${x.round}.${String(x.no).padStart(2, '0')}`;
  return `<div class="grid g3">
    <div class="card"><h2>${d.type === 'startup' ? `${d.year} Startup Draft` : `${d.year} Rookie Draft`} <span class="r">Pick ${d.cur + 1} of ${d.picks.length}</span></h2>
      ${myTurn ? `<div class="onclock">🟢 You're on the clock — Round ${dp.round}, pick ${pickNo(dp)}</div>` : `<div class="msg">On the clock: ${teamName(dp.teamId)} (${pickNo(dp)}) · You have ${myNext} pick${myNext === 1 ? '' : 's'} left</div>`}
      <div class="row" style="margin:12px 0">
        ${myTurn ? `<button class="blue" data-act="autopick">Auto-pick for me</button>` : `<button class="primary" data-act="simToMe" ${myNext ? '' : 'disabled'}>Sim to my pick ▶</button>`}
        <button data-act="simDraft">Sim rest of draft (auto-pick for me) ⏩</button>
        <select data-chg="dpos">${['ALL', ...E.POS].map(k => `<option ${UI.draftPos === k ? 'selected' : ''}>${k}</option>`).join('')}</select>
        <span class="muted">My roster: ${counts}</span>
      </div>
      ${d.type === 'rookie' ? '<p class="muted" style="font-size:12px">OVR and POT for rookies are scouting estimates. True ratings are revealed when the draft ends. <b>NFL pick</b> is real draft capital: NFL teams scout better than you, and early picks get a bigger role in their first seasons.</p>' : ''}
      <div class="tbl-wrap"><table><thead><tr><th>Pos</th><th>Player</th><th class="num">Age</th><th>College</th>${d.type === 'rookie' ? '<th class="num" title="NFL draft round.pick">NFL pick</th>' : ''}<th class="num">OVR</th><th class="num">POT</th><th class="num">Proj</th><th class="num">Value</th><th></th></tr></thead><tbody>
        ${pool.map(p => `<tr><td>${posTag(p.pos)}</td><td>${pLink(p)}${nflTag(p)}</td><td class="num">${p.age}</td><td class="muted">${esc(p.college)}</td>${d.type === 'rookie' ? `<td class="num" title="${esc(capTxt(p.nflDraft))}">${capStr(p.nflDraft)} <span class="muted">${p.nflDraft ? p.nfl : ''}</span></td>` : ''}<td class="num">${ovrStr(p)}</td><td class="num">${potStr(p)}</td><td class="num">${projStr(p)}</td><td class="num">${Math.round(pv(p))}</td>
          <td>${myTurn ? `<button class="sm primary" data-act="draftP" data-id="${p.id}">Draft</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>
    </div>
    <div class="grid">
      <div class="card"><h2>Up next</h2>${upcoming.map(x => `<div class="${x.teamId === l.userId ? 'onclock' : ''}" style="padding:4px 6px;margin-bottom:2px">${pickNo(x)} ${teamName(x.teamId)}${x.origId != null && x.origId !== x.teamId ? ` <span class="muted">(via ${E.T(x.origId).abbr})</span>` : ''}</div>`).join('') || '<p class="muted">—</p>'}</div>
      <div class="card"><h2>Recent picks</h2>${recent.map(x => { const p = E.P(x.playerId); return `<div style="padding:4px 0;border-bottom:1px solid var(--line)">${pickNo(x)} ${teamAbbr(x.teamId)} — ${p ? posTag(p.pos) + ' ' + pLink(p) : '?'}</div>`; }).join('') || '<p class="muted">No picks yet.</p>'}</div>
      <div class="card"><h2>Trade during the draft</h2><p class="muted">You can trade players and picks (including current-draft picks) in the Trade tab while the draft is paused.</p><button data-act="tab" data-tab="trade">Open Trade Center</button></div>
    </div></div>`;
}

// ---------- league ----------
function viewLeague() {
  const l = L();
  const subs = [['standings', 'Standings'], ['schedule', 'Schedule & Results'], ['playoffs', 'Playoffs'], ['leaders', 'Leaders'], ['records', '🏅 Records'], ['nfl', '🏈 NFL'], ['teams', 'Teams'], ['scoring', 'Scoring']];
  let body = '';
  if (UI.league === 'standings') body = `<div class="card"><h2>Standings</h2>${standingsTable(false)}</div>`;
  else if (UI.league === 'schedule') body = scheduleView();
  else if (UI.league === 'playoffs') body = playoffsView();
  else if (UI.league === 'leaders') body = leadersView();
  else if (UI.league === 'records') body = recordsView();
  else if (UI.league === 'nfl') body = nflView();
  else if (UI.league === 'scoring') body = `<div class="card"><h2>Scoring settings <span class="r">${esc((E.SCORING_PRESETS[E.presetOf(l.settings.scoring)] || { label: 'Custom' }).label)}</span></h2>${scoringEditable() ? '<p class="muted">Changes apply to all future games. Projections and trade values update immediately.</p>' : '<div class="msg" style="margin-bottom:10px">🔒 Scoring is locked during the season. You can change it in the offseason or preseason.</div>'}${scoringForm(l.settings.scoring, 'league', scoringEditable())}</div>`;
  else body = `<div class="grid g2">${l.teams.map(t => `<div class="card"><h2>${teamName(t.id)} ${t.human ? '<span class="badge">You</span>' : modeBadge(t.mode)}<span class="r">${t.titles ? '🏆×' + t.titles : ''}</span></h2>
      <p class="muted">Power ${E.teamPower(t).toFixed(1)} · Roster ${t.roster.length} · Picks ${l.picks.filter(k => k.ownerId === t.id && !k.used).length}</p>
      ${E.bestLineup(t).map(id => id != null ? `<div>${posTag(E.P(id).pos)} ${pLink(E.P(id))} <span class="muted">${E.P(id).age}y · ${E.P(id).ovr}</span></div>` : '').join('')}</div>`).join('')}</div>`;
  return `<div class="subtabs">${subs.map(([k, n]) => `<button class="${UI.league === k ? 'on' : ''}" data-act="lsub" data-k="${k}">${n}</button>`).join('')}</div>${body}`;
}

function scheduleView() {
  const l = L();
  if (!l.schedule.length) return '<div class="card"><p class="muted">The schedule is created when the season starts.</p></div>';
  if (UI.week == null) UI.week = Math.min(Math.max(1, l.phase === 'regular' ? l.week : C.REG_WEEKS), C.REG_WEEKS);
  const w = UI.week;
  const res = l.results[w - 1];
  const games = l.schedule[w - 1].map(([a, b], i) => {
    const r = res && res[i];
    const line = (id, s, win) => `<div class="t ${win ? 'w' : ''}"><span>${teamName(id)} <span class="muted">${rec(E.T(id))}</span></span><span>${s != null ? s.toFixed(1) : ''}</span></div>`;
    return `<div class="bgame">${line(a, r ? r.sa : null, r && r.sa > r.sb)}${line(b, r ? r.sb : null, r && r.sb > r.sa)}${r && r.la ? `<div style="text-align:right;font-size:12px"><a data-act="box" data-w="${w}" data-i="${i}">Box score</a> · <a data-act="box" data-w="${w}" data-i="${i}" data-anim="1">▶ Watch</a></div>` : ''}</div>`;
  }).join('');
  return `<div class="card"><h2>Week ${w}</h2><div class="row" style="margin-bottom:10px">${Array.from({ length: C.REG_WEEKS }, (_, i) => `<button class="sm ${i + 1 === w ? 'blue' : ''}" data-act="wk" data-w="${i + 1}">${i + 1}</button>`).join('')}</div><div class="grid g2">${games}</div></div>`;
}

function playoffsView() {
  const l = L(), pl = l.playoffs;
  if (!pl) return `<div class="card"><p class="muted">Playoffs begin after week ${C.REG_WEEKS}. Top ${C.PLAYOFF_TEAMS} teams qualify.</p></div>`;
  const g = (a, b, r, w, i) => `<div class="bgame"><div class="t ${r && r.sa > r.sb ? 'w' : ''}"><span>#${pl.seeds.indexOf(a) + 1} ${teamName(a)}</span><span>${r ? r.sa.toFixed(1) : ''}</span></div><div class="t ${r && r.sb > r.sa ? 'w' : ''}"><span>#${pl.seeds.indexOf(b) + 1} ${teamName(b)}</span><span>${r ? r.sb.toFixed(1) : ''}</span></div>${r && r.la ? `<div style="text-align:right;font-size:12px"><a data-act="box" data-w="${w}" data-i="${i}">Box score</a> · <a data-act="box" data-w="${w}" data-i="${i}" data-anim="1">▶ Watch</a></div>` : ''}</div>`;
  return `<div class="card"><h2>${l.year} Playoffs</h2><div class="bracket">
    <div><h3>Semifinals</h3>${pl.semis.map((s, i) => g(s[0], s[1], pl.semiRes && pl.semiRes[i], C.REG_WEEKS + 1, i)).join('')}</div>
    <div><h3>Championship</h3>${pl.final ? g(pl.final[0], pl.final[1], pl.finalRes, C.REG_WEEKS + 2, 0) : '<p class="muted">TBD</p>'}${pl.champ != null ? `<p style="font-size:18px">🏆 <b>${teamName(pl.champ)}</b></p>` : ''}</div>
  </div></div>`;
}

function leadersView() {
  const l = L();
  const all = Object.values(l.players).filter(p => !p.retired);
  const hasPts = all.some(p => E.seasonGP(p) > 0);
  const metric = hasPts ? E.seasonPts : p => E.playerValue(p, 'balanced', 'public');
  return `<div class="grid g2">${E.POS.map(pos => {
    const top = all.filter(p => p.pos === pos && (p.revealed || p.teamId != null)).sort((a, b) => metric(b) - metric(a)).slice(0, 10);
    return `<div class="card"><h2>${posTag(pos)} ${hasPts ? 'Fantasy points' : 'Top value'}</h2><table><tbody>${top.map((p, i) => `<tr><td>${i + 1}</td><td>${pLink(p)}${nflTag(p)}${statusBadges(p)}</td><td>${teamAbbr(p.teamId)}</td><td class="num">${hasPts ? E.seasonPts(p).toFixed(1) : Math.round(metric(p))}</td></tr>`).join('')}</tbody></table></div>`;
  }).join('')}</div>`;
}

// ---------- NFL ----------
function nflView() {
  const l = L(), N = l.nfl;
  if (!N) return '<div class="card"><p class="muted">No NFL season yet.</p></div>';
  const st = N.st;
  const r = a => `${st[a].w}-${st[a].l}${st[a].t ? '-' + st[a].t : ''}`;
  const mine = new Set(user().roster.map(id => E.P(id).nfl));
  const tm = a => `<span class="nfl ${mine.has(a) ? 'mine' : ''}" title="${esc(E.NFL[a])}">${a}</span>`;
  const seedOf = a => { if (!N.po) return ''; const s = N.po.seeds[E.CONF_OF(a)].indexOf(a); return s >= 0 ? ` <span class="muted">(${s + 1})</span>` : ''; };
  const maxW = N.week || 0;
  if (UI.nflWk == null || UI.nflWk > E.NFL_WEEKS) UI.nflWk = Math.max(1, Math.min(E.NFL_WEEKS, l.phase === 'regular' || l.phase === 'playoffs' ? l.week : maxW || 1));
  const w = UI.nflWk, res = N.res[w - 1];
  const games = (N.sched[w - 1] || []).map(([h, a], i) => {
    const g = res && res[i];
    const cell = (x, s, win) => `<div class="t ${win ? 'w' : ''}"><span>${tm(x)} <span class="muted">${esc(E.NFL[x])}</span></span><span>${s != null ? s : ''}</span></div>`;
    return `<div class="bgame">${cell(a, g && g.as, g && g.as > g.hs)}${cell(h, g && g.hs, g && g.hs > g.as)}<div class="muted" style="font-size:11px;text-align:right">@ ${h}</div></div>`;
  }).join('');
  const byes = Object.keys(N.bye).filter(a => N.bye[a] === w);
  const divs = E.DIV_NAMES.map(d => `<div class="card nfl-div"><h4>${d}</h4><table><thead><tr><th>Team</th><th class="num">W-L</th><th class="num">Div</th><th class="num">PF</th><th class="num">PA</th><th class="num">Bye</th></tr></thead><tbody>
    ${E.nflSortDiv(E.NFL_DIVS[d].slice()).map(a => `<tr class="${mine.has(a) ? 'me' : ''}"><td>${tm(a)}${seedOf(a)}</td><td class="num">${r(a)}</td><td class="num muted">${st[a].dw}-${st[a].dl}</td><td class="num">${st[a].pf}</td><td class="num">${st[a].pa}</td><td class="num muted">${N.bye[a]}</td></tr>`).join('')}</tbody></table></div>`).join('');
  let po = '';
  if (N.po) {
    po = `<div class="card"><h2>${N.year} NFL Playoffs</h2><div class="nfl-po">${N.po.rounds.map((games, ri) => `<div><h4>${E.NFL_ROUNDS[ri]}</h4>${games.map(g => `<div class="bgame"><div class="t ${g.win === g.a ? 'w' : ''}"><span>${tm(g.a)}${seedOf(g.a)}</span><span>${g.as}</span></div><div class="t ${g.win === g.h ? 'w' : ''}"><span>${tm(g.h)}${seedOf(g.h)}</span><span>${g.hs}</span></div></div>`).join('')}</div>`).join('')}</div>
      <p style="font-size:16px">🏆 <b>${esc(E.NFL[N.po.champ])}</b> win the Super Bowl</p></div>`;
  }
  const nextYr = N.po ? N.year + 1 : N.year;
  const order = (l.nflOrders || {})[nextYr];
  const drafted = Object.values(l.players).filter(p => p.nflDraft && !p.nflDraft.udfa && p.nflDraft.year === nextYr).sort((a, b) => a.nflDraft.overall - b.nflDraft.overall);
  const draftCard = order ? `<div class="card"><h2>${nextYr} NFL Draft order</h2>${drafted.length ? '' : '<p class="muted">Set by final standings and playoff results. The NFL Draft runs when you advance to the offseason, before your rookie draft.</p>'}
    <div class="nfl-order">${order.map((a, i) => `<div>${i + 1}. ${tm(a)} <span class="muted">${r(a) && N.year === nextYr - 1 ? r(a) : ''}</span></div>`).join('')}</div>
    ${drafted.length ? `<h3>Skill-position picks</h3><div class="tbl-wrap" style="max-height:360px;overflow-y:auto"><table><tbody>${drafted.map(p => `<tr><td class="num">${capStr(p.nflDraft)}</td><td class="num muted">#${p.nflDraft.overall}</td><td>${tm(p.nflDraft.team)}</td><td>${posTag(p.pos)} ${pLink(p)}</td><td class="muted">${esc(p.college)}</td></tr>`).join('')}</tbody></table></div>` : ''}</div>` : '';
  return `<div class="card"><h2>${N.year} NFL season <span class="r muted" style="font-size:13px">through week ${maxW} of ${E.NFL_WEEKS}</span></h2>
      <p class="muted" style="font-size:12px">The real NFL plays alongside your league: same weeks, real divisions, a 17-game schedule and bye weeks (5–14). Teams with healthy stars win more, and final standings set the NFL Draft order. Highlighted teams employ your players.</p>
      <div class="row" style="margin-bottom:10px">${Array.from({ length: E.NFL_WEEKS }, (_, i) => `<button class="sm ${i + 1 === w ? 'blue' : ''}" data-act="nflWk" data-w="${i + 1}">${i + 1}</button>`).join('')}</div>
      <div class="grid g4">${games}</div>
      <p class="muted" style="margin-top:8px">Bye: ${byes.length ? byes.map(tm).join(' ') : 'none'}</p></div>
    ${po}${draftCard}
    <div class="grid g4">${divs}</div>`;
}

// ---------- record book ----------
const wkLabel = w => (w <= C.REG_WEEKS ? `Wk ${w}` : w === C.REG_WEEKS + 1 ? 'Semis' : 'Final');
const recWhen = e => (e.week ? `${wkLabel(e.week)}, ${e.year}` : `${e.year}`);
const recVal = (c, e) => (c.unit ? `${e.v} ${c.unit}` : (+e.v).toFixed(1));
const recPlayer = e => { const p = E.P(e.pid); return `${posTag(e.pos)} ${p ? pLink(p) : esc(e.name)}`; };
const recTeam = id => (id != null && E.T(id) ? teamAbbr(id) : '<span class="muted">FA</span>');

// one-line description of who/what for an entry
function recWho(c, e) {
  if (c.grp === 'player') return `${recPlayer(e)} <span class="muted">· ${recTeam(e.t)}</span>`;
  if (c.k === 'sPF' || c.k === 'sWins') return recTeam(e.t);
  if (c.grp === 'season') return `${recPlayer(e)} <span class="muted">· ${recTeam(e.t)}</span>`;
  if (c.k === 'combined') return `${recTeam(e.t)} <span class="muted">vs</span> ${recTeam(e.o)}`;
  return recTeam(e.t);
}
function recDetail(c, e) {
  if (c.k === 'streak') {
    const T = E.T(e.t), live = T.streak === e.v && T.streakFrom && T.streakFrom.year === e.from.year && T.streakFrom.week === e.from.week;
    return `${wkLabel(e.from.week)}, ${e.from.year} → ${recWhen(e)}${live ? ' <span class="badge hot">active</span>' : ''}`;
  }
  if (c.k === 'sPF') return `${e.w}-${e.l}${e.ties ? '-' + e.ties : ''} · ${e.year}`;
  if (c.k === 'sWins') return `${e.w}-${e.l}${e.ties ? '-' + e.ties : ''} · ${e.pf.toFixed(1)} PF · ${e.year}`;
  if (c.grp === 'season') return `${e.gp} games · ${e.year}`;
  if (c.grp === 'player') return `${esc(e.line || '')}${c.unit ? ` · ${e.pts.toFixed(1)} pts` : ''} · vs ${e.o != null ? esc(E.T(e.o).abbr) : '?'} · ${recWhen(e)}`;
  if (c.k === 'combined' || c.k === 'blowout' || c.k === 'closeLoss') return `${e.s.toFixed(1)}–${e.os.toFixed(1)}${c.k !== 'combined' ? ` vs ${esc(E.T(e.o).abbr)}` : ''} · ${recWhen(e)}`;
  return `vs ${esc(E.T(e.o).abbr)} (${e.os.toFixed(1)}) · ${recWhen(e)}`;
}

function recordsView() {
  const l = L();
  const scope = UI.recScope || 'season';
  const n = UI.recN || 5;
  const book = E.recordBook(scope);
  const yr = l.rec && l.rec.year;
  const groups = [['team', 'Team · single game'], ['player', 'Player · single game (fantasy starters)'], ['season', 'Season']];
  const toggle = `<div class="row" style="margin-bottom:12px;align-items:center">
    <button class="sm ${scope === 'season' ? 'blue' : ''}" data-act="recScope" data-k="season">${yr ? yr + ' season' : 'This season'}</button>
    <button class="sm ${scope === 'all' ? 'blue' : ''}" data-act="recScope" data-k="all">All-time</button>
    <span class="spacer"></span>
    <button class="sm" data-act="recN">${n === 5 ? 'Show top 10' : 'Show top 5'}</button></div>`;
  if (!E.REC_CATS.some(c => (book[c.k] || []).length)) return `<div class="card"><h2>🏅 Record book</h2>${toggle}<p class="muted">No games played yet. Records start filling in after week 1.</p></div>`;
  return `<div class="card"><h2>🏅 Record book <span class="r muted" style="font-size:13px">${scope === 'all' ? 'League history · ★ = set this season' : 'Most recent season'}</span></h2>${toggle}</div>` +
    groups.map(([g, title]) => `<h3 class="rec-group">${title}</h3><div class="grid g3 rec-grid">${E.REC_CATS.filter(c => c.grp === g).map(c => {
      const list = (book[c.k] || []).slice(0, n);
      return `<div class="card rec-card"><h4>${c.pos ? posTag(c.pos) + ' ' : ''}${esc(c.label)}</h4>${list.length ? `<table class="rec"><tbody>${list.map((e, i) => {
        const mine = e.t === l.userId || (c.k === 'combined' && e.o === l.userId);
        const fresh = scope === 'all' && e.year === yr && l.history.length;
        return `<tr class="${mine ? 'me' : ''}"><td class="rk">${i === 0 ? '👑' : i + 1}</td><td><div>${recWho(c, e)}${fresh ? ' <span class="star">★</span>' : ''}</div><div class="muted sm-txt">${recDetail(c, e)}</div></td><td class="num rv">${recVal(c, e)}</td></tr>`;
      }).join('')}</tbody></table>` : '<p class="muted">—</p>'}</div>`;
    }).join('')}</div>`).join('');
}

// records set in one game, for the end-of-game screen
function recordsReport(A, B, week) {
  const l = L();
  const yr = A.yr || l.year;
  const all = E.recordBook('all'), ssn = l.rec && l.rec.year === yr ? E.recordBook('season') : {};
  const match = e => e && e.year === yr && e.week === week && (e.t === A.id || e.t === B.id);
  const hits = [];
  E.REC_CATS.filter(c => c.grp !== 'season').forEach(c => {
    const top = (all[c.k] || [])[0], st = (ssn[c.k] || [])[0];
    if (l.history.length && match(top)) hits.push([1, c, top]);
    else if (week >= 3 && match(st)) hits.push([0, c, st]);
  });
  if (!hits.length) return '';
  hits.sort((a, b) => b[0] - a[0] || (b[2].t === l.userId) - (a[2].t === l.userId));
  return `<div class="gd-rec"><div class="gd-rec-h">📜 Record book</div>${hits.slice(0, 6).map(([lg, c, e]) => `<div class="gd-rec-row ${e.t === l.userId ? 'mine' : ''}">
    <span><span class="rbadge ${lg ? 'lg' : ''}">${lg ? 'LEAGUE RECORD' : 'SEASON BEST'}</span> ${esc(c.label)}</span>
    <span>${recWho(c, e)} — <b>${recVal(c, e)}</b></span></div>`).join('')}</div>`;
}

// ---------- history ----------
function viewHistory() {
  const l = L(), u = user();
  const champs = l.history.slice().reverse();
  const legends = l.retired.slice().sort((a, b) => b.pts - a.pts).slice(0, 25);
  const draftKeys = Object.keys(l.draftHistory).sort().reverse();
  if (UI.histDraft == null || !l.draftHistory[UI.histDraft]) UI.histDraft = draftKeys[0] || null;
  const dh = UI.histDraft ? l.draftHistory[UI.histDraft] : null;
  return `<div class="grid g2">
    <div class="card"><h2>Champions</h2>${champs.length ? `<div class="tbl-wrap"><table><thead><tr><th>Year</th><th>Champion</th><th>Runner-up</th><th>MVP</th><th>ROTY</th><th>You</th></tr></thead><tbody>
      ${champs.map(h => `<tr class="${h.champ === l.userId ? 'hl' : ''}"><td>${h.year}</td><td>🏆 ${teamAbbr(h.champ)}</td><td>${teamAbbr(h.runnerUp)}</td><td>${h.mvp ? posTag(h.mvp.pos) + ' ' + esc(h.mvp.name) : ''}</td><td>${h.roty ? posTag(h.roty.pos) + ' ' + esc(h.roty.name) : ''}</td><td>${ord(h.user.finish)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">No completed seasons yet.</p>'}</div>
    <div class="card"><h2>${esc(u.name)} — franchise history <span class="r">${u.titles ? '🏆×' + u.titles : ''}</span></h2>${u.hist.length ? `<table><thead><tr><th>Year</th><th class="num">Record</th><th class="num">PF</th><th class="num">Finish</th></tr></thead><tbody>
      ${u.hist.slice().reverse().map(h => `<tr><td>${h.year}</td><td class="num">${h.w}-${h.l}${h.t ? '-' + h.t : ''}</td><td class="num">${h.pf.toFixed(1)}</td><td class="num">${h.finish === 1 ? '🏆 ' : ''}${ord(h.finish)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Play a season to build your legacy.</p>'}</div>
    <div class="card"><h2>Draft history</h2>${dh ? `<select data-chg="hdraft">${draftKeys.map(k => `<option ${k === UI.histDraft ? 'selected' : ''} value="${k}">${k.replace('-startup', ' Startup')}</option>`).join('')}</select>
      <div class="tbl-wrap" style="max-height:420px;overflow-y:auto;margin-top:8px"><table><tbody>${dh.map(x => { const p = E.P(x.playerId); return `<tr class="${x.teamId === l.userId ? 'me' : ''}"><td>${x.round}.${String(x.no).padStart(2, '0')}</td><td>${teamAbbr(x.teamId)}</td><td>${p ? posTag(p.pos) + ' ' + pLink(p) + ` <span class="muted">${p.ovr} ovr</span>` : '<span class="muted">retired</span>'}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">No drafts yet.</p>'}</div>
    <div class="card"><h2>Legends (retired)</h2>${legends.length ? `<table><thead><tr><th>Player</th><th>Years</th><th class="num">Seasons</th><th class="num">Best</th><th class="num">Career pts</th></tr></thead><tbody>${legends.map(r => `<tr><td>${posTag(r.pos)} ${esc(r.name)}</td><td>${r.from}–${r.to}</td><td class="num">${r.seasons}</td><td class="num">${r.best}</td><td class="num">${r.pts}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No notable retirements yet.</p>'}</div>
  </div>`;
}

// ---------- modals ----------
function openModal(m) { UI.modal = m; renderModal(); }
function closeModal() { UI.modal = null; $('#modal').classList.add('hidden'); }
function renderModal() {
  const m = UI.modal;
  if (!m) return;
  let html = '';
  if (m.type === 'player') {
    const p = E.P(m.id);
    if (!p) { closeModal(); return; }
    html = playerCard(p);
  } else if (m.type === 'team') html = teamCard(E.T(m.id));
  $('#modal-box').innerHTML = `<button class="sm x" data-act="close">✕</button>${html}`;
  $('#modal').classList.remove('hidden');
}

function playerCard(p) {
  const l = L();
  const colors = { QB: 'var(--qb)', RB: 'var(--rb)', WR: 'var(--wr)', TE: 'var(--te)' };
  const wk = p.wk || [];
  const maxW = Math.max(10, ...wk.filter(x => x != null));
  const draftTxt = p.draft ? `${p.draft.year} draft, pick ${p.draft.round}.${String(p.draft.no).padStart(2, '0')} by ${E.T(p.draft.teamId).abbr}` : p.rookieYear === l.year && !p.revealed ? `${l.year} draft prospect` : 'Undrafted / original pool';
  const career = p.hist.reduce((s, h) => s + h.pts, 0);
  const traits = [];
  if (p.pos === 'QB' && p.mob != null) traits.push(p.mob > 0.6 ? 'Dual-threat QB' : p.mob < 0.2 ? 'Pocket passer' : '');
  if (p.pos === 'RB' && p.recv != null) traits.push(p.recv > 0.7 ? 'Pass-catching back' : p.recv < 0.25 ? 'Early-down grinder' : '');
  if (p.ret) traits.push('Kick/punt returner');
  return `<div class="pcard-head"><div class="face">${faceSVG(p)}</div>
    <div><div style="font-size:22px;font-weight:800">${posTag(p.pos)} <span class="muted">#${p.num != null ? p.num : '—'}</span> ${esc(E.fullName(p))}${statusBadges(p)}</div>
    <div class="muted">${p.nfl ? `<b style="color:var(--text)">${esc(E.NFL[p.nfl] || p.nfl)}</b> · ` : ''}Fantasy: ${p.teamId != null ? teamName(p.teamId) : 'Free agent'}</div>
    <div class="muted">Age ${p.age} · 🏠 ${esc(p.hometown || 'Unknown')} · 🎓 ${esc(p.college)} · ${draftTxt}</div>
    ${p.nflDraft ? `<div class="muted">🏈 ${capTxt(p.nflDraft)}${p.nflDraft.team ? ` by the ${esc(E.NFL[p.nflDraft.team] || p.nflDraft.team)}` : ''}${E.byeWeek(p.nfl) ? ` · bye week ${E.byeWeek(p.nfl)}` : ''}</div>` : ''}
    ${traits.filter(Boolean).length ? `<div style="margin-top:4px">${traits.filter(Boolean).map(t => `<span class="badge">${t}</span>`).join(' ')}</div>` : ''}</div></div>
    ${p.inj > 0 && p.injury ? `<div class="msg no">🚑 <b>${esc(p.injury.name)}</b> (week ${p.injury.week}) — ${esc(p.injury.est)}${p.injury.season ? '. Placed on injured reserve.' : ''}${p.injury.carry ? ' Serious injury: may lose some ability next season.' : ''}</div>` : ''}
    <div class="stats">
      <div class="stat"><div class="k">Overall</div><div class="v">${ovrStr(p)}</div></div>
      <div class="stat"><div class="k">Potential</div><div class="v">${potStr(p)}</div></div>
      <div class="stat"><div class="k">Proj PPG</div><div class="v">${projStr(p)}</div></div>
      <div class="stat"><div class="k">Value</div><div class="v">${val(p)}</div></div>
      <div class="stat"><div class="k">${statYear()} pts</div><div class="v">${E.seasonPts(p).toFixed(1)}</div></div>
      <div class="stat"><div class="k">Career pts</div><div class="v">${Math.round(career)}</div></div>
    </div>
    ${wk.length ? `<div class="muted">${l.year} weekly scoring</div><div class="spark">${wk.map((x, i) => `<div class="${x == null ? 'out' : ''}" title="Wk ${i + 1}: ${x == null ? (E.byeWeek(p.nfl) === i + 1 ? 'BYE' : 'OUT') : x}" style="height:${x == null ? 100 : Math.max(2, (x / maxW) * 100)}%"></div>`).join('')}</div>` : ''}
    ${gameLog(p)}
    ${careerTable(p)}
    <div class="row" style="margin-top:14px">${actionFor(p)}${p.teamId != null && p.teamId !== l.userId ? `<button class="sm" data-act="team" data-id="${p.teamId}">View team</button>` : ''}</div>`;
}

// position-specific stat columns: [label, stat key or formatter]
const STAT_COLS = {
  QB: [['Cmp/Att', st => `${st.pc || 0}/${st.pa || 0}`], ['Pass Yds', 'py'], ['Pass TD', 'ptd'], ['INT', 'int'], ['Rush Yds', 'ry'], ['Rush TD', 'rtd']],
  RB: [['Car', 'ra'], ['Rush Yds', 'ry'], ['Rush TD', 'rtd'], ['Rec', 'rec'], ['Rec Yds', 'rcy'], ['Rec TD', 'rctd']],
  WR: [['Tgt', 'tg'], ['Rec', 'rec'], ['Rec Yds', 'rcy'], ['Rec TD', 'rctd'], ['Rush Yds', 'ry']],
  TE: [['Tgt', 'tg'], ['Rec', 'rec'], ['Rec Yds', 'rcy'], ['Rec TD', 'rctd']],
};
// weekly stats on players belong to last season once the new league year has started
const statYear = () => (['draft', 'preseason'].includes(L().phase) ? L().year - 1 : L().year);
const statCell = (st, c) => (typeof c[1] === 'function' ? c[1](st) : (st[c[1]] || 0));

function gameLog(p) {
  const l = L();
  const wk = p.wk || [];
  if (!wk.length) return '';
  const cols = STAT_COLS[p.pos];
  return `<h3>${statYear()} game log</h3><div class="tbl-wrap" style="max-height:300px;overflow-y:auto"><table><thead><tr><th>Wk</th><th>Box score</th>${cols.map(c => `<th class="num">${c[0]}</th>`).join('')}<th class="num">Pts</th></tr></thead><tbody>
    ${wk.map((x, i) => { const st = p.st && p.st[i]; const hurt = p.injury && p.injury.year === l.year && p.injury.week === i + 1;
      return x == null ? `<tr><td>${i + 1}</td><td class="muted" colspan="${cols.length + 1}">${E.byeWeek(p.nfl) === i + 1 ? 'Bye week' : 'Out (injured)'}</td><td class="num">—</td></tr>`
        : `<tr><td>${i + 1}</td><td class="muted">${st ? esc(E.statLine(st, p.pos)) : ''}${hurt ? ' 🚑' : ''}</td>${cols.map(c => `<td class="num">${st ? statCell(st, c) : ''}</td>`).join('')}<td class="num"><b>${x.toFixed(1)}</b></td></tr>`; }).join('')}
  </tbody></table></div>`;
}

function careerTable(p) {
  const l = L();
  const cols = STAT_COLS[p.pos];
  const rows = p.hist.slice().reverse();
  const gpNow = E.seasonGP(p);
  const live = gpNow && (l.phase === 'regular' || l.phase === 'playoffs') && !p.hist.some(h => h.year === l.year);
  if (live) rows.unshift({ year: l.year + '*', team: p.teamId != null ? E.T(p.teamId).abbr : 'FA', age: p.age, ovr: p.ovr, gp: gpNow, pts: E.seasonPts(p), st: E.sumStats(p.st || []) });
  if (!rows.length) return '<h3>Career</h3><p class="muted">No games played yet.</p>';
  const tot = E.sumStats(rows.map(r => r.st).filter(Boolean));
  const totPts = rows.reduce((a, r) => a + r.pts, 0), totGp = rows.reduce((a, r) => a + r.gp, 0);
  return `<h3>Career</h3><div class="tbl-wrap"><table><thead><tr><th>Year</th><th>Team</th><th class="num">Age</th><th class="num">OVR</th><th class="num">GP</th>${cols.map(c => `<th class="num">${c[0]}</th>`).join('')}<th class="num">Pts</th><th class="num">PPG</th></tr></thead><tbody>
    ${rows.map(h => `<tr><td>${h.year}</td><td>${esc(h.team)}</td><td class="num">${h.age}</td><td class="num">${h.ovr}</td><td class="num">${h.gp}</td>${cols.map(c => `<td class="num">${h.st ? statCell(h.st, c) : '—'}</td>`).join('')}<td class="num">${h.pts.toFixed(1)}</td><td class="num">${h.gp ? (h.pts / h.gp).toFixed(1) : '—'}</td></tr>`).join('')}
    ${rows.length > 1 ? `<tr style="font-weight:700"><td>Total</td><td></td><td></td><td></td><td class="num">${totGp}</td>${cols.map(c => `<td class="num">${statCell(tot, c)}</td>`).join('')}<td class="num">${totPts.toFixed(1)}</td><td class="num">${totGp ? (totPts / totGp).toFixed(1) : '—'}</td></tr>` : ''}
  </tbody></table></div>${live ? '<p class="muted" style="font-size:12px">* season in progress</p>' : ''}`;
}

// ---------- stick-figure faces (deterministic per player) ----------
function seeded(seed) {
  let x = (seed >>> 0) || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}
function faceSVG(p) {
  const r = seeded((p.face != null ? p.face : p.id * 7919) + 1);
  const pk = a => a[Math.floor(r() * a.length)];
  const skin = pk(['#fbe0c6', '#f1c27d', '#e0ac69', '#c68642', '#a0662f', '#8d5524', '#5c3a1e']);
  const hc = pk(['#141414', '#2b1a0f', '#4a2c17', '#7a4a21', '#b8860b', '#e0c27a', '#8b3a1a', '#6b6b6b']);
  const hair = pk(['none', 'short', 'flat', 'afro', 'mohawk', 'curly', 'long', 'buzz', 'dreads']);
  const eyes = pk(['dot', 'wide', 'sleepy', 'angry', 'happy']);
  const mouth = pk(['smile', 'grin', 'flat', 'smirk', 'o', 'frown']);
  const facial = pk(['none', 'none', 'none', 'beard', 'goatee', 'stache', 'stubble']);
  const eyeBlack = r() < 0.35, headband = r() < 0.15, armUp = r() < 0.3;
  const pc = { QB: '#f472b6', RB: '#34d399', WR: '#60a5fa', TE: '#fbbf24' }[p.pos];
  const ink = '#0b1220', limb = '#e6ecf7';
  let back = '', top = '';
  if (hair === 'afro') back = `<circle cx="60" cy="40" r="38" fill="${hc}"/>`;
  if (hair === 'long') back = `<path d="M26,52 Q24,12 60,12 Q96,12 94,52 L96,84 L84,84 L84,44 Q60,30 36,44 L36,84 L24,84Z" fill="${hc}"/>`;
  if (hair === 'dreads') back = Array.from({ length: 8 }, (_, i) => `<line x1="${32 + i * 8}" y1="22" x2="${28 + i * 9}" y2="${74 + (i % 3) * 5}" stroke="${hc}" stroke-width="6" stroke-linecap="round"/>`).join('');
  if (hair === 'short' || hair === 'buzz' || hair === 'dreads') top = `<path d="M30,46 Q30,16 60,16 Q90,16 90,46 Q84,30 60,29 Q36,30 30,46Z" fill="${hc}" ${hair === 'buzz' ? 'opacity=".45"' : ''}/>`;
  if (hair === 'flat') top = `<rect x="31" y="10" width="58" height="24" rx="5" fill="${hc}"/>`;
  if (hair === 'mohawk') top = `<rect x="54" y="4" width="12" height="28" rx="5" fill="${hc}"/>`;
  if (hair === 'curly') top = Array.from({ length: 7 }, (_, i) => `<circle cx="${34 + i * 8.7}" cy="${22 + Math.abs(i - 3) * 3}" r="7.5" fill="${hc}"/>`).join('');
  const E1 = 48, E2 = 72, EY = 48;
  const lid = (x, d) => `<path d="M${x - 5},${EY + (d > 0 ? 0 : 2)} Q${x},${EY + d} ${x + 5},${EY + (d > 0 ? 0 : 2)}" stroke="${ink}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  const eyeSvg = {
    dot: `<circle cx="${E1}" cy="${EY}" r="3.2" fill="${ink}"/><circle cx="${E2}" cy="${EY}" r="3.2" fill="${ink}"/>`,
    wide: [E1, E2].map(x => `<circle cx="${x}" cy="${EY}" r="6" fill="#fff" stroke="${ink}" stroke-width="1.5"/><circle cx="${x + 1}" cy="${EY}" r="2.6" fill="${ink}"/>`).join(''),
    sleepy: lid(E1, 4) + lid(E2, 4),
    angry: `<circle cx="${E1}" cy="${EY + 1}" r="3" fill="${ink}"/><circle cx="${E2}" cy="${EY + 1}" r="3" fill="${ink}"/><line x1="${E1 - 7}" y1="${EY - 9}" x2="${E1 + 5}" y2="${EY - 5}" stroke="${ink}" stroke-width="3" stroke-linecap="round"/><line x1="${E2 + 7}" y1="${EY - 9}" x2="${E2 - 5}" y2="${EY - 5}" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`,
    happy: lid(E1, -5) + lid(E2, -5),
  }[eyes];
  const mouthSvg = {
    smile: `<path d="M48,64 Q60,74 72,64" stroke="${ink}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`,
    grin: `<path d="M46,63 Q60,78 74,63 Z" fill="#fff" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round"/><line x1="47" y1="64.5" x2="73" y2="64.5" stroke="${ink}" stroke-width="1"/>`,
    flat: `<line x1="50" y1="67" x2="70" y2="67" stroke="${ink}" stroke-width="2.8" stroke-linecap="round"/>`,
    smirk: `<path d="M50,67 Q62,70 72,61" stroke="${ink}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`,
    o: `<ellipse cx="60" cy="67" rx="4.5" ry="5.5" fill="${ink}"/>`,
    frown: `<path d="M48,70 Q60,61 72,70" stroke="${ink}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`,
  }[mouth];
  const jaw = 'M31,52 Q34,90 60,90 Q86,90 89,52 Q84,76 60,77 Q36,76 31,52Z';
  const facialSvg = {
    none: '',
    beard: `<path d="${jaw}" fill="${hc}"/>`,
    goatee: `<path d="M53,73 Q60,84 67,73 Z" fill="${hc}"/>`,
    stache: `<path d="M48,60 Q60,54 72,60 Q60,63 48,60Z" fill="${hc}"/>`,
    stubble: `<path d="${jaw}" fill="${hc}" opacity=".28"/>`,
  }[facial];
  return `<svg viewBox="0 0 120 170" width="96" height="136" role="img" aria-label="Placeholder portrait of ${esc(E.fullName(p))}">
    ${back}
    <g stroke="${limb}" stroke-width="4.5" stroke-linecap="round" fill="none">
      <line x1="60" y1="80" x2="60" y2="134"/>
      <line x1="60" y1="98" x2="34" y2="${armUp ? 76 : 122}"/><line x1="60" y1="98" x2="86" y2="122"/>
      <line x1="60" y1="134" x2="44" y2="166"/><line x1="60" y1="134" x2="76" y2="166"/>
    </g>
    <rect x="47" y="92" width="26" height="30" rx="5" fill="${pc}"/>
    <text x="60" y="113" text-anchor="middle" font-size="14" font-weight="800" fill="${ink}" font-family="system-ui,sans-serif">${p.num != null ? p.num : ''}</text>
    <circle cx="30" cy="50" r="5.5" fill="${skin}" stroke="${ink}" stroke-width="1.5"/><circle cx="90" cy="50" r="5.5" fill="${skin}" stroke="${ink}" stroke-width="1.5"/>
    <circle cx="60" cy="48" r="31" fill="${skin}" stroke="${ink}" stroke-width="2"/>
    ${facialSvg}${top}
    ${headband ? `<rect x="29" y="30" width="62" height="6" rx="2" fill="${pc}"/>` : ''}
    ${eyeSvg}
    ${eyeBlack ? `<rect x="${E1 - 6}" y="${EY + 6}" width="12" height="4" rx="1" fill="${ink}"/><rect x="${E2 - 6}" y="${EY + 6}" width="12" height="4" rx="1" fill="${ink}"/>` : ''}
    <path d="M60,52 Q56,60 61,60" stroke="${ink}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    ${mouthSvg}
  </svg>`;
}

function teamCard(t) {
  const l = L();
  const roster = t.roster.map(E.P).sort((a, b) => E.POS.indexOf(a.pos) - E.POS.indexOf(b.pos) || E.proj(b) - E.proj(a));
  const lu = new Set(E.bestLineup(t).filter(x => x != null));
  const picks = l.picks.filter(k => k.ownerId === t.id && !k.used).sort((a, b) => a.year - b.year || a.round - b.round);
  return `<h2 style="margin-top:0"><span class="teamdot" style="background:${t.color}"></span>${esc(t.name)} ${t.human ? '<span class="badge">You</span>' : modeBadge(t.mode)}</h2>
    <p class="muted">${rec(t)} · PF ${t.pf.toFixed(1)} · Power ${E.teamPower(t).toFixed(1)} · Titles ${t.titles}</p>
    ${playerTable(roster, { starters: lu })}
    <h3>Picks</h3><p>${picks.map(k => esc(E.pickLabel(k))).join(' · ') || '<span class="muted">None</span>'}</p>
    ${t.hist.length ? `<h3>History</h3><p class="muted">${t.hist.slice().reverse().map(h => `${h.year}: ${h.w}-${h.l} (${h.finish === 1 ? '🏆' : ord(h.finish)})`).join(' · ')}</p>` : ''}
    ${!t.human ? `<button class="blue" data-act="tradeWith" data-id="${t.id}">Trade with ${esc(t.abbr)}</button>` : ''}`;
}

// ---------- game day (slot machine) ----------
const GD = { token: 0, skip: false, wake: null, timers: [] };
const gdSleep = ms => new Promise(r => {
  if (GD.skip) return r();
  const t = setTimeout(r, ms);
  GD.wake = () => { clearTimeout(t); r(); };
});
const gdTitle = w => (w === C.REG_WEEKS + 1 ? 'Playoff Semifinal' : w === C.REG_WEEKS + 2 ? 'Championship Game' : `Week ${w}`);

function showGameDay(res, week, animate = true) {
  const l = L();
  if (!res || !res.la) { toast('No box score saved for that game.'); return; }
  const flip = res.b === l.userId;
  const A = flip ? { id: res.b, lu: res.lb, s: res.sb, yr: res.year } : { id: res.a, lu: res.la, s: res.sa, yr: res.year };
  const B = flip ? { id: res.a, lu: res.la, s: res.sa } : { id: res.b, lu: res.lb, s: res.sb };
  const name = e => { if (!e) return '<span class="muted">— empty —</span>'; const p = E.P(e[0]); return p ? esc(E.fullName(p)) : '<span class="muted">(retired)</span>'; };
  const sub = e => { if (!e) return ''; const p = E.P(e[0]); return `<small>${p ? p.pos + ' · ' + (p.nfl || '') + ' · ' : ''}proj ${e[2] != null ? e[2].toFixed(1) : '—'}</small>`; };
  const rows = E.SLOTS.map((s, i) => `<div class="gd-row" id="gdr-${i}">
      <div class="gd-p l" id="gpa-${i}">${name(A.lu[i])}${sub(A.lu[i])}</div>
      <div class="reelwrap" id="rwa-${i}"><div class="reel" id="ra-${i}"><span class="num">?</span></div></div>
      <div class="gd-slot">${posTag(s)}</div>
      <div class="reelwrap" id="rwb-${i}"><div class="reel" id="rb-${i}"><span class="num">?</span></div></div>
      <div class="gd-p" id="gpb-${i}">${name(B.lu[i])}${sub(B.lu[i])}</div></div>`).join('');
  const box = $('#gameday');
  box.innerHTML = `<div class="gd-box">
    <div class="gd-title">${l.year} · ${gdTitle(week)}</div>
    <div class="gd-head">
      <div><div class="gd-team">${esc(E.T(A.id).name)}</div><div class="gd-total" id="gta">0.0</div></div>
      <div class="gd-vs">VS</div>
      <div><div class="gd-team">${esc(E.T(B.id).name)}</div><div class="gd-total" id="gtb">0.0</div></div>
    </div>
    ${rows}
    <div id="gd-end"></div>
    <div class="gd-btns" id="gd-btns">${animate ? '<button data-act="gdSkip">Skip ⏩</button>' : ''}<button class="primary" data-act="gdClose">${animate ? 'Close' : 'Close'}</button></div>
  </div>`;
  box.classList.remove('hidden');
  box.scrollTop = 0;
  GD.skip = !animate;
  const token = ++GD.token;
  runGameDay(A, B, week, token, animate);
}

function setTotal(el, from, to, ms) {
  if (ms <= 0 || GD.skip) { el.textContent = to.toFixed(1); return; }
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = (from + (to - from) * (1 - Math.pow(1 - k, 3))).toFixed(1);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function sparks(wrap, color, n = 14) {
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'spark-p';
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4, dist = 40 + Math.random() * 40;
    s.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    s.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
    s.style.background = color;
    wrap.appendChild(s);
    setTimeout(() => s.remove(), 800);
  }
}

function confetti(n = 120) {
  const cols = ['#22c55e', '#fbbf24', '#3b82f6', '#ec4899', '#f97316', '#a855f7', '#fff'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = cols[i % cols.length];
    c.style.animationDuration = 2 + Math.random() * 2.5 + 's';
    c.style.animationDelay = Math.random() * 0.8 + 's';
    c.style.borderRadius = Math.random() < 0.3 ? '50%' : '2px';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 5500);
  }
}

function spinReel(el) {
  el.className = 'reel spinning';
  const num = el.querySelector('.num');
  const iv = setInterval(() => { num.textContent = (Math.random() * 35).toFixed(1); }, 55);
  GD.timers.push(iv);
  return iv;
}

// reveal one player's score on a reel; returns points
function landReel(el, wrap, entry, quiet) {
  const num = el.querySelector('.num');
  el.className = 'reel land';
  if (!entry) { num.textContent = '—'; el.classList.add('out'); return 0; }
  const [, pts, pj] = entry;
  if (pts == null) { num.textContent = entry[4] ? 'BYE' : 'OUT'; el.classList.add('out'); return 0; }
  num.textContent = pts.toFixed(1);
  const proj = pj || 5;
  if (pts >= Math.max(20, proj * 1.6)) {
    el.classList.add('jackpot');
    wrap.insertAdjacentHTML('beforeend', '<span class="tag">💥</span><span class="jp">JACKPOT</span>');
    if (!quiet) { sparks(wrap, '#fde047', 18); const gd = $('#gameday'); gd.classList.remove('shake'); void gd.offsetWidth; gd.classList.add('shake'); }
  } else if (pts >= proj * 1.2) {
    el.classList.add('hot');
    wrap.insertAdjacentHTML('beforeend', '<span class="tag">🔥</span>');
    if (!quiet) sparks(wrap, '#4ade80', 10);
  } else if (pts < proj * 0.5 && !entry[3]) {
    el.classList.add('cold');
    wrap.insertAdjacentHTML('beforeend', '<span class="tag">🥶</span>');
  }
  if (entry[3]) { // injured during this game
    el.classList.add('hurt');
    wrap.insertAdjacentHTML('beforeend', '<span class="tag hurt-tag">🚑</span><span class="jp hurt-lbl">INJURED</span>');
    if (!quiet) { const gd = $('#gameday'); gd.classList.remove('shake'); void gd.offsetWidth; gd.classList.add('shake'); }
  }
  return pts;
}

function showStatLine(sel, entry, week) {
  if (!entry) return;
  const p = E.P(entry[0]);
  const sm = document.querySelector(sel + ' small');
  if (!p || !sm || !p.st || p.st[week - 1] === undefined) return;
  sm.textContent = E.statLine(p.st[week - 1], p.pos);
  sm.classList.add('statline');
}

async function runGameDay(A, B, week, token, animate) {
  const l = L();
  const alive = () => token === GD.token;
  const ta = $('#gta'), tb = $('#gtb');
  let sa = 0, sb = 0;
  await gdSleep(500);
  for (let i = 0; i < E.SLOTS.length; i++) {
    if (!alive()) return;
    const row = $(`#gdr-${i}`), ra = $(`#ra-${i}`), rb = $(`#rb-${i}`);
    row.classList.add('active');
    const fast = GD.skip;
    const iva = fast ? null : spinReel(ra), ivb = fast ? null : spinReel(rb);
    await gdSleep(800);
    if (!alive()) return;
    clearInterval(iva);
    const va = landReel(ra, $(`#rwa-${i}`), A.lu[i], GD.skip);
    setTotal(ta, sa, sa + va, GD.skip ? 0 : 450); sa += va;
    showStatLine(`#gpa-${i}`, A.lu[i], week);
    await gdSleep(380);
    if (!alive()) return;
    clearInterval(ivb);
    const vb = landReel(rb, $(`#rwb-${i}`), B.lu[i], GD.skip);
    setTotal(tb, sb, sb + vb, GD.skip ? 0 : 450); sb += vb;
    showStatLine(`#gpb-${i}`, B.lu[i], week);
    if (va !== vb) {
      (va > vb ? ra : rb).classList.add('win');
      $(va > vb ? `#gpa-${i}` : `#gpb-${i}`).classList.add('w');
    }
    ta.classList.toggle('lead', sa > sb);
    tb.classList.toggle('lead', sb > sa);
    row.classList.remove('active');
    row.classList.add('done');
    await gdSleep(450);
  }
  if (!alive()) return;
  // final: use the official scores
  ta.textContent = A.s.toFixed(1); tb.textContent = B.s.toFixed(1);
  ta.classList.toggle('lead', A.s > B.s); tb.classList.toggle('lead', B.s > A.s);
  const userIn = A.id === l.userId;
  const won = A.s > B.s || (A.s === B.s && l.playoffs && l.playoffs.seeds.indexOf(A.id) < l.playoffs.seeds.indexOf(B.id) && week > C.REG_WEEKS);
  const champ = week === C.REG_WEEKS + 2;
  let cls, text;
  if (!userIn) { cls = 'win'; text = `${esc(E.T(won ? A.id : B.id).abbr)} WIN`; }
  else if (A.s === B.s && week <= C.REG_WEEKS) { cls = 'loss'; text = 'TIE'; }
  else if (won) { cls = champ ? 'champ' : 'win'; text = champ ? '🏆 CHAMPIONS! 🏆' : 'VICTORY'; }
  else { cls = 'loss'; text = champ ? 'RUNNER-UP' : 'DEFEAT'; }
  const margin = Math.abs(A.s - B.s);
  $('#gd-end').innerHTML = `<div class="gd-banner ${cls}">${text}</div><div class="gd-sub">${A.s.toFixed(1)} – ${B.s.toFixed(1)}${margin > 0 && margin < 5 ? ' · a nail-biter!' : margin >= 40 ? ' · a blowout' : ''}</div>` + recordsReport(A, B, week) + injuryReport(A, B, week);
  $('#gd-btns').innerHTML = `<button class="primary" data-act="gdClose">Continue</button>`;
  if (animate && userIn && won) confetti(champ ? 260 : 110);
}

// injuries suffered this week by players on either fantasy team (starters and bench)
function injuryReport(A, B, week) {
  const l = L();
  const yr = A.yr || l.year;
  const list = (l.injuryLog || []).filter(x => x.year === yr && x.week === week && (x.team === A.id || x.team === B.id))
    .sort((x, y) => (y.team === l.userId) - (x.team === l.userId) || y.season - x.season);
  if (!list.length) return `<div class="gd-inj none">✅ No injuries for either team this week.</div>`;
  return `<div class="gd-inj"><div class="gd-inj-h">🚑 Injury report</div>${list.map(x => {
    const mine = x.team === l.userId;
    return `<div class="gd-inj-row ${mine ? 'mine' : ''} ${x.season ? 'sev' : ''}">
      <span>${posTag(x.pos)} <b>${esc(x.pname)}</b> <span class="nfl">${x.nfl}</span> <span class="muted">· ${mine ? 'your team' : esc(E.T(x.team).abbr)}</span></span>
      <span><b>${esc(x.name)}</b> — <span class="${x.season ? 'sev-txt' : ''}">${esc(x.est)}</span></span></div>`;
  }).join('')}</div>`;
}

function closeGameDay() {
  GD.token++;
  GD.skip = true;
  if (GD.wake) GD.wake();
  GD.timers.forEach(clearInterval);
  GD.timers = [];
  $('#gameday').classList.add('hidden');
  $('#gameday').innerHTML = '';
}

function findGame(w, teamId) {
  const r = L().results[w - 1];
  return r ? r.find(g => g.a === teamId || g.b === teamId) : null;
}

// ---------- actions ----------
function simMany(mode) {
  const l = L();
  const startOffers = l.offers.length;
  const w0 = l.week;
  let n = 0;
  while (true) {
    if (l.phase !== 'regular' && l.phase !== 'playoffs') break;
    if (mode === 'deadline' && (l.phase !== 'regular' || l.week > C.TRADE_DEADLINE)) break;
    if (mode === 'season' && l.phase !== 'regular') break;
    if (typeof mode === 'number' && n >= mode) break;
    const err = E.simWeek();
    if (err) { toast(err); break; }
    n++;
    if (mode !== 1 && l.offers.length > startOffers) { toast('📨 You received a trade offer — sim paused.'); break; }
  }
  UI.week = null;
  if (n > 1) {
    const hurt = (l.injuryLog || []).filter(x => x.team === l.userId && x.year === l.year && x.week >= w0 && x.week < w0 + n);
    if (hurt.length) toast(`🚑 ${hurt.length} injur${hurt.length > 1 ? 'ies' : 'y'} on your team: ${hurt.map(x => `${x.pname} (${x.name}, ${x.est})`).join('; ')}`, 7000);
  }
  if (mode === 1 && n === 1) {
    const g = findGame(w0, l.userId);
    if (g) showGameDay(g, w0, true);
    else if (w0 > C.REG_WEEKS) { const r = l.results[w0 - 1]; if (r && r.length === 1) showGameDay(r[0], w0, true); }
  }
}

const actions = {
  tab: el => { UI.tab = el.dataset.tab; closeModal(); window.scrollTo(0, 0); },
  create: () => {
    captureSetup();
    E.newLeague({ teamName: UI.setup.name, numTeams: UI.setup.n, difficulty: UI.setup.d, scoring: UI.setup.scoring });
    Object.assign(UI, { tab: 'draft', trade: { partner: null, give: [], get: [], msg: null, ok: false, hl: [] }, histDraft: null, week: null });
    E.draftAdvance(true);
  },
  newLeague: () => { if (confirm('Start a new league? Your current league will be deleted (export it first if you want to keep it).')) { localStorage.removeItem(SAVE_KEY); E.load(null); UI.tab = 'home'; closeModal(); } },
  export: () => {
    const blob = new Blob([E.serialize()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dynasty-gm-${L().year}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  import: () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      f.text().then(txt => {
        try { const d = JSON.parse(txt); if (!d || !d.teams || !d.players) throw new Error('bad'); E.load(d); UI.tab = 'home'; render(); toast('Save imported.'); }
        catch (e) { toast('That file is not a valid Dynasty GM save.'); }
      });
    };
    inp.click();
  },
  startSeason: () => { const err = E.startSeason(); if (err) toast(err); else UI.tab = 'home'; },
  sim: el => { const n = el.dataset.n; simMany(n === '1' ? 1 : n); },
  offseason: () => { E.startOffseason(); E.draftAdvance(true); UI.tab = 'draft'; },
  player: el => openModal({ type: 'player', id: +el.dataset.id }),
  team: el => openModal({ type: 'team', id: +el.dataset.id }),
  close: closeModal,
  sign: el => { const err = E.signFA(+el.dataset.id); toast(err || 'Signed!'); },
  release: el => { const p = E.P(+el.dataset.id); if (confirm(`Release ${E.fullName(p)}? He becomes a free agent anyone can sign.`)) { const err = E.releasePlayer(p.id); if (err) toast(err); } },
  tradeFor: el => { const p = E.P(+el.dataset.id); actions.tradeWith({ dataset: { id: p.teamId } }); UI.trade.get = [{ kind: 'p', id: p.id }]; },
  tradeWith: el => { UI.trade = { partner: +el.dataset.id, give: [], get: [], msg: null, ok: false, hl: [] }; UI.tab = 'trade'; closeModal(); },
  tsel: el => {
    const side = el.dataset.side, a = { kind: el.dataset.kind, id: +el.dataset.id };
    const list = side === 'give' ? UI.trade.give : UI.trade.get;
    const i = list.findIndex(x => x.kind === a.kind && x.id === a.id);
    if (i >= 0) list.splice(i, 1); else list.push(a);
    UI.trade.msg = null; UI.trade.hl = [];
  },
  tclear: () => { UI.trade.give = []; UI.trade.get = []; UI.trade.msg = null; UI.trade.hl = []; },
  propose: () => {
    const tr = UI.trade;
    const r = E.proposeTrade(tr.partner, tr.give, tr.get);
    tr.msg = r.msg; tr.ok = r.ok; tr.hl = [];
    if (r.ok) { tr.give = []; tr.get = []; toast('Trade accepted! 🤝'); }
  },
  balance: () => {
    const tr = UI.trade;
    if (!tr.get.length) { tr.msg = 'Select at least one asset you want from them first.'; tr.ok = false; return; }
    const r = E.balanceTrade(tr.partner, tr.give, tr.get);
    tr.msg = r.msg; tr.ok = r.ok;
    if (r.ok) { tr.hl = r.give.filter(a => !tr.give.some(x => x.kind === a.kind && x.id === a.id)); tr.give = r.give; }
  },
  offerYes: el => { const err = E.respondOffer(+el.dataset.id, true); toast(err || 'Trade completed! 🤝'); },
  offerNo: el => { E.respondOffer(+el.dataset.id, false); },
  offerCounter: el => {
    const o = L().offers.find(x => x.id === +el.dataset.id);
    if (!o) return;
    UI.trade = { partner: o.from, give: o.get.slice(), get: o.give.slice(), msg: 'Loaded their offer — tweak it and propose your own version.', ok: true, hl: [] };
    UI.tab = 'trade';
  },
  autoNow: () => { const u = user(); u.lineup = E.bestLineup(u); },
  autoSub: () => {
    const u = user();
    const sw = E.autoSub(u.id);
    u.autoLineup = false;
    const made = sw.filter(x => x.in != null), stuck = sw.filter(x => x.in == null);
    const nm = id => E.fullName(E.P(id));
    toast(made.length || stuck.length
      ? made.map(x => `${x.slot}: ${x.out != null ? nm(x.out) + (x.why === 'bye' ? ' (bye)' : ' (hurt)') : 'empty'} → ${nm(x.in)}`).concat(stuck.map(x => `${x.slot}: no healthy sub for ${nm(x.out)}`)).join(' · ')
      : 'Everyone in your lineup is healthy and playing this week.', 4500);
  },
  nflWk: el => { UI.nflWk = +el.dataset.w; },
  draftP: el => { E.makeDraftPick(+el.dataset.id); if (L().draft) E.draftAdvance(true); afterDraftCheck(); },
  autopick: () => { const c = E.aiDraftChoice(L().userId); if (c) E.makeDraftPick(c.id); if (L().draft) E.draftAdvance(true); afterDraftCheck(); },
  simToMe: () => { E.draftAdvance(true); afterDraftCheck(); },
  simDraft: () => {
    if (!confirm('Auto-draft the rest of your picks with best available?')) return;
    while (L().draft) { E.draftAdvance(true); if (L().draft) { const c = E.aiDraftChoice(L().userId); if (!c) break; E.makeDraftPick(c.id); } }
    afterDraftCheck();
  },
  sort: el => { const k = el.dataset.k; if (UI.players.sort === k) UI.players.dir *= -1; else { UI.players.sort = k; UI.players.dir = -1; } },
  lsub: el => { UI.league = el.dataset.k; },
  recScope: el => { UI.recScope = el.dataset.k; },
  recN: () => { UI.recN = (UI.recN || 5) === 5 ? 10 : 5; },
  wk: el => { UI.week = +el.dataset.w; },
  gdSkip: () => { GD.skip = true; GD.timers.forEach(clearInterval); if (GD.wake) GD.wake(); },
  gdClose: closeGameDay,
  replay: el => { const g = findGame(+el.dataset.w, L().userId); if (g) showGameDay(g, +el.dataset.w, true); },
  box: el => { const r = L().results[+el.dataset.w - 1]; if (r && r[+el.dataset.i]) showGameDay(r[+el.dataset.i], +el.dataset.w, el.dataset.anim === '1'); },
};

function afterDraftCheck() {
  if (!L().draft) {
    UI.tab = 'roster';
    const u = user();
    toast(u.roster.length > C.ROSTER_MAX ? `Draft complete! You're at ${u.roster.length}/${C.ROSTER_MAX} — release players before the season.` : 'Draft complete!', 4000);
  }
}

function applyScoring(scope, S) {
  if (scope === 'setup') { captureSetup(); UI.setup.scoring = S; return; }
  if (!scoringEditable()) { toast('Scoring is locked during the season.'); return; }
  E.setScoring(S);
  toast('Scoring updated.');
}
const changes = {
  sc: el => {
    const scope = el.dataset.scope;
    const S = Object.assign({}, scope === 'setup' ? UI.setup.scoring : L().settings.scoring);
    let v = parseFloat(el.value);
    if (!isFinite(v)) v = 0;
    if (el.dataset.t === 'ypp') v = v > 0 ? 1 / v : 0;
    S[el.dataset.k] = v;
    applyScoring(scope, S);
  },
  scpreset: el => { if (el.value !== 'custom') applyScoring(el.dataset.scope, E.presetScoring(el.value)); },
  slot: el => {
    const u = user(), i = +el.dataset.i, id = el.value === '' ? null : +el.value;
    if (id != null) u.lineup = u.lineup.map((x, j) => (x === id && j !== i ? null : x));
    u.lineup[i] = id;
    u.autoLineup = false;
  },
  auto: el => { const u = user(); u.autoLineup = el.checked; if (el.checked) u.lineup = E.bestLineup(u); },
  pstatus: el => { UI.players.status = el.value; },
  ppos: el => { UI.players.pos = el.value; },
  pq: el => { UI.players.q = el.value; },
  partner: el => { UI.trade = { partner: +el.value, give: [], get: [], msg: null, ok: false, hl: [] }; },
  dpos: el => { UI.draftPos = el.value; },
  mynews: el => { UI.myNews = el.checked; },
  hdraft: el => { UI.histDraft = el.value; },
};

document.addEventListener('click', e => {
  if (e.target.id === 'modal') { closeModal(); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  fn(el);
  render();
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-chg]');
  if (!el || !changes[el.dataset.chg]) return;
  changes[el.dataset.chg](el);
  render();
});
let qTimer;
document.addEventListener('input', e => {
  if (e.target.dataset && e.target.dataset.chg === 'pq') {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      UI.players.q = e.target.value;
      render();
      const inp = document.querySelector('[data-chg="pq"]');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }, 250);
  }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#gameday').classList.contains('hidden')) closeGameDay();
  else if (UI.modal) closeModal();
});

loadSave();
render();
})();
