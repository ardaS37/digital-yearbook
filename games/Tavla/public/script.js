const CONFIG = window.__TAVLA_CONFIG__ || { type: 'tavla' };
const API = `${window.location.pathname.replace(/\/$/, '')}/api`;
const GAME_LINKS = {
  tavla: '/games/tavla/play/', koridor: '/games/koridor/play/', '9-tas': '/games/9-tas/play/', '3-tas': '/games/3-tas/play/',
  dama: '/games/dama/play/', 'capraz-dama': '/games/capraz-dama/play/', mangala: '/games/mangala/play/', reversi: '/games/reversi/play/',
  xox: '/games/xox/play/', sos: '/games/sos/play/', 'kutu-doldurmaca': '/games/kutu-doldurmaca/play/', 'yilanlar-ve-merdivenler': '/games/yilanlar-ve-merdivenler/play/',
  abalone: '/games/abalone/play/', satranc: '/games/satranc/play/', 'dortlu-birlestir': '/games/dortlu-birlestir/play/', mastermind: '/games/mastermind/play/', domino: '/games/domino/play/', go: '/games/go/play/', 'kizma-birader': '/games/kizma-birader/play/'
};
let room = null, pollTimer = null, selectedPoint = null, selectedDie = null;
const els = {
  gameSelect: document.getElementById('game-select'), roomTitle: document.getElementById('room-title'), players: document.getElementById('players'), turn: document.getElementById('turn'), borne: document.getElementById('borne'), message: document.getElementById('message'), board: document.getElementById('board'), openList: document.getElementById('open-list'), roomCode: document.getElementById('room-code'), joinForm: document.getElementById('join-form'), createRoom: document.getElementById('create-room'), pcRoom: document.getElementById('pc-room'), refresh: document.getElementById('refresh'), rollBtn: document.getElementById('roll-btn'), passBtn: document.getElementById('pass-btn'), diceList: document.getElementById('dice-list')
};
function markLabel(mark){ return { X:'Acik', O:'Koyu', draw:'Berabere' }[mark] || mark; }
function setMessage(text,type=''){ els.message.className=`message ${type}`.trim(); els.message.textContent=text||''; }
function escapeHtml(v){ return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function canMove(){ return room && room.status==='playing' && room.state.turn===room.mark; }
async function loadRooms(){ const r=await fetch(`${API}/rooms?type=${encodeURIComponent(CONFIG.type)}`); const d=await r.json(); if(!r.ok){ els.openList.textContent=d.error||'Odalar alinamadi.'; return;} if(!d.rooms.length){ els.openList.textContent='Acik oda yok.'; return;} els.openList.innerHTML=d.rooms.map(item=>`<div class="open-room-row"><span><strong>${item.code}</strong><br>${escapeHtml(item.hostName)}</span><button data-join="${item.code}" type="button">Katil</button></div>`).join(''); els.openList.querySelectorAll('[data-join]').forEach(btn=>btn.addEventListener('click',()=>joinRoom(btn.getAttribute('data-join')))); }
function setRoom(data){ room=data; selectedPoint=null; selectedDie=null; els.roomTitle.textContent=`Oda ${data.code}`; els.players.innerHTML=Object.entries(data.players).filter(([,p])=>p).map(([m,p])=>`${markLabel(m)}: <strong>${escapeHtml(p.name)}</strong>`).join('<br>'); els.turn.textContent=data.status==='finished'?'':`${markLabel(data.state.turn)} | Sen: ${markLabel(data.mark)}`; els.borne.textContent=`Bar: Acik ${data.state.bar?.X||0} | Koyu ${data.state.bar?.O||0} | Toplanan: Acik ${data.state.borne.X} | Koyu ${data.state.borne.O}`; if(data.status==='waiting') setMessage('Oda acik. Rakip bekleniyor.'); else if(data.status==='finished') setMessage(data.finishReason||`${markLabel(data.state.winner)} kazandi.`, 'success'); else setMessage(data.state.turn===data.mark?'Pul sec veya zar at.':'Rakip bekleniyor.'); renderDice(); renderBoard(); startPolling(); }
function startPolling(){ if(!room) return; if(pollTimer) clearInterval(pollTimer); pollTimer=setInterval(async()=>{ if(selectedPoint!==null || selectedDie!==null) return; const r=await fetch(`${API}/rooms/${room.code}`); if(!r.ok) return; setRoom(await r.json()); },1400); }
async function createRoom(bot){ const r=await fetch(`${API}/rooms`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:CONFIG.type,bot})}); const d=await r.json(); if(!r.ok) return setMessage(d.error||'Oda kurulamadi.','error'); setRoom(d); await loadRooms(); }
async function joinRoom(code){ const r=await fetch(`${API}/rooms/${code}/join`,{method:'POST'}); const d=await r.json(); if(!r.ok) return setMessage(d.error||'Odaya katilamadin.','error'); setRoom(d); await loadRooms(); }
async function sendMove(payload){ if(!room) return; const r=await fetch(`${API}/rooms/${room.code}/move`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const d=await r.json(); if(!r.ok) return setMessage(d.error||'Hamle yapilamadi.','error'); setRoom(d); }
function pointOwner(point){ return point.X>0 ? 'X' : point.O>0 ? 'O' : ''; }
function pointCount(point, mark){ return Number(point?.[mark] || 0); }
function homeRange(mark){ return mark === 'X' ? [0, 5] : [18, 23]; }
function allCheckersHome(mark){
  if(!room) return false;
  const [start, end] = homeRange(mark);
  return room.state.points.every((point, index) => {
    if(index >= start && index <= end) return true;
    return !pointCount(point, mark);
  });
}
function legalTargetMap(){
  const result = new Map();
  if(!room || !canMove() || selectedPoint===null || !room.state.dice.length) return result;
  const opponent = room.mark === 'X' ? 'O' : 'X';
  if(selectedPoint === -1){
    const barCount = Number(room.state.bar?.[room.mark] || 0);
    if(barCount <= 0) return result;
    const dice = selectedDie !== null ? [{ die: room.state.dice[selectedDie], key: selectedDie }] : room.state.dice.map((die, key) => ({ die, key }));
    dice.forEach(({ die, key }) => {
      const to = room.mark === 'X' ? 24 - die : die - 1;
      if(to < 0 || to >= 24) return;
      if (pointCount(room.state.points[to], opponent) > 1) return;
      if (!result.has(to)) result.set(to, []);
      result.get(to).push(key);
    });
    return result;
  }
  const dir = room.mark === 'X' ? -1 : 1;
  const [homeStart, homeEnd] = homeRange(room.mark);
  const canBearOff = allCheckersHome(room.mark) && selectedPoint >= homeStart && selectedPoint <= homeEnd;
  const dice = selectedDie !== null ? [{ die: room.state.dice[selectedDie], key: selectedDie }] : room.state.dice.map((die, key) => ({ die, key }));
  dice.forEach(({ die, key }) => {
    const to = selectedPoint + dir * die;
    if (to >= 0 && to < 24) {
      if (pointCount(room.state.points[to], opponent) > 1) return;
      if (!result.has(to)) result.set(to, []);
      result.get(to).push(key);
    } else if (canBearOff) {
      if (!result.has('borne')) result.set('borne', []);
      result.get('borne').push(key);
    }
  });
  return result;
}
function pickDieForTarget(target){
  const options = legalTargetMap().get(target);
  if (!options || !options.length) return null;
  return selectedDie !== null && options.includes(selectedDie) ? selectedDie : options[0];
}
function handlePoint(index){
  if(!canMove()) return;
  if((room.state.bar?.[room.mark]||0) > 0 && index !== -1) return;
  const point=room.state.points[index];
  const targets = legalTargetMap();
  if(point[room.mark]>0){ selectedPoint=index; if(selectedDie!==null && !targets.size) selectedDie=null; renderDice(); renderBoard(); return; }
  if(selectedPoint===null) return;
  const dieKey = pickDieForTarget(index);
  if(dieKey===null) return;
  const die = room.state.dice[dieKey];
  sendMove({from:selectedPoint,die});
}
function handleBar(){
  if(!canMove()) return;
  if((room.state.bar?.[room.mark]||0) <= 0) return;
  selectedPoint = -1;
  renderDice();
  renderBoard();
}
function handleBorne(){
  if(selectedPoint===null) return;
  const dieKey = pickDieForTarget('borne');
  if(dieKey===null) return;
  const die = room.state.dice[dieKey];
  sendMove({from:selectedPoint,die});
}
function renderDice(){
  els.diceList.innerHTML='';
  const dice=room?.state?.dice||[];
  els.rollBtn.disabled=!canMove() || dice.length>0;
  els.passBtn.disabled=!canMove() || !dice.length;
  if(!dice.length){
    els.diceList.innerHTML='<div class="dice-waiting">Zarlar burada gorunecek</div>';
    return;
  }
  dice.forEach((die,i)=>{
    const b=document.createElement('button');
    b.type='button';
    b.className=`die-btn ${selectedDie===i?'selected':''}`;
    b.innerHTML=`<span class="die-face">${die}</span><span class="die-index">Zar ${i+1}</span>`;
    b.disabled=!canMove() || selectedPoint===null;
    b.addEventListener('click',()=>{ selectedDie = selectedDie===i ? null : i; renderDice(); renderBoard(); });
    els.diceList.appendChild(b);
  });
}
function renderBoard(){
  els.board.innerHTML='';
  if(!room){
    els.board.innerHTML='<p class="empty-board">PC\'ye karsi basla veya online oda kur.</p>';
    return;
  }
  const legalTargets = legalTargetMap();
  const [homeStart, homeEnd] = homeRange(room.mark);
  const ownBar = document.createElement(canMove() && (room.state.bar?.[room.mark]||0) > 0 ? 'button' : 'div');
  ownBar.className = `bar ${selectedPoint===-1 ? 'valid' : ''}`;
  ownBar.textContent = `${markLabel(room.mark)} Bar ${room.state.bar?.[room.mark]||0}`;
  if(ownBar.tagName === 'BUTTON'){
    ownBar.type = 'button';
    ownBar.disabled = false;
    ownBar.addEventListener('click', handleBar);
  }
  const otherMark = room.mark === 'X' ? 'O' : 'X';
  const otherBar = document.createElement('div');
  otherBar.className = 'bar';
  otherBar.textContent = `${markLabel(otherMark)} Bar ${room.state.bar?.[otherMark]||0}`;
  els.board.append(ownBar, otherBar);
  const topOrder=[12,13,14,15,16,17,18,19,20,21,22,23];
  const bottomOrder=[11,10,9,8,7,6,5,4,3,2,1,0];
  [...topOrder,...bottomOrder].forEach((index,pos)=>{
    const point=room.state.points[index];
    const owner=pointOwner(point);
    const count=owner?point[owner]:0;
    const ownPoint = point[room.mark] > 0;
    const inHome = index >= homeStart && index <= homeEnd;
    const button=document.createElement('button');
    button.type='button';
    button.className=`point ${pos>=12?'bottom':'top'} ${selectedPoint===index?'selected':''} ${legalTargets.has(index)?'valid':''} ${ownPoint?'playable':''} ${inHome?'home-zone':''}`;
    button.disabled=!canMove();
    button.innerHTML=`<span class="point-label">${index+1}</span><div class="triangle"></div><div class="stack"></div>`;
    const stack=button.querySelector('.stack');
    for(let i=0;i<Math.min(count,5);i+=1){
      const checker=document.createElement('span');
      checker.className=`checker ${owner.toLowerCase()}`;
      stack.appendChild(checker);
    }
    if(count>5){
      const extra=document.createElement('strong');
      extra.className='stack-extra';
      extra.textContent=`+${count-5}`;
      stack.appendChild(extra);
    }
    button.addEventListener('click',()=>handlePoint(index));
    els.board.appendChild(button);
  });
  const borneX = document.createElement('button');
  borneX.type = 'button';
  borneX.className = `borne-box ${legalTargets.has('borne') ? 'valid' : ''}`;
  borneX.textContent = `Acik Topla ${room.state.borne.X}`;
  borneX.disabled = !canMove();
  borneX.addEventListener('click', handleBorne);
  const borneO = document.createElement('div');
  borneO.className = 'borne-box passive';
  borneO.textContent = `Koyu Topla ${room.state.borne.O}`;
  els.board.append(borneX, borneO);
}
els.gameSelect.value='tavla'; els.gameSelect.addEventListener('change',()=>{ const href=GAME_LINKS[els.gameSelect.value]; if(href) window.location.href=href; }); els.pcRoom.addEventListener('click',()=>createRoom(true)); els.createRoom.addEventListener('click',()=>createRoom(false)); els.refresh.addEventListener('click',loadRooms); els.rollBtn.addEventListener('click',()=>sendMove({roll:true})); els.passBtn.addEventListener('click',()=>sendMove({pass:true})); els.joinForm.addEventListener('submit',e=>{ e.preventDefault(); const code=els.roomCode.value.trim().toUpperCase(); if(code) joinRoom(code); }); loadRooms(); window.setInterval(loadRooms,5000);
