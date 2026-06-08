/* =====================================================================
   員工後台 Staff Console — roles, nav, views (RBAC 模擬)
   對著 contracts/openapi.json；狀態用詞照狀態機
   ===================================================================== */
const ST = { role:'front', view:'checkin', sel:null, wo:null, boardStatus:'all' };

/* ---------- icons ---------- */
const sv=(p)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const IC={
  checkin:sv('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM8.5 13l2 2 4-4"/>'),
  board:sv('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'),
  queue:sv('<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 14h4l1.5 2.5h6L16.5 14h4"/>'),
  scissors:sv('<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5L20 18M8 16.5L20 6"/>'),
  users:sv('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c1.3-3.6 10.7-3.6 12 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M18 14c2.4.4 3.6 1.8 4 3.6"/>'),
  shield:sv('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6Z"/><path d="M9 12l2 2 4-4"/>'),
  paw:sv('<circle cx="7" cy="9" r="1.7"/><circle cx="12" cy="7.3" r="1.8"/><circle cx="17" cy="9" r="1.7"/><path d="M12 12c-2.6 0-4.5 1.7-4.5 3.6 0 1.6 1.4 2.4 3 2.4 1 0 1 .4 1.5.4s.5-.4 1.5-.4c1.6 0 3-.8 3-2.4 0-1.9-1.9-3.6-4.5-3.6Z"/>'),
  chart:sv('<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>'),
  bell:sv('<path d="M6 9a6 6 0 0 1 12 0c0 4.5 1.8 5.5 1.8 5.5H4.2S6 13.5 6 9"/><path d="M10 19a2 2 0 0 0 4 0"/>'),
  search:sv('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>'),
  x:sv('<path d="M6 6l12 12M18 6L6 18"/>'),
  plus:sv('<path d="M12 5v14M5 12h14"/>'),
  alert:sv('<path d="M12 3l9 16H3Z"/><path d="M12 10v4M12 17.5v.1"/>'),
  cam:sv('<path d="M4 8h3l1.5-2h7L18 8h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.2"/>'),
};
const badge=(cls,zh,en='')=>`<span class="badge ${cls}"><span class="dot"></span>${zh}${en?`<span class="num" style="opacity:.6;font-weight:500"> ${en}</span>`:''}</span>`;
const api=(t)=>`<span class="api-tag">${t}</span>`;

/* ---------- roles ---------- */
const ROLES={
  front:{ name:'櫃台人員', sub:'Front Desk', short:'櫃', color:'hsl(22 72% 52%)', home:'checkin',
    nav:[ ['checkin','報到核驗',IC.checkin,''], ['board','床位看板',IC.board,''], ['review','待審核佇列',IC.queue,'2'] ] },
  groomer:{ name:'美容師', sub:'Groomer', short:'美', color:'hsl(265 40% 52%)', home:'workorders',
    nav:[ ['workorders','美容工作單',IC.scissors,'3'] ] },
  admin:{ name:'系統管理員', sub:'Admin', short:'管', color:'hsl(150 36% 38%)', home:'accounts',
    nav:[ ['accounts','帳號管理',IC.users,''], ['rbac','角色與權限',IC.shield,''], ['dangerpets','危險寵物',IC.paw,''], ['cancelreport','異常取消報告',IC.chart,''] ] },
};

/* ---------- data ---------- */
const KENNELS=[
  ['A-01','標準','occupied','奶油','2/12–2/15'],['A-02','標準','available','',''],['A-03','標準','occupied','黑糖','2/13–2/16'],
  ['A-04','標準','cleaning','',''],['A-05','標準','available','',''],['A-06','標準','reserved','可可','2/15 入住'],
  ['B-01','豪華','occupied','毛球','2/10–2/14'],['B-02','豪華','available','',''],['B-03','豪華','occupied','旺財','2/14–2/17'],
  ['B-04','豪華','reserved','布丁','2/16 入住'],['B-05','豪華','available','',''],['B-06','豪華','cleaning','',''],
];
const KST={ available:['k-available',badge('success','空床','Available')], reserved:['k-reserved',badge('warn','已預約','Reserved')],
  occupied:['k-occupied',badge('brand','已入住','Occupied')], cleaning:['k-cleaning',badge('neutral','清潔中','Cleaning')] };

