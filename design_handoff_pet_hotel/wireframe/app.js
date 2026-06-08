/* ============ 飼主預約流程 線框稿 — render engine ============ */
const S = { approach:'A', service:'Lodging', danger:'None', tone:'warm' };

/* ---------- tiny helpers ---------- */
const fmt = n => 'NT$' + n.toLocaleString('en-US');
const SVC = {
  Lodging:  { cat:'住宿', cats:['住宿','美容'], grades:[['標準房',800],['豪華房',1200]], pick:1, unit:'晚', qty:3, slot:'range', slotLabel:'入住 / 退房日期', note:'2/14 入住 → 2/17 退房 · 3 晚' },
  Grooming: { cat:'美容', cats:['住宿','美容'], grades:[['基礎美容',600],['完整美容',1000]], pick:1, unit:'次', qty:1, slot:'time', slotLabel:'預約日期與時段', note:'2/14（六）14:00 · 約 120 分鐘' },
};
const svc = () => SVC[S.service];
const total = () => { const s=svc(); return s.grades[s.pick][1]*s.qty; };
const deposit = () => Math.round(total()*0.3);
const gradeName = () => svc().grades[svc().pick][0];

function gating(d){
  if(d==='High')   return {kind:'danger',pill:'s-danger',label:'已拒絕',title:'高度危險 — 無法線上預約',
    body:'此寵物標記為高度危險，系統自動拒絕。須先聯繫門市，由<b>管理員解除封鎖</b>後才能再次預約。',
    cta:'無法送出',dis:true, api:'POST /bookings → <b>409</b> DANGER_LEVEL_HIGH'};
  if(d==='Medium') return {kind:'warn',pill:'s-pending',label:'待審核',title:'送出後進入「待審核」',
    body:'中度危險寵物的預約須由<b>櫃台人員審核通過</b>後才能付訂金確認，暫不向您收款。',
    cta:'送出待審核',dis:false, api:'POST /bookings → 201 status=<b>PendingReview</b>'};
  if(d==='Low')    return {kind:'ok',pill:'s-confirmed',label:'可預約',title:'可正常預約',
    body:'報到當天工作人員會收到<b>低度危險提醒</b>多加留意，不影響本次預約。',
    cta:'確認並付訂金',dis:false, api:'POST /bookings → 201 status=<b>PendingDeposit</b>'};
  return {kind:'info',pill:'s-confirmed',label:'可預約',title:'可正常預約',body:'',
    cta:'確認並付訂金',dis:false, api:'POST /bookings → 201 status=<b>PendingDeposit</b>'};
}
function dangerPill(d){
  if(d==='High')   return `<span class="pill s-danger"><i class="pdot"></i>高度危險</span>`;
  if(d==='Medium') return `<span class="pill s-pending"><i class="pdot"></i>中度危險</span>`;
  if(d==='Low')    return `<span class="pill s-confirmed"><i class="pdot"></i>低度危險</span>`;
  return '';
}

/* ---------- icons ---------- */
const I = {
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
  cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3.2v3.6M16 3.2v3.6"/></svg>',
  bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 4.5 1.8 5.5 1.8 5.5H4.2S6 13.5 6 9"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c1.6-4.2 12.4-4.2 14 0"/></svg>',
};

/* ---------- chrome ---------- */
const sb = () => `<div class="sb"><span>9:41</span><span class="dots"><span class="mono fs11">5G</span><span class="bat"></span></span></div>`;
const bnav = (a) => `<div class="bnav">
  <a class="${a==='home'?'on':''}">${I.home}<span>首頁</span></a>
  <a class="${a==='book'?'on':''}">${I.cal}<span>預約</span></a>
  <a class="${a==='noti'?'on':''}">${I.bell}<span>通知</span></a>
  <a class="${a==='me'?'on':''}">${I.user}<span>我的</span></a>
</div>`;
const appbar = (title,{back=true,right=''}={}) =>
  `<div class="appbar center"><span class="back">${back?'‹':''}</span><span class="title">${title}</span><span class="right">${right}</span></div>`;
const pad = (inner,long=true)=>`<div class="scroll ${long?'long':''}"><div class="pad">${inner}</div></div>`;
const phone = inner => `<div class="phone"><div class="notch"></div><div class="screen">${sb()}${inner}</div></div>`;
const frame = ({step='',cap='',note='',api='',inner}) =>
  `<div class="frame">${step?`<div class="step-tag">${step}</div>`:''}${phone(inner)}
    <div class="cap">${cap}</div>${note?`<div class="note">✍ ${note}</div>`:''}${api?`<div class="api">${api}</div>`:''}</div>`;
const arrow = ()=>`<div class="arrow">→</div>`;
const flowRow = frames => frames.map((f,i)=> f + (i<frames.length-1?arrow():'')).join('');

