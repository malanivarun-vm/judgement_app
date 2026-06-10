// screens-v2.jsx — Home, Lobby, RoundEnd, GameOver screens

const CV = {
  bg:'#0A1C13', bgLight:'#1A4B33', bgDeep:'#060e09',
  surface:'rgba(8,22,15,0.80)', glass:'rgba(255,255,255,0.05)',
  gold:'#D4AF37', goldLight:'#F3E5AB',
  border:'rgba(255,255,255,0.09)', borderAccent:'rgba(243,229,171,0.25)',
  text:'#FFFFFF', textDim:'#A1A1AA',
  success:'#10B981', danger:'#EF4444', red:'#E63946',
};

const MOCK_V2_PLAYERS = [
  { id:'p1', name:'You',     is_host:true,  bid:2, tricks_won:1, total_score:120, card_count:5, is_connected:true,  has_bid:true  },
  { id:'p2', name:'Alice',   is_host:false, bid:3, tricks_won:2, total_score:95,  card_count:5, is_connected:true,  has_bid:true  },
  { id:'p3', name:'Bob',     is_host:false, bid:1, tricks_won:0, total_score:80,  card_count:5, is_connected:true,  has_bid:true  },
  { id:'p4', name:'Charlie', is_host:false, bid:null, tricks_won:0, total_score:110, card_count:5, is_connected:false, has_bid:false },
];

const MOCK_V2_HISTORY = [
  { round:1, trump:'hearts',   cards:7, scores:{ p1:{name:'You',bid:2,tricks_won:2,round_score:20,total_score:20}, p2:{name:'Alice',bid:3,tricks_won:2,round_score:-30,total_score:-30}, p3:{name:'Bob',bid:1,tricks_won:1,round_score:10,total_score:10}, p4:{name:'Charlie',bid:2,tricks_won:2,round_score:20,total_score:20} } },
  { round:2, trump:'spades',   cards:6, scores:{ p1:{name:'You',bid:1,tricks_won:2,round_score:-10,total_score:10}, p2:{name:'Alice',bid:2,tricks_won:2,round_score:20,total_score:-10}, p3:{name:'Bob',bid:0,tricks_won:0,round_score:25,total_score:35}, p4:{name:'Charlie',bid:3,tricks_won:2,round_score:-30,total_score:-10} } },
  { round:3, trump:'diamonds', cards:5, scores:{ p1:{name:'You',bid:2,tricks_won:2,round_score:20,total_score:30}, p2:{name:'Alice',bid:2,tricks_won:2,round_score:20,total_score:10}, p3:{name:'Bob',bid:1,tricks_won:1,round_score:10,total_score:45}, p4:{name:'Charlie',bid:1,tricks_won:0,round_score:-10,total_score:-20} } },
];

// ── Shared ──────────────────────────────────────────────────────────
function Chip2({ children, gold, danger, style={} }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'4px 11px', borderRadius:999,
      border:`1px solid ${gold?CV.borderAccent:danger?'rgba(239,68,68,0.32)':CV.border}`,
      background:gold?'rgba(212,175,55,0.10)':danger?'rgba(239,68,68,0.08)':CV.glass,
      color:gold?CV.goldLight:danger?CV.danger:CV.textDim,
      fontSize:11, fontWeight:700, letterSpacing:'0.04em', whiteSpace:'nowrap',
      fontFamily:'DM Sans, sans-serif', ...style,
    }}>{children}</span>
  );
}

function GoldBtn({ children, onClick, outline, small, disabled, style={} }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        width:small?'auto':'100%', padding:small?'10px 22px':'15px 0',
        borderRadius:999,
        border:outline?`1.5px solid ${CV.goldLight}`:'none',
        background:outline?'transparent':hov?'linear-gradient(135deg,#F3E5AB,#C9A020)':'linear-gradient(135deg,#E8D080,#BF9510)',
        color:outline?CV.goldLight:'#000',
        fontSize:small?13:16, fontWeight:800, letterSpacing:'0.04em',
        cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.5:1,
        transition:'all 0.18s',
        boxShadow:outline?'none':hov?'0 0 30px rgba(212,175,55,0.55)':'0 0 18px rgba(212,175,55,0.30)',
        fontFamily:'Outfit, sans-serif', ...style,
      }}>{children}</button>
  );
}

