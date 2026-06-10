// game-v2.jsx — GameScreenV2, BiddingModalV2, HandCardSlot

const MOCK_HAND_V2 = [
  { rank:'A', suit:'spades' }, { rank:'K', suit:'hearts' },
  { rank:'7', suit:'diamonds' }, { rank:'3', suit:'clubs' }, { rank:'9', suit:'spades' },
];

// 17-card hand for 3-player round 1 bidding demo
const MOCK_HAND_BID = [
  { rank:'A', suit:'spades'  }, { rank:'K', suit:'spades'   }, { rank:'Q', suit:'spades'   }, { rank:'J',  suit:'spades'   }, { rank:'10', suit:'spades'  },
  { rank:'A', suit:'hearts'  }, { rank:'K', suit:'hearts'   }, { rank:'Q', suit:'hearts'   }, { rank:'J',  suit:'hearts'   },
  { rank:'A', suit:'diamonds'}, { rank:'K', suit:'diamonds' }, { rank:'Q', suit:'diamonds' }, { rank:'10', suit:'diamonds' },
  { rank:'A', suit:'clubs'   }, { rank:'K', suit:'clubs'    }, { rank:'Q', suit:'clubs'    }, { rank:'J',  suit:'clubs'    },
];

const MOCK_TRICK_V2 = [
  { player_index:1, card:{ rank:'Q', suit:'hearts' } },
  { player_index:2, card:{ rank:'4', suit:'spades'  } },
];

// Each card in the hand fan is its own component so hooks work correctly
function HandCardSlot({ card, rotation, dropY, xShift, canPlay, onPlay, cardStyle, animLevel, zIdx }) {
  const [hov, setHov] = React.useState(false);
  const cardW = (window.CARD_DIMS?.hand?.w) || 60;
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => canPlay && onPlay && onPlay()}
      style={{
        position:'absolute', bottom: dropY,
        left:'50%', marginLeft: xShift - cardW / 2,
        transform: `rotate(${rotation}deg) translateY(${hov ? -24 : 0}px)`,
        transformOrigin: 'bottom center',
        transition: animLevel !== 'low' ? 'transform 0.18s ease' : undefined,
        cursor: canPlay ? 'pointer' : 'default',
        zIndex: hov ? 30 : zIdx,
      }}
    >
      <PlayingCard card={card} size="hand" cardStyle={cardStyle}
        highlighted={canPlay} dimmed={!canPlay && !!onPlay}
      />
    </div>
  );
}