/* ---------- shared bits ---------- */
const lines = (arr)=>arr.map(w=>`<div class="ln" style="width:${w}"></div>`).join('');
const petRow = (sel)=>`<div class="wcard ${sel?'sel':''}"><div class="row gap10">
  <div class="imgph avatar">照片</div>
  <div class="col gap4" style="flex:1">
    <div class="row between"><b class="fs14">旺財</b>${dangerPill(S.danger)}</div>
    <div class="fs12 muted">柴犬 · ♂ · 3 歲</div>
  </div>${sel!==undefined?`<div class="radio ${sel?'on':''}"></div>`:''}</div></div>`;

const summaryCard = ()=>{const s=svc();return `<div class="wcard flat"><div class="col gap8">
  <div class="kv"><span class="k">寵物</span><span class="v">旺財 · 柴犬</span></div>
  <div class="kv"><span class="k">服務</span><span class="v">${s.cat} · ${gradeName()}</span></div>
  <div class="kv"><span class="k">${s.slot==='range'?'住宿期間':'預約時段'}</span><span class="v">${s.note}</span></div>
  <div class="divln dash"></div>
  <div class="kv"><span class="k">預估總額</span><span class="v">${fmt(total())}</span></div>
  <div class="kv"><span class="k">訂金 30%（本次支付）</span><span class="v" style="color:var(--accent)">${fmt(deposit())}</span></div>
  <div class="kv"><span class="k faint">尾款（報到日結清）</span><span class="v faint">${fmt(total()-deposit())}</span></div>
</div></div>`;};

const payMethods = ()=>`<div class="col gap8">
  <div class="ctrl-label" style="letter-spacing:.04em">支付方式</div>
  <div class="wcard sel"><div class="row gap10"><div class="radio on"></div><div class="col gap4" style="flex:1"><b class="fs13">線上付款</b><span class="fs11 muted">ECPay 信用卡 / 行動支付</span></div></div></div>
  <div class="wcard"><div class="row gap10"><div class="radio"></div><div class="col gap4" style="flex:1"><b class="fs13">現場刷卡</b><span class="fs11 muted">報到當日於門市結清</span></div></div></div>
</div>`;

const gradeCards = ()=>{const s=svc();return s.grades.map((g,i)=>`<div class="wcard ${i===s.pick?'sel':''}">
  <div class="row between"><div class="row gap8"><div class="radio ${i===s.pick?'on':''}"></div><b class="fs14">${g[0]}</b></div>
  <b class="fs13" style="color:var(--accent)">${fmt(g[1])}<span class="fs11 muted">/${s.unit}</span></b></div>
  <div class="fs11 muted mt6" style="padding-left:26px">${s.cat==='住宿'?(i===0?'4㎡ 獨立房 · 每日放風 1 次':'6㎡ 採光房 · 每日放風 2 次 + 視訊'):(i===0?'洗澡 + 基礎修剪 + 剪指甲':'造型剪 + SPA + 耳道清潔 + 香氛')}</div>
</div>`).join('');};

