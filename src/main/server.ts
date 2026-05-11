import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import os from 'os'
import { store } from './settings'
import { agent } from './agent/index'

const PORT = 3747

export function getLocalIP(): string {
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return 'localhost'
}

function getMobileHTML(): string {
  const elevenLabsKey = (store.get('elevenLabsApiKey') as string) || ''
  const elevenLabsVoice = (store.get('elevenLabsVoiceId') as string) || '21m00Tcm4TlvDq8ikWAM'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
<meta name="theme-color" content="#00060f"/>
<title>J.A.R.V.I.S</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
:root{
  --c:#06b6d4;--cb:#22d3ee;--bg:#00060f;
  --bg1:#040e22;--bg2:#0a1628;--bg3:#0f1e35;
  --text:#e2f4ff;--text2:#5a8fa8;--text3:#2e5a70;
  --r:14px;--font:system-ui,-apple-system,sans-serif;
}
html,body{width:100%;height:100%;background:var(--bg);font-family:var(--font);color:var(--text);overflow:hidden;user-select:none}
#app{display:flex;flex-direction:column;height:100vh;background:radial-gradient(ellipse at 50% 40%,rgba(4,30,70,0.95) 0%,#00060f 70%)}

/* ── HUD ── */
#hud-wrap{flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:12px 0 4px}
#hud{width:min(72vw,300px);height:min(72vw,300px)}

/* ── Status ── */
#status{text-align:center;font-size:11px;letter-spacing:0.2em;color:var(--text2);text-transform:uppercase;min-height:18px;padding:2px 0 8px;transition:color 0.3s}
#status.listening{color:var(--cb)}
#status.thinking{color:#a78bfa}
#status.speaking{color:#34d399}

/* ── Chat ── */
#chat{flex:1;min-height:0;overflow-y:auto;padding:8px 14px;display:flex;flex-direction:column;gap:8px;scrollbar-width:none}
#chat::-webkit-scrollbar{display:none}
.msg{display:flex;flex-direction:column;gap:2px}
.msg--user{align-items:flex-end}
.msg--assistant{align-items:flex-start}
.msg__bubble{
  max-width:85%;padding:9px 13px;border-radius:16px;
  font-size:14px;line-height:1.5;word-break:break-word;
}
.msg--user .msg__bubble{background:linear-gradient(135deg,#0e7490,#0891b2);color:#fff;border-bottom-right-radius:4px}
.msg--assistant .msg__bubble{background:var(--bg3);color:#a8d4e6;border:1px solid rgba(6,182,212,0.15);border-bottom-left-radius:4px}
.cursor{display:inline-block;animation:blink 0.9s step-end infinite;color:var(--cb)}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}

/* ── Empty ── */
#empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;color:var(--text3);font-size:13px;text-align:center;padding:20px}
#empty b{color:var(--cb);font-size:15px;display:block;margin-bottom:4px}

/* ── Input area ── */
#input-area{flex-shrink:0;padding:10px 12px 20px;border-top:1px solid rgba(6,182,212,0.1);background:rgba(4,14,34,0.95)}
#thinking-bar{display:none;align-items:center;gap:8px;font-size:11px;color:var(--text2);padding:0 2px 8px}
#thinking-bar.show{display:flex}
.dot-anim{display:flex;gap:3px}
.dot-anim span{width:4px;height:4px;border-radius:50%;background:var(--cb);display:inline-block;animation:bounce 1.2s ease-in-out infinite}
.dot-anim span:nth-child(2){animation-delay:.2s}
.dot-anim span:nth-child(3){animation-delay:.4s}
@keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}
#row{display:flex;gap:8px;align-items:flex-end}
#mic{width:44px;height:44px;border-radius:50%;background:var(--bg3);border:1px solid rgba(6,182,212,0.2);color:var(--cb);font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all .2s}
#mic.active{background:rgba(6,182,212,.15);border-color:var(--cb);box-shadow:0 0 20px rgba(6,182,212,.5);animation:mpulse 1.5s ease-in-out infinite}
@keyframes mpulse{0%,100%{box-shadow:0 0 12px rgba(6,182,212,.3)}50%{box-shadow:0 0 28px rgba(6,182,212,.7)}}
#msg-input{flex:1;background:var(--bg3);border:1px solid rgba(6,182,212,.18);border-radius:10px;color:var(--text);font-family:var(--font);font-size:14px;padding:10px 12px;outline:none;resize:none;max-height:90px;line-height:1.4;-webkit-appearance:none}
#msg-input::placeholder{color:var(--text3)}
#send{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#0e7490,#0891b2);border:none;color:#fff;font-size:18px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;box-shadow:0 0 14px rgba(6,182,212,.3);transition:all .15s}
#send:disabled{opacity:.3;box-shadow:none}
</style>
</head>
<body>
<div id="app">
  <div id="hud-wrap"><canvas id="hud"></canvas></div>
  <div id="status">say "hey jarvis" or type below</div>
  <div id="chat"><div id="empty"><b>J.A.R.V.I.S</b>Your AI assistant is ready.<br/>Speak or type a message.</div></div>
  <div id="input-area">
    <div id="thinking-bar"><div class="dot-anim"><span></span><span></span><span></span></div>Jarvis is thinking…</div>
    <div id="row">
      <button id="mic">🎤</button>
      <textarea id="msg-input" placeholder="Message Jarvis…" rows="1"></textarea>
      <button id="send" disabled>↑</button>
    </div>
  </div>
</div>

<script>
const ELEVEN_KEY   = ${JSON.stringify(elevenLabsKey)};
const ELEVEN_VOICE = ${JSON.stringify(elevenLabsVoice)};
const WS_URL       = 'ws://' + location.host;

// ── WebSocket ──────────────────────────────────────────────────────────────
let ws, reconnectTimer;
let currentBubble = null;
let streamText = '';
let audioCtx = null;

function connect() {
  ws = new WebSocket(WS_URL);
  ws.onopen  = () => console.log('WS connected');
  ws.onclose = () => { reconnectTimer = setTimeout(connect, 2000); };
  ws.onerror = (e) => console.error('WS error', e);
  ws.onmessage = (e) => handleEvent(JSON.parse(e.data));
}
connect();

// ── State ──────────────────────────────────────────────────────────────────
let state = 'idle'; // idle | listening | thinking | speaking
const statusEl   = document.getElementById('status');
const thinkingEl = document.getElementById('thinking-bar');
const micBtn     = document.getElementById('mic');
const chatEl     = document.getElementById('chat');
const emptyEl    = document.getElementById('empty');
const inputEl    = document.getElementById('msg-input');
const sendBtn    = document.getElementById('send');

function setState(s) {
  state = s;
  statusEl.className = s;
  statusEl.textContent =
    s === 'idle'      ? 'say "hey jarvis" or type below' :
    s === 'listening' ? '● listening…' :
    s === 'thinking'  ? '⟳ processing…' :
    s === 'speaking'  ? '◆ speaking…' : '';
  thinkingEl.className = s === 'thinking' ? 'show' : '';
  micBtn.className = s === 'listening' ? 'active' : '';
}

// ── Chat UI ────────────────────────────────────────────────────────────────
function hideEmpty() {
  if (emptyEl) emptyEl.style.display = 'none';
}

function addMessage(role, text, streaming) {
  hideEmpty();
  const div = document.createElement('div');
  div.className = 'msg msg--' + role;
  const bubble = document.createElement('div');
  bubble.className = 'msg__bubble';
  bubble.innerHTML = streaming ? '<span class="cursor">▋</span>' : escHtml(text);
  div.appendChild(bubble);
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return bubble;
}

function escHtml(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br/>');
}

// ── Agent events ───────────────────────────────────────────────────────────
function handleEvent(ev) {
  if (ev.type === 'text_delta') {
    if (!currentBubble) {
      currentBubble = addMessage('assistant', '', true);
      streamText = '';
    }
    streamText += ev.text;
    currentBubble.innerHTML = escHtml(streamText) + '<span class="cursor">▋</span>';
    chatEl.scrollTop = chatEl.scrollHeight;
  } else if (ev.type === 'done') {
    if (currentBubble) {
      currentBubble.innerHTML = escHtml(streamText);
      currentBubble = null;
    }
    setState('idle');
    if (ev.fullText) speakText(ev.fullText);
  } else if (ev.type === 'error') {
    if (currentBubble) { currentBubble.innerHTML = '⚠️ ' + escHtml(ev.message); currentBubble = null; }
    setState('idle');
  }
}

// ── Send message ───────────────────────────────────────────────────────────
function sendMessage(text) {
  if (!text.trim() || state === 'thinking') return;
  addMessage('user', text);
  setState('thinking');
  currentBubble = null;
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ message: text }));
}

