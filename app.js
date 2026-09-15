const ASSET_PATH = './golden-assets/';
const PRACTICE_STORAGE_KEY = 'ai-aria-coach-practice-v1';
const FULL_LYRICS = 'Caro mio ben, credimi almen, senza di te languisce il cor. Il tuo fedel sospira ognor, cessa, crudel, tanto rigor!';
const INTERPRETATION = {
  short: '这是一个人在向爱人恳求：请相信我。没有你，我的心正在憔悴；请不要再这样冷酷。先听懂这份温柔而急切的请求，再把每个音节放到旋律上。',
  deep: '基调以 D 大调的明亮框架承载脆弱的请求。旋律常用级进和下行线条，让“相信我”“憔悴”“叹息”听起来像不断回落的心绪；长音把元音拉开，给恳求留下时间，短小的级进和装饰音则像说话时的犹疑与急切。',
  motif: '可先抓住一个听觉动机：从较高音向下级进，再回到稳定音。它在“Caro mio ben”和“senza di te”一类句子中反复出现，形成“请求—回落—再请求”的呼吸。演唱时不要把每个音当成孤立目标，要让级进保持一条语气线。'
};
const STATE = { notes: [], words: [], phraseIndex: 0, recorder: null, recordingUrl: null, practice: {} };
const $ = (selector) => document.querySelector(selector);
const safe = (value, fallback = '暂无数据') => typeof value === 'string' && value.trim() ? value : fallback;
let scoreRendererPromise;
function renderFormalScore(xml) {
  const host = $('#melodyLine');
  if (!host) return;
  host.classList.add('formal-score-host');
  host.innerHTML = '<img class="static-score" src="./golden-assets/caro-mio-ben-vocal-score.svg" alt="Caro mio ben 正式声乐五线谱">';
  return;
  if (!scoreRendererPromise) scoreRendererPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './vendor/osmd/opensheetmusicdisplay.min.js';
    script.onload = () => resolve(window.opensheetmusicdisplay?.OpenSheetMusicDisplay);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  scoreRendererPromise.then((OpenSheetMusicDisplay) => {
    if (!OpenSheetMusicDisplay) throw Error('正式谱面渲染器不可用');
    host.classList.add('formal-score-host');
    const osmd = new OpenSheetMusicDisplay(host, { autoResize: true, drawTitle: false, followCursor: false, backend: 'svg' });
    const typeByDuration = { '1':'16th', '2':'eighth', '3':'eighth', '4':'quarter', '8':'half', '16':'whole' };
    const normalizedXml = xml.replace(/<note\b[^>]*>[\s\S]*?<\/note>/g, (note) => {
      if (/<type>/.test(note) || !/<duration>\d+<\/duration>/.test(note)) return note;
      const duration = note.match(/<duration>(\d+)<\/duration>/)?.[1];
      return note.replace('</duration>', `</duration><type>${typeByDuration[duration] || 'quarter'}</type>`);
    });
    return osmd.load(normalizedXml).then(() => osmd.render());
  }).catch(() => {
    host.classList.remove('formal-score-host');
    host.querySelector('.score-loading')?.remove();
  });
}

const PHRASES = [
  { text: 'Caro mio ben', translation: '亲爱的，我的爱人', ipa: 'ˈka.ro ˈmi.o bɛn', measures: '第 4–5 小节', wordRange: [0, 3], noteIds: ['v_m4_n02', 'v_m4_n03', 'v_m4_n04', 'v_m5_n01'], task: '先听清四个音，再让每个音节落在对应音高上。' },
  { text: 'credimi almen', translation: '至少请相信我', ipa: 'ˈkre.di.mi alˈmɛn', measures: '第 5–6 小节', wordRange: [3, 5], noteIds: ['v_m5_n02', 'v_m5_n03', 'v_m5_n04', 'v_m6_n01'], task: '把短音节说清楚，最后一个长音不要提前收掉。' },
  { text: 'senza di te', translation: '没有你', ipa: 'ˈsɛn.tsa di te', measures: '第 6–7 小节', wordRange: [5, 8], noteIds: ['v_m6_n02', 'v_m6_n03', 'v_m6_n04', 'v_m7_n01'], task: '前三个短音保持连贯，把 te 稳稳放在长音上。' },
  { text: 'languisce il cor', translation: '我的心日渐憔悴', ipa: 'ˈlaŋ.ɡwi.ʃe il kɔr', measures: '第 7–8 小节', wordRange: [8, 11], noteIds: ['v_m7_n02', 'v_m7_g01', 'v_m7_g02', 'v_m7_n03', 'v_m7_n04', 'v_m8_n01', 'v_m8_n02'], task: '装饰音要轻，cor 的元音跨过两个音符保持连线。' }
  ,{ text: 'Il tuo fedel', translation: '你忠实的爱人', ipa: 'il ˈtu.o feˈdɛl', measures: '第 10–11 小节', wordRange: [11, 14], noteIds: ['v_m10_n01', 'v_m10_n02', 'v_m10_n03', 'v_m10_n04'], task: '让 Il tuo 的语气保持连贯，在 fedel 的长音上保持元音。' }
  ,{ text: 'sospira ognor', translation: '始终在叹息', ipa: 'soˈspi.ra oɲˈɲor', measures: '第 11 小节', wordRange: [14, 16], noteIds: ['v_m11_n01', 'v_m11_n02', 'v_m11_n03', 'v_m11_n04'], task: '叹息感来自气息线，不要把每个短音切成断句。' }
  ,{ text: 'cessa crudel', translation: '停止吧，残酷的人', ipa: 'ˈtʃɛs.sa kruˈdɛl', measures: '第 11–12 小节', wordRange: [16, 18], noteIds: ['v_m11_n05', 'v_m11_n06', 'v_m11_n07', 'v_m12_n01'], task: '先收住 cessa，再把 crudel 的重音放在第二音节。' }
  ,{ text: 'tanto rigor', translation: '如此严酷', ipa: 'ˈtan.to riˈɡor', measures: '第 12–15 小节', wordRange: [18, 20], noteIds: ['v_m12_n02', 'v_m12_n03', 'v_m12_n04', 'v_m15_n01'], task: '长音承载责问的重量，保持 tanto 与 rigor 的句末方向。' }
];