const TODAY_CHECKIN=[
  {id:'b1', pet:'毛球', breed:'貴賓', owner:'王小明', svc:'豪華房 · 3 晚', chip:'900987654321098', chipMatch:true, vaccine:'valid', danger:'None', booking:'Confirmed'},
  {id:'b2', pet:'旺財', breed:'柴犬', owner:'李大華', svc:'完整美容', chip:'900123456789012', chipMatch:true, vaccine:'expired', danger:'Low', booking:'Confirmed'},
  {id:'b3', pet:'布丁', breed:'柯基', owner:'陳美玲', svc:'標準房 · 2 晚', chip:'900555666777888', chipMatch:true, vaccine:'valid', danger:'Medium', booking:'Confirmed'},
];
const REVIEW=[
  {id:'r1', pet:'布丁', owner:'陳美玲', svc:'標準房 · 2 晚', danger:'Medium', note:'曾對工作人員低吼', created:'今天 10:24'},
  {id:'r2', pet:'坦克', owner:'吳建國', svc:'完整美容', danger:'Medium', note:'怕剪刀、易緊張', created:'今天 09:10'},
];
const WORKORDERS=[
  {id:'w1', pet:'旺財', breed:'柴犬', svc:'完整美容', owner:'李大華', status:'Bathing', start:'14:00'},
  {id:'w2', pet:'Lucky', breed:'黃金獵犬', svc:'基礎美容', owner:'張家豪', status:'Pending', start:'—'},
  {id:'w3', pet:'妞妞', breed:'瑪爾濟斯', svc:'完整美容', owner:'林淑芬', status:'Completed', start:'11:30'},
];
const WO_STAGES=[['PreCheck','預檢'],['Bathing','洗澡'],['Drying','烘乾'],['Grooming','剪毛']];
const woStageIdx=(s)=> s==='Pending'?-1 : s==='Completed'?4 : WO_STAGES.findIndex(x=>x[0]===s);

const ACCOUNTS=[
  ['王小明','wang@example.com','飼主','Active'],['李大華','lee@example.com','飼主','Active'],
  ['陳櫃台','front@pethotel.tw','櫃台人員','Active'],['林美容','groomer@pethotel.tw','美容師','Active'],
  ['吳建國','wu@example.com','飼主','Banned'],['趙管理','admin@pethotel.tw','系統管理員','Active'],
];
const DANGER_PETS=[
  ['坦克','比特犬','吳建國','High',true],['阿虎','杜賓','周大','High',true],['旺財','柴犬','李大華','Low',false],['布丁','柯基','陳美玲','Medium',false],
];
const CANCELS=[
  ['#BK-2041','王小明','2/14 行程取消','是','2/12'],['#BK-2038','吳建國','未說明','否','2/11'],
  ['#BK-2033','吳建國','臨時有事','否','2/09'],['#BK-2027','陳美玲','寵物生病','是','2/07'],
];
const accBadge=s=> s==='Active'?badge('success','啟用','Active'):s==='Banned'?badge('danger','已封鎖','Banned'):badge('neutral','停用','Disabled');
const dangerBadge=d=> d==='High'?badge('danger','高度','High'):d==='Medium'?badge('warn','中度','Medium'):d==='Low'?badge('success','低度','Low'):badge('neutral','無','None');

/* =====================================================================
   VIEWS
   ===================================================================== */
const VIEWS={};

/* ---- 櫃台：報到核驗 ---- */
VIEWS.checkin=()=>{
  const sel = ST.sel ? TODAY_CHECKIN.find(b=>b.id===ST.sel) : null;
  const list = TODAY_CHECKIN.map(b=>`
    <div class="list-row card tap ${ST.sel===b.id?'sel':''}" data-pick="${b.id}" style="margin-bottom:10px">
      <img src="hifi/img/pet-shiba.png" class="lead" style="border-radius:12px;object-fit:cover">
      <div style="flex:1"><div class="row between"><span class="cell-strong">${b.pet} · ${b.breed}</span>${dangerBadge(b.danger)}</div>
        <div class="t-sm muted" style="margin-top:2px">${b.svc} · ${b.owner}</div></div>
      <div style="color:hsl(var(--muted-foreground))">${IC.checkin}</div>
    </div>`).join('');
  let right;
  if(!sel){ right=`<div class="empty">${IC.checkin}<div style="margin-top:10px">從左側選擇一筆今日預約開始報到</div></div>`; }
  else {
    const vacOk = sel.vaccine==='valid';
    const checks=[
      ['預約狀態', sel.booking==='Confirmed'?'ok':'bad', sel.booking==='Confirmed'?'已確認 Confirmed · 有效':'預約無效', 'GET /checkin/{id}/verify'],
      ['晶片核對', sel.chipMatch?'ok':'bad', sel.chipMatch?`${sel.chip} · 相符`:'晶片號碼不符', ''],
      ['疫苗有效期', vacOk?'ok':'bad', vacOk?'狂犬病疫苗 · 有效至 2026-12-31':'疫苗已逾期 — 必須暫停報到、待補件', 'POST /checkin/{id}/vaccine'],
      ['危險等級', sel.danger==='None'?'ok':(sel.danger==='High'?'bad':'wait'), sel.danger==='None'?'無標記':`${sel.danger==='Low'?'低度':'中度'} · 報到時留意`, ''],
    ];
    right=`
      <div class="panel">
        <div class="panel-h"><div class="row" style="gap:10px"><img src="hifi/img/pet-shiba.png" class="lead" style="border-radius:12px;width:42px;height:42px;object-fit:cover">
          <div><h3>${sel.pet} · ${sel.breed}</h3><div class="t-sm muted">${sel.svc} · ${sel.owner}</div></div></div>
          ${dangerBadge(sel.danger)}</div>
        <div class="panel-b">
          ${checks.map(([t,st,s,a])=>`<div class="verify-row"><div class="vico ${st}">${st==='ok'?'✓':st==='bad'?'✕':'!'}</div>
            <div style="flex:1"><div class="vt">${t}</div><div class="vs">${s}</div></div>${a?api(a):''}</div>`).join('')}
          ${vacOk
            ? `<div class="alert success" style="margin-top:16px"><span class="ic">✓</span><span>核驗通過，可分配床位完成報到。</span></div>
               <button class="btn primary lg block" style="margin-top:12px" data-act="checkin-ok">完成報到並分配床位</button>`
            : `<div class="alert danger" style="margin-top:16px"><span class="ic">⛔</span><span><b>疫苗逾期，報到阻斷（FR-06.1）。</b>請飼主補件，由系統重新校驗後方可入住。</span></div>
               <button class="btn lg block disabled" disabled style="margin-top:12px">無法報到 · 待補件</button>`}
          <div class="row" style="gap:10px;margin-top:10px">
            <button class="btn outline" style="flex:1" data-act="mark-danger">標記危險等級</button>
            <button class="btn danger" style="flex:1" data-act="emergency">觸發緊急事件</button>
          </div>
        </div>
      </div>`;
  }
  return `<div class="cols c2">
    <div><div class="row between" style="margin-bottom:14px"><h3 style="margin:0;font-size:14px">今日報到（${TODAY_CHECKIN.length}）</h3>${api('POST /checkin')}</div>${list}</div>
    <div>${right}</div></div>`;
};

