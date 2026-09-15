/* AI 咏叹调教练 · 曲目库首页与固定两页学习模板（v19） */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ARIAS = './golden-assets/arias/';
  const ASSET_BASE = (window.ARIA_ASSET_BASE || ARIAS).replace(/\/?$/, '/');
  const VOICES = ['女高音', '女中音', '男高音', '男中音', '男低音'];
  const LANGS = ['意大利语', '德语', '法语', '英语', '俄语'];
  const LANG_CODES = { 意大利语: 'it-IT', 法语: 'fr-FR', 德语: 'de-DE', 英语: 'en-GB', 俄语: 'ru-RU' };
  const GOLDEN = { id: 'caro-mio-ben', title: 'Caro mio ben', titleZh: '亲爱的，请相信我', composer: 'G. Giordani', opera: '独立咏叹调（Arietta，约 1783）', language: '意大利语', voice: '男高音', difficulty: '基础', sourceStatus: 'MusicXML 原谱（Mutopia） · 已核验', sourceGrade: 'A', state: 'published', genre: '咏叹调（Golden Sample）', range: { low: 'D4', high: 'F5' }, href: './caro-mio-ben.html' };
  const GRADE_TEXT = { A: 'A · 权威版本 / 公有领域正式出版谱', B: 'B · 两个独立来源交叉确认', C: 'C · 单一公开结构化来源，解析正常', D: 'D · 自动识别或用户整理版本，程序检查通过、待人工复核', E: 'E · 仅研究线索' };

  let manifest = null;
  let vocalRecordings = null;
  const loadVocalSurvey = async () => {
    if (vocalRecordings) return vocalRecordings;
    try {
      vocalRecordings = await (await fetch(ARIAS + 'vocal-recordings.json', { cache: 'no-store' })).json();
    } catch {
      vocalRecordings = { recordings: [], unavailable: [] };
    }
    return vocalRecordings;
  };
  /* A recording is playable when it is present, verified and points at a bundled file. */
  const vocalInfo = (id) => vocalRecordings?.recordings?.find((r) => r.id === id && r.verified && r.file) || null;
  /* Phrase segmentation is opt-in per recording: only fetch the sidecar when the metadata
     declares it, so a recording without segments never produces a 404. */
  const hasSegments = (rec) => !!rec?.segmented;
  const loadManifest = async () => { if (manifest) return manifest; try { manifest = await (await fetch(ARIAS + 'manifest.json', { cache: 'no-store' })).json(); } catch { manifest = { assets: {} }; } return manifest; };
  const audioFile = (id, wav) => { const mp3 = wav.replace(/\.wav$/, '.mp3'); return manifest?.assets?.[id]?.[`audio/${mp3}`] ? `audio/${mp3}` : `audio/${wav}`; };

  const store = {
    key: 'aria-coach-progress-v2',
    read() { try { return JSON.parse(localStorage.getItem(this.key) || '{}'); } catch { return {}; } },
    write(d) { try { localStorage.setItem(this.key, JSON.stringify(d)); } catch { /* private mode */ } },
    aria(id) { const all = this.read(); return all[id] || { listened: [], done: [], weak: [] }; },
    update(id, fn) { const all = this.read(); all[id] = fn(all[id] || { listened: [], done: [], weak: [] }); all[id].updated = Date.now(); all.lastAria = id; this.write(all); },
  };
  const midiOf = (p) => { const m = /^([A-G])([#b]*)(-?\d)$/.exec(p || ''); if (!m) return null; return (+m[3] + 1) * 12 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + [...m[2]].reduce((s, c) => s + (c === '#' ? 1 : -1), 0); };
  const pitchLabel = (p) => (p ? p.replace(/b/g, '♭').replace(/#/g, '♯') : '');
  const fmt = (s) => { if (!isFinite(s) || s < 0) s = 0; return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };

  /* ================= Web Audio synth (melody reference, note fallback) ================= */
  const synth = {
    ctx: null, nodes: [], timers: [],
    context() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; },
    stop() { this.timers.forEach(clearTimeout); this.timers = []; this.nodes.forEach((n) => { try { n.stop(); } catch { /* stopped */ } }); this.nodes = []; },
    tone(hz, start, seconds, gainValue = 0.22) {
      const ctx = this.context(); const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.02);
      gain.gain.setValueAtTime(gainValue, Math.max(start + 0.02, start + seconds - 0.08)); gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
      gain.connect(ctx.destination);
      [[1, 1], [2, 0.28], [3, 0.1]].forEach(([mult, amp]) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz * mult; const g = ctx.createGain(); g.gain.value = amp / 1.38; o.connect(g); g.connect(gain); o.start(start); o.stop(start + seconds + 0.02); this.nodes.push(o); });
    },
    /* Melody reference: every tone is scheduled on the AudioContext clock at its real
       quarter-length position. The same t0/anchor drives the highlight callbacks, so
       melody and highlighting share one timeline (no independent setInterval). */
    play(events, bpm, { onEvent, silent = false } = {}) {
      this.stop(); const ctx = this.context(); const quarter = 60 / bpm; const t0 = ctx.currentTime + 0.08; let t = 0;
      events.forEach((event, index) => { const seconds = Math.max(0.06, Number(event.duration) * quarter); const midi = event.rest ? null : midiOf(event.pitch); if (midi !== null && !silent) this.tone(440 * 2 ** ((midi - 69) / 12), t0 + t, seconds); this.timers.push(setTimeout(() => onEvent && onEvent(index, event), Math.max(0, (t + 0.08) * 1000))); t += seconds; });
      return { total: t, done: new Promise((resolve) => { this.timers.push(setTimeout(() => { onEvent && onEvent(null); resolve(); }, (t + 0.15) * 1000)); }) };
    },
  };
  const speech = { speak(text, lang, rate = 0.85) { if (!('speechSynthesis' in window) || !text) return false; const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = rate; speechSynthesis.speak(u); return true; }, stop() { if ('speechSynthesis' in window) speechSynthesis.cancel(); } };

  /* ================= global player (one <audio>, one status bar) ================= */
  const player = {
    audio: new Audio(), bar: null, state: 'idle', track: '', context: '', segmentEnd: null, timers: [], onTick: null, onEnd: null, synthTotal: 0, synthStart: 0,
    mount() {
      if (this.bar) return;
      const bar = document.createElement('div'); bar.id = 'playerBar'; bar.className = 'player-bar';
      bar.innerHTML = `<div class="pb-main"><button id="pbToggle" class="pb-btn" title="播放/暂停">▶</button><button id="pbStop" class="pb-btn" title="停止">■</button><div class="pb-text"><div class="pb-state" id="pbState">未播放</div><div class="pb-track" id="pbTrack">—</div></div><div class="pb-time"><span id="pbCur">0:00</span> / <span id="pbDur">0:00</span></div><label class="pb-speed">速度 <select id="pbSpeed"><option value="1">1×</option><option value="0.75">0.75×</option><option value="0.6">0.6×</option></select></label></div><div class="pb-progress" id="pbProgress"><div id="pbFill"></div></div>`;
      document.body.appendChild(bar); this.bar = bar;
      window.__ariaAudio = this.audio;
      const a = this.audio; a.preservesPitch = true;
      $('#pbToggle').onclick = () => { if (this.state === 'playing' && !this.synthTotal) { a.pause(); this.set('paused', '已暂停'); } else if (this.state === 'paused') { a.play().then(() => this.set('playing', '正在播放')).catch(() => this.set('error', '无法继续播放')); } };
      $('#pbStop').onclick = () => this.stop('已停止');
      $('#pbSpeed').onchange = (e) => { a.playbackRate = Number(e.target.value); };
      $('#pbProgress').onclick = (e) => { if (!a.duration || this.synthTotal) return; const r = e.currentTarget.getBoundingClientRect(); a.currentTime = ((e.clientX - r.left) / r.width) * a.duration; };
      a.addEventListener('timeupdate', () => { if (this.segmentEnd !== null && a.currentTime >= this.segmentEnd) { a.pause(); this.segmentEnd = null; this.set('done', '播放完毕'); const end = this.onEnd; this.onEnd = null; end && end(); return; } this.draw(); this.onTick && this.onTick(a.currentTime); });
      a.addEventListener('ended', () => { this.set('done', '播放完毕'); const end = this.onEnd; this.onEnd = null; end && end(); });
      a.addEventListener('waiting', () => { if (this.state === 'playing') this.set('loading', '正在缓冲…'); });
      a.addEventListener('playing', () => { if (this.state !== 'stopped') this.set('playing', '正在播放'); });
    },
    set(state, text) { this.state = state; $('#pbState').textContent = text; $('#pbTrack').textContent = this.track ? `${this.track}${this.context ? ' · ' + this.context : ''}` : '—'; $('#pbToggle').textContent = state === 'playing' ? '⏸' : '▶'; this.bar.dataset.state = state; document.dispatchEvent(new CustomEvent('aria-player', { detail: { state, text, track: this.track } })); },
    draw() { const a = this.audio; const cur = this.synthTotal ? Math.min(this.synthTotal, (performance.now() - this.synthStart) / 1000) : a.currentTime; const dur = this.synthTotal || a.duration || 0; $('#pbCur').textContent = fmt(cur); $('#pbDur').textContent = fmt(dur); $('#pbFill').style.width = dur ? `${Math.min(100, cur / dur * 100)}%` : '0%'; },
    stop(text = '已停止') { const a = this.audio; a.pause(); this.segmentEnd = null; synth.stop(); speech.stop(); this.timers.forEach(clearTimeout); this.timers = []; this.synthTotal = 0; this.onTick = null; const end = this.onEnd; this.onEnd = null; this.set('stopped', text); this.draw(); end && end(); },
    /* play a file (optionally a [start,end] segment); resolves when playback started, rejects on failure */
    playFile(src, { track, context = '', start = 0, end = null, rate = 1, onTick, onEnd } = {}) {
      this.stop(''); this.track = track; this.context = context; this.onTick = onTick || null; this.onEnd = onEnd || null;
      this.set('loading', '正在加载…');
      const a = this.audio;
      return new Promise((resolve, reject) => {
        const fail = (msg) => { a.onerror = null; this.set('error', msg); reject(new Error(msg)); };
        a.onerror = () => fail('音频文件无法加载');
        const begin = () => { a.playbackRate = rate * Number($('#pbSpeed').value || 1); this.segmentEnd = end; a.play().then(() => { this.set('playing', '正在播放'); this.draw(); resolve(); }).catch((e) => fail(e && e.name === 'NotAllowedError' ? '浏览器阻止了自动播放，请再点一次' : '无法播放')); };
        const abs = new URL(src, location.href).href;
        if (a.src !== abs) { a.src = abs; a.load(); }
        if (start) { const seek = () => { a.currentTime = start; begin(); }; if (a.readyState >= 1) seek(); else a.addEventListener('loadedmetadata', seek, { once: true }); } else { if (a.readyState >= 1) a.currentTime = 0; begin(); }
      });
    },
    /* Web Audio synth through the same bar */
    playSynth(events, bpm, { track, context = '', onEvent, silent } = {}) {
      this.stop(''); this.track = track; this.context = context; this.set('playing', '正在播放（Web Audio 合成）');
      const run = synth.play(events, bpm, { onEvent, silent });
      this.synthTotal = run.total; this.synthStart = performance.now();
      const tick = setInterval(() => { if (this.state !== 'playing') { clearInterval(tick); return; } this.draw(); }, 200); this.timers.push(tick);
      return run.done.then(() => { if (this.state === 'playing') { this.synthTotal = 0; this.set('done', '播放完毕'); } });
    },
  };

  /* ================= LIBRARY HOME ================= */
  async function renderCatalog(app) {
    const [catalog, research] = await Promise.all([fetch(ARIAS + 'catalog.json').then((r) => r.json()), fetch(ARIAS + 'research.json').then((r) => r.json()).catch(() => [])]);
    await loadVocalSurvey();
    const ready = [GOLDEN, ...catalog.map((a) => ({ ...a, href: `./aria-library.html?id=${a.id}` }))];
    const progress = store.read();
    const state = { query: '', voice: progress.preferredVoice || 'all', language: 'all', difficulty: 'all' };
    const recent = Object.entries(progress).filter(([k, v]) => v && typeof v === 'object' && v.updated).sort((a, b) => b[1].updated - a[1].updated).map(([k]) => ready.find((a) => a.id === k)).filter(Boolean).slice(0, 4);
    const completed = ready.filter((a) => (progress[a.id]?.done || []).length);
    app.innerHTML = `
      <div class="catalog">
        <aside class="sidebar card">
          <p class="eyebrow">曲目库</p>
          <input id="q" type="search" placeholder="搜索歌名、作曲家、歌剧、角色…" aria-label="搜索曲目">
          <label>声部</label>
          <div class="voice-list" id="voices"><button data-v="all" class="active">全部</button>${VOICES.map((v) => `<button data-v="${v}">${v}</button>`).join('')}</div>
          <label for="lang">语言</label>
          <select id="lang"><option value="all">全部语言</option>${LANGS.map((l) => `<option>${l}</option>`).join('')}</select>
          <label for="diff">难度</label>
          <select id="diff"><option value="all">全部难度</option><option>基础</option><option>中级</option><option>高阶</option></select>
          <p class="progress" id="progressNote"></p>
        </aside>
        <main>
          ${recent.length ? `<section class="section-head" style="margin-top:0"><div><p class="eyebrow">最近学习</p><h2 style="margin:0">继续上次的曲目</h2></div></section><div class="grid" id="recentGrid"></div>` : ''}
          <section class="section-head"><div><p class="eyebrow">推荐曲目</p><h2 style="margin:0">按声部、音域、难度与进度推荐</h2></div><span class="muted" id="recWhy"></span></section>
          <div class="grid" id="recGrid"></div>
          <section class="section-head" style="margin-top:28px"><div><p class="eyebrow">全部曲目</p><h2 style="margin:0">正式曲库</h2></div><span class="muted" id="count"></span></section>
          <div class="grid" id="grid"></div>
          <details class="steps" style="margin-top:28px"><summary>研究队列：${research.length} 首尚未达到发布标准（不生成学习页）</summary><p class="muted">已定位候选来源，但谱面、歌词或音频尚未通过核验；每条记录缺少什么、下一步来源与处理方法。</p><div class="grid" id="plannedGrid"></div></details>
        </main>
      </div>`;
    $('#progressNote', app).textContent = completed.length ? `已练过 ${completed.length} 首：${completed.map((a) => a.title).join('、')}` : '尚未记录练习；完成任一乐句后，推荐会考虑你的进度。';
    const rank = (a) => {
      let score = 0; const why = [];
      if (state.voice !== 'all') { if (a.voice === state.voice) { score += 5; why.push('声部匹配'); } else if (a.voice[0] === state.voice[0]) { score += 1; why.push('同性别声部'); } else score -= 4; }
      const levels = completed.map((c) => c.difficulty); const target = levels.includes('中级') ? '高阶' : levels.includes('基础') ? '中级' : '基础';
      if (a.difficulty === target) { score += 2; why.push(`当前阶段：${target}`); }
      if (completed.some((c) => c.id === a.id)) { score -= 2; why.push('已练过'); }
      const langs = completed.map((c) => c.language); if (langs.length && langs.includes(a.language)) { score += 1; why.push('延续同语言'); }
      if (a.range) { const span = midiOf(a.range.high) - midiOf(a.range.low); if (span <= 12) { score += 1; why.push('音域一个八度内'); } else if (span >= 17) why.push('音域较宽'); }
      return { score, why };
    };
    const card = (a, showWhy = true) => { const { why } = rank(a); const span = a.range ? `${pitchLabel(a.range.low)}–${pitchLabel(a.range.high)}` : ''; const prog = progress[a.id]; const rec = vocalInfo(a.id); return `<a class="aria-card" href="${a.href}"><strong>${esc(a.title)}</strong><span class="zh">${esc(a.titleZh || '')}${a.genre ? ` · ${esc(a.genre)}` : ''}</span>
        <div class="meta"><span>${esc(a.composer)}</span><span>${esc(a.language)}</span><span>${esc(a.voice)}</span><span>难度：${esc(a.difficulty)}</span>${span ? `<span>音域 ${span}</span>` : ''}</div>
        <span class="pill ${/片段/.test(a.sourceStatus) ? 'frag' : /自动识别/.test(a.sourceStatus) ? 'warn' : 'ok'}">${esc(a.sourceStatus)}</span>${a.sourceGrade ? `<span class="pill grade-${esc(a.sourceGrade)}">来源 ${esc(a.sourceGrade)} 级</span>` : ''}${prog?.done?.length ? `<span class="pill">已完成 ${prog.done.length} 句</span>` : ''}
        ${rec ? `<span class="pill ok">真人演唱 · ${esc(rec.performer)}</span>` : '<span class="pill">真人录音暂不可用</span>'}
        ${showWhy && why.length ? `<div class="why">${why.join(' · ')}</div>` : ''}</a>`; };
    const plannedCard = (a) => `<article class="aria-card planned"><strong>${esc(a.title)}</strong><span class="zh">${esc(a.titleZh || '')}</span><div class="meta"><span>${esc(a.composer)}</span><span>${esc(a.language)}</span><span>${esc(a.voice)}</span></div><span class="pill warn">研究队列 · ${esc(a.status)}</span><div class="why"><b>缺少：</b>${(a.missing || []).map(esc).join('、')}<br><b>原因：</b>${esc(a.reason)}<br><b>下一步来源：</b>${esc(a.nextSource || '')}<br><b>处理方法：</b>${esc(a.method || '')}</div></article>`;
    const matches = (a) => { const q = state.query.toLowerCase(); const hay = [a.title, a.titleZh, a.composer, a.opera, a.role, a.language, a.voice, a.genre].join(' ').toLowerCase(); return (!q || hay.includes(q)) && (state.language === 'all' || a.language === state.language) && (state.difficulty === 'all' || a.difficulty === state.difficulty) && (state.voice === 'all' || a.voice === state.voice || a.voice[0] === state.voice[0]); };
    const draw = () => {
      const list = ready.filter(matches);
      const ranked = list.map((a) => ({ a, r: rank(a) })).sort((x, y) => y.r.score - x.r.score);
      $('#recGrid', app).innerHTML = ranked.slice(0, 6).map(({ a }) => card(a)).join('') || '<p class="empty">没有匹配曲目。</p>';
      $('#recWhy', app).textContent = state.voice === 'all' ? '选择声部后推荐更精确' : `按 ${state.voice} 推荐`;
      $('#grid', app).innerHTML = list.slice().sort((x, y) => x.title.localeCompare(y.title)).map((a) => card(a, false)).join('') || '<p class="empty">没有匹配的正式曲目。试试放宽声部或语言。</p>';
      $('#count', app).textContent = `${list.length} / ${ready.length} 首`;
      if ($('#recentGrid', app)) $('#recentGrid', app).innerHTML = recent.map((a) => card(a, false)).join('');
      $('#plannedGrid', app).innerHTML = research.filter(matches).map(plannedCard).join('') || '<p class="empty">该筛选条件下没有研究队列曲目。</p>';
    };
    $('#q', app).oninput = (e) => { state.query = e.target.value.trim(); draw(); };
    $('#lang', app).onchange = (e) => { state.language = e.target.value; draw(); };
    $('#diff', app).onchange = (e) => { state.difficulty = e.target.value; draw(); };
    $('#voices', app).querySelectorAll('button').forEach((b) => { if (b.dataset.v === state.voice) { $('#voices button.active', app)?.classList.remove('active'); b.classList.add('active'); } b.onclick = () => { $('#voices button.active', app)?.classList.remove('active'); b.classList.add('active'); state.voice = b.dataset.v; const all = store.read(); all.preferredVoice = state.voice; store.write(all); draw(); }; });
    draw();
  }

  /* ================= LEARNING PAGE ================= */
  async function renderAria(app, id) {
    const base = `${ARIAS}${id}/`; const abase = `${ASSET_BASE}${id}/`;
    await loadManifest();
    let catalog = [], data = null, segments = null;
    await loadVocalSurvey();
    const vi = vocalInfo(id);
    try {
      [catalog, data] = await Promise.all([
        fetch(ARIAS + 'catalog.json').then((r) => r.json()).catch(() => []),
        fetch(base + 'data.json', { cache: 'no-store' }).then((r) => { if (r.ok) return r.json(); throw new Error(`HTTP ${r.status}`); }),
      ]);
      // Optional per-phrase segmentation of the same recording. Only fetched when declared;
      // otherwise the aria offers the full recording as its reference.
      if (vi && hasSegments(vi)) segments = await fetch(base + 'audio/vocal-segments.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    } catch (error) {
      app.innerHTML = `<section class="card"><p class="eyebrow">无法打开曲目</p><h1>${esc(id)}</h1><p>该曲目的学习数据尚未发布或来源仍在核验（${esc(error.message)}）。</p><p><a class="btn primary" href="./index.html">← 返回曲目库</a></p></section>`;
      return;
    }
    document.title = `${data.title} · AI 咏叹调教练`;
    player.mount();
    const lang = LANG_CODES[data.language] || 'it-IT';
    const allEvents = data.phrases.flatMap((p) => p.events);
    const byId = Object.fromEntries(allEvents.map((e) => [e.id, e]));
    const hasVocal = !!vi;
    const hasPhraseSegments = !!(segments && segments.phrases);
    let index = Math.max(0, data.phrases.findIndex((p, i) => !store.aria(id).done.includes(i)));
    const cov = data.coverage || {}; const fragment = cov.complete === false; const st = data.story || {};
    const idx = catalog.findIndex((c) => c.id === id); const prev = catalog[idx - 1]; const next = catalog[idx + 1];
    const similar = catalog.filter((c) => c.id !== id && (c.voice === data.voice || c.language === data.language)).sort((a, b) => (b.voice === data.voice) - (a.voice === data.voice) || (a.difficulty === data.difficulty ? -1 : 1)).slice(0, 3);
    const speechPhrases = data.phrases.map((p, i) => (p.lyrics ? `speech-phrase-${i + 1}.wav` : null));
    const grade = data.sourceGrade || 'C';
    const firstVisit = !(store.read().visited || []).includes(id);
    store.update(id, (s) => s); { const all = store.read(); all.visited = [...new Set([...(all.visited || []), id])]; store.write(all); }

    app.innerHTML = `
      <nav class="detail-nav card">
        <a class="btn" href="./index.html">← 返回曲目库</a>
        ${prev ? `<a class="btn" href="./aria-library.html?id=${prev.id}" title="${esc(prev.title)}">‹ 上一首</a>` : '<span class="btn" aria-disabled="true">‹ 上一首</span>'}
        ${next ? `<a class="btn" href="./aria-library.html?id=${next.id}" title="${esc(next.title)}">下一首 ›</a>` : '<span class="btn" aria-disabled="true">下一首 ›</span>'}
        <span class="muted similar">相似曲目：${similar.map((s) => `<a href="./aria-library.html?id=${s.id}">${esc(s.title)}</a>`).join(' · ') || '—'}</span>
      </nav>
      ${firstVisit ? `<div class="hint card" id="firstHint">这首曲目包含两个学习部分：① 乐谱与练唱，② 剧情与作品解读。可以先练唱，也可以先了解剧情。<button class="link-btn" id="hintClose">知道了</button></div>` : ''}
      <section class="card hero">
        <div>
          <p class="eyebrow">${esc(data.opera)}</p>
          <h1>${esc(data.title)}</h1>
          <p class="muted" style="margin:0 0 6px">${esc(data.titleZh || '')} · ${esc(data.composer)}${data.role ? ` · 角色：${esc(data.role)}` : ''}${data.genre ? ` · ${esc(data.genre)}` : ''}</p>
          <div class="facts">
            <span class="pill">语言：${esc(data.language)}</span><span class="pill">声部：${esc(data.voice)}</span><span class="pill">难度：${esc(data.difficulty)}</span>
            <span class="pill">音域 ${pitchLabel(data.range.low)}–${pitchLabel(data.range.high)}</span><span class="pill">拍号 ${esc(data.timeSignature)} · ♩=${data.tempoBpm}</span>
            <span class="pill ${fragment ? 'frag' : 'ok'}">${fragment ? `片段：第 ${cov.measures[0]}–${cov.measures[1]} 小节` : '完整'}</span>
            <span class="pill grade-${esc(grade)}" title="${esc(GRADE_TEXT[grade] || '')}">来源 ${esc(grade)} 级</span>
          </div>
          <div class="primary-actions">
            <button class="btn primary big" id="playVocal" ${hasVocal ? '' : 'disabled'}>▶ 听真人演唱</button>
            <button class="btn big" id="playSpeech">🎙 听歌词发音</button>
            <button class="btn big" id="goPractice">♪ 分句练习</button>
          </div>
          <div class="vocal-note">
            ${hasVocal
              ? `<span class="badge ok">真人演唱 · ${esc(vi.performer)} · ${esc(vi.year)} · ${esc(vi.license)}</span>
                 ${hasPhraseSegments ? '<span class="badge ok">已按乐句分段，可逐句播放</span>' : '<span class="badge warn">整曲参考（未逐句分段）</span>'}`
              : '<span class="badge warn">真人录音暂不可用：本曲只提供歌词朗读与准确旋律参考</span>'}
          </div>
          ${hasVocal ? `<details class="steps" style="margin-top:10px"><summary>真人演唱录音来源与版本差异</summary>
            <ul class="sources" style="margin:8px 0 0">
              <li><b>演唱者</b>：${esc(vi.performer)}（${esc(vi.voiceType)}）</li>
              <li><b>录音年份</b>：${esc(vi.year)}</li>
              <li><b>来源</b>：<a href="${esc(vi.sourceUrl)}" target="_blank" rel="noopener">${esc(vi.source)}</a></li>
              <li><b>许可</b>：<a href="${esc(vi.licenseUrl)}" target="_blank" rel="noopener">${esc(vi.license)}</a></li>
              <li><b>版本差异</b>：${esc(vi.versionNote)}</li>
              <li><b>已核验</b>：可下载、可解码、非空、非 MIDI、非纯伴奏；时长 ${Math.round(vi.durationSec)} 秒。</li>
            </ul></details>` : ''}
          <p class="muted" style="font-size:13px;margin:8px 0 0">${esc(cov.note || '')}</p>
        </div>
        <aside class="preview-card">
          <p class="eyebrow">先理解人物，再开始演唱</p>
          <h3>30 秒剧情</h3><p>${esc(st.plain30)}</p>
          <h3>人物关系</h3><p class="clamp">${esc(st.relationships)}</p>
          <h3>核心动机</h3><p class="clamp">${esc(st.motif)}</p>
          <button class="link-btn" data-view="story">查看完整作品解读 →</button>
        </aside>
      </section>
      <div class="tabs" role="tablist">
        <button class="active" data-view="study">① 乐谱与练唱</button>
        <button data-view="story">② 剧情与作品解读<small>理解人物、动机、完整歌词</small></button>
      </div>

      <section class="view active" id="view-study">
        <div class="study-layout">
          <nav class="card phrase-nav" id="phraseNav" aria-label="分句列表"></nav>
          <div>
            <section class="card phrase-hero" id="practice">
              <div class="kicker" id="kicker"></div>
              <div class="text" id="phraseText"></div>
              <p class="zh" id="phraseZh"></p>
              <div class="syllables" id="syllables"></div>
              <div class="note-panel" id="notePanel">点击任一音符：播放该音的歌唱音节（或旋律参考），并显示音名、小节、拍点、时值与音节。</div>
              <div class="controls">
                <button class="btn primary" id="phraseVocal" ${hasVocal && hasPhraseSegments ? '' : 'disabled'} title="${hasVocal ? (hasPhraseSegments ? '播放本句对应的真人演唱片段' : '本曲录音未逐句分段') : '本曲暂无真人录音'}">▶ 听本句人声</button>
                <button class="btn" id="phraseSpeech">🎙 本句发音</button>
                <button class="btn" id="phraseSpeechSlow">🐢 慢速发音</button>
                <button class="btn danger" id="stopPhrase">■ 停止</button>
                <button class="btn" id="prev">← 上一句</button><button class="btn" id="next">下一句 →</button>
              </div>
              <details class="steps tools"><summary>练习工具：准确旋律 · 慢速旋律 · 下载</summary>
                <div class="controls">
                  <button class="btn" id="melody">♪ 准确旋律参考（合成）</button>
                  <button class="btn" id="melodySlow">🐢 慢速旋律参考</button>
                  <button class="btn" id="fullMelody">♪ 整曲旋律参考</button>
                </div>
                <p class="muted" style="margin:8px 0 0;font-size:13px">播放速度在底部播放器中切换（1× / 0.75× / 0.6×，保持音高）。</p>
                <div class="controls">
                  <button class="btn" id="done">✓ 完成本句练习</button><button class="btn" id="weak">⚑ 标记为薄弱乐句</button>
                  <a class="btn" href="${abase}score.pdf" download>⇩ PDF 五线谱</a><a class="btn" href="${abase}score.musicxml" download>⇩ MusicXML</a>
                </div>
                <p class="progress" id="progress"></p>
              </details>
            </section>
            <section class="card score">
              <p class="eyebrow">正规五线谱</p><h2>完整声乐谱（${data.pages} 页）</h2>
              <div class="score-zoom"><button id="zoomOut" title="缩小">−</button><span id="zoomLevel">100%</span><button id="zoomIn" title="放大">+</button><button id="zoomReset" title="恢复原始大小" style="font-size:13px;width:auto;padding:0 10px">重置</button></div>
              <div class="score-container" id="scoreContainer">
              ${Array.from({ length: data.pages || 1 }, (_, i) => `<img src="${abase}score-${i + 1}.svg" alt="${esc(data.title)} 五线谱第 ${i + 1} 页" loading="lazy">`).join('')}
              </div>
            </section>
          </div>
        </div>
      </section>

      <section class="view" id="view-story">
        <section class="card">
          <div class="section-head" style="margin-top:0"><div><p class="eyebrow">🎭 情境</p><h2>这首歌在说什么</h2></div><span class="badge">解读 · 草稿</span></div>
          <div class="story-grid">
            <div class="story-card"><h3>作品背景</h3><p>${esc(st.background)}</p></div>
            <div class="story-card"><h3>当前剧情位置</h3><p>${esc(st.situation)}</p></div>
            <div class="story-card"><h3>人物关系</h3><p>${esc(st.relationships)}</p></div>
            <div class="story-card"><h3>演唱意图</h3><p>${esc(st.intent)}</p></div>
          </div>
        </section>
        <section class="card">
          <div class="section-head" style="margin-top:0"><div><p class="eyebrow">作品解读</p><h2>把咏叹调听活</h2></div><span class="badge">学习辅助</span></div>
          <div class="story-grid">
            <div class="story-card"><h3>30 秒白话版</h3><p>${esc(st.plain30)}</p></div>
            <div class="story-card"><h3>基调与情绪弧线</h3><p>${esc(st.arc)}</p></div>
            <div class="story-card"><h3>核心音乐动机与演唱提示</h3><p>${esc(st.motif)}</p></div>
            <div class="story-card"><h3>呼吸、咬字、换声区与高音</h3><p>${esc(st.technique || '')}</p></div>
          </div>
          ${(st.motifPositions || []).length ? `<h3 style="margin-top:14px">动机在乐句中的位置与变化</h3><ul class="motif-list">${st.motifPositions.map((m) => `<li><button class="link-btn" data-goto="${Number(m.phrase) - 1}">第 ${Number(m.phrase)} 句</button> ${esc(m.note)}</li>`).join('')}</ul>` : ''}
          <details class="steps" style="margin-top:12px"><summary>展开：从歌剧舞台到课堂（七步练习）</summary><ol>${(st.classroom || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol></details>
        </section>
        ${(data.hints || []).length ? `<section class="card hints"><p class="eyebrow">语言提示</p><h2>${esc(data.language)}发音要点</h2><div class="story-grid">${data.hints.map((h) => `<div class="story-card"><h3>${esc(h.title)}</h3><ul>${h.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</div></section>` : ''}
        <section class="card">
          <p class="eyebrow">完整歌词</p><h2>原文与中文翻译</h2>
          <div class="controls"><button class="btn" id="speechFull2">🎙 全文标准朗读</button><button class="btn" id="speechFullSlow2">🐢 全文慢速朗读</button><button class="btn danger" id="stopStory">■ 停止</button></div>
          <p class="muted" style="font-size:13px">点击任一行可跳到对应乐句并播放本句人声（无人声时播放朗读）。</p>
          <table class="lyrics-table"><tbody>${data.lyrics.map((l, i) => `<tr class="lyric-row" data-line="${i}"><td>${esc(l.text)}</td><td>${esc(l.zh)}</td></tr>`).join('')}</tbody></table>
        </section>
        <section class="card sources">
          <p class="eyebrow">来源与可信度</p><h2>谱面、歌词、背景与音频来源</h2>
          <p><span class="pill grade-${esc(grade)}">整体来源等级 ${esc(GRADE_TEXT[grade] || grade)}</span></p>
          <ul>${data.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a> · ${esc(s.format)}${s.grade ? ` · <span class="pill grade-${esc(s.grade)}">${esc(s.grade)} 级</span>` : ''}${s.accessed ? ` · 访问 ${esc(s.accessed)}` : ''}<br><small>${esc(s.role)} · ${esc(s.status)}</small></li>`).join('')}</ul>
          <ul>
            <li><b>真人演唱录音</b>：${hasVocal ? `${esc(vi.performer)}（${esc(vi.voiceType)}），${esc(vi.year)}，${esc(vi.license)}。来源：<a href="${esc(vi.sourceUrl)}" target="_blank" rel="noopener">${esc(vi.source)}</a>。经自动技术核查（可下载、可解码、非空、非 MIDI、非纯伴奏）。` : '本曲暂无合法可用的真人演唱录音。'}</li>
            <li><b>本页不提供</b>：语音合成（TTS）拼接的“合成人声”。人声只来自上述真人录音；没有录音时，只提供歌词朗读与旋律参考。</li>
            <li><b>标准语言朗读</b>：${data.speech ? `${esc(data.speech.engine)} · 语音 ${esc(data.speech.voice)}；慢速为 ${esc(String(data.speech.slowScale))}× 时长` : '尚未生成，按钮回退到浏览器系统语音'}。只用于学习发音，不是演唱。</li>
            <li><b>准确旋律参考</b>：按 data.json 的音高、时值与休止合成，不承担歌词发音。</li>
            <li>没有真实演唱输入时不生成任何演唱评分。</li>
          </ul>
          <details class="steps"><summary>音频加载诊断</summary><div id="diag" class="muted" style="font-size:13px">展开后自动检测全部音频文件…</div></details>
        </section>
      </section>`;

    /* ---- tabs & hint ---- */
    const showView = (name) => { app.querySelectorAll('.tabs [data-view]').forEach((x) => x.classList.toggle('active', x.dataset.view === name)); app.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`)); if (name === 'story') window.scrollTo({ top: $('.tabs', app).offsetTop - 70, behavior: 'smooth' }); };
    app.querySelectorAll('[data-view]').forEach((b) => { b.onclick = () => showView(b.dataset.view); });
    $('#hintClose', app)?.addEventListener('click', () => $('#firstHint', app).remove());

    /* ---- highlighting (synth melody only: real recordings have no per-note alignment) ---- */
    const highlightId = (eid) => { app.querySelectorAll('.syl.now').forEach((s) => s.classList.remove('now')); if (!eid) return; const el = app.querySelector(`.syl[data-id="${eid}"]`); if (el) { el.classList.add('now'); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } };
    const stopAll = (msg = '已停止') => { player.stop(msg); highlightId(null); };

    /* ---- speech helpers ---- */
    const playSpeechFile = (wav, text, track, context, rate = 1) => {
      if (!wav || !data.speech) { const ok = speech.speak(text, lang, rate < 1 ? 0.6 : 0.85); player.track = track; player.set(ok ? 'playing' : 'error', ok ? '正在播放（浏览器系统语音回退）' : '当前浏览器不支持语音朗读'); return; }
      player.playFile(abase + audioFile(id, wav), { track, context, rate }).catch(() => { const ok = speech.speak(text, lang, 0.85); player.set('error', ok ? '朗读文件加载失败，已改用浏览器系统语音' : '朗读文件加载失败，且浏览器不支持语音朗读'); });
    };
    /* Play the verified real recording — whole, or the [start,end] segment of the same file.
       No fallback to synthetic voice: if the file fails, say so and play the melody reference instead.
       `phraseRange` is the [from, to] phrase-index range the segment covers, used only for the fallback. */
    const playRealRecording = ({ start = 0, end = null, track, context, rate = 1, phraseRange = null } = {}) => {
      if (!vi) { player.set('error', '本曲暂无真人录音'); return Promise.resolve(); }
      return player.playFile(abase + vi.file, { track: `${track} · 真人演唱（${vi.performer}${vi.year ? '，' + vi.year : ''}）`, context, start, end, rate })
        .catch(() => {
          player.set('error', '真人录音加载失败，已改用旋律参考');
          const evs = phraseRange ? data.phrases.slice(phraseRange[0], phraseRange[1] + 1).flatMap((p) => p.events) : allEvents;
          return player.playSynth(evs, data.tempoBpm, { track: `${track}（旋律参考回退）`, onEvent: (i, e) => highlightId(e ? e.id : null) });
        });
    };
    /* Segment for a 1-based phrase, or null when this recording was not segmented per phrase. */
    const segOf = (phraseIndex) => (hasPhraseSegments ? segments.phrases[String(phraseIndex + 1)] || null : null);

    /* ---- phrase rendering ---- */
    const nav = $('#phraseNav', app);
    const noteInfo = (e) => `<b>${e.rest ? '休止' : pitchLabel(e.pitch)}</b> · 小节 ${e.measure} · 第 ${e.beat} 拍 · ${e.duration} 拍${e.verse ? ` · 第 ${e.verse} 节` : ''}${e.lyric ? ` · 音节「${esc(e.lyric)}」` : e.rest ? '' : ' · 无新音节'} · <span class="src">${e.rest ? '休止符（不发声）' : '旋律参考（合成音）'}</span>`;
    const render = (resetPanel = true) => {
      const p = data.phrases[index]; const prog = store.aria(id);
      nav.innerHTML = data.phrases.map((x, i) => `<button data-i="${i}" class="${i === index ? 'active' : ''} ${prog.done.includes(i) ? 'done' : ''} ${(prog.weak || []).includes(i) ? 'weak' : ''}">第 ${i + 1} 句 · 小节 ${x.measures[0]}${x.measures[1] !== x.measures[0] ? '–' + x.measures[1] : ''}${x.verse ? ` · 第 ${x.verse} 节` : ''}<small>${esc(x.lyrics || '（旋律段，原谱此处未标注歌词）')}</small></button>`).join('');
      nav.querySelectorAll('button').forEach((b) => { b.onclick = () => { stopAll('已切换乐句'); index = Number(b.dataset.i); render(); }; });
      $('#kicker', app).textContent = `第 ${index + 1} / ${data.phrases.length} 句 · 小节 ${p.measures[0]}–${p.measures[1]}${p.verse ? ` · 第 ${p.verse} 节` : ''}`;
      $('#phraseText', app).textContent = p.lyrics || '（旋律段：原谱此处未标注歌词，可对照第二页完整歌词）';
      $('#phraseZh', app).textContent = p.translation || (p.lyrics ? '' : '尾声旋律，按原谱音高与时值播放。');
      $('#syllables', app).innerHTML = p.events.map((e) => e.rest
        ? `<button type="button" class="syl rest" data-id="${e.id}" title="休止 ${e.duration} 拍">𝄽<small>${e.duration}</small></button>`
        : `<button type="button" class="syl ${e.lyric ? '' : 'melisma'}" data-id="${e.id}" title="小节 ${e.measure} 第 ${e.beat} 拍 · ${e.duration} 拍 · 点击试听">${esc(e.lyric || '·')}<small>${pitchLabel(e.pitch)}</small></button>`).join('');
      $('#syllables', app).querySelectorAll('button.syl').forEach((b) => { b.onclick = () => playNote(byId[b.dataset.id]); });
      if (resetPanel) $('#notePanel', app).innerHTML = '点击任一音符：播放该音的旋律参考，并显示音名、小节、拍点、时值与音节。';
      $('#progress', app).textContent = `已听 ${prog.listened.length} 句 · 已完成 ${prog.done.length} / ${data.phrases.length} 句${(prog.weak || []).length ? ` · 薄弱 ${prog.weak.length} 句` : ''}`;
      $('#prev', app).disabled = index === 0; $('#next', app).disabled = index === data.phrases.length - 1;
      $('#phraseSpeech', app).disabled = !p.lyrics; $('#phraseSpeechSlow', app).disabled = !p.lyrics;
      $('#weak', app).textContent = (prog.weak || []).includes(index) ? '⚑ 取消薄弱标记' : '⚑ 标记为薄弱乐句';
    };
    /* single note: real recordings are not note-aligned, so a note always plays the melody reference */
    const playNote = (e) => {
      stopAll(''); highlightId(e.id);
      $('#notePanel', app).innerHTML = noteInfo(e);
      if (e.rest) { player.track = `休止 ${e.duration} 拍`; player.set('stopped', '休止符：不发声'); return; }
      const seconds = Math.max(0.25, e.duration * 60 / data.tempoBpm);
      const hz = 440 * 2 ** ((midiOf(e.pitch) - 69) / 12);
      synth.stop(); synth.tone(hz, synth.context().currentTime + 0.02, Math.min(2.5, seconds));
      player.track = `${pitchLabel(e.pitch)}${e.lyric ? '「' + e.lyric + '」' : '（延音）'}（旋律参考）`;
      player.set('playing', '正在播放（旋律参考·合成音）');
      player.timers.push(setTimeout(() => { if (player.state === 'playing') player.set('done', '播放完毕'); }, Math.min(2.5, seconds) * 1000 + 100));
    };
    render();

    /* ---- score zoom ---- */
    let zoomScale = 1;
    const setZoom = (s) => { zoomScale = Math.max(0.5, Math.min(3, s)); const c = $('#scoreContainer', app); if (c) c.querySelectorAll('img').forEach((img) => { img.style.transform = `scale(${zoomScale})`; img.style.transformOrigin = 'top left'; img.style.width = `${100 / zoomScale}%`; }); const el = $('#zoomLevel', app); if (el) el.textContent = `${Math.round(zoomScale * 100)}%`; };
    $('#zoomIn', app)?.addEventListener('click', () => setZoom(zoomScale + 0.25));
    $('#zoomOut', app)?.addEventListener('click', () => setZoom(zoomScale - 0.25));
    $('#zoomReset', app)?.addEventListener('click', () => setZoom(1));

    /* ---- keyboard shortcuts ---- */
    const keyHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); stopAll('已切换乐句'); index = Math.max(0, index - 1); render(); }
      else if (e.key === 'ArrowRight' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); stopAll('已切换乐句'); index = Math.min(data.phrases.length - 1, index + 1); render(); }
      else if (e.key === ' ' && !e.shiftKey) { e.preventDefault(); if (player.state === 'playing') player.stop('已停止'); else { markListened(); player.playSynth(data.phrases[index].events, data.tempoBpm, { track: `第 ${index + 1} 句准确旋律参考`, context: data.title, onEvent: (i, ev) => highlightId(ev ? ev.id : null) }); } }
      else if (e.key === 'Escape') { stopAll(); }
    };
    document.addEventListener('keydown', keyHandler);

    /* ---- primary buttons ---- */
    const markListened = () => store.update(id, (s) => ({ ...s, listened: [...new Set([...(s.listened || []), index])] }));
    const phraseSpan = (i) => segOf(i);
    $('#playVocal', app).onclick = () => { markListened(); playRealRecording({ track: '整曲真人演唱', context: data.title, phraseRange: [0, data.phrases.length - 1] }); };
    $('#playSpeech', app).onclick = () => playSpeechFile('speech-full.wav', data.lyrics.map((l) => l.text).join(' '), '整曲歌词发音（标准朗读）', data.title);
    $('#goPractice', app).onclick = () => { showView('study'); $('#practice', app).scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    $('#phraseVocal', app).onclick = () => {
      markListened();
      const s = phraseSpan(index);
      if (!s) { player.set('error', hasPhraseSegments ? '本句分段不可用' : '本曲录音未逐句分段，请用「听真人演唱」播放整曲'); return; }
      playRealRecording({ start: s.start, end: s.end, track: `第 ${index + 1} 句真人演唱`, context: data.title, phraseRange: [index, index] });
    };
    $('#phraseSpeech', app).onclick = () => { markListened(); playSpeechFile(speechPhrases[index], data.phrases[index].lyrics, `第 ${index + 1} 句发音（标准朗读）`, data.title); };
    $('#phraseSpeechSlow', app).onclick = () => { markListened(); playSpeechFile(speechPhrases[index], data.phrases[index].lyrics, `第 ${index + 1} 句慢速发音`, data.title, 0.7); };
    $('#melody', app).onclick = () => { markListened(); player.playSynth(data.phrases[index].events, data.tempoBpm, { track: `第 ${index + 1} 句准确旋律参考`, context: data.title, onEvent: (i, e) => highlightId(e ? e.id : null) }); };
    $('#melodySlow', app).onclick = () => { markListened(); player.playSynth(data.phrases[index].events, data.tempoBpm * 0.6, { track: `第 ${index + 1} 句慢速旋律参考（0.6×）`, context: data.title, onEvent: (i, e) => highlightId(e ? e.id : null) }); };
    $('#fullMelody', app).onclick = () => player.playFile(abase + audioFile(id, 'full.wav'), { track: '整曲旋律参考', context: data.title }).catch(() => player.playSynth(allEvents, data.tempoBpm, { track: '整曲旋律参考（合成回退）', onEvent: (i, e) => highlightId(e ? e.id : null) }));
    $('#stopPhrase', app).onclick = () => stopAll(); $('#stopStory', app).onclick = () => stopAll();
    $('#prev', app).onclick = () => { stopAll('已切换乐句'); index = Math.max(0, index - 1); render(); };
    $('#next', app).onclick = () => { stopAll('已切换乐句'); index = Math.min(data.phrases.length - 1, index + 1); render(); };
    $('#done', app).onclick = () => { store.update(id, (s) => ({ ...s, done: [...new Set([...(s.done || []), index])] })); render(false); player.track = `第 ${index + 1} 句`; player.set(player.state, `第 ${index + 1} 句已标记完成`); };
    $('#weak', app).onclick = () => { store.update(id, (s) => { const w = new Set(s.weak || []); w.has(index) ? w.delete(index) : w.add(index); return { ...s, weak: [...w] }; }); render(false); };
    $('#speechFull2', app).onclick = () => playSpeechFile('speech-full.wav', data.lyrics.map((l) => l.text).join(' '), '全文标准朗读', data.title);
    $('#speechFullSlow2', app).onclick = () => playSpeechFile('speech-full-slow.wav', data.lyrics.map((l) => l.text).join(' '), '全文慢速朗读', data.title);
    app.querySelectorAll('.lyric-row').forEach((row) => { row.onclick = () => { const zh = data.lyrics[Number(row.dataset.line)].zh; const target = data.phrases.findIndex((p) => p.translation === zh); if (target < 0) return; stopAll('已切换乐句'); index = target; render(); showView('study'); $('#practice', app).scrollIntoView({ behavior: 'smooth' }); const s = phraseSpan(index); if (hasVocal && s) playRealRecording({ start: s.start, end: s.end, track: `第 ${index + 1} 句真人演唱`, context: data.title, phraseRange: [index, index] }); else if (speechPhrases[index]) playSpeechFile(speechPhrases[index], data.phrases[index].lyrics, `第 ${index + 1} 句发音`, data.title); }; });
    app.querySelectorAll('[data-goto]').forEach((b) => { b.onclick = () => { stopAll('已切换乐句'); index = Math.max(0, Math.min(data.phrases.length - 1, Number(b.dataset.goto))); render(); showView('study'); $('#practice', app).scrollIntoView({ behavior: 'smooth' }); }; });
    /* diagnostics */
    const diag = $('#diag', app); let diagDone = false;
    diag.closest('details').addEventListener('toggle', async (e) => {
      if (!e.target.open || diagDone) return; diagDone = true;
      const wavs = ['full.wav', 'slow.wav', ...(hasVocal ? [vi.file.replace(/^audio\//, '')] : []), ...(data.speech ? ['speech-full.wav', 'speech-full-slow.wav'] : []), ...data.phrases.map((_, i) => `phrase-${i + 1}.wav`), ...speechPhrases.filter(Boolean)];
      const files = [...wavs.map((w) => audioFile(id, w)), 'score.pdf', 'score.musicxml', ...Array.from({ length: data.pages || 1 }, (_, i) => `score-${i + 1}.svg`)];
      const rows = await Promise.all(files.map(async (f) => { try { const r = await fetch(abase + f, { method: 'HEAD' }); return [f, r.ok ? `${r.status} · ${(Number(r.headers.get('content-length')) / 1024).toFixed(0)} KB` : `HTTP ${r.status}`, r.ok]; } catch (err) { return [f, err.message, false]; } }));
      const bad = rows.filter((r) => !r[2]).length;
      diag.innerHTML = `<p>${rows.length} 个资源，${bad} 个失败。资源地址：${esc(ASSET_BASE)}${manifest?.version ? ` · 资源清单版本 ${esc(manifest.version)}` : ''}${hasVocal ? ` · 真人录音 ${esc(vi.performer)}${hasPhraseSegments ? '（已逐句分段）' : '（整曲参考）'}` : ''}</p><ul>${rows.map(([f, s, ok]) => `<li style="color:${ok ? 'inherit' : 'var(--red)'}">${esc(f)} — ${esc(s)}</li>`).join('')}</ul>`;
    });
  }

  /* ---- dark mode toggle ---- */
  const initTheme = () => {
    const saved = localStorage.getItem('aria-coach-theme');
    if (saved) document.documentElement.dataset.theme = saved;
    const btn = document.getElementById('themeBtn');
    if (!btn) return;
    const update = () => { const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme:dark)').matches); btn.textContent = dark ? '☀️' : '🌙'; };
    btn.onclick = () => { const cur = document.documentElement.dataset.theme; const next = cur === 'dark' ? 'light' : cur === 'light' ? '' : (matchMedia('(prefers-color-scheme:dark)').matches ? 'light' : 'dark'); if (next) { document.documentElement.dataset.theme = next; localStorage.setItem('aria-coach-theme', next); } else { delete document.documentElement.dataset.theme; localStorage.removeItem('aria-coach-theme'); } update(); };
    update(); matchMedia('(prefers-color-scheme:dark)').addEventListener('change', update);
  };

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    const app = $('#app'); const id = new URLSearchParams(location.search).get('id'); const back = $('#back');
    if (id) { if (back) { back.textContent = '← 曲目库'; back.href = './index.html'; } renderAria(app, id).catch((e) => { app.innerHTML = `<section class="card"><h2>页面出错</h2><p>${esc(e.message)}</p></section>`; }); }
    else { if (back) { back.textContent = 'Golden Sample · Caro mio ben'; back.href = './caro-mio-ben.html'; } renderCatalog(app).catch((e) => { app.innerHTML = `<section class="card"><h2>曲目库加载失败</h2><p>${esc(e.message)}</p></section>`; }); }
  });
})();
