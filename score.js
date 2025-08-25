(() => {
  'use strict';

  const TEAM_A = 0;
  const TEAM_B = 1;

  // ------ ELEMENT QUICKGET ------
  const $ = (id) => document.getElementById(id);

  // Setup inputs
  const elTeamAName = $('teamAName');
  const elTeamBName = $('teamBName');
  const elOversPer  = $('oversPerInnings');
  const elWktsPer   = $('wicketsPerInnings');
  const elStart     = $('startMatch');
  const elNewMatch  = $('newMatch');

  // Cards & fields
  const elNameA   = $('nameA');
  const elRunsA   = $('runsA');
  const elWktsA   = $('wktsA');
  const elOversA  = $('oversA');
  const elRRA     = $('rrA');
  const elHintA   = $('hintA');
  const elExtrasA = $('extrasA');
  const elWDA     = $('wdA');
  const elNBA     = $('nbA');
  const elBadgeA  = $('badgeA');
  const elCardA   = $('cardA');

  const elNameB   = $('nameB');
  const elRunsB   = $('runsB');
  const elWktsB   = $('wktsB');
  const elOversB  = $('oversB');
  const elRRB     = $('rrB');
  const elHintB   = $('hintB');
  const elExtrasB = $('extrasB');
  const elWDB     = $('wdB');
  const elNBB     = $('nbB');
  const elBadgeB  = $('badgeB');
  const elCardB   = $('cardB');

  // Over summary containers
  const elOversAList = $('oversAList');
  const elOversBList = $('oversBList');

  // Chase panel (Team B only)
  const elChaseBox  = $('chaseBox');
  const elTargetVal = $('targetVal');
  const elNeedVal   = $('needVal');
  const elBallsLeft = $('ballsLeftVal');
  const elReqRR     = $('reqRR');

  // Status
  const elStatus = $('status');
  elStatus.setAttribute('role', 'status');
  elStatus.setAttribute('aria-live', 'polite');

  // Controls
  const btn = {
    dot: $('dot'), r1: $('r1'), r2: $('r2'), r3: $('r3'), r4: $('r4'), r6: $('r6'),
    wkt: $('wkt'), wd: $('wd'), nb: $('nb'), end: $('endInnings')
  };
  const allControlIds = ['dot','r1','r2','r3','r4','r6','wkt','wd','nb','end'];

  // ------ STATE HELPERS ------
  const oversStr = (balls) => `${Math.floor(balls/6)}.${balls%6}`;
  const rr = (runs, balls) => balls > 0 ? (runs / (balls/6)) : null;
  const fmtRR = (n) => (n == null || !isFinite(n)) ? '—' : n.toFixed(2);
  const totalExtras = (inn) => inn.wides + inn.noballs;

  // Over & innings factories
  const makeOver = () => ({ balls: [], runs: 0, wkts: 0 });
  const blankInnings = (name) => ({
    name,
    runs: 0,
    wickets: 0,
    balls: 0,            // legal balls only
    wides: 0,
    noballs: 0,
    concluded: false,
    overs: [],           // completed overs
    currOver: makeOver() // live over
  });

  // ------ MATCH STATE ------
  const match = {
    maxOvers: null,
    maxBalls: null,      // overs * 6
    maxWickets: 10,      // configurable
    batting: TEAM_A,
    innings: [blankInnings('Team A'), blankInnings('Team B')],
    started: false,
    matchOver: false,
    target: null         // Team B target = Team A runs + 1
  };

  const curr  = () => match.innings[match.batting];
  const other = () => match.innings[match.batting === TEAM_A ? TEAM_B : TEAM_A];

  function setControlsEnabled(enabled) {
    allControlIds.forEach(id => { const b = btn[id]; if (b) b.disabled = !enabled; });
  }

  // Badge helper
  function setBadge(el, text, cls) {
    el.textContent = text;
    el.classList.remove('batting', 'chasing', 'done');
    if (cls) el.classList.add(cls);
  }

  // Record and finalize overs
  function finalizeCurrentOver(inn) {
    if (inn.currOver && inn.currOver.balls.length) {
      inn.overs.push(inn.currOver);
      inn.currOver = makeOver();
    }
  }

  function recordBall(inn, token, runsDelta = 0, { isLegal = false, isWicket = false } = {}) {
    // token: '0','1','2','3','4','6','W','Wd','Nb'
    inn.currOver.balls.push(token);
    if (runsDelta) inn.currOver.runs += runsDelta;
    if (isWicket)  inn.currOver.wkts += 1;

    // Close over after 6 legal balls (extras don't count as legal)
    if (isLegal && inn.balls % 6 === 0) {
      finalizeCurrentOver(inn);
    }
  }

  // NEW: single function to close the current innings immediately
  function closeCurrentInnings() {
    const c = curr();
    if (c.concluded) return;

    // capture partial live over
    finalizeCurrentOver(c);

    c.concluded = true;

    if (match.batting === TEAM_A) {
      // set target and move to Team B
      const A = match.innings[TEAM_A];
      match.target = A.runs + 1;
      match.batting = TEAM_B;
      elStatus.className = 'status';
      elStatus.textContent = `Second innings begins. ${match.innings[TEAM_B].name} need ${match.target} to win.`;
    } else {
      // end match after second innings
      decideMatch();
    }
  }

  // hard guard — do nothing if the innings already hit the balls cap
  function ensureInningsOpen() {
    const c = curr();
    if (match.maxBalls != null && c.balls >= match.maxBalls) {
      closeCurrentInnings();
      render();
      return false;
    }
    if (c.concluded || match.matchOver || !match.started) return false;
    return true;
  }

  // ------ RENDER ------
  function renderOvers(inn, containerEl) {
    if (!containerEl) return;

    const list = inn.currOver.balls.length && !inn.concluded
      ? [...inn.overs, { ...inn.currOver, live: true }]
      : [...inn.overs];

    const show = list.slice(-5); // last 5 overs
    const baseIndex = list.length - show.length;

    if (show.length === 0) {
      containerEl.innerHTML = '<div class="over-empty">No overs yet.</div>';
      return;
    }

    containerEl.innerHTML = show.map((ov, idx) => {
      const ovNum = baseIndex + idx + 1;
      const balls = ov.balls.map(tok => {
        const t = String(tok);
        const cls = t === 'W' ? 'W' : (t === '4' ? 'b4' : (t === '6' ? 'b6' : (t.toLowerCase()==='wd' ? 'wd' : (t.toLowerCase()==='nb' ? 'nb' : ''))));
        return `<span class="ball ${cls}">${t}</span>`;
      }).join(' ');
      const liveTag = ov.live ? ' (live)' : '';
      return `
        <div class="over-row">
          <span class="ov-no">Ov ${ovNum}${liveTag}</span>
          <span class="ov-balls">${balls}</span>
          <span class="ov-tally">${ov.runs}/${ov.wkts}</span>
        </div>`;
    }).join('');
  }

  function render() {
    // Names
    elNameA.textContent = match.innings[TEAM_A].name;
    elNameB.textContent = match.innings[TEAM_B].name;

    // Team A
    const A = match.innings[TEAM_A];
    elRunsA.textContent   = A.runs;
    elWktsA.textContent   = A.wickets;
    elOversA.textContent  = oversStr(A.balls);
    elRRA.textContent     = A.balls ? `(RR: ${fmtRR(rr(A.runs, A.balls))})` : '';
    elHintA.textContent   = `Balls this over: ${A.balls % 6}/6`;
    elExtrasA.textContent = totalExtras(A);
    elWDA.textContent     = A.wides;
    elNBA.textContent     = A.noballs;

    // Team B
    const B = match.innings[TEAM_B];
    elRunsB.textContent   = B.runs;
    elWktsB.textContent   = B.wickets;
    elOversB.textContent  = oversStr(B.balls);
    elRRB.textContent     = B.balls ? `(RR: ${fmtRR(rr(B.runs, B.balls))})` : '';
    elHintB.textContent   = `Balls this over: ${B.balls % 6}/6`;
    elExtrasB.textContent = totalExtras(B);
    elWDB.textContent     = B.wides;
    elNBB.textContent     = B.noballs;

    // Badges & highlight
    const secondInnings = match.started && match.target != null;
    if (!match.started) {
      elCardA.classList.add('active'); elCardB.classList.remove('active');
      setBadge(elBadgeA, 'Batting', 'batting');
      setBadge(elBadgeB, 'Yet to bat', null);
    } else if (match.batting === TEAM_A) {
      elCardA.classList.add('active'); elCardB.classList.remove('active');
      setBadge(elBadgeA, A.concluded ? 'Innings over' : 'Batting', A.concluded ? 'done' : 'batting');
      setBadge(elBadgeB, B.concluded ? 'Innings over' : (B.balls > 0 ? 'Fielding' : 'Yet to bat'), B.concluded ? 'done' : null);
    } else {
      elCardB.classList.add('active'); elCardA.classList.remove('active');
      setBadge(elBadgeB, B.concluded ? 'Innings over' : (secondInnings ? 'Chasing' : 'Batting'), B.concluded ? 'done' : (secondInnings ? 'chasing' : 'batting'));
      setBadge(elBadgeA, A.concluded ? 'Innings over' : 'Fielding', A.concluded ? 'done' : null);
    }

    // Chase UI (Team B only in 2nd innings)
    if (match.started && match.target != null) {
      const ballsLeft = Math.max(0, match.maxBalls - B.balls);
      const need = Math.max(0, match.target - B.runs);
      elChaseBox.classList.remove('hidden');
      elTargetVal.textContent = match.target;
      elNeedVal.textContent = need;
      elBallsLeft.textContent = ballsLeft;
      elReqRR.textContent = (need > 0 && ballsLeft > 0) ? (need / (ballsLeft/6)).toFixed(2) : (need <= 0 ? '0.00' : '—');
    } else {
      elChaseBox.classList.add('hidden');
    }

    // Status line (general)
    if (!match.started) {
      elStatus.className = 'status';
      elStatus.textContent = 'Set up the match to begin.';
    }

    // Controls availability based on current innings
    const c = curr();
    const canScore = match.started && !match.matchOver && !c.concluded && (match.maxBalls == null || c.balls < match.maxBalls);
    setControlsEnabled(canScore);

    // Over summaries
    renderOvers(match.innings[TEAM_A], elOversAList);
    renderOvers(match.innings[TEAM_B], elOversBList);
  }

  // ------ CORE LOGIC ------
  function startMatch() {
    const nameA = (elTeamAName.value || 'Team A').trim();
    const nameB = (elTeamBName.value || 'Team B').trim();
    const overs = parseInt(elOversPer.value, 10);
    const wkts  = parseInt(elWktsPer.value, 10);

    if (!Number.isFinite(overs) || overs < 1) {
      alert('Please enter valid overs per innings, e.g., 20.');
      return;
    }

    match.maxOvers   = overs;
    match.maxBalls   = overs * 6;
    match.maxWickets = (Number.isFinite(wkts) && wkts >= 1) ? wkts : 10;

    match.innings[TEAM_A] = blankInnings(nameA);
    match.innings[TEAM_B] = blankInnings(nameB);
    match.batting   = TEAM_A;
    match.started   = true;
    match.matchOver = false;
    match.target    = null;

    elStatus.textContent = `Match started. ${nameA} are batting first. (${match.maxWickets} wicket innings)`;
    render();
  }
  function newMatch() {
    elTeamAName.value = '';
    elTeamBName.value = '';
    elOversPer.value  = '';
    if (elWktsPer) elWktsPer.value = '';

    match.maxOvers = null;
    match.maxBalls = null;
    match.maxWickets = 20;
    match.batting  = TEAM_A;
    match.innings  = [blankInnings('Team A'), blankInnings('Team B')];
    match.started  = false;
    match.matchOver= false;
    match.target   = null;
    render();
  }

  function afterAction() {
    autoChecks();
    render();
  }

  // Legal deliveries (advance ball)
  function addRuns(r) {
    if (!ensureInningsOpen()) return;
    const c = curr();
    c.runs += r;
    c.balls += 1;                 // advance ball
    recordBall(c, String(r), r, { isLegal: true });
    afterAction();
  }

  function wicket() {
    if (!ensureInningsOpen()) return;
    const c = curr();
    if (c.wickets < match.maxWickets) {
      c.wickets += 1;
      c.balls += 1;               // advance ball
      recordBall(c, 'W', 0, { isLegal: true, isWicket: true });
      afterAction();
    }
  }

  // Extras (do NOT advance ball)
  function wide() {
    if (!ensureInningsOpen()) return;
    const c = curr();
    c.runs += 1;
    c.wides += 1;
    recordBall(c, 'Wd', 1, { isLegal: false });
    afterAction();
  }

  function noBall() {
    if (!ensureInningsOpen()) return;
    const c = curr();
    c.runs += 1;
    c.noballs += 1;
    recordBall(c, 'Nb', 1, { isLegal: false });
    afterAction();
  }

  function endInningsManual() {
    const c = curr();
    if (!match.started || c.concluded || match.matchOver) return;
    closeCurrentInnings();
    render();
  }

  // Auto close: all out or balls exhausted; check win during chase
  function autoChecks() {
    const c = curr();

    // hard close at balls cap
    if (match.maxBalls != null && c.balls >= match.maxBalls) {
      closeCurrentInnings();
      return;
    }

    // all out
    if (c.wickets >= match.maxWickets) {
      closeCurrentInnings();
      return;
    }

    // instant win during chase (Team B)
    if (match.batting === TEAM_B && match.target != null) {
      const B = match.innings[TEAM_B];
      if (B.runs >= match.target) {
        match.matchOver = true;
        B.concluded = true;         // ensure badges show over
        finalizeCurrentOver(B);     // push partial live over
        elStatus.className = 'status ok';
        elStatus.textContent = `✅ ${B.name} win with ${Math.max(0, match.maxBalls - B.balls)} ball(s) left and ${match.maxWickets - B.wickets} wicket(s).`;
        setControlsEnabled(false);
      }
    }
  }

  function decideMatch() {
    const A = match.innings[TEAM_A];
    const B = match.innings[TEAM_B];
    match.matchOver = true;

    if (B.runs > A.runs) {
      elStatus.className = 'status ok';
      elStatus.textContent = `✅ ${B.name} win.`;
    } else if (B.runs < A.runs) {
      elStatus.className = 'status bad';
      elStatus.textContent = `❌ ${B.name} fall short by ${A.runs - B.runs} run(s).`;
    } else {
      elStatus.className = 'status';
      elStatus.textContent = '⏸️ Match tied.';
    }
    setControlsEnabled(false);
  }

  // ------ WIRE UI ------
  elStart.addEventListener('click', startMatch);
  elNewMatch.addEventListener('click', newMatch);

  btn.dot.addEventListener('click', () => addRuns(0));
  btn.r1 .addEventListener('click', () => addRuns(1));
  btn.r2 .addEventListener('click', () => addRuns(2));
  btn.r3 .addEventListener('click', () => addRuns(3));
  btn.r4 .addEventListener('click', () => addRuns(4));
  btn.r6 .addEventListener('click', () => addRuns(6));
  btn.wkt.addEventListener('click', wicket);

  btn.wd .addEventListener('click', wide);
  btn.nb .addEventListener('click', noBall);

  btn.end.addEventListener('click', endInningsManual);
  // Keyboard shortcuts (ignored when typing in inputs)
  const keymap = {
    '0': () => addRuns(0), '.': () => addRuns(0),
    '1': () => addRuns(1), '2': () => addRuns(2), '3': () => addRuns(3),
    '4': () => addRuns(4), '6': () => addRuns(6),
    'w': wicket, 'W': wicket,
    'q': wide,   'Q': wide,
    'n': noBall, 'N': noBall,
    'x': endInningsManual, 'X': endInningsManual
  };
  document.addEventListener('keydown', (e) => {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    const fn = keymap[e.key];
    if (fn) { e.preventDefault(); fn(); }
  });

  // Initial paint
  render();

  // Expose for console debugging
  window._score2 = { startMatch, newMatch, addRuns, wicket, wide, noBall, endInningsManual, match };
})();