/* ---- 櫃台：床位看板 ---- */
VIEWS.board=()=>{
  const counts={available:0,reserved:0,occupied:0,cleaning:0}; KENNELS.forEach(k=>counts[k[2]]++);
  const f=ST.boardStatus||'all';
  const KDOT={success:'--success',warn:'--warning',brand:'--primary',neutral:'--muted-foreground'};
  const dot=c=>`<span style="width:10px;height:10px;border-radius:50%;background:hsl(var(${KDOT[c]}))"></span>`;
  const filters=[['all','全部',KENNELS.length],['available','空床',counts.available],['reserved','已預約',counts.reserved],['occupied','已入住',counts.occupied],['cleaning','清潔中',counts.cleaning]];
  const kcard=([no,ty,st,occ,period])=>{ const [cls,b]=KST[st];
    const act = st==='cleaning'?['標記空床','clean-done']:st==='occupied'?['辦理退房','checkout']:st==='reserved'?['前往報到','to-checkin']:null;
    return `<div class="kennel ${cls}" data-kennel="${no}" data-kst="${st}" style="cursor:pointer">
      <div class="st">${b}</div><div class="no">${no}</div><div class="ty">${ty}房</div>
      ${occ?`<div class="occ"><img src="hifi/img/pet-${ty==='豪華'?'poodle':'shiba'}.png" class="pdot" style="object-fit:cover">${occ}</div>${period?`<div class="t-xs muted num" style="margin-top:-2px">${period}</div>`:''}`:`<div class="occ muted" style="font-weight:500">可接受預約</div>`}
      ${act?`<button class="btn ${act[1]==='clean-done'?'primary':'outline'} sm block" style="margin-top:9px" data-act="${act[1]}" data-n="${no}">${act[0]}</button>`:''}</div>`; };
  const grid=(room)=>{ const items=KENNELS.filter(k=>k[1]===room && (f==='all'||k[2]===f)); if(!items.length) return '';
    return `<div class="section-label" style="margin:20px 0 10px">${room}房 <span class="muted" style="font-weight:500">· ${items.length} 間</span></div><div class="kennel-grid">${items.map(kcard).join('')}</div>`; };
  return `
  <div class="kpis" style="grid-template-columns:repeat(4,1fr)">
    ${[['空床',counts.available,'success'],['已預約',counts.reserved,'warn'],['已入住',counts.occupied,'brand'],['清潔中',counts.cleaning,'neutral']]
      .map(([l,n,c])=>`<div class="kpi"><div class="row between"><div class="n">${n}</div>${dot(c)}</div><div class="l">${l}</div></div>`).join('')}
  </div>
  <div class="toolbar">
    <div class="seg">${filters.map(([k,l,n])=>`<button aria-selected="${f===k}" data-bf="${k}">${l}<span style="opacity:.55;margin-left:5px">${n}</span></button>`).join('')}</div>
    <div class="sp" style="flex:1"></div>
    <div class="search" style="min-width:210px">${IC.search}<input placeholder="搜尋床位 / 寵物…"></div>
  </div>
  <div class="row between" style="margin:-4px 2px 0"><span class="t-xs muted">入住完成自動轉「已入住」，離開轉「清潔中」，清潔完成由你手動標記空床（FR-06.4）</span>${api('GET /checkin/kennels')}</div>
  ${['標準','豪華'].map(grid).join('')}`;
};