function GlassCard({ children, accent, style={} }) {
  return (
    <div style={{
      background:'rgba(8,22,15,0.78)', backdropFilter:'blur(18px)',
      borderRadius:20, padding:'18px 20px',
      border:`1px solid ${accent?CV.borderAccent:CV.border}`,
      boxShadow:'0 10px 36px rgba(0,0,0,0.45)',
      ...style,
    }}>{children}</div>
  );
}

function Kicker2({ children, style={} }) {
  return <p style={{ margin:0, color:CV.gold, fontSize:10, fontWeight:800, letterSpacing:'0.20em', textTransform:'uppercase', ...style }}>{children}</p>;
}

function Avatar2({ name, you, active, winner, size=36 }) {
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', flexShrink:0,
      background:you?CV.gold:winner?'linear-gradient(135deg,#D4AF37,#F3E5AB)':active?'rgba(212,175,55,0.18)':CV.bgLight,
      border:`2px solid ${you||winner?CV.gold:active?CV.goldLight:'rgba(255,255,255,0.12)'}`,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontWeight:900, fontSize:size*0.38, color:you||winner?'#000':CV.text,
      boxShadow:active?'0 0 14px rgba(212,175,55,0.4)':winner?'0 0 20px rgba(212,175,55,0.6)':'none',
      transition:'all 0.3s', fontFamily:'Outfit, sans-serif',
    }}>{(name||'?')[0].toUpperCase()}</div>
  );
}

// ── HOME SCREEN ─────────────────────────────────────────────────────
function HomeScreenV2({ onNavigate }) {
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const inputSt = {
    width:'100%', padding:'13px 16px', borderRadius:12, boxSizing:'border-box',
    background:'rgba(255,255,255,0.06)', border:`1px solid ${CV.border}`,
    color:CV.text, fontSize:15, fontWeight:500, outline:'none',
    fontFamily:'DM Sans, sans-serif', transition:'border 0.18s',
  };
  return (
    <div style={{ minHeight:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'28px 20px', gap:14, boxSizing:'border-box' }}>
      {/* Deco suits */}
      <div style={{ position:'absolute', top:20, left:0, right:0, display:'flex', justifyContent:'center', gap:24, pointerEvents:'none' }}>
        {['♠','♥','♦','♣'].map((s,i)=>(
          <span key={i} style={{ fontSize:40, color:i%2===0?'rgba(255,255,255,0.07)':'rgba(230,57,70,0.12)', animation:`vfloat${i%2} ${6+i}s ease-in-out infinite` }}>{s}</span>
        ))}
      </div>

      {/* Hero panel */}
      <GlassCard accent style={{ width:'100%' }}>
        <Kicker2 style={{ marginBottom:10 }}>Live Card Table</Kicker2>
        <h1 style={{ margin:'0 0 6px', fontSize:38, fontWeight:900, letterSpacing:5, color:CV.goldLight, fontFamily:'Outfit, sans-serif', lineHeight:1, wordBreak:'keep-all' }}>
          JUDGEMENT
        </h1>
        <p style={{ margin:'8px 0 0', color:CV.textDim, fontSize:13, lineHeight:1.7 }}>
          Bid the exact number of tricks. Win the table.<br/>Miss by one — and pay for it.
        </p>
        <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
          {['Real-time','3–7 players','Exact bids','Dealer blind'].map(t=><Chip2 key={t}>{t}</Chip2>)}
        </div>
      </GlassCard>

      {/* Form */}
      <GlassCard style={{ width:'100%' }}>
        <label style={{ display:'block', color:CV.textDim, fontSize:10, fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:6 }}>Your Name</label>
        <input style={inputSt} value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your name" maxLength={16} />
        <GoldBtn onClick={()=>name.trim()&&onNavigate('lobby')} style={{ marginTop:14 }}>Create Room</GoldBtn>

        <div style={{ display:'flex', alignItems:'center', gap:12, margin:'18px 0' }}>
          <div style={{ flex:1, height:1, background:CV.border }} />
          <span style={{ color:CV.textDim, fontSize:12, fontWeight:600 }}>OR</span>
          <div style={{ flex:1, height:1, background:CV.border }} />
        </div>

        <label style={{ display:'block', color:CV.textDim, fontSize:10, fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:6 }}>Room Code</label>
        <input style={inputSt} value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="4-letter code" maxLength={4} />
        <GoldBtn outline onClick={()=>code.trim()&&onNavigate('lobby')} style={{ marginTop:14 }}>Join Room</GoldBtn>

        <p style={{ textAlign:'center', marginTop:16, marginBottom:0, color:CV.textDim, fontSize:13 }}>
          New here?{' '}
          <span onClick={()=>onNavigate('howtoplay')} style={{ color:CV.goldLight, fontWeight:700, textDecoration:'underline', cursor:'pointer' }}>
            How to Play →
          </span>
        </p>
      </GlassCard>
    </div>
  );
}