sendBtn.onclick = () => { sendMessage(inputEl.value); inputEl.value = ''; sendBtn.disabled = true; };
inputEl.oninput = () => { sendBtn.disabled = !inputEl.value.trim(); inputEl.style.height = 'auto'; inputEl.style.height = Math.min(inputEl.scrollHeight, 90) + 'px'; };
inputEl.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputEl.value); inputEl.value = ''; sendBtn.disabled = true; inputEl.style.height = 'auto'; } };

// ── Voice input ────────────────────────────────────────────────────────────
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let wakeRecognition = null;

function startListening() {
  if (!SR) return alert('Speech recognition not supported on this browser. Try Chrome.');
  if (state !== 'idle') return;
  setState('listening');
  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (e) => {
    const t = e.results[0]?.[0]?.transcript?.trim();
    if (t) sendMessage(t);
  };
  recognition.onerror = () => setState('idle');
  recognition.onend   = () => { if (state === 'listening') setState('idle'); startWakeWord(); };
  recognition.start();
}

micBtn.onclick = () => {
  if (state === 'listening') { recognition?.stop(); setState('idle'); }
  else startListening();
};

// ── Wake word loop ─────────────────────────────────────────────────────────
const WAKE = ['hey jarvis','jarvis','yo jarvis','ok jarvis'];
function startWakeWord() {
  if (!SR) return;
  wakeRecognition = new SR();
  wakeRecognition.lang = 'en-US';
  wakeRecognition.continuous = false;
  wakeRecognition.interimResults = false;
  wakeRecognition.maxAlternatives = 3;
  wakeRecognition.onresult = (e) => {
    const transcripts = [];
    for (let i=0;i<e.results.length;i++) for (let j=0;j<e.results[i].length;j++) transcripts.push(e.results[i][j].transcript.toLowerCase().trim());
    const hit = transcripts.find(t => WAKE.some(w => t.includes(w)));
    if (!hit) return;
    const cmd = WAKE.reduce((s,w) => s.replace(w,''), hit).replace(/^[,. ]+/,'').trim();
    if (cmd.length > 2) sendMessage(cmd);
    else startListening();
  };
  wakeRecognition.onerror = () => {};
  wakeRecognition.onend = () => { if (state === 'idle') setTimeout(startWakeWord, 200); };
  try { wakeRecognition.start(); } catch {}
}
setTimeout(startWakeWord, 1000);