/* =========================================================
   APPROACH A — 分步精靈 Step Wizard
========================================================= */
function progress(cur){
  const labels=['寵物','服務','時段','確認'];
  let h='<div class="prog">';
  for(let i=1;i<=4;i++){
    h+=`<div class="dot ${i<cur?'done':''} ${i===cur?'on':''}">${i<cur?'✓':i}</div>`;
    if(i<4)h+=`<div class="seg-line ${i<cur?'on':''}"></div>`;
  }
  h+=`</div><div class="prog-label">步驟 ${cur} / 4 · ${labels[cur-1]}</div>`;
  return h;
}
const A = ()=>{
  const g=gating(S.danger); const s=svc();
  const a1 = pad(`<div class="row between"><div class="col"><span class="fs12 muted">午安，</span><span class="h-title">王小明 👋</span></div><div class="imgph avatar">頭像</div></div>
    <div class="wcard sel mt14" style="background:var(--accent);border-color:var(--accent)">
      <div class="row between"><b class="fs14" style="color:#fff">建立新預約</b><span style="color:#fff;font-size:18px">＋</span></div>
      <div class="fs12 mt6" style="color:#fbe9dc">住宿 · 美容，3 步完成</div></div>
    <div class="ctrl-label mt16" style="letter-spacing:.04em">即將到來</div>
    <div class="wcard mt8"><div class="row between"><b class="fs13">毛球 · 完整美容</b><span class="pill s-confirmed"><i class="pdot"></i>已確認</span></div>
      <div class="fs12 muted mt6">2/12（四）10:30 · 訂金已付</div></div>
    <div class="ctrl-label mt16" style="letter-spacing:.04em">快捷</div>
    <div class="wrap mt8"><span class="chip">我的寵物</span><span class="chip">預約紀錄</span><span class="chip">疫苗證明</span></div>`)
    + bnav('home');

  const a2 = progress(1)+pad(`<div class="h-sub mt6">選擇要預約的寵物</div>
    <div class="stack mt10">${petRow(true)}${petRow(false).replace('旺財','毛球').replace('柴犬 · ♂ · 3 歲','貴賓 · ♀ · 2 歲').replace(dangerPill(S.danger),'')}</div>
    <div class="wbtn ghost block mt10">＋ 新增寵物</div>`,true)
    + `<div class="sticky-sum"><div class="wbtn pri block">下一步</div></div>`;

  const a3 = progress(2)+pad(`<div class="h-sub mt6">選擇服務類型與分級</div>
    <div class="seg-pill mt10"><span class="${S.service==='Lodging'?'on':''}">住宿</span><span class="${S.service==='Grooming'?'on':''}">美容</span></div>
    <div class="stack mt10">${gradeCards()}</div>`,true)
    + `<div class="sticky-sum"><div class="row between fs12"><span class="muted">已選 ${gradeName()}</span><b>${fmt(svc().grades[svc().pick][1])}/${svc().unit}</b></div><div class="wbtn pri block">下一步</div></div>`;

  const a4 = progress(3)+pad(`<div class="h-sub mt6">${s.slotLabel}</div>
    <div class="banner info mt10"><span class="bdot"></span><span>僅顯示目前<b>可預約</b>的時段，額滿不顯示。</span></div>
    ${s.slot==='range'? calendar() : timeList()}`,true)
    + `<div class="sticky-sum"><div class="row between fs12"><span class="muted">${s.note}</span></div><div class="wbtn pri block">下一步</div></div>`;

  const a5 = progress(4)+pad(`<div class="h-sub mt6">確認訂單</div>
    <div class="mt10">${summaryCard()}</div>
    ${g.body?`<div class="banner ${g.kind} mt10"><span class="bdot"></span><span><b>${g.title}</b><br>${g.body}</span></div>`:''}
    <div class="mt12">${payMethods()}</div>`,true)
    + `<div class="sticky-sum">${g.kind!=='danger'?`<div class="row between fs12"><span class="muted">本次支付訂金</span><b style="color:var(--accent)">${fmt(deposit())}</b></div>`:''}
      <div class="wbtn ${g.dis?'disabled':'pri'} block">${g.cta}</div></div>`;

  let a6inner;
  if(S.danger==='High'){
    a6inner = pad(`<div class="col gap12" style="align-items:center;text-align:center;padding-top:40px">
      <div class="imgph" style="width:84px;height:84px;border-radius:50%">⛔</div>
      <div class="h-title">預約未成立</div>
      <div class="h-sub" style="max-width:220px">旺財目前為高度危險狀態，請聯繫門市由管理員協助。</div>
      <span class="pill s-danger mt6"><i class="pdot"></i>已拒絕</span>
      <div class="wbtn block mt16">聯繫門市</div></div>`,false);
  } else if(S.danger==='Medium'){
    a6inner = pad(`<div class="col gap12" style="align-items:center;text-align:center;padding-top:36px">
      <div class="imgph" style="width:84px;height:84px;border-radius:50%">⏳</div>
      <div class="h-title">已送出，待審核</div>
      <div class="h-sub" style="max-width:230px">櫃台審核通過後會通知您完成付款，暫未收取訂金。</div>
      <span class="pill s-pending mt6"><i class="pdot"></i>待審核 PendingReview</span>
      <div class="wcard flat mt12" style="width:100%;text-align:left"><div class="kv"><span class="k">預估總額</span><span class="v">${fmt(total())}</span></div></div>
      <div class="wbtn block mt8">查看我的預約</div></div>`,false);
  } else {
    a6inner = pad(`<div class="col gap12" style="align-items:center;text-align:center;padding-top:34px">
      <div class="imgph" style="width:84px;height:84px;border-radius:50%">🎉</div>
      <div class="h-title">${S.tone==='warm'?'預約成功，毛孩交給我們！':'預約成功'}</div>
      <div class="h-sub" style="max-width:230px">訂金 ${fmt(deposit())} 已付款，預約已確認。</div>
      <span class="pill s-confirmed mt6"><i class="pdot"></i>已確認 Confirmed</span>
      ${summaryCard().replace('class="wcard flat"','class="wcard flat" style="width:100%;text-align:left;margin-top:8px"')}
      <div class="wbtn pri block mt8">查看預約明細</div></div>`,false);
  }

  return flowRow([
    frame({step:'A·1',cap:'首頁',note:'底部 Tab 導航，預約入口最顯眼',api:'GET /bookings?status=Confirmed',inner:a1}),
    frame({step:'A·2',cap:'步驟 1／4 — 選寵物',note:'危險等級隨檔案帶出',api:'GET /pets',inner:a2}),
    frame({step:'A·3',cap:'步驟 2／4 — 服務分級',note:'住宿↔美容，分級定價',api:'GET /bookings/services?category=',inner:a3}),
    frame({step:'A·4',cap:'步驟 3／4 — 選時段',note:'只給可預約，避免超額',api:'GET /bookings/availability',inner:a4}),
    frame({step:'A·5',cap:'步驟 4／4 — 確認＋分流',note:'危險分流就在送出前',api:g.api,inner:a5}),
    frame({step:'A·6',cap:'結果',note:'三種結局：成功／待審／拒絕',api:S.danger==='Medium'?'—（不收款）':(S.danger==='High'?'—':'POST /bookings/{id}/deposit'),inner:a6inner}),
  ]);
};