// Opponent seat with card-back hand indicator
function OpponentSeatV2({ player, active, arcPos, animLevel }) {
  return (
    <div style={{
      position:'absolute', ...arcPos,
      background: active ? 'rgba(243,229,171,0.07)' : 'rgba(8,22,15,0.84)',
      border: `1px solid ${active ? CV.goldLight : CV.border}`,
      borderRadius:16, padding:'9px 11px', minWidth:92, maxWidth:124,
      boxShadow: active && animLevel !== 'low' ? '0 0 20px rgba(212,175,55,0.22)' : 'none',
      transition: animLevel !== 'low' ? 'all 0.35s ease' : undefined,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
        <Avatar2 name={player.name} active={active} size={26} />
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ color:CV.text, fontSize:11, fontWeight:800, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'Outfit, sans-serif' }}>{player.name}</div>
          <div style={{ color:CV.goldLight, fontSize:10 }}>{player.total_score} pts</div>
        </div>
      </div>
      {/* Mini card-back stack showing hand count */}
      <div style={{ display:'flex', marginBottom:4, height:16 }}>
        {Array.from({ length: Math.min(player.card_count || 5, 5) }).map((_,ci) => (
          <div key={ci} style={{
            width:10, height:16, borderRadius:2, flexShrink:0,
            background:'linear-gradient(135deg,#1E5038,#0E2E1C)',
            border:'1px solid rgba(212,175,55,0.18)',
            marginLeft: ci > 0 ? -4 : 0,
            boxShadow:'1px 1px 4px rgba(0,0,0,0.5)',
            zIndex: ci,
          }} />
        ))}
      </div>
      <div style={{ color:CV.textDim, fontSize:10, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
        {player.has_bid || player.bid !== null
          ? `Bid ${player.bid} · Won ${player.tricks_won}`
          : player.is_connected ? 'Waiting to bid…' : '● Offline'}
      </div>
    </div>
  );
}

// Bidding modal — giant number selector with card fan
function BiddingModalV2({ onClose, hand, cardsThisRound, trumpSuit, restricted, cardStyle, animLevel }) {
  const [sel, setSel] = React.useState(0);
  const bids = Array.from({ length: cardsThisRound + 1 }, (_, i) => i);
  const restr = restricted || [2];
  const isR = (b) => restr.includes(b);
  const trumpSym = (window.SUIT_SYMS || {})[trumpSuit] || '';
  const trumpColor = (trumpSuit==='hearts'||trumpSuit==='diamonds') ? CV.red : CV.text;
  const h = hand || MOCK_HAND_V2;
  const n = h.length;

  const change = (delta) => {
    let next = sel + delta;
    while (next >= 0 && next <= cardsThisRound && isR(next)) next += delta;
    if (next >= 0 && next <= cardsThisRound && !isR(next)) setSel(next);
  };

  return (
    <div style={{
      position:'absolute', inset:0, zIndex:100,
      display:'flex', alignItems:'center', justifyContent:'center',
      background:'rgba(2,8,5,0.90)', backdropFilter:'blur(10px)',
    }}>
      <div style={{
        width:'calc(100% - 28px)', maxWidth:356,
        background:'#0C2218', borderRadius:28,
        border:'1px solid rgba(212,175,55,0.30)',
        padding:'22px 20px 26px',
        boxShadow:'0 32px 80px rgba(0,0,0,0.7)',
      }}>
        {/* Hand grid — readable at any count */}
        <div style={{ marginBottom:14 }}>
          <p style={{ margin:'0 0 7px', color:CV.textDim, fontSize:10, fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase' }}>
            Your hand · {h.length} cards
          </p>
          <div style={{
            display:'flex', flexWrap:'wrap', gap:5, justifyContent:'center',
            maxHeight:136, overflowY:'auto', paddingTop:4,
          }}>
            {h.map((c,i) => (
              <PlayingCard key={i} card={c} size="small" cardStyle={cardStyle} disabled />
            ))}
          </div>
        </div>

        <div style={{ height:1, background:'rgba(255,255,255,0.07)', marginBottom:16 }} />

        <p style={{ margin:'0 0 4px', color:CV.gold, fontSize:10, fontWeight:800, letterSpacing:'0.20em', textTransform:'uppercase' }}>Bidding Round</p>
        <h2 style={{ margin:'0 0 12px', fontSize:19, fontWeight:900, color:CV.goldLight, fontFamily:'Outfit, sans-serif' }}>How many tricks will you win?</h2>

        <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap' }}>
          <Chip2>Round 3/7</Chip2>
          <Chip2>{cardsThisRound} cards</Chip2>
          <Chip2 style={{ color:trumpColor }}>{trumpSym} {trumpSuit}</Chip2>
        </div>

        {/* Giant number picker */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:20, marginBottom:16 }}>
          <button onClick={() => change(-1)} style={{
            width:52, height:52, borderRadius:'50%',
            background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.14)',
            color:CV.text, fontSize:28, fontWeight:300, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            transition: animLevel !== 'low' ? 'all 0.15s' : undefined,
          }}>−</button>

          <div style={{ textAlign:'center', minWidth:110 }}>
            <div style={{
              fontSize:84, fontWeight:900, color:CV.gold,
              fontFamily:'Outfit, sans-serif', lineHeight:1,
              transition: animLevel !== 'low' ? 'color 0.15s' : undefined,
            }}>{sel}</div>
            <div style={{ color:CV.textDim, fontSize:12, marginTop:4 }}>out of {cardsThisRound}</div>
          </div>

          <button onClick={() => change(1)} style={{
            width:52, height:52, borderRadius:'50%',
            background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.14)',
            color:CV.text, fontSize:28, fontWeight:300, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center',
            transition: animLevel !== 'low' ? 'all 0.15s' : undefined,
          }}>+</button>
        </div>

        {/* Dot pill indicators */}
        <div style={{ display:'flex', gap:5, justifyContent:'center', marginBottom:22, flexWrap:'wrap' }}>
          {bids.map(b => (
            <div key={b} onClick={() => !isR(b) && setSel(b)} style={{
              width: b === sel ? 22 : 8, height:8, borderRadius:4,
              background: b===sel ? CV.gold : isR(b) ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.20)',
              cursor: isR(b) ? 'not-allowed' : 'pointer',
              transition: animLevel !== 'low' ? 'width 0.2s ease, background 0.15s' : undefined,
              flexShrink:0,
            }} />
          ))}
        </div>

        <button onClick={onClose} style={{
          width:'100%', padding:'15px 0', borderRadius:999,
          background:'linear-gradient(135deg,#E8D080,#BF9510)',
          border:'none', color:'#000', fontSize:16, fontWeight:900,
          cursor:'pointer', fontFamily:'Outfit, sans-serif',
          boxShadow:'0 0 26px rgba(212,175,55,0.42)',
        }}>Lock in {sel} →</button>
      </div>
    </div>
  );
}