/* ---- 櫃台：待審核佇列 ---- */
VIEWS.review=()=>`
  <div class="panel"><div class="panel-h"><h3>待審核預約（中度危險）</h3>${api('GET /bookings/pending-review · POST /bookings/{id}/review')}</div>
  <table class="table" style="border:0;border-radius:0;box-shadow:none">
    <thead><tr><th>寵物 / 飼主</th><th>服務</th><th>危險</th><th>說明</th><th>送出時間</th><th style="text-align:right">審核</th></tr></thead>
    <tbody>${REVIEW.map(r=>`<tr>
      <td><div class="cell-strong">${r.pet}</div><div class="t-sm muted">${r.owner}</div></td>
      <td>${r.svc}</td><td>${dangerBadge(r.danger)}</td><td class="t-sm">${r.note}</td><td class="t-sm muted num">${r.created}</td>
      <td style="text-align:right"><div class="row" style="gap:8px;justify-content:flex-end">
        <button class="btn danger sm" data-review="reject" data-id="${r.id}">拒絕</button>
        <button class="btn primary sm" data-review="approve" data-id="${r.id}">核可</button></div></td></tr>`).join('')}
    </tbody></table></div>`;

/* ---- 美容師：工作單清單 ---- */
VIEWS.workorders=()=>{
  const order={InProgress:0,Bathing:0,PreCheck:0,Drying:0,Grooming:0,Pending:1,Completed:2};
  const sorted=[...WORKORDERS].sort((a,b)=>(order[a.status]??1)-(order[b.status]??1));
  return `<div class="wo-grid">${sorted.map(w=>{
    const idx=woStageIdx(w.status);
    const st = w.status==='Pending'?badge('neutral','待處理','Pending'):w.status==='Completed'?badge('success','已完成','Completed'):badge('brand',WO_STAGES[idx][1],w.status);
    return `<div class="wo-card" data-wo="${w.id}">
      <div class="row between"><div class="row" style="gap:10px"><img src="hifi/img/pet-shiba.png" class="lead" style="border-radius:12px;width:42px;height:42px;object-fit:cover">
        <div><div class="cell-strong">${w.pet} · ${w.breed}</div><div class="t-sm muted">${w.svc}</div></div></div>${st}</div>
      <div class="wo-mini-stage">${WO_STAGES.map((s,i)=>`<div class="s ${i<idx?'done':i===idx?'now':''}"></div>`).join('')}</div>
      <div class="row between" style="margin-top:11px"><span class="t-sm muted">飼主 ${w.owner}</span><span class="t-sm muted num">開始 ${w.start}</span></div>
    </div>`;}).join('')}</div>`;
};

/* ---- 美容師：工作單明細 ---- */
VIEWS['wo-detail']=()=>{
  const w=WORKORDERS.find(x=>x.id===ST.wo)||WORKORDERS[0];
  const idx=woStageIdx(w.status); const done=w.status==='Completed';
  const stages=WO_STAGES.map((s,i)=>{
    const cls = i<idx||done?'done':i===idx?'now':'';
    const label = cls==='done'?'已完成':cls==='now'?'進行中 · 點擊完成此階段':'等待中';
    return `<button class="stage-btn ${cls}" ${cls===''||done?'disabled':''} data-stage="${i}">
      <span class="row" style="gap:11px"><span class="step"><span class="node ${cls==='done'?'done':cls==='now'?'now':''}">${cls==='done'?'✓':i+1}</span></span>
      <span><span style="font-weight:600">${s[1]} <span class="num t-xs muted">${s[0]}</span></span><br><span class="t-xs muted">${label}</span></span></span>
      ${cls==='now'?'<span style="color:hsl(var(--primary))">→</span>':''}</button>`;
  }).join('<div style="height:8px"></div>');
  return `
  <button class="btn ghost sm" data-act="back-wo" style="margin-bottom:14px">${IC.scissors} ← 返回工作單</button>
  <div class="cols c2">
    <div class="panel"><div class="panel-h"><h3>${w.pet} · ${w.svc}</h3>${done?badge('success','已完成','Completed'):badge('brand',idx>=0?WO_STAGES[idx][1]:'待處理',w.status)}</div>
      <div class="panel-b">
        <div class="row between" style="margin-bottom:14px"><span class="t-sm muted">飼主 ${w.owner} · ${w.breed}</span>${api('POST /grooming/work-orders/{id}/stage')}</div>
        ${w.status==='Pending'?`<button class="btn primary lg block" data-act="start-wo" style="margin-bottom:14px">開始工作單（建立四階段）</button>`:''}
        ${stages}
        <div class="row" style="gap:10px;margin-top:18px">
          <button class="btn outline" style="flex:1" ${done?'disabled':''} data-act="complete-wo">標記完成服務</button>
          <button class="btn danger" style="flex:1" data-act="emergency-wo">緊急事件</button>
        </div>
      </div></div>
    <div class="panel"><div class="panel-h"><h3>作業照片</h3>${api('POST /grooming/work-orders/{id}/photos')}</div>
      <div class="panel-b">
        <div class="photos" style="grid-template-columns:repeat(2,1fr);gap:10px">
          <div class="p" style="aspect-ratio:1;border-radius:var(--radius-md);overflow:hidden"><image-slot id="sw-1" src="hifi/img/care1.png" placeholder="預檢照" shape="rect" style="width:100%;height:100%"></image-slot></div>
          <div class="p" style="aspect-ratio:1;border-radius:var(--radius-md);overflow:hidden"><image-slot id="sw-2" src="hifi/img/care2.png" placeholder="洗澡照" shape="rect" style="width:100%;height:100%"></image-slot></div>
          <div class="p empty" style="aspect-ratio:1;border:1.5px dashed hsl(var(--border));border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;color:hsl(var(--muted-foreground));cursor:pointer">${IC.cam}<span class="t-xs">上傳照片</span></div>
        </div>
        <div class="alert info" style="margin-top:14px"><span class="ic">ⓘ</span><span>每階段完成時，系統自動推播通知飼主（FR-04.5）。</span></div>
      </div></div>
  </div>`;
};