/* calendar (lodging) & time list (grooming) */
function calendar(){
  let cells='';
  const off=[1,2,3]; // leading offset blanks shown as prev month
  for(const d of off) cells+=`<div class="d off">${26+d}</div>`;
  for(let d=1;d<=28;d++){
    let cls='d';
    if([8,9,15].includes(d)) cls+=' full';
    if(d===14) cls+=' edge';
    else if(d===17) cls+=' edge';
    else if(d>14&&d<17) cls+=' in';
    cells+=`<div class="${cls}">${d}</div>`;
  }
  return `<div class="cal mt10"><div class="cal-head"><span>‹</span><span>2026 年 2 月</span><span>›</span></div>
    <div class="cal-grid"><div class="wd">日</div><div class="wd">一</div><div class="wd">二</div><div class="wd">三</div><div class="wd">四</div><div class="wd">五</div><div class="wd">六</div>${cells}</div></div>
    <div class="row gap12 mt8 fs11 muted"><span class="row gap4"><span class="d edge" style="width:14px;height:14px;border-radius:4px"></span>選取</span><span class="row gap4"><span style="width:12px;height:12px;border-radius:3px;background:var(--accent-soft)"></span>區間</span><span class="row gap4"><s>劃線</s> 額滿</span></div>`;
}
function timeList(){
  const slots=[['09:00',1],['10:30',1],['12:00',0],['14:00',2],['15:30',1],['17:00',0]];
  return `<div class="wrap mt10" style="gap:6px">${['2/13 五','2/14 六','2/15 日','2/16 一'].map((d,i)=>`<span class="chip ${i===1?'':''}" style="${i===1?'border-color:var(--accent);background:var(--accent-soft);color:#9a4d1f':''}">${d}</span>`).join('')}</div>
    <div class="stack mt10">${slots.map(([t,c])=>`<div class="timeslot ${c===0?'full':(t==='14:00'?'on':'')}"><span>${t}</span><span class="fs11">${c===0?'已額滿':(t==='14:00'?'已選 ✓':'可預約')}</span></div>`).join('')}</div>`;
}

/* =========================================================
   APPROACH B — 單頁堆疊 Single-scroll builder
========================================================= */
const B = ()=>{
  const g=gating(S.danger); const s=svc();
  const b1 = pad(`<div class="row between"><span class="h-title">嗨，王小明</span><div class="imgph avatar">頭像</div></div>
    <div class="wcard mt12" style="border-style:dashed"><div class="fs12 muted">繼續上次的草稿</div>
      <div class="row between mt6"><b class="fs13">旺財 · ${s.cat}</b><span class="fs12 muted">未完成</span></div></div>
    <div class="wbtn pri block mt12">開始新預約</div>
    <div class="ctrl-label mt16" style="letter-spacing:.04em">進行中的服務</div>
    <div class="wcard mt8"><div class="row between"><b class="fs13">毛球 · 住宿中</b><span class="pill s-progress"><i class="pdot"></i>服務中</span></div>
      <div class="fs12 muted mt6">床位 A-12 · 2/10–2/14</div></div>`)
    + bnav('home');

  // single scroll builder
  const builder = (confirm)=>{
    const sectionHead=(n,t,done)=>`<div class="row gap8 mt14" style="align-items:center"><div class="node ${done?'done':'now'}" style="width:20px;height:20px;border-radius:50%;border:1.7px solid ${done?'var(--ok)':'var(--accent)'};background:${done?'var(--ok)':'var(--accent)'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px">${done?'✓':n}</div><b class="fs14">${t}</b></div>`;
    return pad(`<div class="h-title">建立預約</div><div class="h-sub">一頁完成 · 隨選隨算</div>
      ${sectionHead(1,'選擇寵物',true)}
      <div class="wrap mt8" style="gap:6px"><span class="chip" style="border-color:var(--accent);background:var(--accent-soft);color:#9a4d1f">旺財 ${S.danger!=='None'?'⚠':'✓'}</span><span class="chip">毛球</span><span class="chip" style="border-style:dashed">＋ 新增</span></div>
      ${sectionHead(2,'服務與分級',true)}
      <div class="seg-pill mt8"><span class="${S.service==='Lodging'?'on':''}">住宿</span><span class="${S.service==='Grooming'?'on':''}">美容</span></div>
      <div class="wrap mt8" style="gap:6px">${s.grades.map((gd,i)=>`<span class="chip" style="${i===s.pick?'border-color:var(--accent);background:var(--accent-soft);color:#9a4d1f':''}">${gd[0]} ${fmt(gd[1])}</span>`).join('')}</div>
      ${sectionHead(3,s.slot==='range'?'住宿期間':'預約時段',confirm)}
      ${s.slot==='range'
        ? `<div class="wrap mt8" style="gap:6px"><span class="chip" style="border-color:var(--accent);background:var(--accent-soft);color:#9a4d1f">2/14 入住</span><span class="chip" style="border-color:var(--accent);background:var(--accent-soft);color:#9a4d1f">2/17 退房</span></div><div class="fs11 muted mt6">3 晚 · 僅顯示可預約日（FR-06.2）</div>`
        : `<div class="wrap mt8" style="gap:6px"><span class="chip" style="border-color:var(--accent);background:var(--accent-soft);color:#9a4d1f">2/14 六</span><span class="chip" style="border-color:var(--accent);background:var(--accent-soft);color:#9a4d1f">14:00</span></div><div class="fs11 muted mt6">約 120 分鐘 · 僅顯示可預約時段</div>`}
      ${confirm&&g.body?`<div class="banner ${g.kind} mt12"><span class="bdot"></span><span><b>${g.title}</b><br>${g.body}</span></div>`:''}
      <div style="height:8px"></div>`,true);
  };
  const stickyB = (confirm)=>`<div class="sticky-sum">
    <div class="row between"><div class="col"><span class="fs11 muted">預估 ${fmt(total())} · 訂金 30%</span><b class="fs14" style="color:var(--accent)">${fmt(deposit())}</b></div>
    <div class="wbtn ${confirm&&g.dis?'disabled':'pri'}" style="padding-left:20px;padding-right:20px">${confirm?g.cta:'下一步：確認'}</div></div></div>`;

  const b2 = builder(false)+stickyB(false);
  const b3 = builder(true)+stickyB(true);

  // payment sheet over page
  const b4 = pad(`<div class="h-title">建立預約</div><div class="h-sub">一頁完成 · 隨選隨算</div><div style="height:200px"></div>`,false)
    + `<div class="sheet-scrim"><div class="sheet"><div class="grab"></div>
        <div class="h-title" style="font-size:16px">支付訂金 ${fmt(deposit())}</div>
        <div class="mt10">${payMethods()}</div>
        <div class="banner info mt10"><span class="bdot"></span><span>付款資訊由 ECPay 處理，不留存於系統（NFR-03）。</span></div>
        <div class="wbtn pri block mt12">確認付款</div></div></div>`;

  return flowRow([
    frame({step:'B·1',cap:'首頁 — 草稿＋進行中',note:'單一大 CTA，可續編草稿',api:'GET /bookings',inner:b1}),
    frame({step:'B·2',cap:'建立預約（單頁堆疊）',note:'寵物/服務/時段同頁，底部即時算錢',api:'GET /pets · /bookings/services',inner:b2}),
    frame({step:'B·3',cap:'同頁確認＋分流',note:'分流橫幅就地浮現，不換頁',api:g.api,inner:b3}),
    frame({step:'B·4',cap:'付款底部彈窗',note:'訂金以 Sheet 疊在頁上',api:'POST /bookings/{id}/deposit',inner:b4}),
  ]);
};

