// card-v2.jsx — PlayingCard with 3 style variants: minimal, pips, foil

const SUIT_SYMS = { hearts: '♥', diamonds: '♦', spades: '♠', clubs: '♣' };
const SUIT_CLR  = { hearts: '#E63946', diamonds: '#E63946', spades: '#111827', clubs: '#111827' };

const CARD_DIMS = {
  hand:  { w: 60, h: 86,  rankSz: 15, suitSz: 12, centerSz: 30, pipSz: 11 },
  trick: { w: 50, h: 70,  rankSz: 12, suitSz: 10, centerSz: 22, pipSz: 9  },
  small: { w: 38, h: 54,  rankSz: 9,  suitSz: 8,  centerSz: 16, pipSz: 7  },
  bid:   { w: 44, h: 62,  rankSz: 11, suitSz: 9,  centerSz: 18, pipSz: 8  },
};

// Pip [x%,y%] positions in card content area for each rank
const PIP_MAP = {
  'A':  [[50,50]],
  '2':  [[50,22],[50,78]],
  '3':  [[50,16],[50,50],[50,84]],
  '4':  [[28,22],[72,22],[28,78],[72,78]],
  '5':  [[28,20],[72,20],[50,50],[28,80],[72,80]],
  '6':  [[28,18],[72,18],[28,50],[72,50],[28,82],[72,82]],
  '7':  [[28,16],[72,16],[50,33],[28,50],[72,50],[28,84],[72,84]],
  '8':  [[28,14],[72,14],[50,30],[28,47],[72,47],[50,64],[28,82],[72,82]],
  '9':  [[28,13],[50,13],[72,13],[28,47],[72,47],[28,80],[50,80],[72,80],[50,47]],
  '10': [[28,11],[72,11],[50,25],[28,42],[72,42],[28,58],[72,58],[50,75],[28,89],[72,89]],
};

function PipsLayout({ rank, symbol, color, d }) {
  const positions = PIP_MAP[rank];
  if (!positions) {
    // J / Q / K — face card
    return (
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{
          width: d.w - 18, height: d.h - 18,
          border: `1px solid ${color}33`, borderRadius:4,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1,
        }}>
          <span style={{ fontSize: d.rankSz + 5, fontWeight:900, color, fontFamily:'Outfit,sans-serif', lineHeight:1 }}>{rank}</span>
          <span style={{ fontSize: d.suitSz + 1, color, lineHeight:1 }}>{symbol}</span>
        </div>
      </div>
    );
  }
  return (
    <div style={{ position:'absolute', inset:0 }}>
      {positions.map(([x,y], i) => (
        <span key={i} style={{
          position:'absolute', left:`${x}%`, top:`${y}%`,
          transform:'translate(-50%,-50%)',
          fontSize: rank === 'A' ? d.centerSz : d.pipSz,
          color, lineHeight:1, userSelect:'none',
        }}>{symbol}</span>
      ))}
    </div>
  );
}