/* ---- 管理員：帳號管理 ---- */
VIEWS.accounts=()=>`
  <div class="toolbar"><div class="search">${IC.search}<input placeholder="搜尋姓名 / Email…"></div><div class="sp" style="flex:1"></div>
    <button class="btn primary" data-act="create-staff">${IC.plus} 建立員工帳號</button></div>
  <div class="panel"><div class="panel-h"><h3>帳號（${ACCOUNTS.length}）</h3>${api('GET /auth/accounts · POST /auth/accounts/{id}/ban')}</div>
  <table class="table" style="border:0;border-radius:0;box-shadow:none">
    <thead><tr><th>姓名</th><th>Email</th><th>角色</th><th>狀態</th><th style="text-align:right">操作</th></tr></thead>
    <tbody>${ACCOUNTS.map(([n,e,r,s])=>`<tr>
      <td class="cell-strong">${n}</td><td class="num t-sm">${e}</td><td>${r}</td><td>${accBadge(s)}</td>
      <td style="text-align:right"><div class="row" style="gap:8px;justify-content:flex-end">
        <button class="btn outline sm" data-act="assign-role" data-n="${n}">指派角色</button>
        ${s==='Banned'?`<button class="btn primary sm" data-act="unban" data-n="${n}">解封</button>`:`<button class="btn danger sm" data-act="ban" data-n="${n}">封鎖</button>`}
      </div></td></tr>`).join('')}</tbody></table></div>`;