// ── TTS ────────────────────────────────────────────────────────────────────
async function speakText(text) {
  setState('speaking');
  if (ELEVEN_KEY) {
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + ELEVEN_VOICE + '/stream', {
        method:'POST',
        headers:{'xi-api-key':ELEVEN_KEY,'Content-Type':'application/json',Accept:'audio/mpeg'},
        body:JSON.stringify({text,model_id:'eleven_turbo_v2_5',voice_settings:{stability:.48,similarity_boost:.78,style:.12,use_speaker_boost:true}})
      });
      if (res.ok) {
        if (!audioCtx) audioCtx = new AudioContext();
        const buf = await res.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(buf);
        const src = audioCtx.createBufferSource();
        src.buffer = decoded;
        src.connect(audioCtx.destination);
        src.onended = () => { setState('idle'); startWakeWord(); };
        src.start(0);
        return;
      }
    } catch(err) { console.warn('ElevenLabs failed, falling back', err); }
  }
  const utt = new SpeechSynthesisUtterance(text);
  utt.onend = () => { setState('idle'); startWakeWord(); };
  speechSynthesis.speak(utt);
}

// ── HUD canvas ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('hud');
const ctx    = canvas.getContext('2d');
let frame = 0;

function resizeCanvas() {
  const size = Math.min(canvas.offsetWidth, canvas.offsetHeight);
  canvas.width  = size * devicePixelRatio;
  canvas.height = size * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function drawHUD() {
  const t  = frame++ * 0.014;
  const W  = canvas.offsetWidth, H = canvas.offsetHeight;
  const cx = W/2, cy = H/2, R = Math.min(W,H)*0.44;
  const active = state !== 'idle';
  const C = '#06b6d4', CB = '#22d3ee';
  function hex(a){return 'rgba(6,182,212,'+a+')';}

  ctx.clearRect(0,0,W,H);

  // bg glow
  const bg = ctx.createRadialGradient(cx,cy,0,cx,cy,R*1.3);
  bg.addColorStop(0,'rgba(4,24,50,0.8)'); bg.addColorStop(1,'rgba(0,4,16,0)');
  ctx.beginPath(); ctx.arc(cx,cy,R*1.3,0,Math.PI*2); ctx.fillStyle=bg; ctx.fill();

  function arc(r,a1,a2,alpha,w){
    ctx.beginPath(); ctx.arc(cx,cy,r,a1,a2);
    ctx.strokeStyle=C; ctx.lineWidth=w||1.5; ctx.globalAlpha=alpha; ctx.stroke(); ctx.globalAlpha=1;
  }
  function garc(r,a1,a2,alpha,w,blur){
    ctx.save(); ctx.shadowBlur=blur; ctx.shadowColor=CB; arc(r,a1,a2,alpha,w); ctx.restore();
  }
  function dots(r,n,w,h,alpha,off=0){
    ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=C;
    for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2+off; ctx.save(); ctx.translate(cx+Math.cos(a)*r,cy+Math.sin(a)*r); ctx.rotate(a); ctx.fillRect(-w/2,-h/2,w,h); ctx.restore();}
    ctx.restore();
  }
  function ticks(r,n,len,alpha,w=1,off=0){
    ctx.save(); ctx.strokeStyle=C; ctx.lineWidth=w; ctx.globalAlpha=alpha;
    for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2+off; const cos=Math.cos(a),sin=Math.sin(a); ctx.beginPath(); ctx.moveTo(cx+cos*r,cy+sin*r); ctx.lineTo(cx+cos*(r+len),cy+sin*(r+len)); ctx.stroke();}
    ctx.restore();
  }

  // rings
  for(let i=0;i<10;i++){const a=(i/10)*Math.PI*2-t*.3; arc(R*.97,a,a+Math.PI*.19,active?.32:.12,1);}
  ticks(R*.89,72,5,active?.45:.2,1); ticks(R*.89,12,11,active?.65:.3,1.5);
  dots(R*.83,64,2.5,5,active?.5:.2);
  dots(R*.77,40,3,6,active?.4:.15,t*.2);
  for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2+t*.5; arc(R*.73,a,a+Math.PI*.19,active?.5:.18,1.5);}
  ticks(R*.67,48,4,active?.35:.15,1,t*.15); ticks(R*.67,8,9,active?.55:.25,1.5,t*.15);
  arc(R*.61,0,Math.PI*2,active?.45:.18,1.5);

  // waveform
  const wR=R*.54;
  if(active){
    ctx.beginPath();
    for(let i=0;i<=160;i++){
      const angle=(i/160)*Math.PI*2-Math.PI/2;
      let amp=0;
      if(state==='listening') amp=(Math.sin(i*.5+t*5)*.6+Math.sin(i*1.1+t*3)*.4)*wR*.1;
      else if(state==='speaking') amp=(Math.sin(i*.4+t*6)*.7+Math.sin(i*.8+t*4)*.3)*wR*.12;
      else amp=Math.sin(i*.3+t*2)*wR*.04;
      const r=wR+amp;
      i===0?ctx.moveTo(cx+Math.cos(angle)*r,cy+Math.sin(angle)*r):ctx.lineTo(cx+Math.cos(angle)*r,cy+Math.sin(angle)*r);
    }
    ctx.closePath();
    ctx.save(); ctx.shadowBlur=12; ctx.shadowColor=CB; ctx.strokeStyle=CB; ctx.lineWidth=2; ctx.globalAlpha=.8; ctx.stroke(); ctx.restore();
  } else {
    arc(wR,0,Math.PI*2,.18,1);
  }

  // rotating accents
  garc(R*.61,t*1.2,t*1.2+Math.PI*.4,active?.9:.35,2.5,16);
  garc(R*.61,t*1.2+Math.PI,t*1.2+Math.PI*1.3,active?.65:.25,2,12);
  garc(R*.73,-t*.8,-t*.8+Math.PI*.3,active?.75:.25,2,14);
  garc(R*.83,t*.5,t*.5+Math.PI*.22,active?.55:.18,1.5,10);

  // inner glow fill
  const ig=ctx.createRadialGradient(cx,cy,0,cx,cy,wR*.84);
  ig.addColorStop(0,'rgba(6,182,212,.1)'); ig.addColorStop(1,'rgba(6,182,212,0)');
  ctx.beginPath(); ctx.arc(cx,cy,wR*.84,0,Math.PI*2); ctx.fillStyle=ig; ctx.fill();
  ctx.save(); ctx.shadowBlur=active?20:8; ctx.shadowColor=C; arc(wR*.84,0,Math.PI*2,active?.65:.25,active?2:1); ctx.restore();

  // center dot
  const dr=active?5+Math.sin(t*4)*1.5:4;
  ctx.save(); ctx.shadowBlur=active?24:10; ctx.shadowColor=CB;
  ctx.beginPath(); ctx.arc(cx,cy,dr,0,Math.PI*2); ctx.fillStyle=CB; ctx.globalAlpha=active?1:.45; ctx.fill(); ctx.restore();

  // J.A.R.V.I.S text
  const fs=Math.max(10,R*.11);
  ctx.save(); ctx.shadowBlur=active?18:8; ctx.shadowColor=C;
  ctx.font='600 '+fs+'px system-ui,sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle=active?CB:hex(.45); ctx.globalAlpha=active?.95:.45;
  ctx.fillText('J.A.R.V.I.S',cx,cy-dr-2); ctx.restore();

  requestAnimationFrame(drawHUD);
}
drawHUD();
</script>
</body>
</html>`
}

let serverURL = ''

export function startMobileServer(): string {
  const server = http.createServer((req, res) => {
    // refresh settings on each request so key changes are picked up
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    })
    res.end(getMobileHTML())
  })

  const wss = new WebSocketServer({ server })

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', async (data) => {
      try {
        const { message } = JSON.parse(data.toString())
        if (!message) return
        await agent.chat(message, (event) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(event))
          }
        })
      } catch (err: any) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: err.message }))
        }
      }
    })
  })

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Jarvis mobile server running on port ${PORT}`)
  })

  serverURL = `http://${getLocalIP()}:${PORT}`
  return serverURL
}

export function getMobileServerURL(): string {
  return serverURL
}