function PlayingCard({ card, size='hand', cardStyle='minimal', highlighted, dimmed, onPress, disabled, style={} }) {
  const [hov, setHov] = React.useState(false);
  const sym   = SUIT_SYMS[card.suit] || '?';
  const color = SUIT_CLR[card.suit]  || '#111';
  const d     = CARD_DIMS[size] || CARD_DIMS.hand;
  const active = !disabled && !!onPress;

  const bg = cardStyle === 'foil'
    ? 'linear-gradient(150deg,#FFFEF6 0%,#FFF8E0 50%,#FFFEF6 100%)'
    : 'linear-gradient(150deg,#FFFFFF 0%,#F4F4F0 100%)';

  const borderColor = highlighted
    ? '#D4AF37'
    : cardStyle === 'foil'
      ? 'rgba(212,175,55,0.55)'
      : 'rgba(210,210,200,0.85)';
  const borderW = highlighted ? '1.5px' : cardStyle === 'foil' ? '1.5px' : '1px';

  const translateY = (hov && active) ? -10 : highlighted ? -6 : 0;
  const scale      = (hov && active) ? 1.07 : highlighted ? 1.04 : 1;

  const shadow = highlighted
    ? '0 0 20px rgba(212,175,55,0.65), 0 10px 24px rgba(0,0,0,0.4)'
    : (hov && active)
      ? '0 14px 30px rgba(0,0,0,0.5)'
      : dimmed
        ? '0 2px 6px rgba(0,0,0,0.2)'
        : '0 5px 14px rgba(0,0,0,0.32)';

  return (
    <div
      onClick={active ? onPress : undefined}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width:d.w, height:d.h, flexShrink:0,
        background: bg,
        borderRadius:8,
        border:`${borderW} solid ${borderColor}`,
        boxShadow: shadow,
        transform:`translateY(${translateY}px) scale(${scale})`,
        transition:'transform 0.18s ease, box-shadow 0.18s ease',
        opacity: dimmed ? 0.55 : 1,
        cursor: active ? 'pointer' : 'default',
        position:'relative', overflow:'hidden',
        userSelect:'none',
        ...style,
      }}
    >
      {/* Inner shine */}
      <div style={{ position:'absolute',top:0,left:0,right:0,height:'45%',background:'linear-gradient(to bottom,rgba(255,255,255,0.55),rgba(255,255,255,0))',pointerEvents:'none',borderRadius:'8px 8px 0 0' }} />

      {/* Foil shimmer overlay */}
      {cardStyle === 'foil' && (
        <div style={{ position:'absolute',inset:0,background:'linear-gradient(120deg,transparent 20%,rgba(255,215,0,0.08) 40%,rgba(255,255,255,0.14) 50%,rgba(255,215,0,0.08) 60%,transparent 80%)',pointerEvents:'none' }} />
      )}
      {/* Foil corner filigree */}
      {cardStyle === 'foil' && (<>
        <div style={{ position:'absolute',top:3,left:3,width:8,height:8,borderTop:'1px solid rgba(212,175,55,0.6)',borderLeft:'1px solid rgba(212,175,55,0.6)',borderRadius:'2px 0 0 0',pointerEvents:'none' }} />
        <div style={{ position:'absolute',bottom:3,right:3,width:8,height:8,borderBottom:'1px solid rgba(212,175,55,0.6)',borderRight:'1px solid rgba(212,175,55,0.6)',borderRadius:'0 0 2px 0',pointerEvents:'none' }} />
      </>)}

      {cardStyle === 'pips' ? (
        <>
          <PipsLayout rank={card.rank} symbol={sym} color={color} d={d} />
          {/* Corners */}
          <div style={{ position:'absolute',top:4,left:5 }}>
            <div style={{ fontSize:d.rankSz-2,fontWeight:900,color,fontFamily:'Outfit,sans-serif',lineHeight:1 }}>{card.rank}</div>
            <div style={{ fontSize:d.suitSz-2,color,lineHeight:1.1 }}>{sym}</div>
          </div>
          <div style={{ position:'absolute',bottom:4,right:5,transform:'rotate(180deg)' }}>
            <div style={{ fontSize:d.rankSz-2,fontWeight:900,color,fontFamily:'Outfit,sans-serif',lineHeight:1 }}>{card.rank}</div>
            <div style={{ fontSize:d.suitSz-2,color,lineHeight:1.1 }}>{sym}</div>
          </div>
        </>
      ) : (
        /* minimal + foil */
        <div style={{ height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between',padding:'4px 6px' }}>
          <div>
            <div style={{ fontSize:d.rankSz,fontWeight:900,color,fontFamily:'Outfit,sans-serif',lineHeight:1 }}>{card.rank}</div>
            <div style={{ fontSize:d.suitSz,color,lineHeight:1 }}>{sym}</div>
          </div>
          <div style={{ textAlign:'center',flex:1,display:'flex',alignItems:'center',justifyContent:'center' }}>
            <span style={{ fontSize:d.centerSz,color,lineHeight:1 }}>{sym}</span>
          </div>
          <div style={{ transform:'rotate(180deg)' }}>
            <div style={{ fontSize:d.rankSz,fontWeight:900,color,fontFamily:'Outfit,sans-serif',lineHeight:1 }}>{card.rank}</div>
            <div style={{ fontSize:d.suitSz,color,lineHeight:1 }}>{sym}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function CardBack({ size='hand', style={} }) {
  const d = CARD_DIMS[size] || CARD_DIMS.hand;
  return (
    <div style={{
      width:d.w, height:d.h, flexShrink:0,
      background:'linear-gradient(135deg,#1E5038 0%,#0E2E1C 100%)',
      borderRadius:8, border:'1px solid rgba(212,175,55,0.25)',
      boxShadow:'0 4px 12px rgba(0,0,0,0.4)',
      display:'flex',alignItems:'center',justifyContent:'center',
      position:'relative', overflow:'hidden',
      ...style,
    }}>
      <div style={{ width:d.w-12,height:d.h-12,border:'1px solid rgba(212,175,55,0.18)',borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center' }}>
        <span style={{ color:'rgba(212,175,55,0.28)',fontSize:d.centerSz-6 }}>♦</span>
      </div>
    </div>
  );
}

Object.assign(window, { PlayingCard, CardBack, SUIT_SYMS, SUIT_CLR, CARD_DIMS });