/* =========================================================
   APPROACH C — 服務優先 Discovery
========================================================= */
const C = ()=>{
  const g=gating(S.danger); const s=svc();
  const c1 = pad(`<div class="row between"><span class="h-title">想為毛孩安排什麼？</span></div>
    <div class="imgph mt12" style="height:120px">店家情境主視覺</div>
    <div class="ctrl-label mt16" style="letter-spacing:.04em">服務分類</div>
    <div class="row gap10 mt8">
      <div class="wcard" style="flex:1;${S.service==='Lodging'?'border-color:var(--accent)':''}"><div class="imgph" style="height:64px">住宿照</div><b class="fs13 mt8" style="display:block">住宿</b><span class="fs11 muted">標準／豪華</span></div>
      <div class="wcard" style="flex:1;${S.service==='Grooming'?'border-color:var(--accent)':''}"><div class="imgph" style="height:64px">美容照</div><b class="fs13 mt8" style="display:block">美容</b><span class="fs11 muted">基礎／完整</span></div>
    </div>
    <div class="ctrl-label mt16" style="letter-spacing:.04em">${s.cat}方案</div>
    <div class="stack mt8">${s.grades.map((gd,i)=>`<div class="wcard"><div class="row gap10"><div class="imgph" style="width:54px;height:54px">照</div><div class="col gap4" style="flex:1"><b class="fs13">${gd[0]}</b><span class="fs11 muted">${s.cat==='住宿'?'每日放風 · 專人照護':'含洗剪 · 約 120 分'}</span></div><b class="fs13" style="color:var(--accent)">${fmt(gd[1])}</b></div></div>`).join('')}</div>`)
    + bnav('home');

  const c2 = pad(`<div class="imgph" style="height:150px;border-radius:0;margin:-12px -14px 0">${gradeName()} 大圖</div>
    <div class="row between mt12"><b class="h-title" style="font-size:18px">${gradeName()}</b><b class="fs14" style="color:var(--accent)">${fmt(svc().grades[svc().pick][1])}/${s.unit}</b></div>
    <div class="h-sub mt6">${s.cat==='住宿'?'寬敞採光房，每日放風與視訊，專人 24h 照護。':'資深美容師一對一，含 SPA、耳道清潔與造型剪。'}</div>
    <div class="ctrl-label mt14" style="letter-spacing:.04em">方案內含</div>
    <div class="stack mt8">${[ '專人照護','作業全程拍照回報','完成自動推播通知'].map(t=>`<div class="row gap8"><span style="color:var(--ok)">✓</span><span class="fs12">${t}</span></div>`).join('')}</div>
    <div class="ctrl-label mt14" style="letter-spacing:.04em">分級切換</div>
    <div class="seg-pill mt8">${s.grades.map((gd,i)=>`<span class="${i===s.pick?'on':''}">${gd[0]}</span>`).join('')}</div>`)
    + `<div class="sticky-sum"><div class="wbtn pri block">立即預約</div></div>`;

  const c3 = pad(`<div class="imgph" style="height:120px;border-radius:0;margin:-12px -14px 0">${gradeName()} 大圖</div><div style="height:120px"></div>`,false)
    + `<div class="sheet-scrim"><div class="sheet"><div class="grab"></div>
        <b class="fs14">為哪位毛孩預約？</b>
        <div class="wrap mt8" style="gap:6px"><span class="chip" style="border-color:var(--accent);background:var(--accent-soft);color:#9a4d1f">旺財 ${S.danger!=='None'?'⚠':''}</span><span class="chip">毛球</span></div>
        <b class="fs14 mt12" style="display:block">${s.slot==='range'?'選擇住宿期間':'選擇時段'}</b>
        ${s.slot==='range'
          ? `<div class="wrap mt8" style="gap:6px"><span class="chip" style="border-color:var(--accent);background:var(--accent-soft);color:#9a4d1f">2/14 入住</span><span class="chip" style="border-color:var(--accent);background:var(--accent-soft);color:#9a4d1f">2/17 退房</span></div>`
          : `<div class="wrap mt8" style="gap:6px"><span class="chip" style="border-color:var(--accent);background:var(--accent-soft);color:#9a4d1f">2/14</span>${['10:30','14:00','15:30'].map((t,i)=>`<span class="chip" style="${i===1?'border-color:var(--accent);background:var(--accent-soft);color:#9a4d1f':''}">${t}</span>`).join('')}</div>`}
        <div class="divln mt12"></div>
        <div class="kv"><span class="k">訂金 30%</span><b style="color:var(--accent)">${fmt(deposit())}</b></div>
        <div class="wbtn pri block mt10">前往確認</div></div></div>`;

  const c4 = pad(`<div class="imgph" style="height:150px;border-radius:0;margin:-12px -14px 0">${gradeName()} 大圖</div><div style="height:80px"></div>`,false)
    + `<div class="modal-scrim"><div class="modal">
        <div class="row between"><b class="fs14">確認預約</b><span class="pill ${g.pill}"><i class="pdot"></i>${g.label}</span></div>
        <div class="mt10">${summaryCard()}</div>
        ${g.body?`<div class="banner ${g.kind} mt10"><span class="bdot"></span><span><b>${g.title}</b><br>${g.body}</span></div>`:''}
        <div class="wbtn ${g.dis?'disabled':'pri'} block mt12">${g.cta}</div>
        ${g.kind!=='danger'?'<div class="wbtn ghost block mt8">再看看</div>':'<div class="wbtn block mt8">聯繫門市</div>'}
      </div></div>`;

  return flowRow([
    frame({step:'C·1',cap:'探索首頁（服務優先）',note:'像逛商店，服務即內容',api:'GET /bookings/services',inner:c1}),
    frame({step:'C·2',cap:'服務詳情',note:'大圖＋分級＋方案內含',api:'GET /bookings/services',inner:c2}),
    frame({step:'C·3',cap:'預約底部彈窗',note:'選寵物＋時段一次到位',api:'GET /bookings/availability',inner:c3}),
    frame({step:'C·4',cap:'確認彈窗＋分流',note:'分流以 Modal 攔截',api:g.api,inner:c4}),
  ]);
};