// ── LOBBY SCREEN ────────────────────────────────────────────────────
function LobbyScreenV2({ onNavigate }) {
  const players = MOCK_V2_PLAYERS.slice(0,3);
  return (
    <div style={{ padding:'24px 20px', display:'flex', flexDirection:'column', alignItems:'center', gap:18 }}>
      <div style={{ width:'100%', display:'flex', alignItems:'center' }}>
        <button onClick={()=>onNavigate('home')} style={{ background:'none', border:'none', color:CV.textDim, fontSize:14, cursor:'pointer', padding:0, fontFamily:'DM Sans, sans-serif' }}>← Back</button>
      </div>

      <h1 style={{ margin:0, fontSize:30, fontWeight:900, letterSpacing:5, color:CV.goldLight, fontFamily:'Outfit, sans-serif' }}>JUDGEMENT</h1>

      {/* Room code */}
      <GlassCard accent style={{ width:'100%', textAlign:'center', padding:'20px' }}>
        <Kicker2 style={{ marginBottom:8 }}>Room Code</Kicker2>
        <div style={{ fontSize:52, fontWeight:900, letterSpacing:14, color:CV.gold, fontFamily:'JetBrains Mono, monospace' }}>ABCD</div>
        <p style={{ margin:'8px 0 0', color:CV.textDim, fontSize:12 }}>Share with friends to join</p>
      </GlassCard>

      {/* Player list */}
      <div style={{ width:'100%' }}>
        <p style={{ margin:'0 0 10px', color:CV.text, fontSize:13, fontWeight:700, letterSpacing:'0.06em' }}>PLAYERS ({players.length}/7)</p>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {players.map(p=>(
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:12, background:CV.glass, borderRadius:14, padding:'11px 14px', border:`1px solid ${CV.border}` }}>
              <Avatar2 name={p.name} you={p.id==='p1'} size={38} />
              <span style={{ flex:1, color:CV.text, fontSize:14, fontWeight:600 }}>{p.name}</span>
              {p.is_host && <Chip2 gold>HOST</Chip2>}
              {p.id==='p1' && <Chip2>YOU</Chip2>}
            </div>
          ))}
          <div style={{ display:'flex', alignItems:'center', gap:12, background:'rgba(255,255,255,0.018)', borderRadius:14, padding:'11px 14px', border:`1px dashed ${CV.border}` }}>
            <div style={{ width:38, height:38, borderRadius:'50%', border:`2px dashed rgba(255,255,255,0.12)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:CV.textDim, fontSize:20, lineHeight:1 }}>+</span>
            </div>
            <span style={{ color:CV.textDim, fontSize:13 }}>Waiting for player…</span>
          </div>
        </div>
      </div>

      <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:10 }}>
        <GoldBtn onClick={()=>onNavigate('game-bidding')}>Start Game</GoldBtn>
        <p style={{ margin:0, color:CV.textDim, fontSize:12, textAlign:'center' }}>Need at least 3 players to start</p>
      </div>
    </div>
  );
}

// ── ROUND END ───────────────────────────────────────────────────────
function RoundEndScreenV2({ onNavigate }) {
  const last = MOCK_V2_HISTORY[2];
  const players = MOCK_V2_PLAYERS;
  const sorted = [...players].sort((a,b)=>b.total_score-a.total_score);
  return (
    <div style={{ padding:'20px', overflowY:'auto', maxHeight:'100%', boxSizing:'border-box' }}>
      <Kicker2 style={{ marginBottom:4 }}>Round 3 of 7</Kicker2>
      <h1 style={{ margin:'0 0 4px', fontSize:26, fontWeight:900, color:CV.goldLight, fontFamily:'Outfit, sans-serif' }}>Round Complete</h1>
      <p style={{ margin:'0 0 18px', color:CV.textDim, fontSize:13 }}>♥ Hearts · 5 cards dealt</p>

      {/* Leader callout */}
      <GlassCard accent style={{ marginBottom:16, display:'flex', alignItems:'center', gap:14 }}>
        <Avatar2 name={sorted[0].name} active size={44} />
        <div>
          <Kicker2 style={{ marginBottom:3 }}>Round Leader</Kicker2>
          <div style={{ color:CV.text, fontSize:16, fontWeight:800, fontFamily:'Outfit, sans-serif' }}>{sorted[0].name} · {sorted[0].total_score} pts</div>
        </div>
      </GlassCard>

      {/* Score table */}
      <GlassCard style={{ marginBottom:16, padding:'14px 16px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 44px 44px 52px 56px', gap:4, paddingBottom:8, borderBottom:`1px solid ${CV.border}`, marginBottom:6 }}>
          {['Player','Bid','Won','Pts','Total'].map(h=>(
            <span key={h} style={{ color:CV.textDim, fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', textAlign:h==='Player'?'left':'center' }}>{h}</span>
          ))}
        </div>
        {players.map((p,i)=>{
          const d = last.scores[p.id]; if(!d) return null;
          const ok = d.bid===d.tricks_won;
          return (
            <div key={p.id} style={{ display:'grid', gridTemplateColumns:'1fr 44px 44px 52px 56px', gap:4, padding:'9px 0', borderRadius:8, background:ok?'rgba(16,185,129,0.07)':'transparent', borderBottom:i<players.length-1?`1px solid rgba(255,255,255,0.04)`:'none' }}>
              <span style={{ color:CV.text, fontSize:13, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}{p.id==='p1'?' (You)':''}</span>
              <span style={{ color:CV.textDim, fontSize:13, textAlign:'center' }}>{d.bid}</span>
              <span style={{ color:CV.textDim, fontSize:13, textAlign:'center' }}>{d.tricks_won}</span>
              <span style={{ color:ok?CV.success:CV.danger, fontSize:13, fontWeight:800, textAlign:'center' }}>{d.round_score>0?'+':''}{d.round_score}</span>
              <span style={{ color:CV.goldLight, fontSize:13, fontWeight:900, textAlign:'center' }}>{d.total_score}</span>
            </div>
          );
        })}
      </GlassCard>

      <GoldBtn onClick={()=>onNavigate('game-playing')} style={{ marginBottom:10 }}>Next Round →</GoldBtn>
      <GoldBtn outline onClick={()=>onNavigate('gameover')}>Jump to Game Over</GoldBtn>
    </div>
  );
}

// ── GAME OVER ───────────────────────────────────────────────────────
function GameOverScreenV2({ onNavigate }) {
  const sorted = [...MOCK_V2_PLAYERS].sort((a,b)=>b.total_score-a.total_score);
  const medals = ['🥇','🥈','🥉'];
  return (
    <div style={{ padding:'22px 20px', overflowY:'auto', maxHeight:'100%', boxSizing:'border-box' }}>
      <div style={{ textAlign:'center', marginBottom:22 }}>
        <div style={{ fontSize:36, marginBottom:6 }}>🎉</div>
        <h1 style={{ margin:'0 0 4px', fontSize:32, fontWeight:900, letterSpacing:4, color:CV.goldLight, fontFamily:'Outfit, sans-serif' }}>GAME OVER</h1>
        <p style={{ margin:0, color:CV.textDim, fontSize:13 }}>Final standings · 7 rounds played</p>
      </div>

      {/* Podium */}
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
        {sorted.map((p,i)=>(
          <div key={p.id} style={{
            display:'flex', alignItems:'center', gap:14,
            background:i===0?'rgba(212,175,55,0.10)':CV.glass,
            border:`1px solid ${i===0?CV.borderAccent:CV.border}`,
            borderRadius:16, padding:'14px 16px',
            boxShadow:i===0?'0 0 28px rgba(212,175,55,0.14)':'none',
          }}>
            <span style={{ fontSize:22, width:30, textAlign:'center' }}>{medals[i]||`#${i+1}`}</span>
            <Avatar2 name={p.name} you={p.id==='p1'} winner={i===0} size={42} />
            <div style={{ flex:1 }}>
              <div style={{ color:CV.text, fontSize:15, fontWeight:800, fontFamily:'Outfit, sans-serif' }}>
                {p.name}{p.id==='p1'&&<span style={{ color:CV.gold, fontSize:11, marginLeft:6 }}>(You)</span>}
              </div>
              <div style={{ color:CV.textDim, fontSize:12, marginTop:2 }}>7 rounds played</div>
            </div>
            <div style={{ color:i===0?CV.gold:CV.goldLight, fontSize:20, fontWeight:900, fontFamily:'Outfit, sans-serif' }}>{p.total_score}</div>
          </div>
        ))}
      </div>

      <GoldBtn onClick={()=>onNavigate('lobby')} style={{ marginBottom:10 }}>Play Again</GoldBtn>
      <GoldBtn outline onClick={()=>onNavigate('home')}>Back to Home</GoldBtn>
    </div>
  );
}

