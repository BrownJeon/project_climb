// All screens (01,02,04,05,06,07,08,09) for TheRoute
const M = window.MOCK;
const Cc = M.COLORS;

// helper
const fmt = (color, level) => `${Cc[color]?.label||color}${Cc[color]?.kr||''}${level?` (${level})`:''}`;

// ════════ 01 HOME / FEED ════════
function HomeScreen(){
  const [tab, setTab] = useState('feed');
  const [filter, setFilter] = useState('all');
  return (
    <div style={{paddingBottom:100}}>
      <TopBar brand right={<button style={{padding:8,color:'var(--ink-2)'}}>{I.bell(20)}</button>}/>
      {/* Hero stats */}
      <div style={{padding:'14px 16px 8px'}}>
        <div style={{
          background:'linear-gradient(135deg, var(--primary) 0%, oklch(58% 0.18 28) 100%)',
          color:'#fff', borderRadius:'var(--r-md)', padding:'16px 18px',
        }}>
          <div style={{fontSize:11, opacity:.85, fontWeight:600, letterSpacing:.4}}>이번 주</div>
          <div style={{display:'flex', alignItems:'baseline', gap:6, marginTop:2}}>
            <span style={{fontSize:32, fontWeight:800, letterSpacing:-1}} className="tabnum">9</span>
            <span style={{fontSize:13, opacity:.9}}>완등</span>
            <span style={{margin:'0 6px', opacity:.4}}>·</span>
            <span style={{fontSize:32, fontWeight:800, letterSpacing:-1}} className="tabnum">3</span>
            <span style={{fontSize:13, opacity:.9}}>방문</span>
          </div>
          <div style={{display:'flex', gap:4, marginTop:14}}>
            {['월','화','수','목','금','토','일'].map((d,i)=>(
              <div key={d} style={{flex:1}}>
                <div style={{
                  height:36, borderRadius:6,
                  background: [0,2,4].includes(i)?'rgba(255,255,255,.85)':'rgba(255,255,255,.18)',
                }}/>
                <div style={{fontSize:10, textAlign:'center', marginTop:4, opacity:.8}}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex', gap:18, padding:'10px 16px 4px', borderBottom:'1px solid var(--line)'}}>
        {[['feed','피드'],['mine','내 영상']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{
            paddingBottom:10, borderBottom: tab===k?'2px solid var(--ink-1)':'2px solid transparent',
            fontSize:14, fontWeight: tab===k?700:500, color: tab===k?'var(--ink-1)':'var(--ink-3)',
          }}>{l}</button>
        ))}
      </div>

      {/* Filter chips */}
      <div style={{display:'flex', gap:6, padding:'12px 16px 8px', overflowX:'auto'}}>
        {[['all','전체'],['v3','V3 이하'],['v4','V4-V5'],['v6','V6+'],['recent','최근 1주']].map(([k,l])=>(
          <Chip key={k} active={filter===k} onClick={()=>setFilter(k)}>{l}</Chip>
        ))}
      </div>

      {/* Feed grid */}
      <div style={{padding:'8px 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
        {M.routes.map(r => <RouteCard key={r.id} route={r}/>)}
      </div>
      <BottomNav active="home"/>
    </div>
  );
}

// ════════ 02 ROUTE DETAIL ════════
function RouteDetail(){
  const r = M.routes[2]; // V5 challenging
  const meta = Cc[r.color];
  const others = M.routes.filter(x=>x.color===r.color).slice(0,3);
  return (
    <div style={{paddingBottom:80, background:'var(--bg)'}}>
      {/* video */}
      <div style={{
        position:'relative', aspectRatio:'9/13.5',
        background:`linear-gradient(160deg, ${meta.dot}55, ${meta.dot}aa)`,
      }}>
        <div style={{position:'absolute', top:14, left:14, display:'flex', gap:8}}>
          <button style={{width:36, height:36, borderRadius:'50%', background:'rgba(0,0,0,.45)', backdropFilter:'blur(8px)', color:'#fff', display:'grid', placeItems:'center'}}>{I.chev(16,'left')}</button>
        </div>
        <div style={{position:'absolute', top:14, right:14}}>
          <button style={{width:36, height:36, borderRadius:'50%', background:'rgba(0,0,0,.45)', backdropFilter:'blur(8px)', color:'#fff', display:'grid', placeItems:'center'}}>{I.more(18)}</button>
        </div>
        {/* holds */}
        {[[20,30,12],[40,55,16],[55,42,12],[70,28,14],[78,55,12]].map(([t,l,s],i)=>(
          <div key={i} style={{position:'absolute', top:`${t}%`, left:`${l}%`, width:s, height:s+4, borderRadius:5, background:meta.dot, boxShadow:'0 2px 6px rgba(0,0,0,.3)'}}/>
        ))}
        <div style={{position:'absolute', inset:0, display:'grid', placeItems:'center'}}>
          <div style={{width:64, height:64, borderRadius:'50%', background:'rgba(0,0,0,.55)', backdropFilter:'blur(10px)', color:'#fff', display:'grid', placeItems:'center'}}>{I.play(22)}</div>
        </div>
        {/* timeline */}
        <div style={{position:'absolute', bottom:14, left:14, right:14, display:'flex', alignItems:'center', gap:10, color:'#fff'}}>
          <span style={{fontSize:12, fontWeight:600}} className="tabnum">0:08</span>
          <div style={{flex:1, height:3, borderRadius:2, background:'rgba(255,255,255,.3)'}}>
            <div style={{width:'34%', height:'100%', borderRadius:2, background:'#fff'}}/>
          </div>
          <span style={{fontSize:12, fontWeight:600, opacity:.8}} className="tabnum">0:23</span>
        </div>
      </div>

      {/* meta */}
      <div style={{padding:'14px 16px', background:'var(--surface)', borderBottom:'1px solid var(--line)'}}>
        <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
          <ColorBadge color={r.color} level={r.level}/>
          <Pill tone="warn">진행중 · {r.attempts}회 시도</Pill>
        </div>
        <div style={{fontSize:18, fontWeight:700, marginBottom:4}}>{fmt(r.color, r.level)}</div>
        <div style={{fontSize:13, color:'var(--ink-3)', display:'flex', alignItems:'center', gap:5}}>
          {I.pin(13)} 더클라임 강남 · 슬랩 · {r.date}
        </div>
        {/* tags */}
        <div style={{display:'flex', gap:5, marginTop:12, flexWrap:'wrap'}}>
          {['#슬랩','#하이스텝','#밸런스'].map(t=><span key={t} style={{
            fontSize:11, padding:'4px 9px', borderRadius:'var(--r-pill)',
            background:'var(--surface-2)', color:'var(--ink-2)', fontWeight:500,
          }}>{t}</span>)}
        </div>
        {/* actions */}
        <div style={{display:'flex', gap:8, marginTop:14, paddingTop:14, borderTop:'1px solid var(--line)'}}>
          <button style={{flex:1, height:42, borderRadius:'var(--r-sm)', background:'var(--surface-2)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:13, fontWeight:600, color:'var(--ink-2)'}}>{I.heart(16)}<span>좋아요 21</span></button>
          <button style={{flex:1, height:42, borderRadius:'var(--r-sm)', background:'var(--surface-2)', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:13, fontWeight:600, color:'var(--ink-2)'}}>{I.bookmark(16)}<span>스크랩</span></button>
        </div>
      </div>

      {/* memo */}
      <div style={{padding:'14px 16px', background:'var(--surface)', marginTop:8, borderTop:'1px solid var(--line)', borderBottom:'1px solid var(--line)'}}>
        <div style={{fontSize:12, fontWeight:700, color:'var(--ink-3)', marginBottom:6, letterSpacing:.4}}>메모</div>
        <div style={{fontSize:13, color:'var(--ink-2)', lineHeight:1.55}}>
          크럭스에서 자꾸 미끌림. 다음엔 우측 발을 더 높게 올려서 무게중심을 옮겨보기. 핑거보드 보강 필요.
        </div>
      </div>

      {/* same color list */}
      <div style={{padding:'14px 16px'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10}}>
          <span style={{fontSize:14, fontWeight:700}}>같은 색 다른 영상</span>
          <span style={{fontSize:12, color:'var(--ink-3)'}}>{others.length}개</span>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
          {others.map(o=><RouteCard key={o.id} route={o} compact/>)}
        </div>
      </div>
    </div>
  );
}

// ════════ 04 GYM LIST ════════
function GymList(){
  return (
    <div style={{paddingBottom:100}}>
      <TopBar title="기록"/>
      <div style={{padding:'12px 16px'}}>
        {/* search */}
        <div style={{display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'var(--surface)', border:'1px solid var(--line)', borderRadius:'var(--r-pill)'}}>
          <span style={{color:'var(--ink-4)'}}>{I.search(16)}</span>
          <input placeholder="암장 이름 검색" style={{flex:1, border:0, outline:'none', fontSize:14, background:'transparent'}}/>
        </div>
        <div style={{display:'flex', gap:6, marginTop:10}}>
          <Chip active icon={I.pin(12)}>내 위치 5km</Chip>
          <Chip>최근 방문</Chip>
          <Chip>주 암장</Chip>
        </div>
      </div>

      <div style={{padding:'4px 16px 16px', fontSize:12, color:'var(--ink-3)', fontWeight:600}}>
        검색 결과 {M.gyms.length}
      </div>

      <div style={{padding:'0 16px', display:'flex', flexDirection:'column', gap:10}}>
        {M.gyms.map(g=>(
          <div key={g.id} style={{background:'var(--surface)', border:'1px solid var(--line)', borderRadius:'var(--r-md)', padding:'14px 14px 12px'}}>
            <div style={{display:'flex', alignItems:'flex-start', gap:8}}>
              <div style={{flex:1, minWidth:0}}>
                <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:3}}>
                  <span style={{fontSize:15, fontWeight:700}}>{g.name}</span>
                  {g.id===1 && <Pill tone="primary">★ 주</Pill>}
                </div>
                <div style={{fontSize:12, color:'var(--ink-3)', marginBottom:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{g.address}</div>
                <div style={{display:'flex', alignItems:'center', gap:10, fontSize:11, color:'var(--ink-3)'}}>
                  <span style={{display:'inline-flex', alignItems:'center', gap:3}}>{I.clock(11)} {g.hours}</span>
                  <span style={{display:'inline-flex', alignItems:'center', gap:3}}>{I.pin(11)} <span className="tabnum">{g.distKm}km</span></span>
                  <span style={{display:'inline-flex', alignItems:'center', gap:3}}>{I.film(11)} <span className="tabnum">{g.routeCount}</span></span>
                </div>
              </div>
              <span style={{color:'var(--ink-4)', marginTop:2}}>{I.chev(14)}</span>
            </div>
            {/* recent thumbs */}
            <div style={{display:'flex', gap:5, marginTop:11, overflow:'hidden'}}>
              {[0,1,2,3].map(i=>{
                const c = ['yellow','blue','red','purple'][i];
                return <div key={i} style={{
                  width:48, height:60, flexShrink:0, borderRadius:8,
                  background:`linear-gradient(160deg, ${Cc[c].dot}44, ${Cc[c].dot}88)`,
                  position:'relative',
                }}>
                  <div style={{position:'absolute', top:4, left:4, width:5, height:5, borderRadius:'50%', background:Cc[c].dot, boxShadow:'0 0 0 1.5px #fff'}}/>
                </div>;
              })}
            </div>
          </div>
        ))}
      </div>
      <BottomNav active="gyms"/>
    </div>
  );
}

// ════════ 05 GYM DETAIL ════════
function GymDetail(){
  const [tab, setTab] = useState('routes');
  const g = M.gyms[0];
  return (
    <div style={{paddingBottom:80}}>
      <TopBar title="암장 상세" back/>
      {/* header */}
      <div style={{padding:'16px', background:'var(--surface)', borderBottom:'1px solid var(--line)'}}>
        <div style={{fontSize:20, fontWeight:800, letterSpacing:-.4}}>{g.name}</div>
        <div style={{fontSize:13, color:'var(--ink-3)', marginTop:4}}>{g.address}</div>
        <div style={{display:'flex', gap:14, marginTop:10, fontSize:12, color:'var(--ink-2)'}}>
          <span style={{display:'inline-flex', alignItems:'center', gap:4}}>{I.clock(13)} 평일 10–24, 주말 10–22</span>
        </div>
        <div style={{fontSize:12, color:'var(--ink-2)', marginTop:4}}>💴 1일권 22,000원</div>
        <div style={{display:'flex', gap:8, marginTop:14}}>
          <Btn variant="ghost" size="sm" icon={I.pin(13)}>지도 보기</Btn>
          <Btn variant="soft" size="sm" icon={I.star(13,true)}>주 암장 빼기</Btn>
        </div>
      </div>

      {/* tabs */}
      <div style={{display:'flex', gap:18, padding:'0 16px', borderBottom:'1px solid var(--line)', background:'var(--surface)', position:'sticky', top:54, zIndex:4}}>
        {[['routes',`영상 (8)`],['problems',`문제 (${M.problems.length})`]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{
            padding:'12px 0', borderBottom: tab===k?'2px solid var(--ink-1)':'2px solid transparent',
            fontSize:13, fontWeight: tab===k?700:500, color: tab===k?'var(--ink-1)':'var(--ink-3)',
          }}>{l}</button>
        ))}
      </div>

      {tab==='routes' ? (
        <>
          <div style={{display:'flex', justifyContent:'space-between', padding:'12px 16px 6px', fontSize:12}}>
            <span style={{color:'var(--ink-3)'}}>정렬: <b style={{color:'var(--ink-1)'}}>최신순</b></span>
            <span style={{color:'var(--ink-3)'}}>필터: 전체</span>
          </div>
          <div style={{padding:'4px 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
            {M.routes.slice(0,4).map(r => <RouteCard key={r.id} route={r}/>)}
          </div>
        </>
      ) : (
        <div style={{padding:'12px 16px', display:'flex', flexDirection:'column', gap:8}}>
          {M.problems.map(p=>(
            <div key={p.id} style={{
              background:'var(--surface)', border:'1px solid var(--line)',
              borderRadius:'var(--r-md)', padding:'12px 14px',
              display:'flex', alignItems:'center', gap:10,
            }}>
              <ColorBadge color={p.color} level={p.level}/>
              <span style={{flex:1, fontSize:12, color:'var(--ink-3)'}}>· {p.section}</span>
              <span style={{fontSize:12, color:'var(--ink-3)'}}>{p.route_count}개 영상</span>
              <span style={{color:'var(--ink-4)'}}>{I.chev(13)}</span>
            </div>
          ))}
          <button style={{
            marginTop:6, padding:'12px', borderRadius:'var(--r-md)',
            border:'1px dashed var(--line-2)', color:'var(--ink-2)',
            fontSize:13, fontWeight:600, background:'transparent',
          }}>+ 새 문제 등록</button>
        </div>
      )}
    </div>
  );
}

// ════════ 06 CALENDAR ════════
function CalendarScreen(){
  const dots = new Set(M.calendarDots);
  const days = Array.from({length:31}, (_,i)=>i+1);
  const startOffset = 5; // May 2026 starts Friday
  const today = 8;
  const [selected, setSelected] = useState(8);
  const log = M.climbLogs[0];

  return (
    <div style={{paddingBottom:100}}>
      <TopBar title="캘린더"/>
      {/* month header */}
      <div style={{padding:'14px 16px 6px', display:'flex', alignItems:'center', justifyContent:'center', gap:24}}>
        <button style={{padding:6, color:'var(--ink-3)'}}>{I.chev(16,'left')}</button>
        <div style={{fontSize:18, fontWeight:700}}>2026년 5월</div>
        <button style={{padding:6, color:'var(--ink-3)'}}>{I.chev(16)}</button>
      </div>
      {/* week labels */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:'8px 12px 4px'}}>
        {['일','월','화','수','목','금','토'].map((d,i)=>(
          <div key={d} style={{textAlign:'center', fontSize:11, fontWeight:600, color:i===0?'var(--danger)':i===6?'var(--c-blue)':'var(--ink-3)'}}>{d}</div>
        ))}
      </div>
      {/* grid */}
      <div style={{padding:'4px 12px', display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2}}>
        {Array.from({length:startOffset}).map((_,i)=><div key={'p'+i}/>)}
        {days.map(d=>{
          const dateStr = `2026-05-${String(d).padStart(2,'0')}`;
          const has = dots.has(dateStr);
          const sel = selected===d;
          const isToday = d===today;
          return (
            <button key={d} onClick={()=>setSelected(d)} style={{
              aspectRatio:'1', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              borderRadius:'var(--r-sm)', position:'relative',
              background: sel?'var(--ink-1)':isToday?'var(--primary-soft)':'transparent',
              color: sel?'var(--surface)':'var(--ink-1)',
              fontSize:14, fontWeight: sel||isToday?700:500,
            }}>
              <span className="tabnum">{d}</span>
              {has && <span style={{
                width:5, height:5, borderRadius:'50%',
                background: sel?'var(--surface)':'var(--primary)',
                marginTop:2,
              }}/>}
            </button>
          );
        })}
      </div>

      {/* selected day panel */}
      <div style={{padding:'12px 16px 4px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div style={{fontSize:14, fontWeight:700}}>5월 {selected}일 (목) 기록</div>
        <Pill tone="primary">{log.problems.length}완등</Pill>
      </div>

      <div style={{padding:'4px 16px 12px'}}>
        <div style={{background:'var(--surface)', border:'1px solid var(--line)', borderRadius:'var(--r-md)', overflow:'hidden'}}>
          <div style={{padding:'12px 14px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:14, fontWeight:700}}>{log.gym_name}</div>
              <div style={{fontSize:11, color:'var(--ink-3)', marginTop:3, display:'inline-flex', alignItems:'center', gap:4}}>
                {I.ticket(11)} {log.pass.label} (잔여 {log.pass.remaining}회)
              </div>
            </div>
            <button style={{color:'var(--ink-4)'}}>{I.more(18)}</button>
          </div>
          {/* memo */}
          <div style={{padding:'10px 14px', borderBottom:'1px solid var(--line)', fontSize:12.5, color:'var(--ink-2)'}}>
            <span style={{color:'var(--ink-4)', fontSize:11, marginRight:6}}>메모</span>
            {log.memo}
          </div>
          {/* problems */}
          <div style={{padding:'8px 14px 12px'}}>
            {log.problems.map((p,i)=>(
              <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom: i<log.problems.length-1?'1px solid var(--line)':'none'}}>
                <ColorBadge color={p.color} level={p.level} size="sm"/>
                {p.cleared
                  ? <span style={{display:'inline-flex', alignItems:'center', gap:3, color:'var(--success)', fontSize:12, fontWeight:600}}>{I.check(12)} 완등</span>
                  : <span style={{color:'var(--ink-4)', fontSize:12}}>도전 중</span>}
                <span style={{fontSize:12, color:'var(--ink-3)'}} className="tabnum">· {p.attempts}회</span>
                {p.video && <span style={{marginLeft:'auto', color:'var(--primary)'}}>{I.film(13)}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{padding:'0 16px'}}>
        <Btn variant="ghost" full icon={I.plus(15)}>기록 추가</Btn>
      </div>
      <BottomNav active="cal"/>
    </div>
  );
}

// ════════ 07 MY PAGE ════════
function MyPage(){
  const [tab, setTab] = useState('routes');
  const u = M.user;
  return (
    <div style={{paddingBottom:80}}>
      <TopBar title="마이페이지" back/>
      {/* profile */}
      <div style={{padding:'18px 16px', background:'var(--surface)', borderBottom:'1px solid var(--line)'}}>
        <div style={{display:'flex', gap:14, alignItems:'center', marginBottom:14}}>
          <div style={{
            width:64, height:64, borderRadius:'50%',
            background:'linear-gradient(135deg, var(--primary), oklch(58% 0.18 28))',
            display:'grid', placeItems:'center', color:'#fff', fontSize:24, fontWeight:800,
          }}>나</div>
          <div style={{flex:1}}>
            <div style={{fontSize:18, fontWeight:800, marginBottom:2}}>{u.nickname}</div>
            <div style={{fontSize:11, color:'var(--ink-3)'}}>{u.bio}</div>
          </div>
          <button style={{padding:'7px 11px', fontSize:12, fontWeight:600, color:'var(--ink-2)', border:'1px solid var(--line-2)', borderRadius:'var(--r-pill)', background:'var(--surface)'}}>편집</button>
        </div>
        {/* stats rows */}
        <div style={{display:'flex', flexDirection:'column', gap:8, fontSize:13}}>
          <div style={{display:'flex', alignItems:'center', gap:8, color:'var(--ink-2)'}}>
            <span style={{width:18}}>🏆</span>
            <span style={{color:'var(--ink-3)', fontSize:12}}>최고 레벨</span>
            <ColorBadge color={u.max_level.color} level={u.max_level.grade} size="sm"/>
            <span style={{fontSize:11, color:'var(--ink-4)'}}>· {u.max_level.gym}</span>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8, color:'var(--ink-2)'}}>
            <span style={{width:18}}>{I.flame(15)}</span>
            <span style={{color:'var(--ink-3)', fontSize:12}}>경력</span>
            <span style={{fontWeight:600}}>{u.tenure}</span>
          </div>
          <div style={{display:'flex', alignItems:'flex-start', gap:8, color:'var(--ink-2)'}}>
            <span style={{width:18}}>{I.pin(15)}</span>
            <span style={{color:'var(--ink-3)', fontSize:12, marginTop:1}}>주 암장</span>
            <div style={{display:'flex', gap:5, flexWrap:'wrap'}}>
              {u.main_gyms.map(g=><span key={g} style={{
                fontSize:12, padding:'3px 9px', borderRadius:'var(--r-pill)',
                background:'var(--surface-2)', border:'1px solid var(--line)', fontWeight:600,
              }}>{g}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div style={{display:'flex', gap:18, padding:'0 16px', borderBottom:'1px solid var(--line)', background:'var(--surface)'}}>
        {[['routes',`내 영상 (${u.counts.routes})`],['bookmarks',`북마크 (${u.counts.bookmarks})`],['passes',`이용권 (${u.counts.passes})`]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{
            padding:'12px 0', borderBottom: tab===k?'2px solid var(--ink-1)':'2px solid transparent',
            fontSize:13, fontWeight: tab===k?700:500, color: tab===k?'var(--ink-1)':'var(--ink-3)',
          }}>{l}</button>
        ))}
      </div>

      {tab==='passes' ? (
        <div style={{padding:'12px 16px', display:'flex', flexDirection:'column', gap:10}}>
          {M.passes.map(p=>(
            <div key={p.id} style={{
              background:'var(--surface)', border:'1px solid var(--line)',
              borderRadius:'var(--r-md)', padding:'14px',
            }}>
              <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:8}}>
                <span style={{fontSize:14, fontWeight:700}}>{p.gym_name}</span>
                <Pill tone={p.pass_type==='period'?'primary':'neutral'}>{p.pass_type==='period'?'정기권':'횟수권'}</Pill>
              </div>
              {p.pass_type==='period' ? (
                <>
                  <div style={{fontSize:12, color:'var(--ink-3)', marginBottom:3}}>📅 {p.start_date} ~ {p.end_date}</div>
                  <div style={{fontSize:13, fontWeight:600, color:'var(--primary)'}}>⏳ 잔여 {p.days_remaining}일</div>
                </>
              ) : (
                <>
                  <div style={{fontSize:13, fontWeight:700, marginBottom:6}} className="tabnum">🎟️ 잔여 {p.remaining_count} / {p.total_count}회</div>
                  <div style={{height:6, borderRadius:3, background:'var(--surface-2)', overflow:'hidden', marginBottom:8}}>
                    <div style={{height:'100%', width:`${p.remaining_count/p.total_count*100}%`, background:'var(--primary)'}}/>
                  </div>
                  <div style={{fontSize:11, color:'var(--ink-3)'}}>📅 {p.end_date?`만료일: ${p.end_date}`:'만료일 없음 (무기한)'}</div>
                  <div style={{display:'flex', justifyContent:'flex-end', marginTop:8}}>
                    <Btn variant="soft" size="sm">1회 사용</Btn>
                  </div>
                </>
              )}
            </div>
          ))}
          <Btn variant="ghost" full icon={I.plus(15)}>이용권 등록</Btn>
        </div>
      ) : (
        <div style={{padding:'12px 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
          {(tab==='bookmarks'?M.routes.filter(r=>r.saved):M.routes).slice(0,6).map(r=><RouteCard key={r.id} route={r}/>)}
        </div>
      )}
    </div>
  );
}

// ════════ 08 TRAINING ════════
function TrainingScreen(){
  const [tab, setTab] = useState('goals');
  return (
    <div style={{paddingBottom:100}}>
      <TopBar title="훈련"/>
      {/* tabs */}
      <div style={{display:'flex', gap:18, padding:'0 16px', borderBottom:'1px solid var(--line)', background:'var(--surface)'}}>
        {[['goals','목표'],['records','기록'],['analysis','분석']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{
            padding:'12px 0', borderBottom: tab===k?'2px solid var(--ink-1)':'2px solid transparent',
            fontSize:13, fontWeight: tab===k?700:500, color: tab===k?'var(--ink-1)':'var(--ink-3)',
          }}>{l}</button>
        ))}
      </div>

      {tab==='goals' && (
        <div style={{padding:'14px 16px', display:'flex', flexDirection:'column', gap:10}}>
          <div style={{fontSize:12, color:'var(--ink-3)', fontWeight:600}}>진행 중 ({M.goals.length})</div>
          {M.goals.map(g=>(
            <div key={g.id} style={{background:'var(--surface)', border:'1px solid var(--line)', borderRadius:'var(--r-md)', padding:'14px'}}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                <span style={{fontSize:14, fontWeight:700}}>🎯 {g.title}</span>
              </div>
              {g.target_date && <div style={{fontSize:11, color:'var(--ink-3)', marginBottom:8}}>마감: {g.target_date} ({g.days_left}일 남음)</div>}
              {g.metric && <div style={{fontSize:12, color:'var(--ink-2)', marginBottom:8}}>측정 단위: {g.metric} · 현재 <b className="tabnum">{g.current}</b> → 목표 <b className="tabnum">{g.target}</b></div>}
              <div style={{height:6, borderRadius:3, background:'var(--surface-2)', overflow:'hidden', marginBottom:6}}>
                <div style={{height:'100%', width:`${g.progress}%`, background:'var(--primary)', transition:'width .3s'}}/>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:11}}>
                <span style={{color:'var(--ink-3)'}}>{g.memo||''}</span>
                <span style={{color:'var(--ink-1)', fontWeight:700}} className="tabnum">{g.progress}%</span>
              </div>
            </div>
          ))}
          <Btn variant="ghost" full icon={I.plus(15)}>새 목표</Btn>
        </div>
      )}

      {tab==='records' && (
        <div style={{padding:'14px 16px', display:'flex', flexDirection:'column', gap:12}}>
          <div style={{background:'var(--surface)', border:'1px solid var(--line)', borderRadius:'var(--r-md)', padding:'14px'}}>
            <div style={{fontSize:12, fontWeight:700, color:'var(--ink-3)', marginBottom:10}}>이번 주 요약</div>
            {[['볼더링','3회','4시간'],['지구력','2회','1.5시간'],['컨디셔닝','4회','2시간']].map(([cat,cnt,t])=>(
              <div key={cat} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', fontSize:13}}>
                <span style={{color:'var(--ink-2)'}}>{cat}</span>
                <span style={{color:'var(--ink-3)', fontSize:12}} className="tabnum">{cnt} · {t}</span>
              </div>
            ))}
            <div style={{display:'flex', justifyContent:'space-between', paddingTop:8, marginTop:6, borderTop:'1px solid var(--line)', fontSize:13, fontWeight:700}}>
              <span>합계</span>
              <span className="tabnum">9세션 · 7.5시간</span>
            </div>
          </div>
          <div style={{fontSize:12, color:'var(--ink-3)', fontWeight:600}}>최근 세션</div>
          {M.sessions.map(s=>(
            <div key={s.id} style={{background:'var(--surface)', border:'1px solid var(--line)', borderRadius:'var(--r-md)', padding:'14px'}}>
              <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:6}}>
                <span style={{fontSize:13, fontWeight:700}}>{s.date}</span>
                <Pill tone={s.synthetic?'primary':'neutral'}>{
                  s.category==='endurance'?'지구력':s.category==='conditioning'?'컨디셔닝':'볼더링'
                }{s.synthetic?' · 자동':''}</Pill>
              </div>
              {s.summary
                ? <div style={{fontSize:12.5, color:'var(--ink-2)'}}>{s.gym_name} · {s.summary}</div>
                : <>
                    <div style={{fontSize:11, color:'var(--ink-3)', marginBottom:6}}>⏱ {s.duration}분{s.gym_name?` · 📍 ${s.gym_name}`:''}</div>
                    {s.items.map((it,i)=>(
                      <div key={i} style={{fontSize:12.5, color:'var(--ink-2)', padding:'2px 0'}}>· {it.name} <span className="tabnum">{it.val}{it.unit}</span> × {it.sets}세트</div>
                    ))}
                    {s.memo && <div style={{fontSize:11, color:'var(--ink-3)', marginTop:6}}>메모: {s.memo}</div>}
                  </>
              }
            </div>
          ))}
        </div>
      )}

      {tab==='analysis' && (
        <div style={{padding:'14px 16px', display:'flex', flexDirection:'column', gap:14}}>
          <div style={{background:'var(--surface)', border:'1px solid var(--line)', borderRadius:'var(--r-md)', padding:'14px'}}>
            <div style={{fontSize:12, fontWeight:700, color:'var(--ink-3)', marginBottom:10}}>분석 요청</div>
            <div style={{display:'flex', gap:6, marginBottom:12}}>
              <Chip>1주</Chip><Chip active>최근 4주</Chip><Chip>3개월</Chip><Chip>직접</Chip>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:7, marginBottom:14}}>
              {[['약점·강점',true],['진행 추세',true],['다음 1주 추천 메뉴',true],['부상 리스크',false]].map(([l,c],i)=>(
                <label key={i} style={{display:'flex', alignItems:'center', gap:9, fontSize:13, color:'var(--ink-2)'}}>
                  <span style={{
                    width:18, height:18, borderRadius:5, border:`1.5px solid ${c?'var(--primary)':'var(--line-2)'}`,
                    background: c?'var(--primary)':'transparent', display:'grid', placeItems:'center', color:'#fff',
                  }}>{c && I.check(11)}</span>
                  {l}
                </label>
              ))}
            </div>
            <Btn variant="accent" full icon={I.sparkles(15)}>AI 분석 요청</Btn>
          </div>

          {/* result */}
          <div style={{background:'var(--surface)', border:'1px solid var(--line)', borderRadius:'var(--r-md)', padding:'14px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
              <div style={{fontSize:13, fontWeight:700}}>2026-05-08 분석</div>
              <Pill tone="success">완료 · 8.4s</Pill>
            </div>
            <div style={{fontSize:11, color:'var(--ink-3)', marginBottom:10}}>engine: claude-cli · template: analysis_meta_v1 (v2)</div>
            <div style={{fontSize:12.5, color:'var(--ink-2)', lineHeight:1.65}}>
              <div style={{fontWeight:700, color:'var(--ink-1)', marginTop:4, marginBottom:3}}>강점</div>
              · 노랑(V3~V4) 평균 시도 2회로 안정적인 완등<br/>
              · 컨디셔닝 빈도 주 4회로 베이스 견고
              <div style={{fontWeight:700, color:'var(--ink-1)', marginTop:8, marginBottom:3}}>약점</div>
              · 빨강(V5+) 평균 시도 8회 이상 — 핑거력·코어 부족 추정<br/>
              · 오버행 완등률 22%로 다른 벽 대비 낮음
              <div style={{fontWeight:700, color:'var(--ink-1)', marginTop:8, marginBottom:3}}>이번 주 추천</div>
              1. 캠퍼스보드 인터벌 주 1회 추가<br/>
              2. 데드행 38s → 45s 점진 증량
            </div>
          </div>
        </div>
      )}
      <BottomNav active="training"/>
    </div>
  );
}

// ════════ 09 SESSION ADD MODAL ════════
function SessionAddModal(){
  return (
    <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'flex-end', overflow:'hidden'}}>
      <div style={{
        background:'var(--bg)', width:'100%', maxHeight:'90%',
        borderRadius:'24px 24px 0 0', overflow:'auto',
        display:'flex', flexDirection:'column',
      }}>
        {/* header */}
        <div style={{
          padding:'12px 16px 14px', display:'flex', alignItems:'center', justifyContent:'space-between',
          background:'var(--surface)', borderBottom:'1px solid var(--line)', position:'sticky', top:0, zIndex:2,
        }}>
          <button style={{fontSize:14, color:'var(--ink-3)'}}>취소</button>
          <span style={{fontSize:15, fontWeight:700}}>운동 기록 추가</span>
          <button style={{fontSize:14, fontWeight:700, color:'var(--primary)'}}>저장</button>
        </div>

        <div style={{padding:'14px 16px', display:'flex', flexDirection:'column', gap:14}}>
          {/* basic */}
          <div>
            <div style={{fontSize:11, fontWeight:700, color:'var(--ink-3)', marginBottom:8, letterSpacing:.4}}>기본</div>
            <div style={{background:'var(--surface)', border:'1px solid var(--line)', borderRadius:'var(--r-md)', overflow:'hidden'}}>
              <Field label="날짜" value="2026-05-08"/>
              <Field label="암장" value="더클라임 강남" chev/>
              <div style={{padding:'12px 14px', borderBottom:'1px solid var(--line)'}}>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10}}>
                  <span style={{fontSize:13, color:'var(--ink-3)'}}>이용권<span style={{color:'var(--danger)'}}>*</span></span>
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:6}}>
                  <RadioOpt label="정기권" sub="해당 암장 정기권 없음" disabled/>
                  <RadioOpt label="횟수권" sub="10회권 (잔여 7회)" checked/>
                  <RadioOpt label="일일이용권" sub="1회용 — 22,000원"/>
                </div>
              </div>
              <Field label="메모" value="(선택) 슬랩 위주로 풀었음" placeholder isLast/>
            </div>
          </div>

          {/* attempts */}
          <div>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
              <span style={{fontSize:11, fontWeight:700, color:'var(--ink-3)', letterSpacing:.4}}>완등·시도</span>
              <span style={{fontSize:11, color:'var(--ink-4)'}}>2개</span>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {[
                { c:'yellow', l:'V3', cleared:true, attempts:2, vid:'upload' },
                { c:'red', l:'V5', cleared:false, attempts:8, vid:'none' },
              ].map((a,i)=>(
                <div key={i} style={{background:'var(--surface)', border:'1px solid var(--line)', borderRadius:'var(--r-md)', padding:'12px 14px'}}>
                  <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
                    <ColorBadge color={a.c} level={a.l} size="sm"/>
                    <span style={{flex:1, fontSize:11, color:'var(--ink-4)'}}>{i===0?'기존 문제':'카탈로그 외'}</span>
                    <button style={{color:'var(--ink-4)'}}>{I.x(16)}</button>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:14, marginBottom:10}}>
                    <label style={{display:'inline-flex', alignItems:'center', gap:7, fontSize:13}}>
                      <span style={{
                        width:18, height:18, borderRadius:5, border:`1.5px solid ${a.cleared?'var(--success)':'var(--line-2)'}`,
                        background: a.cleared?'var(--success)':'transparent', display:'grid', placeItems:'center', color:'#fff',
                      }}>{a.cleared && I.check(11)}</span>
                      완등
                    </label>
                    <div style={{display:'flex', alignItems:'center', gap:8, fontSize:13}}>
                      <span style={{color:'var(--ink-3)'}}>시도</span>
                      <div style={{display:'inline-flex', alignItems:'center', border:'1px solid var(--line)', borderRadius:'var(--r-sm)', overflow:'hidden'}}>
                        <button style={{width:28, height:28, color:'var(--ink-3)', fontSize:14}}>−</button>
                        <span className="tabnum" style={{padding:'0 12px', minWidth:24, textAlign:'center', fontWeight:700, fontSize:13}}>{a.attempts}</span>
                        <button style={{width:28, height:28, color:'var(--ink-3)', fontSize:14}}>+</button>
                      </div>
                      <span style={{color:'var(--ink-3)', fontSize:12}}>회</span>
                    </div>
                  </div>
                  {/* video */}
                  <div style={{display:'flex', flexDirection:'column', gap:5, fontSize:12.5}}>
                    <RadioOpt mini label="영상 없음" checked={a.vid==='none'}/>
                    <RadioOpt mini label="새로 업로드" sub={a.vid==='upload'?'video_3293.mp4 (24MB) · 9:16':null} checked={a.vid==='upload'}/>
                    <RadioOpt mini label="기존 영상 연결"/>
                  </div>
                </div>
              ))}
              <Btn variant="ghost" full icon={I.plus(14)}>완등·시도 추가</Btn>
            </div>
          </div>

          {/* training */}
          <div>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
              <span style={{fontSize:11, fontWeight:700, color:'var(--ink-3)', letterSpacing:.4}}>훈련</span>
              <button style={{fontSize:12, color:'var(--primary)', fontWeight:600}}>+ 추가</button>
            </div>
            <div style={{
              background:'var(--surface)', border:'1px dashed var(--line-2)',
              borderRadius:'var(--r-md)', padding:'14px',
              fontSize:12.5, color:'var(--ink-3)', textAlign:'center',
            }}>
              훈련 항목을 추가하면 분석에 반영됩니다.
            </div>
          </div>
          <div style={{height:8}}/>
        </div>
      </div>
    </div>
  );
}
function Field({ label, value, placeholder, chev, isLast }){
  return (
    <div style={{
      display:'flex', alignItems:'center', padding:'12px 14px',
      borderBottom: isLast?'none':'1px solid var(--line)',
    }}>
      <span style={{fontSize:13, color:'var(--ink-3)', width:60}}>{label}</span>
      <span style={{flex:1, fontSize:13.5, color: placeholder?'var(--ink-4)':'var(--ink-1)', fontWeight: placeholder?500:600}}>{value}</span>
      {chev && <span style={{color:'var(--ink-4)'}}>{I.chev(13)}</span>}
    </div>
  );
}
function RadioOpt({ label, sub, checked, disabled, mini }){
  return (
    <label style={{
      display:'flex', alignItems:'center', gap:9, padding: mini?'5px 0':'8px 10px',
      borderRadius:'var(--r-sm)', background: checked&&!mini?'var(--primary-soft)':'transparent',
      border: checked&&!mini?'1px solid var(--primary-line)':'1px solid transparent',
      opacity: disabled?0.45:1,
    }}>
      <span style={{
        width:16, height:16, borderRadius:'50%',
        border:`1.5px solid ${checked?'var(--primary)':'var(--line-2)'}`,
        display:'grid', placeItems:'center', flexShrink:0,
      }}>
        {checked && <span style={{width:8, height:8, borderRadius:'50%', background:'var(--primary)'}}/>}
      </span>
      <span style={{flex:1, fontSize:13, fontWeight:500}}>{label}</span>
      {sub && <span style={{fontSize:11.5, color:'var(--ink-3)'}}>{sub}</span>}
    </label>
  );
}

Object.assign(window, {
  HomeScreen, RouteDetail, GymList, GymDetail, CalendarScreen, MyPage, TrainingScreen, SessionAddModal,
});