function parseMusicXml(xml) {
  const documentNode = new DOMParser().parseFromString(xml, 'application/xml');
  if (documentNode.querySelector('parsererror')) throw Error('MusicXML 解析失败');
  return [...documentNode.querySelectorAll('part[id="P1"] > measure')].flatMap((measure) => {
    let time = 0;
    return [...measure.querySelectorAll(':scope > note')].map((note) => {
      const duration = +(note.querySelector('duration')?.textContent || 0);
      const pitchNode = note.querySelector('pitch');
      const alter = +(pitchNode?.querySelector('alter')?.textContent || 0);
      const parsed = {
        id: note.id,
        measure: +measure.getAttribute('number'),
        beat: 1 + time / 4,
        duration,
        pitch: pitchNode ? `${pitchNode.querySelector('step').textContent}${alter === 1 ? '#' : alter === -1 ? 'b' : ''}${pitchNode.querySelector('octave').textContent}` : null,
        grace: Boolean(note.querySelector('grace')),
        lyric: note.querySelector('lyric text')?.textContent || ''
      };
      time += duration;
      return parsed;
    });
  });
}

function normalizeDiction(data) {
  if (!data || !Array.isArray(data.words)) throw Error('发音数据缺少规范单词层');
  return data.words.map((entry) => {
    const syllables = Array.isArray(entry.syllables) ? entry.syllables.map((syllable) => ({
      text: safe(syllable.text),
      ipa: safe(syllable.ipa),
      ids: Array.isArray(syllable.note_ids) ? syllable.note_ids : []
    })) : [];
    if (!syllables.length) throw Error(`${safe(entry.text)} 缺少音节映射`);
    return {
      word: safe(entry.text),
      ipa: safe(entry.ipa),
      translation: safe(entry.translation_zh),
      stress: safe(entry.stress_zh),
      syllables,
      ids: syllables.flatMap((syllable) => syllable.ids),
      syllable: syllables.map((syllable) => syllable.text).join('·')
    };
  });
}

function durationName(duration, grace) {
  if (grace) return '装饰音';
  return ({ 8: '二分音符', 4: '四分音符', 3: '附点八分音符', 2: '八分音符', 1: '十六分音符' })[duration] || '短音符';
}