/* =========================================================
   COMMON SCREENS（共用畫面，單一版本）
========================================================= */
function COMMON(){
  const login = pad(`<div style="height:30px"></div>
    <div class="col" style="align-items:center"><div class="imgph" style="width:64px;height:64px;border-radius:18px">LOGO</div>
    <div class="h-title mt12">寵物旅館</div><div class="h-sub">登入以管理預約</div></div>
    <div class="stack mt16"><div class="wcard flat"><span class="fs11 muted">電子郵件</span><div class="ln mt6" style="width:80%"></div></div>
    <div class="wcard flat"><span class="fs11 muted">密碼</span><div class="ln mt6" style="width:55%"></div></div></div>
    <div class="wbtn pri block mt12">登入</div>
    <div class="row between mt10 fs12"><span class="muted">忘記密碼？</span><span style="color:var(--accent)">註冊新帳號</span></div>`,false);

  const pets = pad(`<div class="h-title">我的寵物</div>
    <div class="stack mt12">
      ${petRow().replace('<div class="radio  "></div>','')}
      ${petRow().replace('旺財','毛球').replace('柴犬 · ♂ · 3 歲','貴賓 · ♀ · 2 歲').replace(dangerPill(S.danger),'')}
    </div>
    <div class="wbtn ghost block mt10">＋ 新增寵物</div>`)
    + bnav('me');

  const profile = pad(`<div class="row gap12"><div class="imgph avatar" style="width:56px;height:56px">照片</div>
      <div class="col gap4"><div class="row gap8"><b class="h-title" style="font-size:18px">旺財</b>${dangerPill(S.danger)}</div><span class="fs12 muted">柴犬 · ♂ · 3 歲</span></div></div>
    <div class="wcard flat mt12"><div class="kv"><span class="k">晶片號碼</span><span class="v mono fs12">900123456789012</span></div>
      <div class="divln dash"></div><div class="kv"><span class="k">行為備註</span><span class="v fs12">怕生，不喜歡被碰腳</span></div>
      ${S.danger!=='None'?`<div class="divln dash"></div><div class="kv"><span class="k">危險說明</span><span class="v fs12">曾對工作人員低吼</span></div>`:''}</div>
    <div class="row between mt16"><b class="fs13">疫苗紀錄</b><span class="fs12" style="color:var(--accent)">＋ 新增</span></div>
    <div class="wcard mt8"><div class="row between"><b class="fs13">狂犬病疫苗</b><span class="pill s-confirmed"><i class="pdot"></i>有效</span></div>
      <div class="fs11 muted mt6">有效期至 2026-12-31</div>
      <div class="row between mt8"><span class="imgph fs11" style="height:34px;flex:1">疫苗證明 PDF</span></div></div>
    <div class="wcard mt8" style="border-style:dashed"><div class="row between"><b class="fs13">八合一疫苗</b><span class="pill s-pending"><i class="pdot"></i>待上傳</span></div>
      <div class="wbtn sm ghost block mt8">上傳證明文件</div></div>`)
    + bnav('me');

  const bookings = pad(`<div class="h-title">我的預約</div>
    <div class="seg-pill mt10"><span class="on">進行中</span><span>歷史</span></div>
    <div class="stack mt12">
      <div class="wcard"><div class="row between"><b class="fs13">毛球 · 住宿中</b><span class="pill s-progress"><i class="pdot"></i>服務中</span></div><div class="fs12 muted mt6">床位 A-12 · 2/10–2/14</div></div>
      <div class="wcard"><div class="row between"><b class="fs13">旺財 · 完整美容</b><span class="pill s-confirmed"><i class="pdot"></i>已確認</span></div><div class="fs12 muted mt6">2/14 14:00 · 訂金已付</div></div>
      <div class="wcard"><div class="row between"><b class="fs13">旺財 · 標準房</b><span class="pill s-pending"><i class="pdot"></i>待付訂金</span></div><div class="fs12 muted mt6">2/20–2/22 · 待付 ${fmt(720)}</div></div>
      <div class="wcard" style="opacity:.7"><div class="row between"><b class="fs13">毛球 · 基礎美容</b><span class="pill s-cancel"><i class="pdot"></i>已取消</span></div><div class="fs12 muted mt6">1/28 · 全額退訂金</div></div>
    </div>`)
    + bnav('book');

  const stages=[['預檢','PreCheck','done'],['洗澡','Bathing','done'],['烘乾','Drying','now'],['剪毛','Grooming','']];
  const detail = pad(appbarless('預約明細')+`
    <div class="row between"><b class="h-title" style="font-size:18px">${S.service==='Lodging'?'毛球 · 豪華房':'毛球 · 完整美容'}</b><span class="pill s-progress"><i class="pdot"></i>服務中</span></div>
    <div class="fs12 muted mt6">${S.service==='Lodging'?'床位 A-12 · 2/10–2/14':'2/14 14:00 · 美容師 小林'}</div>
    ${S.service==='Grooming'?`<div class="ctrl-label mt14" style="letter-spacing:.04em">服務進度</div>
      <div class="stepper mt8">${stages.map(([t,e,st],i)=>`<div class="stp"><div class="rail"><div class="node ${st}">${st==='done'?'✓':''}</div>${i<3?`<div class="line ${st==='done'?'done':''}"></div>`:''}</div><div class="body"><div class="t">${t} <span class="mono fs11 muted">${e}</span></div><div class="s">${st==='done'?'已完成':st==='now'?'進行中…':'等待中'}</div></div></div>`).join('')}</div>`
    :`<div class="ctrl-label mt14" style="letter-spacing:.04em">住宿狀態</div><div class="wcard flat mt8"><div class="kv"><span class="k">床位</span><span class="v">A-12（豪華房）</span></div><div class="divln dash"></div><div class="kv"><span class="k">狀態</span><span class="v">已入住 Occupied</span></div></div>`}
    <div class="ctrl-label mt14" style="letter-spacing:.04em">作業照片</div>
    <div class="wrap mt8" style="gap:6px"><span class="imgph" style="width:72px;height:72px">照片</span><span class="imgph" style="width:72px;height:72px">照片</span><span class="imgph" style="width:72px;height:72px;border-style:dashed">待更新</span></div>
    <div class="divln mt14"></div>
    <div class="kv"><span class="k">尾款（報到日結清）</span><b>${fmt(700)}</b></div>
    <div class="wbtn pri block mt10">結清尾款</div>
    <div class="wbtn ghost block mt8">取消預約</div>`,true);

  const cancel = pad(appbarless('取消預約')+`
    <div class="banner warn mt6"><span class="bdot"></span><span><b>退款規則（FR-05.4）</b><br>開始前 <b>≥24 小時</b> 取消 → 全額退訂金；<b>未滿 24 小時</b> 或未到場 → 訂金不退。</span></div>
    <div class="wcard flat mt12"><div class="kv"><span class="k">預約</span><span class="v">旺財 · 標準房</span></div><div class="divln dash"></div>
      <div class="kv"><span class="k">距開始</span><span class="v" style="color:var(--ok)">3 天 6 小時</span></div>
      <div class="kv"><span class="k">可退訂金</span><span class="v" style="color:var(--ok)">${fmt(216)}（全額）</span></div></div>
    <div class="ctrl-label mt14" style="letter-spacing:.04em">取消原因（必填）</div>
    <div class="wcard flat mt8" style="height:64px"><span class="fs12 muted">臨時有事無法前往…</span></div>
    <div class="wbtn block mt12" style="border-color:var(--danger);color:var(--danger)">確認取消並退款</div>`,true);

  return [
    frame({cap:'登入／註冊',note:'Email 密碼，含密碼重設',api:'POST /auth/login · /auth/register',inner:login}),
    frame({cap:'我的寵物',note:'危險等級一眼可見',api:'GET /pets',inner:pets}),
    frame({cap:'寵物檔案＋疫苗',note:'醫療紀錄唯讀只增；證明可上傳',api:'GET /pets/{id} · POST …/vaccinations/{id}/proof',inner:profile}),
    frame({cap:'我的預約（清單）',note:'進行中／歷史，狀態用詞照狀態機',api:'GET /bookings?status=',inner:bookings}),
    frame({cap:'預約明細（進度＋照片）',note:'四階段照狀態機；住宿顯示床位',api:'GET /bookings/{id} · /grooming/work-orders',inner:detail}),
    frame({cap:'取消＋退款（24h 規則）',note:'先算可退金額再讓你按',api:'POST /cancellation/bookings/{id}',inner:cancel}),
  ].map((f,i)=> f + (i<5?arrow():'')).join('');
}
function appbarless(t){return `<div class="appbar"><span class="back">‹</span><span class="title">${t}</span><span class="right"></span></div>`.replace('<div class="appbar">','<div class="appbar" style="margin:-12px -14px 6px">');}