// Main game screen
function GameScreenV2({ onNavigate, phase, tweaks }) {
  const cs    = tweaks?.cardStyle    || 'minimal';
  const anim  = tweaks?.animIntensity || 'medium';
  const ph    = phase || 'playing';

  const [showBid,      setShowBid]      = React.useState(ph === 'bidding');
  const [trickWinner,  setTrickWinner]  = React.useState(null);

  const opponents  = MOCK_V2_PLAYERS.filter(p => p.id !== 'p1');
  const isMyTurn   = true;
  const trumpSuit  = 'hearts';
  const trumpSym   = (window.SUIT_SYMS || {})[trumpSuit] || '♥';
  const trumpColor = CV.red;
  // Use 17-card hand for both phases for realistic preview
  const currentHand = MOCK_HAND_BID;

  // Demo "no lead suit" case — player can play any card (all 17 highlighted)
  const leadSuit   = null;
  const playable   = ph === 'playing' && isMyTurn
    ? (() => {
        const heartIndices = currentHand.map((c,i) => c.suit === leadSuit ? i : -1).filter(i => i >= 0);
        return new Set(heartIndices.length > 0 ? heartIndices : currentHand.map((_,i) => i));
      })()
    : null;

  // Arc positions for up to 3 opponents
  const arcPos = [
    { left:'4%',  top:22 },
    { left:'50%', top:4,  transform:'translateX(-50%)' },
    { right:'4%', top:22 },
  ];

  const playCard = () => {
    setTrickWinner(null);
    setTimeout(() => {
      setTrickWinner('You');
      setTimeout(() => setTrickWinner(null), 2200);
    }, 500);
  };

  return (
    <div style={{ position:'relative', height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Ambient glow */}
      {anim !== 'low' && (
        <div style={{
          position:'absolute', top:-80, left:-60, width:240, height:240, borderRadius:'50%',
          background:'rgba(212,175,55,0.055)', filter:'blur(55px)', pointerEvents:'none',
          animation: anim === 'high' ? 'glowDrift 8s ease-in-out infinite' : 'none',
        }} />
      )}

      {/* Status rail */}
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 12px 6px', flexWrap:'wrap', zIndex:5, position:'relative' }}>
        <button onClick={() => onNavigate('lobby')} style={{
          background:'rgba(255,255,255,0.05)', border:`1px solid ${CV.border}`,
          borderRadius:10, padding:'7px 10px', color:CV.textDim,
          fontSize:12, cursor:'pointer', fontFamily:'DM Sans, sans-serif',
        }}>← Leave</button>
        {[
          { label:'Trump',  val: <span style={{ color:trumpColor }}>{trumpSym} Hearts</span> },
          { label:'Round',  val: '3/7' },
          { label:'Tricks', val: '2/5' },
          { label:'Live',   val: <span style={{ color:CV.success }}>●</span> },
        ].map((p,i) => (
          <div key={i} style={{ background:'rgba(255,255,255,0.05)', border:`1px solid ${CV.border}`, borderRadius:10, padding:'5px 10px' }}>
            <div style={{ color:CV.textDim, fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:2 }}>{p.label}</div>
            <div style={{ color:CV.text, fontSize:12, fontWeight:800 }}>{p.val}</div>
          </div>
        ))}
      </div>

      {/* Opponents in arc */}
      <div style={{ position:'relative', height:162, flexShrink:0, margin:'0 8px' }}>
        {opponents.map((opp, i) => (
          <OpponentSeatV2 key={opp.id} player={opp} active={i===0} arcPos={arcPos[i]} animLevel={anim} />
        ))}
      </div>

      {/* Turn banner */}
      <div style={{ display:'flex', justifyContent:'center', marginBottom:7 }}>
        <div style={{
          padding:'6px 18px', borderRadius:999,
          background: isMyTurn ? 'rgba(212,175,55,0.10)' : CV.glass,
          border: `1px solid ${isMyTurn ? CV.borderAccent : CV.border}`,
          animation: isMyTurn && anim === 'high' ? 'bannerPulse 2.8s ease-in-out infinite' : 'none',
        }}>
          <span style={{ color: isMyTurn ? CV.goldLight : CV.textDim, fontSize:12, fontWeight:700 }}>
            {ph === 'bidding'
              ? (isMyTurn ? '✦ Your turn to bid' : 'Waiting for Alice to bid')
              : (isMyTurn ? '✦ Your turn to play' : 'Waiting for Alice')}
          </span>
        </div>
      </div>

      {/* Felt oval table */}
      <div style={{ display:'flex', justifyContent:'center', marginBottom:6 }}>
        <div style={{
          width:'92%', maxWidth:336, height:150,
          borderRadius:'50%',
          background:'radial-gradient(ellipse at 42% 38%, #2C6C46 0%, #1A4833 44%, #0D2B1C 100%)',
          border:`2px solid rgba(212,175,55,${isMyTurn ? 0.32 : 0.15})`,
          boxShadow:[
            'inset 0 4px 24px rgba(0,0,0,0.60)',
            'inset 0 -2px 8px rgba(255,255,255,0.03)',
            '0 12px 40px rgba(0,0,0,0.55)',
            isMyTurn && anim !== 'low' ? '0 0 54px rgba(212,175,55,0.12)' : '',
          ].filter(Boolean).join(', '),
          position:'relative', overflow:'hidden',
          display:'flex', alignItems:'center', justifyContent:'center',
          transition: anim !== 'low' ? 'box-shadow 0.6s ease, border-color 0.6s ease' : undefined,
        }}>
          {/* SVG felt noise */}
          <svg style={{ position:'absolute',inset:0,width:'100%',height:'100%',opacity:0.13 }} aria-hidden="true">
            <filter id="fnoise">
              <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="4" stitchTiles="stitch"/>
              <feColorMatrix type="saturate" values="0"/>
            </filter>
            <rect width="100%" height="100%" filter="url(#fnoise)"/>
          </svg>
          {/* Inner ring */}
          <div style={{ position:'absolute', width:'calc(100%-22px)', height:'calc(100%-22px)', borderRadius:'50%', border:'1px solid rgba(212,175,55,0.09)', pointerEvents:'none' }} />

          {/* Trick cards on felt */}
          <div style={{ position:'relative', zIndex:2, display:'flex', gap:8, alignItems:'center', justifyContent:'center' }}>
            {trickWinner ? (
              <div style={{ color:CV.gold, fontSize:12, fontWeight:700, textAlign:'center', padding:8 }}>
                🏆 {trickWinner} took the trick!
              </div>
            ) : ph === 'bidding' ? (
              <div style={{ color:'rgba(243,229,171,0.32)', fontSize:13, fontWeight:600 }}>
                Bids locking in…
              </div>
            ) : MOCK_TRICK_V2.map((tc, i) => (
              <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                <PlayingCard card={tc.card} size="trick" cardStyle={cs} highlighted={i===0} />
                <span style={{ color:'rgba(255,255,255,0.42)', fontSize:9, fontWeight:600 }}>
                  {MOCK_V2_PLAYERS[tc.player_index]?.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* My info bar */}
      <div style={{ padding:'3px 12px 2px' }}>
        <div style={{
          background:'rgba(255,255,255,0.05)', border:`1px solid ${CV.border}`,
          borderRadius:14, padding:'8px 14px',
          display:'flex', justifyContent:'space-between', alignItems:'center',
        }}>
          <div>
            <div style={{ color:CV.text, fontSize:14, fontWeight:900, fontFamily:'Outfit, sans-serif' }}>You</div>
            <div style={{ color:CV.textDim, fontSize:11, marginTop:1, fontWeight:600 }}>Dealer · Bid 2 / Won 1</div>
          </div>
          <div style={{ color:CV.goldLight, fontSize:15, fontWeight:900, fontFamily:'Outfit, sans-serif' }}>120 pts</div>
        </div>
      </div>

      {/* Hand — flat grid, scrollable for large hands */}
      <div style={{ padding:'4px 12px 12px' }}>
        <p style={{ margin:'0 0 8px', color:CV.textDim, fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.14em', paddingLeft:2 }}>
          Your hand · {currentHand.length} cards
        </p>
        <div style={{
          display:'flex', flexWrap:'wrap', gap:6,
          paddingTop:14, paddingBottom:6,
          justifyContent:'center',
          maxHeight:210, overflowY:'auto',
        }}>
          {currentHand.map((card, i) => {
            const canPlay = !!playable?.has(i);
            const cardSize = currentHand.length > 8 ? 'trick' : 'hand';
            return (
              <PlayingCard
                key={`${card.rank}-${card.suit}-${i}`}
                card={card} size={cardSize} cardStyle={cs}
                highlighted={canPlay}
                dimmed={!canPlay && !!playable}
                onPress={canPlay ? playCard : undefined}
                disabled={!canPlay}
              />
            );
          })}
        </div>
      </div>

      {/* Bidding overlay */}
      {showBid && (
        <BiddingModalV2
          onClose={() => setShowBid(false)}
          hand={MOCK_HAND_BID} cardsThisRound={17}
          trumpSuit="hearts" restricted={[2]}
          cardStyle={cs} animLevel={anim}
        />
      )}
      {ph === 'bidding' && !showBid && (
        <button onClick={() => setShowBid(true)} style={{
          position:'absolute', bottom:118, left:'50%', transform:'translateX(-50%)',
          background:CV.gold, border:'none', borderRadius:999, padding:'12px 28px',
          color:'#000', fontWeight:800, fontSize:14, cursor:'pointer',
          fontFamily:'Outfit, sans-serif', boxShadow:'0 0 26px rgba(212,175,55,0.5)', zIndex:10,
        }}>Place Your Bid →</button>
      )}
    </div>
  );
}

Object.assign(window, { GameScreenV2, BiddingModalV2, HandCardSlot, OpponentSeatV2, MOCK_HAND_V2, MOCK_TRICK_V2 });