function staffTop(note) {
  if (!note.pitch) return 57;
  const match = /^([A-G])(?:[#b]?)(\d)$/.exec(note.pitch);
  if (!match) return 57;
  const order = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  const diatonic = (+match[2] * 7) + order[match[1]];
  const e4 = (4 * 7) + order.E;
  return Math.max(8, Math.min(72, 62 - (diatonic - e4) * 5));
}

function renderStaff(notes, phraseNoteIds) {
  const chunkSize = 16;
  return Array.from({ length: Math.ceil(notes.length / chunkSize) }, (_, systemIndex) => {
    const chunk = notes.slice(systemIndex * chunkSize, (systemIndex + 1) * chunkSize);
    const noteMarkup = chunk.map((note, index) => {
      const left = 4 + (index * 92 / Math.max(1, chunk.length - 1));
      const active = phraseNoteIds.has(note.id) ? ' phrase-note' : ' other-note';
      const rest = note.pitch ? '' : ' rest-note';
      return `<button class="staff-note${active}${rest}" data-note="${note.id}" style="left:${left}%;top:${staffTop(note)}px" aria-label="${note.pitch || '休止'}，${durationName(note.duration, note.grace)}"><i></i><b>${note.pitch || '休'}</b><small>${durationName(note.duration, note.grace)}</small></button>`;
    }).join('');
    return `<div class="staff-system"><span class="staff-measure">${chunk[0]?.measure || ''}–${chunk[chunk.length - 1]?.measure || ''} 小节</span><div class="staff-lines"></div>${noteMarkup}</div>`;
  }).join('');
}

function pitchToFrequency(pitch) {
  const match = /^([A-G])([#b]?)(\d)$/.exec(pitch || '');
  if (!match) return null;
  const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  const midi = (+match[3] + 1) * 12 + semitones[match[1]] + accidental;
  return 440 * (2 ** ((midi - 69) / 12));
}

class AudioManager {
  constructor() {
    this.context = null;
    this.activeNodes = [];
    this.timers = [];
    this.media = null;
  }

  message(text) {
    const status = $('#recordStatus');
    status.hidden = false;
    status.textContent = text;
  }

  stop() {
    window.speechSynthesis?.cancel();
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.activeNodes.forEach((node) => { try { node.stop(); } catch {} });
    this.activeNodes = [];
    if (this.media) { this.media.pause(); this.media.currentTime = 0; this.media = null; }
    document.querySelectorAll('.playing').forEach((note) => note.classList.remove('playing'));
  }

  say(text, rate = 0.82) {
    this.stop();
    if (!window.speechSynthesis) return this.message('当前浏览器不支持 AI 语音范读');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT';
    utterance.rate = rate;
    utterance.onstart = () => this.message('AI 意大利语范读播放中');
    utterance.onend = () => this.message('播放完成');
    window.speechSynthesis.speak(utterance);
  }

  async playMelody(notes, withSyllables = false) {
    this.stop();
    const bpm = Number($('#tempoRange')?.value || 72);
    const secondsPerDivision = 60 / bpm / 4;
    const repeatCount = Math.max(1, Math.min(3, Number($('#repeatCount')?.value || 1)));
    let cursor = 0;
    Array.from({ length: repeatCount }, () => notes).flat().forEach((note) => {
      const noteLength = note.grace ? 0.1 : Math.max(0.12, note.duration * secondsPerDivision);
      const delay = Math.round(cursor * 1000);
      this.timers.push(setTimeout(() => highlightNote(note.id, true), delay));
      this.timers.push(setTimeout(() => highlightNote(note.id, false), delay + noteLength * 1000));
      cursor += noteLength;
    });
    let played = 0;
    const media = new Audio(`./golden-assets/audio/phrase-${STATE.phraseIndex + 1}.wav`);
    media.preload = 'auto'; media.volume = 1; media.playbackRate = bpm / 72; media.preservesPitch = true;
    media.onended = () => {
      played += 1;
      if (played < repeatCount) { media.currentTime = 0; media.play().catch(() => this.message('请再次点击播放以启用声音')); }
      else { this.media = null; this.message('旋律播放完成'); }
    };
    media.onerror = () => {
      this.media = null;
      this.message('音频文件不可用，已切换为浏览器音高合成');
      this.playSynth(notes, bpm);
    };
    this.media = media;
    await media.play().catch(() => { throw Error('浏览器阻止了声音播放，请再次点击按钮'); });
    this.message(`正在播放准确音高与节奏 · ${bpm} BPM · ${repeatCount} 遍`);
  }

  playSynth(notes, bpm = 72) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return this.message('当前浏览器不支持音频播放');
    this.context ||= new AudioContextClass();
    this.context.resume();
    const unit = 60 / bpm / 4;
    let cursor = this.context.currentTime + 0.05;
    notes.forEach((note) => {
      const hz = pitchToFrequency(note.pitch);
      const length = Math.max(0.12, Number(note.duration || 1) * unit);
      if (hz) {
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        osc.type = 'sine'; osc.frequency.value = hz;
        gain.gain.setValueAtTime(0.0001, cursor);
        gain.gain.exponentialRampToValueAtTime(0.16, cursor + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, cursor + length);
        osc.connect(gain).connect(this.context.destination); osc.start(cursor); osc.stop(cursor + length + 0.02); this.activeNodes.push(osc);
      }
      cursor += length;
    });
  }

  async playRhythmGuide(notes) {
    this.stop();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return this.message('当前浏览器不支持节拍训练');
    this.context ||= new AudioContextClass();
    await this.context.resume();
    const bpm = Number($('#tempoRange')?.value || 72);
    const secondsPerDivision = 60 / bpm / 4;
    const startAt = this.context.currentTime + 0.08;
    let cursor = 0;
    notes.forEach((note) => {
      const length = note.grace ? 0.08 : Math.max(0.1, note.duration * secondsPerDivision);
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = note.pitch ? 1050 : 650;
      gain.gain.setValueAtTime(0.18, startAt + cursor);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + cursor + 0.045);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(startAt + cursor);
      oscillator.stop(startAt + cursor + 0.05);
      this.activeNodes.push(oscillator);
      const delay = Math.round(cursor * 1000);
      this.timers.push(setTimeout(() => highlightNote(note.id, true), delay));
      this.timers.push(setTimeout(() => highlightNote(note.id, false), delay + length * 1000));
      cursor += length;
    });
    this.message(`按节拍读屏幕上的音节 · ${bpm} BPM`);
    this.timers.push(setTimeout(() => this.message('节奏跟读完成'), cursor * 1000 + 120));
  }

  playSingleNote(note) {
    this.stop();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const frequency = pitchToFrequency(note.pitch);
    if (!AudioContextClass || !frequency) return this.message('这是休止符，没有需要发声的音高');
    this.context ||= new AudioContextClass();
    this.context.resume();
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.24, this.context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + 0.62);
    oscillator.connect(gain).connect(this.context.destination); oscillator.start(); oscillator.stop(this.context.currentTime + 0.65);
    this.activeNodes.push(oscillator); highlightNote(note.id, true);
    this.timers.push(setTimeout(() => highlightNote(note.id, false), 620));
    this.message(`${note.pitch} · ${durationName(note.duration, note.grace)} · 单音试听`);
  }

  saySyllable(text, pitch) {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text.replace(/[~_-]/g, ' '));
    utterance.lang = 'it-IT';
    utterance.rate = 0.72;
    utterance.pitch = Math.max(0.55, Math.min(1.8, (pitchToFrequency(pitch) || 440) / 440));
    window.speechSynthesis.speak(utterance);
  }

  phrase(mode) {
    const phrase = PHRASES[STATE.phraseIndex];
    const notes = getPhraseNotes();
    if (mode === 'melody') {
      markPractice('melody');
      return this.playMelody(notes, false);
    }
    if (mode === 'rhythm') {
      markPractice('melody');
      return this.playRhythmGuide(notes);
    }
    markPractice('pronunciation');
    this.say(phrase.text, mode === 'slow' ? 0.24 : 0.82);
  }

  word(word) { this.say(word, 0.7); }

  fullLyrics() { this.markFullLyrics(); this.say(FULL_LYRICS, 0.78); }

  markFullLyrics() {
    try { localStorage.setItem('ai-aria-coach-full-lyrics-read-v1', '1'); } catch {}
  }
}