/* ---- 管理員：RBAC ---- */
VIEWS.rbac=()=>{
  const roles=['飼主 Owner','櫃台 Front Desk','美容師 Groomer','管理員 Admin'];
  const perms=[['預約建立 / 取消','✓','✓','','✓'],['報到核驗','','✓','',''],['床位管理','','✓','',''],['審核中度危險','','✓','','✓'],
    ['美容工作單','','','✓',''],['標記危險（低/中）','','✓','✓',''],['標記高度危險 / 解封','','','','✓'],['帳號封鎖 / 建員工','','','','✓'],['異常取消報告','','','','✓']];
  return `<div class="cols c2">
    <div class="panel"><div class="panel-h"><h3>角色</h3>${api('GET /auth/roles')}</div><div class="panel-b">
      <div style="display:flex;flex-direction:column;gap:10px">${roles.map(r=>`<div class="card flat pad row between"><span class="cell-strong">${r}</span><span class="t-sm muted">${IC.shield}</span></div>`).join('')}</div></div></div>
    <div class="panel"><div class="panel-h"><h3>權限矩陣</h3>${api('GET /auth/permissions')}</div>
      <table class="table" style="border:0;border-radius:0;box-shadow:none"><thead><tr><th>權限</th><th style="text-align:center">飼主</th><th style="text-align:center">櫃台</th><th style="text-align:center">美容</th><th style="text-align:center">管理</th></tr></thead>
      <tbody>${perms.map(p=>`<tr><td class="t-sm">${p[0]}</td>${[1,2,3,4].map(i=>`<td style="text-align:center;color:${p[i]?'hsl(var(--success))':'hsl(var(--border))'};font-weight:700">${p[i]||'·'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  </div>`;
};

/* ---- 管理員：危險寵物 ---- */
VIEWS.dangerpets=()=>`
  <div class="panel"><div class="panel-h"><h3>危險等級寵物</h3>${api('POST /pets/{id}/danger-level · POST /pets/{id}/unblock')}</div>
  <table class="table" style="border:0;border-radius:0;box-shadow:none">
    <thead><tr><th>寵物</th><th>品種</th><th>飼主</th><th>危險等級</th><th>狀態</th><th style="text-align:right">操作</th></tr></thead>
    <tbody>${DANGER_PETS.map(([n,b,o,d,blocked])=>`<tr>
      <td class="cell-strong">${n}</td><td>${b}</td><td>${o}</td><td>${dangerBadge(d)}</td>
      <td>${blocked?badge('danger','已封鎖 · 無法預約'):badge('success','正常')}</td>
      <td style="text-align:right"><div class="row" style="gap:8px;justify-content:flex-end">
        ${d!=='High'?`<button class="btn danger sm" data-act="mark-high" data-n="${n}">標記高度危險</button>`:''}
        ${blocked?`<button class="btn primary sm" data-act="unblock" data-n="${n}">解除封鎖</button>`:''}
      </div></td></tr>`).join('')}</tbody></table></div>`;

/* ---- 管理員：異常取消報告 ---- */
VIEWS.cancelreport=()=>{
  const abnormal=CANCELS.filter(c=>c[3]==='否').length;
  return `<div class="kpis" style="grid-template-columns:repeat(3,1fr)">
    <div class="kpi"><div class="n">${CANCELS.length}</div><div class="l">近 30 天取消</div></div>
    <div class="kpi"><div class="n" style="color:hsl(var(--warning))">${abnormal}</div><div class="l">不退款 / 異常</div></div>
    <div class="kpi"><div class="n" style="color:hsl(var(--destructive))">1</div><div class="l">高風險帳號（≥2 次）</div></div></div>
  <div class="panel"><div class="panel-h"><h3>取消明細（保存 ≥180 天）</h3>${api('GET /auth/reports/abnormal-cancellations')}</div>
  <table class="table" style="border:0;border-radius:0;box-shadow:none">
    <thead><tr><th>預約</th><th>飼主</th><th>原因</th><th>已退款</th><th>取消日</th></tr></thead>
    <tbody>${CANCELS.map(([bk,o,r,ref,d])=>`<tr ${o==='吳建國'?'style="background:hsl(var(--destructive-soft)/.35)"':''}>
      <td class="num cell-strong">${bk}</td><td>${o}</td><td class="t-sm">${r}</td>
      <td>${ref==='是'?badge('success','是'):badge('neutral','否')}</td><td class="num t-sm muted">${d}</td></tr>`).join('')}</tbody></table></div>`;
};

/* =====================================================================
   RENDER + ROUTER
   ===================================================================== */
const PAGE_META={ checkin:['報到核驗','掃描晶片或輸入預約單號，核驗預約・晶片・疫苗有效期'],
  board:['床位看板','即時顯示每個床位的狀態與住客寵物（FR-03.6）'], review:['待審核佇列','中度危險寵物的預約需審核通過方可確認（FR-02.8）'],
  workorders:['美容工作單','今日指派給你的工作單'], 'wo-detail':['工作單明細','依序更新四階段並上傳作業照片'],
  accounts:['帳號管理','建立員工、指派角色、封鎖／解封帳號'], rbac:['角色與權限','RBAC — 每個角色的權限範圍'],
  dangerpets:['危險寵物','標記高度危險與解除封鎖（僅管理員）'], cancelreport:['異常取消報告','監控異常取消行為（NFR-05）'] };

function render(){
  const r=ROLES[ST.role];
  // sidebar nav
  document.getElementById('nav').innerHTML = `<div class="nav-sec">${r.name}功能</div>` + r.nav.map(([k,l,ic,ct])=>
    `<div class="nav-item ${ST.view===k||(k==='workorders'&&ST.view==='wo-detail')?'on':''}" data-view="${k}">${ic}<span>${l}</span>${ct?`<span class="ct">${ct}</span>`:''}</div>`).join('');
  // role switch (design-preview only — lives in the floating preview menu, not the app chrome)
  document.getElementById('rolePick').innerHTML = Object.entries(ROLES).map(([k,v])=>
    `<button data-role="${k}" aria-pressed="${ST.role===k}"><span class="av" style="background:${v.color}">${v.short}</span><span>${v.name}</span></button>`).join('');
  // sidebar footer: current signed-in identity + logout (single fixed role per RBAC)
  document.getElementById('sideFoot').innerHTML =
    `<div class="side-user"><span class="av" style="background:${r.color}">${r.short}</span><div style="min-width:0"><div class="su-n">${r.name}</div><div class="su-r">${r.sub}</div></div></div><button class="side-logout">登出</button>`;
  // topbar
  const [pt,ps]=PAGE_META[ST.view]||['',''];
  document.getElementById('pt').innerHTML=`${pt}<small>${ps}</small>`;
  document.getElementById('who').innerHTML=`<span class="av" style="background:${r.color}">${r.short}</span><div style="line-height:1.2"><div style="font-size:13px;font-weight:600">${r.name}</div><div class="t-xs muted">${r.sub}</div></div>`;
  const eb=document.getElementById('emergBtn'); eb.style.display = ST.role==='admin'?'none':'inline-flex';
  // content
  document.getElementById('view').innerHTML=`<div class="page">${(VIEWS[ST.view]||(()=>'<div class="empty">—</div>'))()}</div>`;
  document.getElementById('view').scrollTop=0;
}
function setRole(r){ ST.role=r; ST.view=ROLES[r].home; ST.sel=null; render(); }
function setView(v){ ST.view=v; render(); }

/* ---------- dialogs ---------- */
function dialog(html){ const d=document.createElement('div'); d.className='scrim2'; d.innerHTML=`<div class="dialog">${html}</div>`;
  d.addEventListener('click',e=>{ if(e.target===d||e.target.closest('[data-dclose]')) d.remove(); }); document.body.appendChild(d); return d; }
const closeDialogs=()=>document.querySelectorAll('.scrim2').forEach(d=>d.remove());

function dlgResult(title,bodyHtml,foot=''){ return `<div class="dh"><h3>${title}</h3><div class="iconbtn2" data-dclose>${IC.x}</div></div><div class="db">${bodyHtml}</div>${foot?`<div class="df">${foot}</div>`:''}`; }

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const t=e.target;
  const nv=t.closest('[data-view]'); if(nv){ setView(nv.dataset.view); return; }
  const rl=t.closest('[data-role]'); if(rl){ setRole(rl.dataset.role); return; }
  const pk=t.closest('[data-pick]'); if(pk){ ST.sel=pk.dataset.pick; render(); return; }
  const wo=t.closest('[data-wo]'); if(wo){ ST.wo=wo.dataset.wo; setView('wo-detail'); return; }
  const sg=t.closest('[data-stage]'); if(sg){ handleAct('stage', sg); return; }
  const bf=t.closest('[data-bf]'); if(bf){ ST.boardStatus=bf.dataset.bf; render(); return; }
  const rv=t.closest('[data-review]'); if(rv){ const dec=rv.dataset.review;
    dialog(dlgResult(dec==='approve'?'核可預約':'拒絕預約',
      `<div class="field"><label>${dec==='approve'?'核可備註（選填）':'拒絕原因（必填）'}</label><textarea class="input" rows="3" placeholder="${dec==='approve'?'已電話確認，核可':'未通過審核原因…'}"></textarea></div>
       <div style="margin-top:12px">${api(dec==='approve'?'POST /bookings/{id}/review {decision:Approved} → PendingDeposit':'POST /bookings/{id}/review {decision:Rejected} → Cancelled')}</div>`,
      `<button class="btn ghost" data-dclose>取消</button><button class="btn ${dec==='approve'?'primary':'danger'}" data-dclose>${dec==='approve'?'確認核可':'確認拒絕'}</button>`)); return; }
  const kn=t.closest('[data-kennel]'); if(kn && !t.closest('[data-act]')){ const no=kn.dataset.kennel, st=kn.dataset.kst;
    dialog(dlgResult(`床位 ${no}`,
      `<div class="kv"><span class="k">狀態</span><span class="v">${st==='cleaning'?'清潔中 Cleaning':'已入住 Occupied'}</span></div>
       ${st==='occupied'?`<div class="hr dash" style="margin:10px 0"></div><div class="kv"><span class="k">住客</span><span class="v">毛球 · 貴賓</span></div><div class="kv" style="margin-top:6px"><span class="k">預約</span><span class="v num">2/10 – 2/14</span></div>`:''}
       <div style="margin-top:14px">${api('PATCH /checkin/kennels/{id} · POST /checkin/kennels/{id}/available')}</div>`,
      st==='cleaning'?`<button class="btn ghost" data-dclose>關閉</button><button class="btn primary" data-dclose>標記為空床（清潔完成）</button>`:`<button class="btn ghost" data-dclose>關閉</button><button class="btn outline" data-dclose>標記離開（轉清潔中）</button>`)); return; }
  const act=t.closest('[data-act]'); if(act){ handleAct(act.dataset.act, act); return; }
});