// ── HOW TO PLAY ─────────────────────────────────────────────────────
function HowToPlayScreenV2({ onNavigate }) {
  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px 12px', borderBottom:`1px solid ${CV.border}` }}>
        <div>
          <div style={{ color:CV.goldLight, fontSize:15, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase' }}>How to Play</div>
          <div style={{ color:CV.textDim, fontSize:11, marginTop:2 }}>The fast version</div>
        </div>
        <button onClick={()=>onNavigate('home')} style={{ width:36,height:36,borderRadius:'50%',background:CV.glass,border:`1px solid ${CV.border}`,color:CV.textDim,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'18px 20px 32px' }}>
        <GlassCard accent style={{ marginBottom:18 }}>
          <Kicker2 style={{ marginBottom:6 }}>Judgement / Oh Hell</Kicker2>
          <div style={{ color:CV.text, fontSize:18, fontWeight:800, lineHeight:1.45, marginBottom:8 }}>Bid the exact number of tricks you will take.</div>
          <div style={{ color:CV.textDim, fontSize:13, lineHeight:1.7 }}>Exact bids score. Misses punish. The dealer can't let everyone succeed.</div>
        </GlassCard>
        {[
          { icon:'🃏', label:'The Game', body:'3–7 players. Each round you get a hand, predict tricks, and play cards clockwise.' },
          { icon:'🎴', label:'Playing Tricks', body:'Lead any card. Others must follow suit if they can. Highest trump wins; otherwise highest card of the lead suit wins.' },
          { icon:'♠', label:'Trump Suits', body:'Trump rotates each round: ♥ Hearts → ♠ Spades → ♦ Diamonds → ♣ Clubs. Trump beats any non-trump card.' },
          { icon:'🎯', label:'Bidding', body:'Bid clockwise after the dealer. The dealer bids last and cannot make total bids equal tricks available.' },
          { icon:'📊', label:'Scoring', body:'Exact bid → +bid × 10 pts. Miss → −bid × 10 pts. Zero bid & 0 tricks → +25 pts.' },
        ].map(s=>(
          <div key={s.label} style={{ marginBottom:18 }}>
            <div style={{ color:CV.goldLight, fontSize:11, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:5 }}>{s.icon} {s.label}</div>
            <div style={{ color:CV.textDim, fontSize:13, lineHeight:1.7 }}>{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  HomeScreenV2, LobbyScreenV2, RoundEndScreenV2, GameOverScreenV2, HowToPlayScreenV2,
  GoldBtn, GlassCard, Chip2, Kicker2, Avatar2, CV, MOCK_V2_PLAYERS, MOCK_V2_HISTORY,
});
