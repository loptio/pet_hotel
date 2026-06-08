/* =====================================================================
   飼主預約 App — approach C (service-first) interactive prototype
   ===================================================================== */
const S = {
  service:'Lodging', grade:1, pet:'a', danger:'None',
  slotL:{in:'2/14',out:'2/17',nights:3}, slotG:{date:'2/14（六）',time:'14:00'},
};

/* ---------- data ---------- */
const PETS = {
  a:{name:'旺財', breed:'柴犬', sex:'♂', age:'3 歲', chip:'900123456789012', behavior:'怕生，不喜歡被碰腳', danger:()=>S.danger},
  b:{name:'毛球', breed:'貴賓', sex:'♀', age:'2 歲', chip:'900987654321098', behavior:'親人、活潑', danger:()=>'None'},
};
const SVC = {
  Lodging:{ cat:'住宿', unit:'晚',
    grades:[
      {name:'標準房', price:800,  desc:'4㎡ 獨立房，每日放風 1 次，專人照護。', feats:['獨立空調房','每日放風 1 次','三餐定時餵食']},
      {name:'豪華房', price:1200, desc:'6㎡ 採光套房，每日放風 2 次＋視訊探視。', feats:['採光大套房','每日放風 2 次','每日視訊探視','24h 專人巡房']},
    ]},
  Grooming:{ cat:'美容', unit:'次',
    grades:[
      {name:'基礎美容', price:600,  desc:'洗澡、基礎修剪、剪指甲，約 90 分鐘。', feats:['洗澡吹乾','基礎修剪','剪指甲 + 清耳']},
      {name:'完整美容', price:1000, desc:'造型剪、SPA、耳道清潔與香氛，約 120 分鐘。', feats:['造型剪 + SPA','耳道深層清潔','香氛舒緩','作業全程拍照']},
    ]},
};
const svc = ()=>SVC[S.service];
const grade = ()=>svc().grades[S.grade];
const qty = ()=> S.service==='Lodging' ? S.slotL.nights : 1;
const total = ()=> grade().price*qty();
const deposit = ()=> Math.round(total()*0.3);
const fmt = n=>'NT$'+n.toLocaleString('en-US');
const slotText = ()=> S.service==='Lodging'
  ? `${S.slotL.in} 入住 → ${S.slotL.out} 退房 · ${S.slotL.nights} 晚`
  : `${S.slotG.date} ${S.slotG.time} · 約 ${S.grade?120:90} 分鐘`;

function gating(d){
  if(d==='High')   return {kind:'danger', badge:'danger',label:'已拒絕', icon:'⛔',
    title:'高度危險 — 無法線上預約', body:'此寵物標記為高度危險，系統自動拒絕。須先聯繫門市，由<b>管理員解除封鎖</b>後才能再次預約。',
    cta:'無法送出', dis:true};
  if(d==='Medium') return {kind:'warn', badge:'warn',label:'待審核', icon:'⏳',
    title:'送出後進入「待審核」', body:'中度危險寵物的預約須由<b>櫃台人員審核通過</b>後才能付訂金確認，本步驟暫不收款。',
    cta:'送出待審核', dis:false};
  if(d==='Low')    return {kind:'success', badge:'success',label:'可預約', icon:'✓',
    title:'可正常預約', body:'報到當天工作人員會收到<b>低度危險提醒</b>多加留意，不影響本次預約。',
    cta:'確認並付訂金', dis:false};
  return {kind:'info', badge:'success',label:'可預約', icon:'✓', title:'可正常預約', body:'', cta:'確認並付訂金', dis:false};
}