const audio = new AudioManager();

function getPhraseNotes() {
  const ids = new Set(PHRASES[STATE.phraseIndex].noteIds);
  return STATE.notes.filter((note) => ids.has(note.id));
}

function validatePhraseCoverage() {
  const noteIds = new Set(STATE.notes.map((note) => note.id));
  PHRASES.forEach((phrase) => {
    const words = STATE.words.slice(...phrase.wordRange);
    if (!words.length || words.map((word) => word.word).join(' ') !== phrase.text) {
      throw Error(`${phrase.text} 的歌词映射不完整`);
    }
    phrase.noteIds.forEach((noteId) => {
      if (!noteIds.has(noteId)) throw Error(`${phrase.text} 缺少乐谱音符 ${noteId}`);
    });
    words.flatMap((word) => word.syllables).forEach((syllable) => {
      if (!syllable.ids.length || syllable.ids.some((noteId) => !noteIds.has(noteId))) {
        throw Error(`${phrase.text} 的音节 ${syllable.text} 缺少音高映射`);
      }
    });
  });
}

function highlightNote(noteId, playing) {
  document.querySelectorAll(`[data-note="${noteId}"]`).forEach((element) => element.classList.toggle('playing', playing));
  document.querySelectorAll('[data-notes]').forEach((element) => {
    const ids = element.dataset.notes.split(',');
    if (ids.includes(noteId)) element.classList.toggle('playing', playing);
  });
  const guide = $('#melodyGuide');
  const note = STATE.notes.find((item) => item.id === noteId);
  if (guide && note && playing) {
    guide.querySelector('.guide-pitch').textContent = note.pitch || '休止';
    guide.querySelector('.guide-duration').textContent = durationName(note.duration, note.grace);
    guide.querySelector('.guide-measure').textContent = `第 ${note.measure} 小节 · 第 ${note.beat.toFixed(2)} 拍`;
  }
}