/* =========================================================
   RENDER
========================================================= */
const DESC = {
  A:{num:'A',name:'分步精靈',blurb:'把預約拆成「寵物 → 服務 → 時段 → 確認」四步，每屏一個決定，頂部進度條。危險分流安排在送出前最後一屏。最穩、最不易出錯，適合不熟流程的飼主。',
     chips:[['good','逐步引導，出錯率低'],['good','危險分流時機清楚'],['','屏數較多']]},
  B:{num:'B',name:'單頁堆疊',blurb:'寵物、服務、時段全在同一頁往下堆，底部黏著即時試算（總額／訂金）。分流橫幅就地浮現、不換頁，付款用底部彈窗。最快、最少跳轉，適合熟手回訪。',
     chips:[['good','一頁完成，跳轉最少'],['good','金額即時可見'],['warn','資訊密度較高']]},
  C:{num:'C',name:'服務優先',blurb:'首頁像逛商店，服務即內容（大圖＋分級）。先看服務詳情，再用底部彈窗選寵物與時段，確認以 Modal 攔截分流。最溫馨、最具導購感，適合新客探索。',
     chips:[['good','導購感強、視覺溫馨'],['good','適合新客探索'],['warn','流程較隱性']]},
};
function render(){
  // controls pressed state
  document.querySelectorAll('[data-ctrl]').forEach(b=>{
    const [k,v]=[b.dataset.ctrl,b.dataset.v];
    b.setAttribute('aria-pressed', String(S[k]===v));
  });
  const d=DESC[S.approach];
  document.getElementById('approachDesc').innerHTML=
    `<div class="eyebrow">方案</div><h2><span class="tagnum">${d.num}</span>${d.name}</h2><p>${d.blurb}</p>
     <div class="chips">${d.chips.map(([c,t])=>`<span class="chip ${c}">${c==='good'?'＋ ':c==='warn'?'△ ':''}${t}</span>`).join('')}</div>`;
  document.getElementById('flowRow').innerHTML = ({A,B,C})[S.approach]();
  document.getElementById('commonRow').innerHTML = COMMON();
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-ctrl]'); if(!b)return;
  S[b.dataset.ctrl]=b.dataset.v; render();
});
render();
