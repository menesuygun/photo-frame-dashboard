(function () {
  const A = window.App;
  let snapshot = null;
  let busy = false;
  let error = '';
  const esc = A.esc;
  const date = value => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', month: 'short', day: 'numeric', year: 'numeric'
  }).format(new Date(value.length === 10 ? value + 'T12:00:00Z' : value));
  const rating = value => Number.isFinite(value) ? value.toFixed(3) : 'NR';
  const link = (url, label) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !['www.globalpickleball.network', 'dashboard.dupr.com'].includes(parsed.hostname)) return '';
      return '<a class="btn btn--ghost" href="' + esc(parsed.href) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + ' ↗</a>';
    } catch { return ''; }
  };

  function leagueTable() {
    if (!Array.isArray(snapshot.standings) || !snapshot.standings.length) return '';
    return '<section aria-label="League standings"><h3 class="pk-section-title">League table</h3>' +
      '<p class="pk-source-note">' + esc(snapshot.league) + ' · Imported ' + esc(date(snapshot.standingsCapturedAt || snapshot.capturedAt)) + '</p>' +
      '<div class="sp-table-scroll pk-standings" tabindex="0" role="region" aria-label="League standings table"><table class="sp-table"><thead><tr>' +
      ['Rank', 'Player', 'Points', 'W', 'L', 'DUPR'].map(label => '<th scope="col">' + label + '</th>').join('') +
      '</tr></thead><tbody>' + snapshot.standings.map(player =>
        '<tr' + (player.name === snapshot.player ? ' class="pk-player-row"' : '') + '><td>' + esc(player.rank) +
        '</td><th scope="row">' + esc(player.name) + (player.name === snapshot.player ? ' <span class="pk-you">You</span>' : '') +
        '</th><td>' + esc(player.points) + '</td><td>' + esc(player.wins) + '</td><td>' + esc(player.losses) +
        '</td><td>' + (Number.isFinite(player.dupr) ? player.dupr.toFixed(2) : 'NR') + '</td></tr>'
      ).join('') + '</tbody></table></div></section>';
  }

  A.pickleballPanelHTML = function () {
    if (!snapshot) return '<div class="sp-empty">' + esc(busy ? 'Loading your pickleball profile…' : error || 'Open My Pickleball to load your profile.') + '</div>';
    const r = snapshot.ratings;
    const matches = snapshot.matches;
    const wins = matches.filter(match => match.scoreFor > match.scoreAgainst).length;
    const losses = matches.filter(match => match.scoreFor < match.scoreAgainst).length;
    return '<section class="pk-profile" aria-label="My pickleball profile">' +
      '<div class="pk-heading"><div><div class="label">MY PICKLEBALL</div><h2 class="serif">' + esc(snapshot.player) + '</h2><p>Imported ' + esc(date(snapshot.capturedAt)) + ' · ' + esc(snapshot.club) + '</p></div><div class="pk-links">' + link(snapshot.duprUrl, 'DUPR profile') + link(snapshot.profileUrl, 'GPN profile') + '</div></div>' +
      (error ? '<p class="sp-notice">' + esc(error) + ' · showing your saved snapshot.</p>' : '') +
      '<div class="pk-ratings"><article><div class="label">DUPR DOUBLES</div><strong class="num">' + rating(r.duprDoubles) + '</strong><p>ID ' + esc(snapshot.duprId) + ' · via your linked GPN profile</p><small>Singles ' + rating(r.duprSingles) + '</small></article>' +
      '<article><div class="label">GPN DOUBLES</div><strong class="num">' + rating(r.gpnDoubles) + '</strong><p>Calculated playing level · ' + esc(r.gpnDoublesAccuracy) + '% accuracy</p><small>GPN singles ' + rating(r.gpnSingles) + ' · ' + esc(r.gpnSinglesAccuracy) + '% accuracy</small></article>' +
      '<article><div class="label">LEAGUE RECORD</div><strong class="num">' + wins + '<span> W / </span>' + losses + '<span> L</span></strong><p>#' + esc(snapshot.leagueRank) + ' · ' + esc(snapshot.leaguePoints) + ' ladder points</p><small>' + matches.length + ' recorded games in this league</small></article></div>' +
      '<p class="pk-source-note">Saved from your signed-in GPN account. New ratings and results need a fresh import.</p>' +
      leagueTable() + '<h3 class="pk-section-title">Recent games</h3>' +
      '<div class="pk-matches">' + matches.map(match => {
        const won = match.scoreFor > match.scoreAgainst;
        return '<article class="pk-match"><div class="pk-match-meta"><time>' + esc(date(match.date)) + '</time><b class="' + (won ? 'pk-win' : 'pk-loss') + '">' + (won ? 'WIN' : 'LOSS') + '</b></div>' +
          '<div class="pk-teams"><div><strong>' + esc(snapshot.player) + ' / ' + esc(match.partner) + '</strong><span>vs ' + esc(match.opponents.join(' / ')) + '</span></div><b class="num">' + esc(match.scoreFor) + '–' + esc(match.scoreAgainst) + '</b></div></article>';
      }).join('') + '</div>' + link(snapshot.leagueUrl, 'View league results') + '</section>';
  };

  A.refreshPickleball = async function () {
    if (busy) return;
    busy = true;
    error = '';
    A.emit('pickleball');
    try {
      let code = '';
      try { code = localStorage.getItem('frame-calendar-code') || ''; } catch {}
      const response = await fetch('/api/sports?kind=pickleball', {
        headers: {Authorization: 'Bearer ' + code}, cache: 'no-store', signal: AbortSignal.timeout(20000)
      });
      if (response.status === 401) throw new Error('Connect Family sync on this device to view your pickleball profile.');
      if (!response.ok) throw new Error('Your pickleball snapshot is temporarily unavailable.');
      const payload = await response.json();
      if (!payload.snapshot || !Array.isArray(payload.snapshot.matches)) throw new Error('Your pickleball snapshot could not be read.');
      snapshot = payload.snapshot;
    } catch (problem) {
      error = problem.message;
    } finally {
      busy = false;
      A.emit('pickleball');
    }
  };
})();