/* ---------- icons ---------- */
const sv=(p,w=24)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const IC={
  home:sv('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  cal:sv('<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8 3.2v3.6M16 3.2v3.6"/>'),
  paw:sv('<circle cx="7" cy="9" r="1.7"/><circle cx="12" cy="7.3" r="1.8"/><circle cx="17" cy="9" r="1.7"/><path d="M12 12c-2.6 0-4.5 1.7-4.5 3.6 0 1.6 1.4 2.4 3 2.4 1 0 1 .4 1.5.4s.5-.4 1.5-.4c1.6 0 3-.8 3-2.4 0-1.9-1.9-3.6-4.5-3.6Z"/>'),
  user:sv('<circle cx="12" cy="8" r="3.6"/><path d="M5 20c1.6-4.2 12.4-4.2 14 0"/>'),
  back:sv('<path d="M15 5l-7 7 7 7"/>'),
  plus:sv('<path d="M12 5v14M5 12h14"/>'),
  bell:sv('<path d="M6 9a6 6 0 0 1 12 0c0 4.5 1.8 5.5 1.8 5.5H4.2S6 13.5 6 9"/><path d="M10 19a2 2 0 0 0 4 0"/>'),
  cam:sv('<path d="M4 8h3l1.5-2h7L18 8h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.2"/>'),
  star:sv('<path d="M12 4l2.3 4.8 5.2.7-3.8 3.6 1 5.1-4.7-2.5-4.7 2.5 1-5.1L4.5 9.5l5.2-.7Z"/>'),
  clock:sv('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 1.5"/>'),
  chev:sv('<path d="M9 6l6 6-6 6"/>'),
  sliders:sv('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/>'),
  x:sv('<path d="M6 6l12 12M18 6L6 18"/>'),
  shield:sv('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6Z"/>'),
};

/* ---------- status badge helper ---------- */
const badge=(cls,zh,en='')=>`<span class="badge ${cls}"><span class="dot"></span>${zh}${en?`<span class="num" style="opacity:.6;font-weight:500"> ${en}</span>`:''}</span>`;

/* =====================================================================
   SCREENS (built once)
   ===================================================================== */
function screenHome(){ return `
<div class="screen" data-screen="home" data-screen-label="探索首頁">
  <div class="scroll pad-b-nav">
    <div class="hero">
      <image-slot id="ph-hero" src="hifi/img/hero.png" placeholder="店家主視覺／毛孩照片" shape="rect"></image-slot>
      <div class="grad"></div>
      <div class="cap">
        <div class="t-eyebrow" style="color:hsl(40 60% 88%)">午安，王小明</div>
        <div class="t-display" style="color:#fff; font-size:25px; margin-top:4px">想為毛孩<br>安排什麼？</div>
      </div>
    </div>
    <div class="pad">
      <div class="section-label" style="margin-bottom:10px">服務分類</div>
      <div class="row" style="gap:10px; align-items:stretch">
        <div class="cat-card" style="flex:1" data-cat="Lodging">
          <image-slot id="ph-cat-l" src="hifi/img/cat-lodge.png" placeholder="住宿照" shape="rect"></image-slot>
          <div class="ov"><div class="t-h3" style="color:#fff">住宿</div><div class="t-xs" style="color:hsl(40 40% 90%)">標準 / 豪華</div></div>
        </div>
        <div class="cat-card" style="flex:1" data-cat="Grooming">
          <image-slot id="ph-cat-g" src="hifi/img/cat-groom.png" placeholder="美容照" shape="rect"></image-slot>
          <div class="ov"><div class="t-h3" style="color:#fff">美容</div><div class="t-xs" style="color:hsl(40 40% 90%)">基礎 / 完整</div></div>
        </div>
      </div>

      <div class="between row" style="margin:22px 0 10px">
        <div class="section-label">熱門方案</div><span class="t-sm muted">查看全部</span>
      </div>
      <div class="svc-card" style="margin-bottom:12px" data-cat="Lodging" data-grade="1">
        <image-slot id="ph-svc1" src="hifi/img/svc-lodge.png" placeholder="豪華房照" shape="rect"></image-slot>
        <div class="body">
          <div class="between row"><div class="t-h3">豪華住宿套房</div><span class="badge brand">熱門</span></div>
          <div class="t-sm muted" style="margin-top:3px">採光套房 · 每日視訊探視</div>
          <div class="between row" style="margin-top:9px">
            <div class="row" style="gap:4px;color:hsl(var(--warning))">${IC.star}<span class="t-sm strong" style="color:hsl(var(--foreground))">4.9</span><span class="t-xs muted">· 218 則評價</span></div>
            <div class="price strong" style="color:hsl(var(--primary-strong))">NT$1,200<span class="t-xs muted">/晚</span></div>
          </div>
        </div>
      </div>
      <div class="svc-card" data-cat="Grooming" data-grade="1">
        <image-slot id="ph-svc2" src="hifi/img/svc-groom.png" placeholder="美容照" shape="rect"></image-slot>
        <div class="body">
          <div class="between row"><div class="t-h3">完整美容 SPA</div></div>
          <div class="t-sm muted" style="margin-top:3px">造型剪 + 耳道清潔 + 香氛</div>
          <div class="between row" style="margin-top:9px">
            <div class="row" style="gap:4px;color:hsl(var(--warning))">${IC.star}<span class="t-sm strong" style="color:hsl(var(--foreground))">4.8</span><span class="t-xs muted">· 約 120 分</span></div>
            <div class="price strong" style="color:hsl(var(--primary-strong))">NT$1,000<span class="t-xs muted">/次</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  ${tabbar('home')}
</div>`;}

function screenDetail(){ return `
<div class="screen" data-screen="detail" data-screen-label="服務詳情">
  <div class="scroll">
    <div style="position:relative">
      <image-slot id="ph-detail" src="hifi/img/detail.png" placeholder="服務大圖" shape="rect" style="width:100%;height:248px;display:block"></image-slot>
      <div class="iconbtn" data-back style="position:absolute;top:12px;left:12px;background:hsl(var(--card)/.9);box-shadow:var(--shadow-sm)">${IC.back}</div>
    </div>
    <div class="pad">
      <div class="between row">
        <div><span class="badge brand" id="d-cat">住宿</span><div class="t-h1" id="d-title" style="margin-top:8px">豪華房</div></div>
        <div class="price strong" style="color:hsl(var(--primary-strong));font-size:18px" id="d-price">NT$1,200<span class="t-xs muted">/晚</span></div>
      </div>
      <div class="row" style="gap:5px;margin-top:8px;color:hsl(var(--warning))">${IC.star}${IC.star}${IC.star}${IC.star}${IC.star}<span class="t-sm muted" style="margin-left:4px">4.9 · 218 則評價</span></div>
      <p class="t-body muted" id="d-desc" style="margin:12px 0 0">6㎡ 採光套房，每日放風 2 次＋視訊探視。</p>

      <div class="section-label" style="margin:20px 0 10px">方案內含</div>
      <div class="stack" id="d-feats" style="display:flex;flex-direction:column;gap:9px"></div>

      <div class="section-label" style="margin:20px 0 10px">選擇分級</div>
      <div class="seg" id="d-grades" style="width:100%"></div>

      <div class="card flat pad" style="margin-top:16px">
        <div class="row" style="gap:10px">
          <div style="color:hsl(var(--primary))">${IC.shield}</div>
          <div class="t-sm muted">所有住宿寵物均需有效疫苗證明，報到時由櫃台核驗。可於寵物檔案預先上傳。</div>
        </div>
      </div>
    </div>
  </div>
  <div style="flex:0 0 auto;padding:12px 18px calc(14px + env(safe-area-inset-bottom));border-top:1px solid hsl(var(--border));background:hsl(var(--card))">
    <div class="row between" style="gap:14px">
      <div><div class="t-xs muted">訂金 30%</div><div class="price strong" style="font-size:17px;color:hsl(var(--primary-strong))" id="d-dep">NT$1,080</div></div>
      <button class="btn primary lg" style="flex:1" data-open="sheet-book">立即預約</button>
    </div>
  </div>
</div>`;}

function screenBookings(){ return `
<div class="screen" data-screen="bookings" data-screen-label="我的預約">
  <div class="topbar"><div class="title" style="padding-left:6px">我的預約</div><div class="iconbtn">${IC.bell}</div></div>
  <div class="scroll pad-b-nav"><div class="pad">
    <div class="seg" id="bk-tabs" style="width:100%;margin-bottom:14px"><button aria-selected="true">進行中</button><button aria-selected="false">歷史</button></div>
    <div class="stack" style="display:flex;flex-direction:column;gap:12px">
      <div class="card tap pad" data-go="booking-detail">
        <div class="between row"><div class="t-h3">毛球 · 豪華房</div>${badge('brand','服務中','InProgress')}</div>
        <div class="t-sm muted" style="margin-top:6px">床位 A-12 · 2/10 – 2/14</div>
        <div class="hr" style="margin:11px 0"></div>
        <div class="row between"><span class="t-sm muted">服務進度</span><span class="t-sm strong" style="color:hsl(var(--primary-strong))">住宿中 · 第 3 天</span></div>
      </div>
      <div class="card tap pad" data-go="booking-detail">
        <div class="between row"><div class="t-h3">旺財 · 完整美容</div>${badge('success','已確認','Confirmed')}</div>
        <div class="t-sm muted" style="margin-top:6px">2/14（六）14:00 · 訂金已付</div>
      </div>
      <div class="card tap pad">
        <div class="between row"><div class="t-h3">旺財 · 標準房</div>${badge('warn','待付訂金','PendingDeposit')}</div>
        <div class="t-sm muted" style="margin-top:6px">2/20 – 2/22 · 待付 NT$720</div>
        <button class="btn primary sm block" style="margin-top:11px" data-open="sheet-pay">付訂金</button>
      </div>
      <div class="card pad" style="opacity:.72">
        <div class="between row"><div class="t-h3">毛球 · 基礎美容</div>${badge('neutral','已取消','Cancelled')}</div>
        <div class="t-sm muted" style="margin-top:6px">1/28 · 已全額退還訂金</div>
      </div>
    </div>
  </div></div>
  ${tabbar('bookings')}
</div>`;}

function screenBookingDetail(){ return `
<div class="screen" data-screen="booking-detail" data-screen-label="預約明細">
  <div class="topbar bordered center"><div class="iconbtn" data-back>${IC.back}</div><div class="title">預約明細</div><div style="width:38px"></div></div>
  <div class="scroll"><div class="pad">
    <div class="between row"><div class="t-h1">毛球 · 豪華房</div>${badge('brand','服務中','InProgress')}</div>
    <div class="t-sm muted" style="margin-top:6px">床位 A-12（豪華房）· 2/10 – 2/14</div>

    <div class="section-label" style="margin:20px 0 12px">服務進度</div>
    <div class="card pad">
      <div class="stepper">
        <div class="step"><div class="rail"><div class="node done">✓</div><div class="bar done"></div></div><div class="txt"><div class="tt">入住報到 <span class="num t-xs muted">CheckedIn</span></div><div class="ss">2/10 09:20 · 床位 A-12</div></div></div>
        <div class="step"><div class="rail"><div class="node now"></div><div class="bar"></div></div><div class="txt"><div class="tt">住宿照護中 <span class="num t-xs muted">InProgress</span></div><div class="ss">每日放風 2 次 · 視訊探視已開通</div></div></div>
        <div class="step"><div class="rail"><div class="node"></div></div><div class="txt"><div class="tt">退房結清 <span class="num t-xs muted">Completed</span></div><div class="ss">預計 2/14 09:00 前</div></div></div>
      </div>
    </div>

    <div class="between row" style="margin:20px 0 12px"><div class="section-label">照護照片</div><span class="t-xs muted">每日更新</span></div>
    <div class="photos">
      <div class="p"><image-slot id="ph-wp1" src="hifi/img/care1.png" placeholder="放風照" shape="rect" style="width:100%;height:100%"></image-slot></div>
      <div class="p"><image-slot id="ph-wp2" src="hifi/img/care2.png" placeholder="用餐照" shape="rect" style="width:100%;height:100%"></image-slot></div>
      <div class="p empty">待更新</div>
    </div>

    <div class="card flat pad" style="margin-top:20px">
      <div class="kv"><span class="k">預估總額</span><span class="v price">NT$3,600</span></div>
      <div class="hr dash" style="margin:9px 0"></div>
      <div class="kv"><span class="k">已付訂金 30%</span><span class="v price" style="color:hsl(var(--success))">− NT$1,080</span></div>
      <div class="kv" style="margin-top:7px"><span class="k strong" style="color:hsl(var(--foreground))">尾款（報到日結清）</span><span class="v price strong" style="color:hsl(var(--primary-strong))">NT$2,520</span></div>
    </div>
  </div></div>
  <div style="flex:0 0 auto;padding:12px 18px calc(14px + env(safe-area-inset-bottom));border-top:1px solid hsl(var(--border));background:hsl(var(--card));display:flex;gap:10px">
    <button class="btn danger" data-open="sheet-cancel">取消預約</button>
    <button class="btn primary" style="flex:1" data-open="sheet-pay">結清尾款 NT$2,520</button>
  </div>
</div>`;}

function screenPets(){ return `
<div class="screen" data-screen="pets" data-screen-label="我的寵物">
  <div class="topbar"><div class="title" style="padding-left:6px">我的寵物</div><div class="iconbtn">${IC.plus}</div></div>
  <div class="scroll pad-b-nav"><div class="pad">
    <div class="stack" style="display:flex;flex-direction:column;gap:12px">
      <div class="card tap" data-go="pet-profile">
        <div class="list-row">
          <image-slot id="ph-pet-a" src="hifi/img/pet-shiba.png" class="lead" placeholder="照" shape="rounded" radius="14"></image-slot>
          <div style="flex:1">
            <div class="row between"><div class="t-h3">旺財</div><span id="pets-danger"></span></div>
            <div class="t-sm muted" style="margin-top:2px">柴犬 · ♂ · 3 歲</div>
          </div>
          <div style="color:hsl(var(--muted-foreground))">${IC.chev}</div>
        </div>
      </div>
      <div class="card tap">
        <div class="list-row">
          <image-slot id="ph-pet-b" src="hifi/img/pet-poodle.png" class="lead" placeholder="照" shape="rounded" radius="14"></image-slot>
          <div style="flex:1">
            <div class="t-h3">毛球</div><div class="t-sm muted" style="margin-top:2px">貴賓 · ♀ · 2 歲</div>
          </div>
          <div style="color:hsl(var(--muted-foreground))">${IC.chev}</div>
        </div>
      </div>
      <button class="btn outline block" style="border-style:dashed">${IC.plus} 新增寵物</button>
    </div>
  </div></div>
  ${tabbar('pets')}
</div>`;}

function screenPetProfile(){ return `
<div class="screen" data-screen="pet-profile" data-screen-label="寵物檔案">
  <div class="topbar bordered center"><div class="iconbtn" data-back>${IC.back}</div><div class="title">寵物檔案</div><div class="iconbtn" style="font-size:13px;color:hsl(var(--primary));font-weight:600;width:auto;padding:0 8px">編輯</div></div>
  <div class="scroll"><div class="pad">
    <div class="row" style="gap:14px">
      <image-slot id="ph-pet-a2" src="hifi/img/pet-shiba.png" placeholder="照片" shape="circle" style="width:64px;height:64px"></image-slot>
      <div><div class="row" style="gap:8px"><div class="t-h1">旺財</div><span id="prof-danger"></span></div><div class="t-sm muted" style="margin-top:3px">柴犬 · ♂ · 3 歲</div></div>
    </div>
    <div class="card flat pad" style="margin-top:16px">
      <div class="kv"><span class="k">晶片號碼</span><span class="v num" style="font-size:12.5px">900123456789012</span></div>
      <div class="hr dash" style="margin:10px 0"></div>
      <div class="kv"><span class="k">行為備註</span><span class="v" style="font-size:13px;max-width:60%;text-align:right">怕生，不喜歡被碰腳</span></div>
      <div id="prof-dnote"></div>
    </div>

    <div class="between row" style="margin:22px 0 12px"><div class="section-label">疫苗紀錄</div><span class="t-sm" style="color:hsl(var(--primary));font-weight:600">＋ 新增</span></div>
    <div class="card pad" style="margin-bottom:11px">
      <div class="between row"><div class="t-h3">狂犬病疫苗</div>${badge('success','有效','Valid')}</div>
      <div class="t-sm muted" style="margin-top:5px">有效期至 2026-12-31</div>
      <div class="row" style="gap:8px;margin-top:11px"><div class="ph" style="flex:1;height:38px;border-radius:var(--radius-sm);font-size:11px">vaccine-proof.pdf ✓</div></div>
    </div>
    <div class="card pad" style="border-style:dashed">
      <div class="between row"><div class="t-h3">八合一疫苗</div>${badge('warn','待上傳','Pending')}</div>
      <button class="btn outline sm block" style="margin-top:11px">${IC.cam} 上傳證明文件</button>
    </div>

    <div class="between row" style="margin:22px 0 12px"><div class="section-label">醫療背景</div><span class="t-xs muted">僅可新增，不可修改</span></div>
    <div class="card flat pad"><div class="t-sm">2025／06 皮膚過敏就診，已痊癒。</div></div>
  </div></div>
</div>`;}

function screenMe(){ return `
<div class="screen" data-screen="me" data-screen-label="我的">
  <div class="scroll pad-b-nav"><div class="pad">
    <div class="row" style="gap:14px;margin-top:8px">
      <image-slot id="ph-me" src="hifi/img/avatar-owner.png" placeholder="頭像" shape="circle" style="width:62px;height:62px"></image-slot>
      <div><div class="t-h1">王小明</div><div class="t-sm muted" style="margin-top:2px">wang@example.com · 0912-345-678</div></div>
    </div>
    <div class="stack" style="display:flex;flex-direction:column;gap:0;margin-top:22px">
      ${meRow('個人資料')}${meRow('我的寵物','pets')}${meRow('預約紀錄','bookings')}${meRow('通知設定')}${meRow('付款方式')}${meRow('幫助與客服')}
    </div>
    <button class="btn ghost block" style="margin-top:18px;color:hsl(var(--muted-foreground))">登出</button>
  </div></div>
  ${tabbar('me')}
</div>`;}
const meRow=(t,go='')=>`<div class="list-row card tap" ${go?`data-go="${go}"`:''} style="border-radius:0;border-left:0;border-right:0;box-shadow:none;border-top:0">
  <div style="flex:1" class="t-body strong">${t}</div><div style="color:hsl(var(--muted-foreground))">${IC.chev}</div></div>`;

function screenLogin(){ return `
<div class="screen active" data-screen="login" data-screen-label="登入">
  <div class="scroll"><div class="pad" style="display:flex;flex-direction:column;min-height:100%;justify-content:center">
    <div style="text-align:center;margin-bottom:30px">
      <img src="hifi/img/logo.png" alt="寵物旅館" style="width:74px;height:74px;border-radius:22px;margin:0 auto;display:block;box-shadow:var(--shadow-md)">
      <div class="t-display" style="margin-top:16px">寵物旅館</div>
      <div class="t-sm muted" style="margin-top:4px">把毛孩，交給信賴的人</div>
    </div>
    <div class="field" style="margin-bottom:12px"><label>電子郵件</label><input class="input" value="wang@example.com"></div>
    <div class="field" style="margin-bottom:18px"><label>密碼</label><input class="input" type="password" value="········"></div>
    <button class="btn primary lg block" data-go="home">登入</button>
    <div class="row between" style="margin-top:14px"><span class="t-sm muted">忘記密碼？</span><span class="t-sm" style="color:hsl(var(--primary));font-weight:600">註冊新帳號</span></div>
  </div></div>
</div>`;}

const tabbar=(on)=>`<div class="tabbar">
  <a data-tab="home" class="${on==='home'?'on':''}">${IC.home}<span>探索</span></a>
  <a data-tab="bookings" class="${on==='bookings'?'on':''}">${IC.cal}<span>預約</span></a>
  <a data-tab="pets" class="${on==='pets'?'on':''}">${IC.paw}<span>寵物</span></a>
  <a data-tab="me" class="${on==='me'?'on':''}">${IC.user}<span>我的</span></a>
</div>`;

/* =====================================================================
   OVERLAYS (built fresh on open)
   ===================================================================== */
function overlayBook(){
  const s=svc();
  const slotUI = S.service==='Lodging' ? calendarUI() : timeUI();
  return sheet(`
    <div class="between row"><div class="t-h2">預約 · ${grade().name}</div><div class="iconbtn" data-close>${IC.x}</div></div>
    <div class="section-label" style="margin:14px 0 9px">為哪位毛孩預約？</div>
    <div class="row" style="gap:8px;flex-wrap:wrap">
      <span class="chip on" data-pet="a">旺財 ${S.danger!=='None'?'⚠':''}</span>
      <span class="chip" data-pet="b">毛球</span>
    </div>
    <div class="section-label" style="margin:18px 0 9px">${S.service==='Lodging'?'選擇住宿期間':'選擇日期與時段'}</div>
    <div class="alert info" style="margin-bottom:12px"><span class="ic">ⓘ</span><span>僅顯示目前<b>可預約</b>的時段。</span></div>
    ${slotUI}
    <div class="hr" style="margin:16px 0 12px"></div>
    <div class="row between" style="margin-bottom:12px"><div><div class="t-xs muted">訂金 30%</div><div class="price strong" style="font-size:17px;color:hsl(var(--primary-strong))">${fmt(deposit())}</div></div>
      <div class="t-xs muted" style="text-align:right;max-width:50%">${slotText()}</div></div>
    <button class="btn primary lg block" data-open="modal-confirm" data-close-sheet>前往確認</button>
  `);
}
function calendarUI(){
  let cells=''; const off=[1,2,3];
  off.forEach(d=>cells+=`<div class="d off">${26+d}</div>`);
  for(let d=1;d<=28;d++){ let c='d';
    if([8,9,20].includes(d)) c+=' full';
    if(d===14) c+=' edge s'; else if(d===17) c+=' edge e'; else if(d>14&&d<17) c+=' in';
    cells+=`<div class="${c}">${d}</div>`; }
  return `<div class="cal"><div class="between row" style="margin-bottom:8px"><span class="t-sm strong">2026 年 2 月</span><span class="muted">${IC.chev}</span></div>
    <div class="cal-grid"><div class="wd">日</div><div class="wd">一</div><div class="wd">二</div><div class="wd">三</div><div class="wd">四</div><div class="wd">五</div><div class="wd">六</div>${cells}</div></div>`;
}
function timeUI(){
  const slots=[['09:00',1],['10:30',1],['12:00',0],['14:00',2],['15:30',1],['17:00',0]];
  return `<div class="row" style="gap:7px;flex-wrap:wrap;margin-bottom:12px">${['2/13 五','2/14 六','2/15 日','2/16 一'].map((d,i)=>`<span class="chip ${i===1?'on':''}">${d}</span>`).join('')}</div>
    <div style="display:flex;flex-direction:column;gap:8px">${slots.map(([t,c])=>`<div class="timeslot ${c===0?'full':(t==='14:00'?'on':'')}"><span class="num">${t}</span><span class="t-sm">${c===0?'已額滿':(t==='14:00'?'已選 ✓':'可預約')}</span></div>`).join('')}</div>`;
}

function overlayConfirm(){
  const g=gating(S.danger); const s=svc();
  return modal(`
    <div class="between row"><div class="t-h2">確認預約</div>${badge(g.badge,g.label)}</div>
    <div class="card flat pad" style="margin-top:14px">
      <div class="kv"><span class="k">寵物</span><span class="v">旺財 · 柴犬</span></div>
      <div class="hr dash" style="margin:9px 0"></div>
      <div class="kv"><span class="k">服務</span><span class="v">${s.cat} · ${grade().name}</span></div>
      <div class="hr dash" style="margin:9px 0"></div>
      <div class="kv"><span class="k">${S.service==='Lodging'?'住宿期間':'預約時段'}</span><span class="v" style="font-size:12.5px;text-align:right;max-width:58%">${slotText()}</span></div>
      <div class="hr" style="margin:11px 0"></div>
      <div class="kv"><span class="k">預估總額</span><span class="v price">${fmt(total())}</span></div>
      <div class="kv" style="margin-top:6px"><span class="k strong" style="color:hsl(var(--foreground))">訂金 30%（本次支付）</span><span class="v price strong" style="color:hsl(var(--primary-strong))">${fmt(deposit())}</span></div>
      <div class="kv" style="margin-top:6px"><span class="k muted">尾款（報到日結清）</span><span class="v price muted">${fmt(total()-deposit())}</span></div>
    </div>
    ${g.body?`<div class="alert ${g.kind}" style="margin-top:13px"><span class="ic">${g.icon}</span><span><b>${g.title}</b><br>${g.body}</span></div>`:''}
    <button class="btn ${g.dis?'disabled':'primary'} lg block" style="margin-top:16px" ${g.dis?'disabled':(S.danger==='Medium'?'data-open="modal-review" data-close-modal':'data-open="sheet-pay" data-close-modal')}>${g.cta}</button>
    ${g.dis?'<button class="btn outline block" style="margin-top:9px" data-close>聯繫門市</button>':'<button class="btn ghost block" style="margin-top:7px" data-close>再看看</button>'}
  `);
}
function overlayPay(){
  return sheet(`
    <div class="between row"><div class="t-h2">支付訂金</div><div class="iconbtn" data-close>${IC.x}</div></div>
    <div class="t-display" style="color:hsl(var(--primary-strong));margin:6px 0 2px">${fmt(deposit())}</div>
    <div class="t-sm muted" style="margin-bottom:16px">預估總額 ${fmt(total())} 的 30%</div>
    <div class="section-label" style="margin-bottom:9px">支付方式</div>
    <div class="card sel pad" style="margin-bottom:9px"><div class="row" style="gap:11px"><div style="width:18px;height:18px;border-radius:50%;border:5px solid hsl(var(--primary))"></div><div style="flex:1"><div class="t-h3">線上付款</div><div class="t-xs muted">ECPay 信用卡 / 行動支付</div></div></div></div>
    <div class="card pad"><div class="row" style="gap:11px"><div style="width:18px;height:18px;border-radius:50%;border:1.7px solid hsl(var(--border))"></div><div style="flex:1"><div class="t-h3">現場刷卡</div><div class="t-xs muted">報到當日於門市結清</div></div></div></div>
    <div class="alert info" style="margin-top:13px"><span class="ic">ⓘ</span><span>付款資訊由 ECPay 處理，不留存於系統。</span></div>
    <button class="btn primary lg block" style="margin-top:14px" data-open="modal-success" data-close-sheet>確認付款 ${fmt(deposit())}</button>
  `);
}
function overlaySuccess(){
  return modal(`
    <div style="text-align:center;padding:8px 0 4px">
      <div class="success-icon">🎉</div>
      <div class="t-h1" style="margin-top:16px">預約成功！</div>
      <div class="t-sm muted" style="margin-top:6px;max-width:240px;margin-left:auto;margin-right:auto">毛孩交給我們，訂金 ${fmt(deposit())} 已付款，我們會在報到前提醒您。</div>
      <div style="margin-top:12px">${badge('success','已確認','Confirmed')}</div>
    </div>
    <div class="card flat pad" style="margin-top:16px;text-align:left">
      <div class="kv"><span class="k">${svc().cat} · ${grade().name}</span><span class="v" style="font-size:12px">${slotText()}</span></div>
    </div>
    <button class="btn primary lg block" style="margin-top:14px" data-go="booking-detail" data-close>查看預約明細</button>
    <button class="btn ghost block" style="margin-top:7px" data-go="home" data-close>回首頁</button>
  `);
}
function overlayReview(){
  return modal(`
    <div style="text-align:center;padding:8px 0 4px">
      <div class="success-icon" style="background:hsl(var(--warning-soft));color:hsl(var(--warning))">⏳</div>
      <div class="t-h1" style="margin-top:16px">已送出，待審核</div>
      <div class="t-sm muted" style="margin-top:6px;max-width:250px;margin-left:auto;margin-right:auto">中度危險寵物的預約需櫃台審核。通過後會通知您完成付款，目前<b>暫未收取訂金</b>。</div>
      <div style="margin-top:12px">${badge('warn','待審核','PendingReview')}</div>
    </div>
    <button class="btn primary lg block" style="margin-top:16px" data-go="bookings" data-close>查看我的預約</button>
  `);
}
function overlayCancel(){
  return sheet(`
    <div class="between row"><div class="t-h2">取消預約</div><div class="iconbtn" data-close>${IC.x}</div></div>
    <div class="alert warn" style="margin:12px 0"><span class="ic">!</span><span><b>退款規則</b><br>開始前 <b>≥24 小時</b> 取消 → 全額退訂金；<b>未滿 24 小時</b> 或未到場 → 訂金不退。</span></div>
    <div class="card flat pad">
      <div class="kv"><span class="k">距開始</span><span class="v" style="color:hsl(var(--success))">3 天 6 小時</span></div>
      <div class="hr dash" style="margin:9px 0"></div>
      <div class="kv"><span class="k">可退訂金</span><span class="v price" style="color:hsl(var(--success))">NT$1,080（全額）</span></div>
    </div>
    <div class="field" style="margin-top:14px"><label>取消原因（必填）</label><textarea class="input" rows="3" placeholder="臨時有事無法前往…"></textarea></div>
    <button class="btn lg block" style="margin-top:14px;background:hsl(var(--destructive));color:#fff;border-color:hsl(var(--destructive))" data-go="bookings" data-close>確認取消並退款</button>
  `);
}

const sheet=(inner)=>`<div class="scrim" data-close></div><div class="sheet"><div class="grab"></div><div class="sheet-scroll">${inner}</div></div>`;
const modal=(inner)=>`<div class="scrim" data-close></div><div class="modal-wrap"><div class="modal">${inner}</div></div>`;
const OVL={ 'sheet-book':overlayBook, 'modal-confirm':overlayConfirm, 'sheet-pay':overlayPay,
  'modal-success':overlaySuccess, 'modal-review':overlayReview, 'sheet-cancel':overlayCancel };

/* =====================================================================
   MOUNT + ROUTER
   ===================================================================== */
const root=document.getElementById('screens');
root.innerHTML=[screenLogin(),screenHome(),screenDetail(),screenBookings(),screenBookingDetail(),
  screenPets(),screenPetProfile(),screenMe()].join('');
const ovlHost=document.getElementById('overlays');

let current='login'; const stack=[];
function go(name,{push=true}={}){
  const cur=root.querySelector('.screen.active');
  const next=root.querySelector(`.screen[data-screen="${name}"]`);
  if(!next||name===current) return;
  if(push&&current) stack.push(current);
  if(cur){ cur.classList.remove('active'); }
  next.classList.add('active'); next.querySelector('.scroll')?.scrollTo(0,0);
  current=name;
}
function back(){ const prev=stack.pop()||'home'; go(prev,{push:false}); }

function openOverlay(id){
  const fn=OVL[id]; if(!fn) return;
  ovlHost.dataset.cur=id; ovlHost.innerHTML=`<div class="overlay" data-ovl>${fn()}</div>`;
  const el=ovlHost.querySelector('.overlay'); void el.offsetWidth; el.classList.add('open');
}
function closeOverlay(){ const o=ovlHost.querySelector('.overlay'); if(!o)return; o.classList.remove('open'); setTimeout(()=>{ if(ovlHost.querySelector('.overlay:not(.open)')) ovlHost.innerHTML=''; },300); }

function syncService(){
  const s=svc(), g=grade();
  const set=(id,html)=>{const e=document.getElementById(id); if(e)e.innerHTML=html;};
  set('d-cat',s.cat); set('d-title',g.name);
  set('d-price',`${fmt(g.price)}<span class="t-xs muted">/${s.unit}</span>`);
  set('d-desc',g.desc);
  set('d-dep',fmt(deposit()));
  set('d-feats', g.feats.map(f=>`<div class="row" style="gap:9px"><span style="color:hsl(var(--success))">✓</span><span class="t-body">${f}</span></div>`).join(''));
  set('d-grades', s.grades.map((gd,i)=>`<button aria-selected="${i===S.grade}" data-grade-pick="${i}">${gd.name}</button>`).join(''));
}
function syncDanger(){
  const d=S.danger;
  const pill = d==='None' ? '' : badge(d==='Low'?'success':d==='Medium'?'warn':'danger', d==='Low'?'低度危險':d==='Medium'?'中度危險':'高度危險');
  ['pets-danger','prof-danger'].forEach(id=>{const e=document.getElementById(id); if(e)e.innerHTML=pill;});
  const dn=document.getElementById('prof-dnote');
  if(dn) dn.innerHTML = d==='None' ? '' : `<div class="hr dash" style="margin:10px 0"></div><div class="kv"><span class="k">危險說明</span><span class="v" style="font-size:13px;color:hsl(var(--destructive))">曾對工作人員低吼</span></div>`;
}

/* ---------- global click delegation ---------- */
document.addEventListener('click',e=>{
  const t=e.target;
  const tab=t.closest('[data-tab]');   if(tab){ go(tab.dataset.tab); return; }
  const goEl=t.closest('[data-go]');   if(goEl){ if(goEl.hasAttribute('data-close')) closeOverlay(); go(goEl.dataset.go); return; }
  const backEl=t.closest('[data-back]'); if(backEl){ back(); return; }
  const cat=t.closest('[data-cat]');   if(cat){ S.service=cat.dataset.cat; if(cat.dataset.grade) S.grade=+cat.dataset.grade; syncService(); go('detail'); return; }
  const gp=t.closest('[data-grade-pick]'); if(gp){ S.grade=+gp.dataset.gradePick; syncService(); return; }
  const open=t.closest('[data-open]'); if(open){ if(open.hasAttribute('data-close-sheet')||open.hasAttribute('data-close-modal')) closeOverlay(); setTimeout(()=>openOverlay(open.dataset.open), (open.hasAttribute('data-close-sheet')||open.hasAttribute('data-close-modal'))?180:0); return; }
  const pet=t.closest('[data-pet]');   if(pet){ ovlHost.querySelectorAll('[data-pet]').forEach(x=>x.classList.toggle('on',x===pet)); S.pet=pet.dataset.pet; return; }
  if(t.closest('[data-close]')||t.matches('.scrim')){ closeOverlay(); return; }
  // seg toggles (bookings/grade demo within static screens)
  const seg=t.closest('.seg button'); if(seg && seg.parentElement.id==='bk-tabs'){ [...seg.parentElement.children].forEach(b=>b.setAttribute('aria-selected',b===seg)); return; }
});

/* ---------- settings (preview controls) ---------- */
const fab=document.getElementById('fab'), settings=document.getElementById('settings');
fab.addEventListener('click',()=>settings.classList.toggle('open'));
settings.addEventListener('click',e=>{
  const p=e.target.closest('[data-set-pal]'); if(p){ document.documentElement.dataset.palette=p.dataset.setPal; settings.querySelectorAll('[data-set-pal]').forEach(x=>x.setAttribute('aria-pressed',x===p)); return; }
  const r=e.target.closest('[data-set-round]'); if(r){ document.documentElement.dataset.round=r.dataset.setRound; settings.querySelectorAll('[data-set-round]').forEach(x=>x.setAttribute('aria-selected',x===r)); return; }
  const d=e.target.closest('[data-set-danger]'); if(d){ S.danger=d.dataset.setDanger; settings.querySelectorAll('[data-set-danger]').forEach(x=>x.setAttribute('aria-selected',x===d)); syncDanger(); return; }
});

syncService(); syncDanger();
