// Mock data for TheRoute prototype
window.MOCK = (() => {
  const COLORS = {
    red:    { dot:'#e84a4a', label:'빨강', kr:'🔴' },
    orange: { dot:'#f08736', label:'주황', kr:'🟠' },
    yellow: { dot:'#f3c94a', label:'노랑', kr:'🟡' },
    green:  { dot:'#4aa760', label:'초록', kr:'🟢' },
    blue:   { dot:'#4a86e8', label:'파랑', kr:'🔵' },
    navy:   { dot:'#2b3e7a', label:'남색', kr:'🟦' },
    purple: { dot:'#8b5cb8', label:'보라', kr:'🟣' },
    black:  { dot:'#1a1a1a', label:'검정', kr:'⚫' },
    white:  { dot:'#f7f7f5', label:'흰색', kr:'⚪' },
    gray:   { dot:'#8c8c88', label:'회색', kr:'⬛' },
  };

  const gyms = [
    { id:1, name:'더클라임 강남', address:'서울 강남구 테헤란로 124', hours:'10:00–24:00', distKm:1.2, routeCount:18 },
    { id:2, name:'클라이밍파크 신촌', address:'서울 서대문구 연세로 9', hours:'09:00–23:00', distKm:3.4, routeCount:12 },
    { id:3, name:'볼더스 홍대', address:'서울 마포구 양화로 188', hours:'10:00–23:00', distKm:5.1, routeCount:9 },
    { id:4, name:'더클라임 양재', address:'서울 서초구 강남대로 24', hours:'10:00–24:00', distKm:6.8, routeCount:14 },
    { id:5, name:'손상원클라이밍 송파', address:'서울 송파구 올림픽로 35길', hours:'10:00–23:00', distKm:9.2, routeCount:7 },
  ];

  const problems = [
    { id:1, gym_id:1, color:'yellow', level:'V3', section:'메인 벽', route_count:5 },
    { id:2, gym_id:1, color:'blue',   level:'V4', section:'메인 벽', route_count:3 },
    { id:3, gym_id:1, color:'red',    level:'V5', section:'슬랩',   route_count:2 },
    { id:4, gym_id:1, color:'green',  level:'V2', section:'오버행', route_count:4 },
    { id:5, gym_id:1, color:'purple', level:'V6', section:'메인 벽', route_count:1 },
    { id:6, gym_id:1, color:'black',  level:'V7', section:'오버행', route_count:1 },
  ];

  const routes = [
    { id:1, problem_id:1, gym_id:1, color:'yellow', level:'V3', cleared:true,  attempts:2, likes:12, bookmarks:3, saved:false, date:'2026-05-08', wall:'슬랩', tech:['스미어'] },
    { id:2, problem_id:2, gym_id:1, color:'blue',   level:'V4', cleared:true,  attempts:5, likes:4,  bookmarks:1, saved:true,  date:'2026-05-08', wall:'수직벽', tech:['크림프'] },
    { id:3, problem_id:3, gym_id:1, color:'red',    level:'V5', cleared:false, attempts:8, likes:21, bookmarks:7, saved:false, date:'2026-05-07', wall:'슬랩', tech:['하이스텝','밸런스'] },
    { id:4, problem_id:4, gym_id:1, color:'green',  level:'V2', cleared:true,  attempts:1, likes:2,  bookmarks:0, saved:false, date:'2026-05-05', wall:'오버행', tech:[] },
    { id:5, problem_id:5, gym_id:1, color:'purple', level:'V6', cleared:false, attempts:12,likes:34, bookmarks:11,saved:true,  date:'2026-05-03', wall:'오버행', tech:['다이나믹','점핑무브'] },
    { id:6, problem_id:6, gym_id:1, color:'black',  level:'V7', cleared:false, attempts:6, likes:8,  bookmarks:2, saved:false, date:'2026-05-01', wall:'오버행', tech:['크림프','파워'] },
  ];

  const passes = [
    { id:1, gym_id:1, gym_name:'더클라임 강남', pass_type:'period', label:'월정기권', start_date:'2026-05-01', end_date:'2026-05-31', days_remaining:12, is_active:true },
    { id:2, gym_id:2, gym_name:'클라이밍파크 신촌', pass_type:'count', label:'10회권', total_count:10, remaining_count:7, end_date:'2026-12-31', days_remaining:240 },
    { id:3, gym_id:3, gym_name:'볼더스 홍대', pass_type:'count', label:'10회권', total_count:10, remaining_count:3, end_date:null },
  ];

  const calendarDots = ['2026-05-01','2026-05-03','2026-05-05','2026-05-07','2026-05-08','2026-05-11','2026-05-12','2026-05-15','2026-05-18','2026-05-22'];

  const goals = [
    { id:1, title:'V6 첫 완등', category:'boulder_grade', target_date:'2026-08-31', days_left:118, progress:40, status:'in_progress', memo:'노랑 V5는 5번째 완등 후' },
    { id:2, title:'데드행 60초 (한 손)', category:'endurance_metric', metric:'초', current:38, target:60, progress:63, status:'in_progress' },
    { id:3, title:'주 3회 훈련 유지', category:'frequency', current:9, target:12, progress:75, status:'in_progress', memo:'이번달 9/12회' },
  ];

  const sessions = [
    { id:11, date:'2026-05-08', category:'endurance', gym_name:'더클라임 강남', duration:60, memo:'손가락 컨디션 좋음',
      items:[
        { name:'핑거보드 데드행', sets:3, val:38, unit:'sec' },
        { name:'트래버스', sets:5, val:180, unit:'sec', note:'평균 3분' },
      ] },
    { id:12, date:'2026-05-07', synthetic:true, category:'bouldering', gym_name:'더클라임 강남', summary:'6완등 / 11시도' },
    { id:13, date:'2026-05-05', category:'conditioning', gym_name:null, duration:45,
      items:[
        { name:'풀업', sets:4, val:8, unit:'rep', weight:0 },
        { name:'코어(플랭크)', sets:3, val:60, unit:'sec' },
      ] },
  ];

  const climbLogs = [
    { id:14, date:'2026-05-08', gym_name:'더클라임 강남', pass:{type:'count',label:'10회권',remaining:6}, memo:'슬랩 위주로 풀었음',
      problems:[
        { color:'yellow', level:'V3', cleared:true, attempts:2, video:true },
        { color:'blue',   level:'V4', cleared:true, attempts:5, video:true },
        { color:'red',    level:'V5', cleared:false,attempts:8, video:false },
      ]
    }
  ];

  const user = {
    nickname: '나',
    max_level: { color:'yellow', grade:'V3', gym:'더클라임 강남' },
    started: '2024-03-05',
    tenure: '2년 2개월차 (792일)',
    main_gyms: ['더클라임 강남','클라이밍파크 신촌'],
    bio: '주 3회. 슬랩 좋아함. V5 프로젝트 중.',
    counts: { routes:8, bookmarks:3, passes:3 },
  };

  return { COLORS, gyms, problems, routes, passes, calendarDots, goals, sessions, climbLogs, user };
})();