function handleAct(a,el){
  if(a==='back-wo'){ setView('workorders'); return; }
  if(a==='checkin-ok'){ dialog(dlgResult('報到成功',
    `<div style="text-align:center;padding:6px 0"><div class="success-icon" style="width:72px;height:72px;font-size:34px;background:hsl(var(--success-soft));color:hsl(var(--success));border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto">✓</div>
     <div class="t-h2" style="margin-top:14px">已報到 · 床位 A-13</div><div class="t-sm muted" style="margin-top:4px">床位狀態 → 已入住；預約狀態 → 已報到 CheckedIn</div></div>
     <div style="margin-top:14px;text-align:center">${api('POST /checkin → result=Success, kennelNumber=A-13')}</div>`,
    `<button class="btn primary" data-dclose>完成</button>`)); return; }
  if(a==='mark-danger'){ dialog(dlgResult('標記危險等級',
    `<div class="field" style="margin-bottom:12px"><label>等級</label><div class="seg" style="width:100%"><button aria-selected="true">低度</button><button aria-selected="false">中度</button></div></div>
     <div class="field"><label>說明（必填）</label><textarea class="input" rows="2" placeholder="例：曾對工作人員低吼"></textarea></div>
     <div style="margin-top:12px">${api('POST /pets/{id}/danger-level — 櫃台限 Low/Medium')}</div>`,
    `<button class="btn ghost" data-dclose>取消</button><button class="btn primary" data-dclose>儲存標記</button>`)); return; }
  if(a==='emergency'||a==='emergency-wo'){ dialog(dlgResult('觸發緊急醫療事件',
    `<div class="alert danger" style="margin-bottom:12px"><span class="ic">${IC.alert}</span><span>此操作將中止服務並立即通知飼主，請務必詳實記錄。</span></div>
     <div class="field"><label>事件描述（必填）</label><textarea class="input" rows="3" placeholder="例：住宿寵物突發嘔吐，已聯絡飼主並送醫…"></textarea></div>
     <div style="margin-top:12px">${api(a==='emergency-wo'?'POST /grooming/work-orders/{id}/emergency':'POST /checkin/{id}/emergency')}</div>`,
    `<button class="btn ghost" data-dclose>取消</button><button class="btn danger" data-dclose>確認觸發</button>`)); return; }
  if(a==='start-wo'){ const w=WORKORDERS.find(x=>x.id===ST.wo); if(w){w.status='PreCheck'; render();} return; }
  if(a==='complete-wo'){ const w=WORKORDERS.find(x=>x.id===ST.wo); if(w){ w.status='Completed'; render();
    dialog(dlgResult('服務完成', `<div style="text-align:center;padding:8px 0"><div class="success-icon" style="width:72px;height:72px;font-size:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto">🎉</div><div class="t-h2" style="margin-top:12px">已完成服務</div><div class="t-sm muted" style="margin-top:4px">系統自動推播通知飼主領回（FR-04.3）</div></div>`, `<button class="btn primary" data-dclose>完成</button>`)); } return; }
  if(a==='stage'){ const w=WORKORDERS.find(x=>x.id===ST.wo); if(w){ const i=+el.dataset.stage; w.status = i>=3?'Completed':WO_STAGES[i+1][0]; render(); } return; }
  if(a==='create-staff'){ dialog(dlgResult('建立員工帳號',
    `<div class="field" style="margin-bottom:10px"><label>姓名</label><input class="input" placeholder="陳小櫃"></div>
     <div class="field" style="margin-bottom:10px"><label>Email</label><input class="input" placeholder="staff@pethotel.tw"></div>
     <div class="field"><label>角色</label><div class="seg" style="width:100%"><button aria-selected="true">櫃台</button><button aria-selected="false">美容師</button><button aria-selected="false">管理員</button></div></div>
     <div style="margin-top:12px">${api('POST /auth/staff {roleName}')}</div>`,
    `<button class="btn ghost" data-dclose>取消</button><button class="btn primary" data-dclose>建立帳號</button>`)); return; }
  if(a==='assign-role'){ dialog(dlgResult(`指派角色 — ${el.dataset.n}`,
    `<div class="field"><label>角色</label><div class="seg" style="width:100%"><button aria-selected="false">飼主</button><button aria-selected="true">櫃台</button><button aria-selected="false">美容師</button><button aria-selected="false">管理員</button></div></div>
     <div style="margin-top:12px">${api('POST /auth/accounts/{id}/roles · DELETE …/roles/{role_id}')}</div>`,
    `<button class="btn ghost" data-dclose>取消</button><button class="btn primary" data-dclose>儲存</button>`)); return; }
  if(a==='ban'||a==='unban'){ dialog(dlgResult(a==='ban'?`封鎖帳號 — ${el.dataset.n}`:`解除封鎖 — ${el.dataset.n}`,
    `${a==='ban'?`<div class="field"><label>封鎖原因</label><textarea class="input" rows="2" placeholder="例：異常取消過多"></textarea></div>`:`<p class="t-body muted">將恢復此帳號的登入與預約權限。</p>`}
     <div style="margin-top:12px">${api(a==='ban'?'POST /auth/accounts/{id}/ban':'POST /auth/accounts/{id}/unban')}</div>`,
    `<button class="btn ghost" data-dclose>取消</button><button class="btn ${a==='ban'?'danger':'primary'}" data-dclose>確認${a==='ban'?'封鎖':'解封'}</button>`)); return; }
  if(a==='mark-high'||a==='unblock'){ dialog(dlgResult(a==='mark-high'?`標記高度危險 — ${el.dataset.n}`:`解除封鎖 — ${el.dataset.n}`,
    `<p class="t-body muted">${a==='mark-high'?'標記為高度危險後，該寵物將無法線上預約，直到管理員解除封鎖。':'解除後，該寵物可再次建立預約。'}</p>
     <div style="margin-top:12px">${api(a==='mark-high'?'POST /pets/{id}/danger-level {High}':'POST /pets/{id}/unblock')}</div>`,
    `<button class="btn ghost" data-dclose>取消</button><button class="btn ${a==='mark-high'?'danger':'primary'}" data-dclose>確認</button>`)); return; }
  if(a==='clean-done'){ const k=KENNELS.find(x=>x[0]===el.dataset.n); if(k){k[2]='available';k[3]='';k[4]='';} render(); return; }
  if(a==='checkout'){ const k=KENNELS.find(x=>x[0]===el.dataset.n); if(k){k[2]='cleaning';k[3]='';k[4]='';} render(); return; }
  if(a==='to-checkin'){ setView('checkin'); return; }
  if(a==='global-emergency'){ handleAct(ST.view==='wo-detail'?'emergency-wo':'emergency'); return; }
}

/* settings (palette) */
document.getElementById('palBtn').addEventListener('click',()=>{const p=document.getElementById('palMenu'); p.style.display = (p.style.display==='block')?'none':'block';});
document.getElementById('previewFab').addEventListener('click',()=>{const p=document.getElementById('previewMenu'); p.style.display = (p.style.display==='block')?'none':'block';});
document.getElementById('palMenu').addEventListener('click',e=>{const b=e.target.closest('[data-pal]'); if(!b)return;
  document.documentElement.dataset.palette=b.dataset.pal; document.querySelectorAll('#palMenu [data-pal]').forEach(x=>x.setAttribute('aria-pressed',x===b)); });

render();