function loadPractice() {
  try {
    const value = JSON.parse(localStorage.getItem(PRACTICE_STORAGE_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function practiceKey() {
  return `caro-mio-ben:${STATE.phraseIndex + 1}`;
}

function currentPractice() {
  const record = STATE.practice[practiceKey()];
  return record && typeof record === 'object'
    ? record
    : { pronunciation: false, melody: false, recording: false, completedCount: 0 };
}

function savePractice() {
  try { localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(STATE.practice)); } catch {}
}

function markPractice(action) {
  const record = { ...currentPractice(), [action]: true };
  STATE.practice[practiceKey()] = record;
  savePractice();
  renderPractice();
}

function renderPractice() {
  const record = currentPractice();
  const items = [
    ['pronunciation', '听过本句发音'],
    ['melody', '听过本句旋律'],
    // 录音与评分不纳入学习记录；页面只记录是否听过发音和旋律。
  ];
  $('#practiceEvidence').innerHTML = items.map(([key, label]) => `<li class="${record[key] ? 'done' : ''}"><span>${record[key] ? '✓' : '○'}</span>${label}</li>`).join('');
  const completeButton = $('#completePractice');
  completeButton.disabled = !record.pronunciation || !record.melody;
  completeButton.textContent = record.completedCount ? '再完成一次本句练习' : '完成本句练习';
  $('#practiceHistory').textContent = record.completedCount
    ? `本句已完成 ${record.completedCount} 次，仅记录练习进度。`
    : '完成听读与旋律练习后即可记录进度。';
}

function renderPhrase() {
  const phrase = PHRASES[STATE.phraseIndex];
  const words = STATE.words.slice(...phrase.wordRange);
  const notes = STATE.notes;
  const phraseNoteIds = new Set(phrase.noteIds);
  $('#phraseKicker').textContent = `正在学习 · 第 ${STATE.phraseIndex + 1} / ${PHRASES.length} 乐句`;
  $('#phraseText').textContent = phrase.text;
  if (!document.querySelector('.phrase-nav-top')) {
    const topNav = document.createElement('div');
    topNav.className = 'phrase-nav phrase-nav-top';
    topNav.innerHTML = '<button data-nav="prev">← 上一句</button><button data-nav="next">下一句 →</button>';
    $('#phraseText').parentElement.insertBefore(topNav, $('#phraseText'));
    topNav.querySelector('[data-nav="prev"]').onclick = () => changePhraseGlobal(-1);
    topNav.querySelector('[data-nav="next"]').onclick = () => changePhraseGlobal(1);
  }
  $('#phraseTranslation').textContent = phrase.translation;
  $('#phraseIpa').textContent = '';
  $('#musicRange').textContent = `完整声乐谱 · 27 小节 · ${STATE.notes.length} 个音符事件。当前乐句音符会高亮，点击任意音符可查看音高与时值。`;
  if (!$('#learningFlow')) {
    const flow = document.createElement('div');
    flow.id = 'learningFlow';
    flow.className = 'learning-flow';
    flow.innerHTML = `<div><b>1</b><span><strong>听发音</strong><small>先听清词和音节</small></span></div><div><b>2</b><span><strong>按节拍读</strong><small>跟随节拍与高亮开口读</small></span></div><div><b>3</b><span><strong>听准旋律</strong><small>确认每个音的音高和时值</small></span></div><div><b>4</b><span><strong>对谱练唱</strong><small>把歌词放回正规五线谱</small></span></div>`;
    $('#musicRange').after(flow);
  }
  if (!$('#melodyGuide')) {
    const guide = document.createElement('div');
    guide.id = 'melodyGuide';
    guide.className = 'melody-guide';
    guide.innerHTML = '<div><span class="guide-label">跟着旋律读</span><strong class="guide-pitch">—</strong></div><div><small class="guide-duration">等待播放</small><small class="guide-measure">点击音符或开始播放</small></div>';
    $('#musicRange').after(guide);
  }
  $('#coachPhraseNumber').textContent = `第 ${STATE.phraseIndex + 1} 乐句`;
  $('#coachPhraseText').textContent = phrase.text;
  $('#practiceTask').textContent = phrase.task;
  $('#wordList').innerHTML = words.map((word, index) => `<article class="word-row"><div><h3>${word.word}</h3><div class="syllable-mark">${word.syllable}</div><p>${word.translation}</p></div><div class="word-side"><span class="stress">${word.stress}</span><button class="word-play" data-word-index="${index}" aria-label="播放 ${word.word}" title="播放单词">🔊</button></div></article>`).join('');
  document.querySelectorAll('.word-play').forEach((button) => { button.onclick = () => audio.word(words[+button.dataset.wordIndex].word); });
  $('#syllableStrip').innerHTML = words.flatMap((word) => word.syllables).map((syllable) => {
    const noteIds = syllable.ids.filter(Boolean);
    const pitches = noteIds.map((id) => STATE.notes.find((note) => note.id === id)?.pitch).filter(Boolean);
    const label = pitches.length ? `${syllable.text} · ${pitches.join(' → ')}` : syllable.text;
    return `<button class="syllable-chip" data-notes="${noteIds.join(',')}" aria-label="${syllable.text} 对应音高 ${pitches.join('、') || '暂无'}">${label}</button>`;
  }).join('');
  $('#melodyLine').innerHTML = renderStaff(notes, phraseNoteIds);
  if (STATE.scoreXml) renderFormalScore(STATE.scoreXml);
  if (!$('#printScore')) {
    const printButton = document.createElement('button');
    printButton.id = 'printScore';
    printButton.className = 'secondary print-score';
    printButton.textContent = '打开正规乐谱 / 下载 PDF';
    printButton.onclick = () => window.open('./score.html', '_blank', 'noopener');
    $('#melodyLine').after(printButton);
  }
  if (!$('#fullSong')) {
    const fullSong = document.createElement('button');
    fullSong.id = 'fullSong'; fullSong.className = 'secondary full-song';
    fullSong.textContent = '▶ 整曲试听（慢速）';
    fullSong.onclick = async () => {
      audio.stop();
      const media = new Audio('./golden-assets/audio/full.wav');
      media.playbackRate = Math.max(0.65, Number($('#tempoRange')?.value || 56) / 56);
      media.preload = 'auto';
      media.onerror = () => { audio.media = null; audio.message('整曲音频文件不可用，已切换为浏览器音高合成'); audio.playSynth(STATE.notes, Number($('#tempoRange')?.value || 56)); };
      audio.media = media;
      try { await media.play(); audio.message('正在播放整曲旋律 · 慢速练习'); } catch { audio.message('请再次点击按钮启用声音'); }
    };
    $('#melodyLine').after(fullSong);
  }
  document.querySelectorAll('[data-note], [data-notes]').forEach((element) => {
    element.onclick = () => {
      document.querySelectorAll('.selected').forEach((selected) => selected.classList.remove('selected'));
      const noteIds = element.dataset.notes ? element.dataset.notes.split(',').filter(Boolean) : [element.dataset.note];
      noteIds.forEach((noteId) => document.querySelectorAll(`[data-note="${noteId}"]`).forEach((match) => match.classList.add('selected')));
      element.classList.add('selected');
      const selectedNote = STATE.notes.find((note) => note.id === (element.dataset.note || noteIds[0]));
      if (selectedNote && $('#melodyGuide')) {
        $('#melodyGuide .guide-pitch').textContent = selectedNote.pitch || '休止';
        $('#melodyGuide .guide-duration').textContent = durationName(selectedNote.duration, selectedNote.grace);
        $('#melodyGuide .guide-measure').textContent = `第 ${selectedNote.measure} 小节 · 第 ${selectedNote.beat.toFixed(2)} 拍`;
      }
      if (selectedNote && element.matches('.staff-note')) audio.playSingleNote(selectedNote);
    };
  });
  $('#previousPhrase').disabled = false;
  $('#nextPhrase').disabled = false;
  $('#previousPhrase').textContent = STATE.phraseIndex === 0 ? '回到最后一句 ←' : '← 上一句';
  $('#nextPhrase').textContent = STATE.phraseIndex === PHRASES.length - 1 ? '从第一句开始 →' : '下一句 →';
  renderPractice();
  audio.message(`第 ${STATE.phraseIndex + 1} 乐句已载入`);
}

function changePhraseGlobal(direction) {
  const nextIndex = (STATE.phraseIndex + direction + PHRASES.length) % PHRASES.length;
  audio.stop();
  STATE.phraseIndex = nextIndex;
  renderPhrase();
  updatePhraseDock();
  window.scrollTo({ top: document.querySelector('.workspace-nav')?.offsetTop || 0, behavior: 'smooth' });
}

function updatePhraseDock() {
  const dock = $('#phraseDock');
  if (!dock) return;
  const phrase = PHRASES[STATE.phraseIndex];
  dock.querySelector('.dock-count').textContent = `${STATE.phraseIndex + 1} / ${PHRASES.length}`;
  dock.querySelector('.dock-title').textContent = phrase.text;
}

function setupWorkspace() {
  const learning = $('#learn');
  const content = learning?.querySelector('.content');
  if (!learning || !content || $('.workspace-nav')) return;
  const phraseHero = $('.phrase-hero');
  const practice = $('.practice-section');
  phraseHero.id = 'phraseStudy';
  practice.id = 'practicePanel';

  const nav = document.createElement('nav');
  nav.className = 'workspace-nav';
  nav.setAttribute('aria-label', '学习视图');
  nav.innerHTML = `<button data-view="study" class="active">歌词与正式乐谱</button><button data-view="story">剧情与完整歌词</button>`;
  learning.before(nav);

  const views = {
    study: [phraseHero, $('#diction'), $('#music'), practice],
    story: [$('#context'), $('#interpretationCard'), $('#ariaCatalog'), $('#fullLyricsCard')]
  };
  [phraseHero, $('#diction'), $('#music'), practice, $('#context'), $('#interpretationCard'), $('#fullLyricsCard')]
    .filter(Boolean).forEach((section) => content.appendChild(section));
  const activate = (name) => {
    Object.values(views).flat().filter(Boolean).forEach((section) => { section.hidden = true; });
    (views[name] || views.study).filter(Boolean).forEach((section) => { section.hidden = false; });
    nav.querySelectorAll('button').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
    document.body.dataset.view = name;
    window.scrollTo({ top: Math.max(0, nav.offsetTop - 12), behavior: 'smooth' });
  };
  nav.querySelectorAll('button').forEach((button) => { button.onclick = () => activate(button.dataset.view); });

  const dock = document.createElement('div');
  dock.id = 'phraseDock';
  dock.className = 'phrase-dock';
  dock.innerHTML = `<button class="dock-arrow" data-direction="-1" aria-label="上一句">← 上一句</button><div><small class="dock-count"></small><strong class="dock-title"></strong></div><button class="dock-play" data-dock-audio="normal">▶ 范读</button><button class="dock-arrow" data-direction="1" aria-label="下一句">下一句 →</button>`;
  document.body.appendChild(dock);
  dock.querySelectorAll('[data-direction]').forEach((button) => { button.onclick = () => changePhraseGlobal(Number(button.dataset.direction)); });
  dock.querySelector('[data-dock-audio]').onclick = () => audio.phrase('normal');
  updatePhraseDock();
  activate('study');
  window.addEventListener('keydown', (event) => {
    if (event.target.matches('input,select,textarea,button')) return;
    if (event.key === 'ArrowLeft') changePhraseGlobal(-1);
    if (event.key === 'ArrowRight') changePhraseGlobal(1);
    if (event.code === 'Space') { event.preventDefault(); audio.phrase('melody'); }
  });
}

function setupNavigation() {
  const changePhrase = (direction) => {
    changePhraseGlobal(direction);
  };
  $('#previousPhrase').onclick = () => changePhrase(-1);
  $('#nextPhrase').onclick = () => changePhrase(1);
}

function renderProvenance() {
  if ($('#provenanceCard')) return;
  const meta = STATE.dictionMeta || {};
  const card = document.createElement('section');
  card.id = 'provenanceCard';
  card.className = 'section-block provenance-card';
  card.innerHTML = `<div class="section-title"><div><p class="eyebrow">内容可信度</p><h2>来源与审核状态</h2></div><span class="state verified">可追溯</span></div><div class="provenance-list"><div><strong>旋律音高与时值</strong><span class="green">曲谱数据 · MusicXML</span><small>来自 Golden Sample 原始文件；音节映射使用 note_ids。</small></div><div><strong>意大利语 IPA</strong><span class="amber">${meta.ipa_status === 'reviewed' ? '已专业审核' : '草稿 · 待教师复核'}</span><small>当前版本：${meta.version || '未标注'}；不生成未经依据的发音评分。</small></div><div><strong>范读音频</strong><span class="gray">浏览器 it-IT 语音</span><small>系统语音仅作语言参考，不冒充真人演唱录音。</small></div></div>`;
  $('#diction')?.after(card);
}

function renderFullLyrics() {
  if ($('#fullLyricsCard')) return;
  const card = document.createElement('section');
  card.id = 'fullLyricsCard';
  card.className = 'section-block full-lyrics-card';
  card.innerHTML = `<div class="section-title"><div><p class="eyebrow">完整歌词</p><h2>先整体听懂这段话</h2></div><span class="state verified">完整声乐谱</span></div><p class="full-lyrics-italian">${FULL_LYRICS}</p><p class="full-lyrics-translation">亲爱的，请至少相信我；没有你，我的心在憔悴。你的忠实之人一直在叹息；残酷的人啊，请停止这样的严酷！</p><button class="wide-audio secondary" id="fullLyricsAudio"><span>▶</span> AI 通读完整歌词</button><small class="coverage-note">完整声乐轨道已扩展至终止小节；当前歌词映射覆盖主段落，重复段落保留原谱音符以便后续练习模式扩展。</small></section>`;
  $('#context')?.after(card);
  $('#fullLyricsAudio').onclick = () => audio.fullLyrics();
}

function renderInterpretation() {
  if ($('#interpretationCard')) return;
  const card = document.createElement('section');
  card.id = 'interpretationCard';
  card.className = 'section-block interpretation-card';
  card.innerHTML = `<div class="section-title"><div><p class="eyebrow">作品解读</p><h2>把咏叹调听活</h2></div><span class="state verified">学习辅助</span></div><div class="interpretation-grid"><article><h3>30 秒白话版</h3><p>${INTERPRETATION.short}</p></article><article><h3>基调与情绪弧线</h3><p>${INTERPRETATION.deep}</p></article><article><h3>动机与演唱提示</h3><p>${INTERPRETATION.motif}</p></article></div><details class="opera-context"><summary>展开：从歌剧舞台到课堂</summary><p>这首作品常被当作独立的古典声乐曲目学习。课堂上可以把它当成一个极简的戏剧场景：人物不移动，冲突集中在“我请求、你却迟疑”的关系里。先用一句话说清人物和请求，再回到歌词重音、音高方向和长音时值，音乐就不会只剩下音符。</p></details></section>`;
  $('#fullLyricsCard')?.after(card);
  const catalog = document.createElement('section');
  catalog.id = 'ariaCatalog'; catalog.className = 'section-block aria-catalog';
  catalog.innerHTML = `<div class="section-title"><div><p class="eyebrow">咏叹调学习库</p><h2>继续学习其他曲目</h2></div><span class="state verified">原谱优先</span></div><p>每首曲目都使用与本页相同的两页结构：① 歌词与正式乐谱、② 情境、剧情与完整歌词。<a class="catalog-link" href="./index.html">打开曲目库首页（搜索、声部筛选与推荐）→</a></p><div class="catalog-grid" id="catalogGrid"><p class="catalog-empty">正在载入曲目…</p></div>`;
  card.after(catalog);
  const grid = catalog.querySelector('#catalogGrid');
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  fetch('./golden-assets/arias/catalog.json').then((r) => r.json()).then((list) => {
    grid.innerHTML = list.map((a) => `<a class="catalog-card active" href="./aria-library.html?id=${esc(a.id)}"><strong>${esc(a.title)}</strong><span>${esc(a.composer)} · ${esc(a.language)} · ${esc(a.voice)}</span><b>${esc(a.sourceStatus)}</b><small>难度：${esc(a.difficulty)}</small></a>`).join('') || '<p class="catalog-empty">曲目库暂无已开放曲目。</p>';
  }).catch(() => { grid.innerHTML = '<p class="catalog-empty">曲目列表加载失败，请稍后重试或直接打开曲目库页面。</p>'; });
}

function setupTransport() {
  const range = $('#tempoRange');
  const output = $('#tempoValue');
  const stop = $('#stopAudio');
  if (stop && !$('#repeatCount')) {
    const label = document.createElement('label');
    label.className = 'repeat-control';
    label.htmlFor = 'repeatCount';
    label.innerHTML = '重复 <select id="repeatCount"><option value="1">1 遍</option><option value="2">2 遍</option><option value="3">3 遍</option></select>';
    stop.parentElement.insertBefore(label, stop);
  }
  if (range && output) {
    range.min = '48'; range.max = '108'; range.value = '72'; range.step = '4';
    output.value = '72 BPM'; output.textContent = '72 BPM';
    range.oninput = () => { output.value = `${range.value} BPM`; output.textContent = `${range.value} BPM`; };
  }
  document.querySelectorAll('[data-audio="melody"]').forEach((button) => { button.innerHTML = '<span>▶</span> 听准确旋律'; });
  document.querySelectorAll('[data-audio="rhythm"]').forEach((button) => { button.innerHTML = '<span>♪</span> 按节拍读歌词'; });
  if (stop) stop.onclick = () => { audio.stop(); audio.message('播放已停止'); };
  if (stop && !$('#loopPhrase')) {
    const loop = document.createElement('button');
    loop.id = 'loopPhrase'; loop.className = 'secondary'; loop.type = 'button'; loop.textContent = '↻ 循环本句';
    loop.onclick = () => { const select = $('#repeatCount'); if (select) select.value = select.value === '3' ? '1' : String(Number(select.value) + 1); audio.phrase('melody'); };
    stop.parentElement.appendChild(loop);
  }
}

function setupRecording() {
  const buttons = [$('#recordBtn'), $('#coachRecord'), $('#practiceRecord')].filter(Boolean);
  buttons.forEach((button) => {
    button.onclick = async () => {
      if (STATE.recordingUrl) return new Audio(STATE.recordingUrl).play();
      if (STATE.recorder?.state === 'recording') return STATE.recorder.stop();
      if (!navigator.mediaDevices?.getUserMedia) return audio.message('当前浏览器不支持录音');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = [];
        STATE.recorder = new MediaRecorder(stream);
        STATE.recorder.ondataavailable = (event) => chunks.push(event.data);
        STATE.recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          STATE.recordingUrl = URL.createObjectURL(new Blob(chunks, { type: 'audio/webm' }));
          audio.message('录音完成，可播放自己的录音');
          markPractice('recording');
          buttons.forEach((item) => { item.innerHTML = '▶ 播放我的录音'; });
        };
        STATE.recorder.start();
        audio.message('正在录音，再次点击结束');
        buttons.forEach((item) => { item.innerHTML = '■ 结束录音'; });
      } catch { audio.message('麦克风权限未开启，无法录音'); }
    };
  });
}

function setupPractice() {
  $('#completePractice').onclick = () => {
    const record = currentPractice();
    if (!record.pronunciation || !record.melody) return;
    STATE.practice[practiceKey()] = {
      ...record,
      completedCount: (Number(record.completedCount) || 0) + 1,
      lastCompletedAt: new Date().toISOString()
    };
    savePractice();
    renderPractice();
  };
}

async function boot() {
  try {
    const [scoreResponse, dictionResponse] = await Promise.all([
      fetch(`${ASSET_PATH}caro-mio-ben-vocal-golden-sample-v1.musicxml`),
      fetch(`${ASSET_PATH}caro-mio-ben-diction-draft-v1.json`)
    ]);
    if (!scoreResponse.ok || !dictionResponse.ok) throw Error('Golden Sample 文件读取失败');
    STATE.scoreXml = await scoreResponse.text();
    STATE.notes = parseMusicXml(STATE.scoreXml);
    const dictionData = await dictionResponse.json();
    STATE.dictionMeta = dictionData;
    STATE.words = normalizeDiction(dictionData);
    STATE.practice = loadPractice();
    if (STATE.notes.length < 100 || STATE.words.length !== 20) throw Error('核心学习数据不完整');
    validatePhraseCoverage();
    renderPhrase();
    renderFullLyrics();
    renderInterpretation();
    setupWorkspace();
    setupNavigation();
    setupTransport();
    // 不启用真人录音：本工具只提供浏览器意大利语范读与音高参考。
    setupPractice();
    document.querySelectorAll('#recordBtn,#practiceRecord,#coachRecord').forEach((node) => node.remove());
    document.querySelectorAll('[data-audio]').forEach((button) => { button.onclick = () => audio.phrase(button.dataset.audio); });
    window.__ariaBootReady = true;
  } catch (error) {
    $('#error').hidden = false;
    $('#error').textContent = `学习数据暂时无法载入：${error.message}`;
    window.__ariaBootError = error.message;
  }
}

boot();

// Always expose the deployed build so a stale Netlify folder is immediately visible.
const buildBadge = document.createElement('span');
buildBadge.className = 'build-version';
buildBadge.textContent = '学习库 v15';
document.querySelector('.topbar')?.appendChild(buildBadge);
