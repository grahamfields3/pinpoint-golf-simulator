(() => {
  'use strict';

  // A browser-only, illustrative golf-physics model. No API, account, or dependencies.
  const CLUBS = {
    DR: { carry: 270, roll: 24, peak: 29, name: 'Driver', note: 'Distance specialist' },
    '3W': { carry: 230, roll: 17, peak: 33, name: '3-wood', note: 'Fairway wood' },
    '5I': { carry: 185, roll: 9, peak: 31, name: '5-iron', note: 'Long iron' },
    '7I': { carry: 155, roll: 6, peak: 34, name: '7-iron', note: 'Mid iron' },
    '9I': { carry: 125, roll: 3.5, peak: 35, name: '9-iron', note: 'Short iron' },
    PW: { carry: 105, roll: 2, peak: 38, name: 'Pitching wedge', note: 'Approach wedge' },
    SW: { carry: 77, roll: 1, peak: 42, name: 'Sand wedge', note: 'High-loft wedge' }
  };
  const WIND = {
    N: { x: 0, y: 1, arrow: '↑', name: 'NORTH' },
    E: { x: 1, y: 0, arrow: '→', name: 'EAST' },
    S: { x: 0, y: -1, arrow: '↓', name: 'SOUTH' },
    W: { x: -1, y: 0, arrow: '←', name: 'WEST' }
  };
  const PIN = { x: 0, y: 178 };
  const $ = id => document.getElementById(id);
  const canvas = $('courseCanvas');
  const stage = $('courseStage');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const state = { club: '5I', power: 96, aim: 0, wind: 6, windDir: 'N', shots: [], animation: null, lastResult: null, width: 940, height: 785, hintDismissed: false };
  let renderQueued = false;
  let shotCounter = 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rad = deg => deg * Math.PI / 180;
  const fmt = n => Number(n).toFixed(1);

  function predict() {
    const club = CLUBS[state.club];
    const angle = rad(state.aim);
    const direction = WIND[state.windDir];
    const windAhead = state.wind * direction.y;
    const crosswind = state.wind * direction.x;
    const carry = Math.max(10, club.carry * Math.pow(state.power / 100, 1.38) + windAhead * (0.59 + club.carry / 340));
    const roll = Math.max(0, club.roll * Math.pow(state.power / 100, 1.18) * (1 + windAhead * .007));
    const total = carry + roll;
    // Side wind affects shots with longer flight times more strongly.
    const drift = crosswind * Math.pow(carry / 165, 1.2) * .95;
    const landing = { x: Math.sin(angle) * carry + drift, y: Math.cos(angle) * carry };
    const end = { x: Math.sin(angle) * total + drift, y: Math.cos(angle) * total };
    const miss = Math.hypot(end.x - PIN.x, end.y - PIN.y);
    return { carry, roll, total, drift, landing, end, miss, angle, zone: classify(end), peak: club.peak * Math.pow(state.power / 100, .55) };
  }

  function inEllipse(pt, x, y, rx, ry) { return Math.pow((pt.x - x) / rx, 2) + Math.pow((pt.y - y) / ry, 2) <= 1; }
  function fairwayCenter(y) { return 6 * Math.sin(y / 42) + 3 * Math.sin(y / 22); }
  function fairwayHalfWidth(y) { return 16 + 16 * Math.min(1, Math.max(0, y / 45)) + 4 * Math.sin(y / 42); }
  function classify(pos) {
    if (Math.hypot(pos.x - PIN.x, pos.y - PIN.y) <= 1.2) return 'ACE!';
    if (inEllipse(pos, 0, 178, 22, 19)) return 'GREEN';
    if (inEllipse(pos, -30, 191, 13, 9) || inEllipse(pos, 32, 113, 12, 10) || inEllipse(pos, 25, 210, 11, 7)) return 'BUNKER';
    if (inEllipse(pos, 62, 135, 20, 31)) return 'WATER';
    if (pos.y >= 0 && pos.y < 213 && Math.abs(pos.x - fairwayCenter(pos.y)) <= fairwayHalfWidth(pos.y)) return 'FAIRWAY';
    return 'ROUGH';
  }
  function pos(x, y) {
    const { width: w, height: h } = state;
    return { x: w * .5 + (x / 115) * (w * .46), y: h - 44 - (y / 267) * (h - 80) };
  }
  function inversePos(px, py) {
    const { width: w, height: h } = state;
    return { x: (px - w * .5) / (w * .46) * 115, y: (h - 44 - py) / (h - 80) * 267 };
  }
  function scale() { return Math.min(state.width / 940, state.height / 785); }
  function rng(seed) { let x = seed | 0; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }

  function rounded(x, y, w, h, r, fill, stroke = null) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function ellipseWorld(x, y, rx, ry, fill, stroke, rotation = 0) {
    const c = pos(x, y), ex = pos(x + rx, y).x - c.x, ey = c.y - pos(x, y + ry).y;
    ctx.beginPath(); ctx.ellipse(c.x, c.y, ex, ey, rotation, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.6 * scale(); ctx.stroke(); }
  }
  function text(t, x, y, size = 11, color = '#dfe9d1', align = 'left', weight = 700) {
    ctx.fillStyle = color; ctx.font = `${weight} ${size * scale()}px Manrope, sans-serif`;ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y);
  }
  function pathFromCoords(coords, close = true) {
    ctx.beginPath(); coords.forEach(([x, y], i) => { const p = pos(x, y); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); if (close) ctx.closePath();
  }

  function drawGround() {
    const w = state.width, h = state.height;
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, '#1b482f');gradient.addColorStop(.55, '#1a442e');gradient.addColorStop(1, '#123926');
    ctx.fillStyle = gradient;ctx.fillRect(0, 0, w, h);
    const r = rng(204);
    for (let i = 0; i < 750; i++) {
      const x = r() * w, y = r() * h;
      ctx.strokeStyle = r() < .5 ? '#62a25a13' : '#03290e1e';
      ctx.lineWidth = (r() * 1.3 + .5) * scale();
      ctx.beginPath();ctx.moveTo(x, y);ctx.lineTo(x + 3.8 * scale(), y - 8 * scale());ctx.stroke();
    }
    // Fine cut lines suggest the mowing direction.
    for (let i = -h; i < w + h; i += 29 * scale()) {
      ctx.beginPath();ctx.moveTo(i, 0);ctx.lineTo(i + h * .37, h);
      ctx.strokeStyle = '#7abb5320';ctx.lineWidth = 6 * scale();ctx.stroke();
    }
    // Subtle outer routing and water hazard.
    const p1 = pos(70, 235), p2 = pos(55, 175), p3 = pos(81, 81);
    ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.bezierCurveTo(p1.x+20*scale(),p1.y+60*scale(),p2.x-25*scale(),p2.y,p2.x,p2.y);ctx.bezierCurveTo(p2.x+44*scale(),p2.y+65*scale(),p3.x-32*scale(),p3.y-30*scale(),p3.x,p3.y);
    ctx.strokeStyle='#a48b604f';ctx.lineWidth=12*scale();ctx.stroke();ctx.strokeStyle='#d0b78e4f';ctx.lineWidth=7*scale();ctx.stroke();
    ellipseWorld(62,135,23,34,'#173c33','#587a4c');
    ellipseWorld(62,135,20,31,'#215d60','#6b9376');
    ctx.save();ctx.beginPath();const pp=pos(62,135),sx=pos(82,135).x-pp.x,sy=pp.y-pos(62,166).y;
    ctx.ellipse(pp.x,pp.y,sx,sy,0,0,Math.PI*2);ctx.clip();
    for(let j=0;j<17;j++){const y=pp.y-sy+j*sy*2/16;ctx.strokeStyle='#c1fcdf16';ctx.lineWidth=2*scale();ctx.beginPath();ctx.moveTo(pp.x-sx,y);ctx.quadraticCurveTo(pp.x,y-3*scale(),pp.x+sx,y);ctx.stroke();}ctx.restore();
  }

  function drawFairway() {
    const coords = [];
    for (let y = 0; y <= 219; y += 4) coords.push([fairwayCenter(y) - fairwayHalfWidth(y) - 5, y]);
    for (let y = 219; y >= 0; y -= 4) coords.push([fairwayCenter(y) + fairwayHalfWidth(y) + 5, y]);
    pathFromCoords(coords);
    ctx.fillStyle = '#1a5131';ctx.fill();ctx.strokeStyle='#497f3d';ctx.lineWidth=4*scale();ctx.stroke();
    const inner = [];
    for(let y=0;y<=218;y+=3)inner.push([fairwayCenter(y)-fairwayHalfWidth(y),y]);
    for(let y=218;y>=0;y-=3)inner.push([fairwayCenter(y)+fairwayHalfWidth(y),y]);
    pathFromCoords(inner);ctx.fillStyle='#437d42';ctx.fill();
    ctx.save();pathFromCoords(inner);ctx.clip();
    const h=state.height,w=state.width;
    for(let j=0;j<18;j++){
      ctx.fillStyle=j%2===0?'#67a15323':'#173f241f';
      const stripeX=(j-2)*w/13;ctx.beginPath();ctx.moveTo(stripeX,-20);ctx.lineTo(stripeX+w/17,-20);ctx.lineTo(stripeX+w/17+h*.22,h+20);ctx.lineTo(stripeX+h*.22,h+20);ctx.closePath();ctx.fill();
    }
    ctx.restore();
    // Rough-side contours.
    for(const offset of [-1,1]){
      ctx.beginPath();for(let y=8;y<=217;y+=5){const q=pos(fairwayCenter(y)+offset*(fairwayHalfWidth(y)+9),y);if(y===8)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);}ctx.strokeStyle='#90b7561d';ctx.lineWidth=2*scale();ctx.setLineDash([5*scale(),11*scale()]);ctx.stroke();ctx.setLineDash([]);
    }
  }

  function drawBunkers() {
    const bunkers=[[-30,191,14,10],[32,113,13,11],[25,210,12,8]];
    bunkers.forEach(([x,y,rx,ry],i)=>{
      ellipseWorld(x,y,rx+2,ry+2,'#2b5b36','#8eaa73');
      ellipseWorld(x,y,rx,ry,'#d2ba89','#e8d5a6');
      const r=rng(i*129+24);for(let j=0;j<10;j++){
        const dx=(r()-.5)*rx*1.7,dy=(r()-.5)*ry*1.5;
        const p=pos(x+dx,y+dy);ctx.beginPath();ctx.moveTo(p.x-4*scale(),p.y-2*scale());ctx.quadraticCurveTo(p.x,p.y-4*scale(),p.x+4*scale(),p.y-2*scale());ctx.strokeStyle='#aa8c6390';ctx.lineWidth=1.3*scale();ctx.stroke();
      }
    });
  }

  function drawTrees() {
    const spots = [
      [-73,13,8],[-88,44,10],[-55,63,10],[-75,94,11],[-59,121,9],[-89,146,9],[-62,180,10],[-83,220,11],[-60,247,9],
      [70,18,10],[82,41,11],[61,69,10],[84,104,9],[93,175,9],[73,194,11],[65,235,11],
      [-83,25,7],[-67,30,7],[-77,72,7],[-82,117,6],[-68,156,8],[-77,236,7],[-99,206,8],
      [65,37,8],[97,72,8],[84,219,8],[91,245,7],[-98,252,9],[-94,69,8],
    ];
    spots.forEach(([x,y,rr],i)=>{
      const p=pos(x,y),r=rr*scale(),shadow=1.4*scale();
      ctx.beginPath();ctx.ellipse(p.x+r*.3,p.y+r*.4,r*1.2,r*.72,-.5,0,Math.PI*2);ctx.fillStyle='#071d1c88';ctx.fill();
      const g=ctx.createRadialGradient(p.x-r*.38,p.y-r*.35,r*.06,p.x,p.y,r*1.15);
      if(i%3===0){g.addColorStop(0,'#6da552');g.addColorStop(.6,'#346d35');g.addColorStop(1,'#174a2e');}
      else{g.addColorStop(0,'#78ae55');g.addColorStop(.6,'#357940');g.addColorStop(1,'#16502f');}
      ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
      ctx.beginPath();ctx.arc(p.x-r*.22,p.y-r*.15,r*.65,0,Math.PI*2);ctx.strokeStyle='#a3c57b32';ctx.lineWidth=1.3*scale();ctx.stroke();
    });
  }

  function drawGreenAndHole() {
    ellipseWorld(0,178,27,24,'#386e39','#36683a',-.08);
    ellipseWorld(0,178,22,19,'#8eb75b','#b1d07b',-.08);
    const c=pos(0,178),rx=pos(22,178).x-c.x,ry=c.y-pos(0,19+178).y;
    ctx.save();ctx.beginPath();ctx.ellipse(c.x,c.y,rx,ry,-.08,0,Math.PI*2);ctx.clip();
    for(let i=-180;i<180;i+=21*scale()){
      ctx.beginPath();ctx.moveTo(c.x-160*scale()+i,c.y-95*scale());ctx.lineTo(c.x+160*scale()+i,c.y+95*scale());ctx.strokeStyle='#edffad13';ctx.lineWidth=12*scale();ctx.stroke();
    }
    ctx.restore();
    const hole=pos(PIN.x,PIN.y);
    ctx.beginPath();ctx.ellipse(hole.x,hole.y,4.5*scale(),3.4*scale(),0,0,Math.PI*2);ctx.fillStyle='#142f22';ctx.fill();
    ctx.strokeStyle='#fcfae5';ctx.lineWidth=2.4*scale();ctx.beginPath();ctx.moveTo(hole.x,hole.y);ctx.lineTo(hole.x,hole.y-40*scale());ctx.stroke();
    ctx.beginPath();ctx.moveTo(hole.x,hole.y-40*scale());ctx.lineTo(hole.x+22*scale(),hole.y-33*scale());ctx.lineTo(hole.x,hole.y-27*scale());ctx.closePath();ctx.fillStyle='#edc97e';ctx.fill();
    rounded(hole.x+26*scale(),hole.y-53*scale(),57*scale(),22*scale(),4*scale(),'#0b251ccf');
    text('THE PIN',hole.x+54*scale(),hole.y-42*scale(),9,'#e1eccb','center',800);
  }
  function drawTee() {
    const p=pos(0,0);
    rounded(p.x-37*scale(),p.y-13*scale(),74*scale(),30*scale(),5*scale(),'#6a9653','#9bb568');
    for(const v of [-19,19]){
      ctx.beginPath();ctx.arc(p.x+v*scale(),p.y-2*scale(),3*scale(),0,2*Math.PI);ctx.fillStyle='#f4edd9';ctx.fill();
    }
    rounded(p.x-25*scale(),p.y+27*scale(),50*scale(),19*scale(),4*scale(),'#09261ac9');
    text('TEE BOX',p.x,p.y+36*scale(),9,'#dfedc8','center',800);
  }
  function drawYardage() {
    for(const yr of [50,100,150,200,250]){
      const p=pos(-68,yr);
      ctx.beginPath();ctx.moveTo(p.x-5*scale(),p.y);ctx.lineTo(p.x+5*scale(),p.y);ctx.strokeStyle='#c9e4b75c';ctx.lineWidth=1.5*scale();ctx.stroke();
      text(`${yr} YDS`,p.x-11*scale(),p.y,10,'#bfd4b2','right',800);
    }
  }
  function shotPoint(shot, t) {
    const carryX=Math.sin(shot.angle)*shot.carry,carryY=Math.cos(shot.angle)*shot.carry;
    if(t<=.79){const f=t/.79;return{x:carryX*f+shot.drift*Math.pow(f,1.8),y:carryY*f,alt:Math.sin(Math.PI*f)*shot.peak};}
    const f=(t-.79)/.21;
    return{x:shot.landing.x+(shot.end.x-shot.landing.x)*f,y:shot.landing.y+(shot.end.y-shot.landing.y)*f,alt:Math.max(0,4*Math.sin(Math.PI*f)*Math.exp(-f*2))};
  }
  function drawForecast(shot, live = false) {
    const p0=pos(0,0),end=pos(shot.end.x,shot.end.y);
    ctx.save();ctx.beginPath();for(let i=0;i<=65;i++){const o=shotPoint(shot,i/65),p=pos(o.x,o.y);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}ctx.strokeStyle=live?'#f5f7ce80':'#d4f69da8';ctx.lineWidth=2*scale();ctx.setLineDash([5*scale(),10*scale()]);ctx.stroke();ctx.setLineDash([]);
    // Crosshair and accuracy halo.
    ctx.beginPath();ctx.arc(end.x,end.y,22*scale(),0,Math.PI*2);ctx.strokeStyle='#d7fa80b5';ctx.lineWidth=1.7*scale();ctx.setLineDash([5*scale(),5*scale()]);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(end.x,end.y,4.2*scale(),0,Math.PI*2);ctx.fillStyle='#d7fa80';ctx.fill();
    ctx.beginPath();ctx.moveTo(end.x-31*scale(),end.y);ctx.lineTo(end.x-14*scale(),end.y);ctx.moveTo(end.x+14*scale(),end.y);ctx.lineTo(end.x+31*scale(),end.y);ctx.moveTo(end.x,end.y-31*scale());ctx.lineTo(end.x,end.y-14*scale());ctx.moveTo(end.x,end.y+14*scale());ctx.lineTo(end.x,end.y+31*scale());ctx.strokeStyle='#c9f58b99';ctx.lineWidth=1.5*scale();ctx.stroke();
    if(!live){const rightSpace=end.x>state.width*.68;const x=rightSpace?end.x-107*scale():end.x+20*scale(),y=clamp(end.y-43*scale(),50*scale(),state.height-46*scale());
      rounded(x,y,87*scale(),30*scale(),4*scale(),'#081e17dd','#7fba5795');text('PREDICTED',x+43*scale(),y+10*scale(),8,'#a7cd89','center',800);text(`${shot.total.toFixed(0)} YARDS`,x+43*scale(),y+21*scale(),10,'#ffffff','center',800);}
    ctx.restore();
  }
  function drawBall(x,y,alt=0,big=false) {
    const p=pos(x,y),r=(big?9:6)*scale(),lift=(alt/42)*35*scale();
    ctx.beginPath();ctx.ellipse(p.x+4*scale(),p.y+2*scale(),(8+alt*.04)*scale(),(3.8+alt*.035)*scale(),0,0,Math.PI*2);ctx.fillStyle='#021d1588';ctx.fill();
    const g=ctx.createRadialGradient(p.x-r*.5,p.y-lift-r*.5,0,p.x,p.y-lift,r*1.45);g.addColorStop(0,'#ffffff');g.addColorStop(.65,'#f6fae7');g.addColorStop(1,'#b5c6aa');
    ctx.beginPath();ctx.arc(p.x,p.y-lift,r,0,Math.PI*2);ctx.fillStyle=g;ctx.shadowBlur=10*scale();ctx.shadowColor='#ffffff50';ctx.fill();ctx.shadowBlur=0;
  }
  function drawShotTrail(shot,t) {
    const count=38;ctx.save();ctx.beginPath();for(let i=0;i<=count;i++){
      const q=shotPoint(shot,t*i/count),p=pos(q.x,q.y),lift=q.alt/42*35*scale();
      if(i===0)ctx.moveTo(p.x,p.y-lift);else ctx.lineTo(p.x,p.y-lift);
    }ctx.strokeStyle='#fff4caa9';ctx.lineWidth=2.9*scale();ctx.stroke();
    const location=shotPoint(shot,t);drawBall(location.x,location.y,location.alt,true);
    if(location.alt>8){const a=pos(location.x,location.y);text(`${Math.round(location.alt*3.28084)} FT`,a.x+14*scale(),a.y-(location.alt/42*35+15)*scale(),9,'#f6f9df','left',800);}
    ctx.restore();
  }
  function drawLastBall(shot){
    drawBall(shot.end.x,shot.end.y,0,true);
    const p=pos(shot.end.x,shot.end.y),right=p.x>state.width*.74,x=right?p.x-106*scale():p.x+12*scale();
    rounded(x,p.y+11*scale(),90*scale(),23*scale(),4*scale(),'#081c14da','#d9f39c77');
    text(`SHOT #${shot.id}`,x+45*scale(),p.y+22*scale(),10,'#f6f9eb','center',800);
  }
  function render() {
    renderQueued=false;const { width:w,height:h }=state;
    ctx.clearRect(0,0,w,h);
    drawGround();drawFairway();drawBunkers();drawGreenAndHole();drawTrees();drawYardage();drawTee();
    const projection=predict();
    if(state.animation){drawForecast(state.animation.shot,true);const t=clamp((performance.now()-state.animation.start)/state.animation.duration,0,1);drawShotTrail(state.animation.shot,t);if(t>=1){finishShot(state.animation.shot);}}else{drawForecast(projection);if(state.lastResult)drawLastBall(state.lastResult);else drawBall(0,0);}
    if(state.animation)requestDraw();
  }
  function requestDraw(){if(!renderQueued){renderQueued=true;requestAnimationFrame(render);}}
  function resizeCanvas(){
    const rect=stage.getBoundingClientRect();const dpr=Math.min(window.devicePixelRatio||1,2);
    state.width=Math.max(1,rect.width);state.height=Math.max(1,rect.height);
    canvas.width=Math.round(state.width*dpr);canvas.height=Math.round(state.height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);requestDraw();
  }
  function fillRange(el) { const min=+el.min,max=+el.max,value=+el.value;const pct=(value-min)/(max-min)*100;el.style.background=`linear-gradient(to right,#c5f57b 0%,#c5f57b ${pct}%,#254837 ${pct}%,#254837 100%)`; }
  function setAnnouncement(textLabel, distance){$('shotLabel').textContent=textLabel;$('shotDistance').textContent=distance;$('shotAnnouncement').hidden=false;}
  function hideAnnouncement(){$('shotAnnouncement').hidden=true;}
  function update() {
    $('powerValue').textContent=state.power;$('aimValue').textContent=state.aim>0?`+${state.aim}`:state.aim;
    $('windValue').textContent=state.wind;$('windArrow').textContent=WIND[state.windDir].arrow;$('windName').textContent=WIND[state.windDir].name;
    $('windLabel').textContent=state.wind===0?'CALM':state.wind<8?'LIGHT BREEZE':state.wind<17?'BREEZY':'STRONG WIND';
    $('baseCarry').textContent=CLUBS[state.club].carry;$('clubNote').textContent=CLUBS[state.club].note;
    for(const id of ['powerSlider','aimSlider','windSlider'])fillRange($(id));
    const shot=predict();$('estDistance').innerHTML=`${Math.round(shot.total)} <small>yd</small>`;$('estMiss').innerHTML=`${fmt(shot.miss)} <small>yd</small>`;
    $('estZone').textContent=shot.zone;
    $('estZone').style.color=(shot.zone==='GREEN'||shot.zone==='ACE!')?'#c5f57b':shot.zone==='BUNKER'||shot.zone==='WATER'?'#e6ae66':'#e9f5da';
    requestDraw();
  }
  function lockControls(locked){document.querySelectorAll('.controls-panel button, .controls-panel input').forEach(el=>{el.disabled=locked;});}
  function shoot(){
    if(state.animation)return;
    const shot=predict();shot.id=++shotCounter;shot.club=state.club;shot.power=state.power;shot.aim=state.aim;shot.wind=state.wind;shot.windDir=state.windDir;
    hideAnnouncement();$('canvasHint').classList.add('hide');state.hintDismissed=true;
    lockControls(true);$('shootBtn').innerHTML='<span>● BALL IN FLIGHT...</span><small>HANG TIGHT</small>';
    state.animation={shot,start:performance.now(),duration:2100+Math.min(600,shot.carry*2.2)};
    requestDraw();
  }
  function finishShot(shot){
    if(!state.animation)return;
    state.animation=null;state.lastResult=shot;state.shots.unshift(shot);
    lockControls(false);$('shootBtn').innerHTML='<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 17 10-10M7 7h10v10"/></svg> TAKE ANOTHER SHOT</span><small>SPACE ↵</small>';
    const verb=shot.zone==='ACE!'?'HOLE IN ONE!':shot.zone==='GREEN'?'ON THE GREEN!':shot.zone==='WATER'?'SPLASH!':shot.zone==='BUNKER'?'IN THE SAND!':shot.zone==='FAIRWAY'?'FAIRWAY HIT':'IN THE ROUGH';
    setAnnouncement(verb,`${fmt(shot.miss)} yd from the pin`);updateStats();update();
  }
  function updateStats(){
    $('statShots').textContent=state.shots.length;
    $('statClosest').textContent=state.shots.length?fmt(Math.min(...state.shots.map(s=>s.miss))):'—';
    $('statGreens').textContent=state.shots.filter(s=>s.zone==='GREEN'||s.zone==='ACE!').length;
    $('statLast').textContent=state.shots.length?Math.round(state.shots[0].total):'—';
    $('roundStatus').textContent=state.shots.length?`${state.shots.length} SHOT${state.shots.length===1?'':'S'} PLAYED`:'PRACTICE MODE';
    const list=$('historyItems');list.replaceChildren();
    if(!state.shots.length){const p=document.createElement('p');p.className='empty-history';p.textContent='No shots yet. Your first swing is waiting.';list.append(p);return;}
    for(const s of state.shots.slice(0,6)){
      const a=document.createElement('article');a.className='history-shot';
      const info=document.createElement('div');const title=document.createElement('strong');title.textContent=`#${s.id} · ${CLUBS[s.club].name}`;
      const sub=document.createElement('small');sub.textContent=`${Math.round(s.total)} yd · ${s.power}% power`;info.append(title,sub);
      const result=document.createElement('div');result.className='shot-result';result.textContent=`${fmt(s.miss)} yd off`;
      const zone=document.createElement('small');zone.textContent=s.zone;result.append(zone);a.append(info,result);list.append(a);
    }
  }
  function reset(){state.shots=[];state.lastResult=null;shotCounter=0;hideAnnouncement();updateStats();update();$('shootBtn').innerHTML='<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 17 10-10M7 7h10v10"/></svg> TAKE YOUR SHOT</span><small>SPACE ↵</small>';}
  function randomizeWind(){const directions=Object.keys(WIND);state.wind=Math.floor(Math.random()*23);state.windDir=directions[Math.floor(Math.random()*directions.length)];$('windSlider').value=state.wind;syncWindButtons();hideAnnouncement();update();}
  function syncWindButtons(){document.querySelectorAll('[data-wind]').forEach(btn=>{const isActive=btn.dataset.wind===state.windDir;btn.classList.toggle('active',isActive);btn.setAttribute('aria-pressed',String(isActive));});}
  document.querySelectorAll('[data-club]').forEach(btn=>btn.addEventListener('click',()=>{state.club=btn.dataset.club;document.querySelectorAll('[data-club]').forEach(b=>{const active=b===btn;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});hideAnnouncement();update();}));
  document.querySelectorAll('[data-wind]').forEach(btn=>btn.addEventListener('click',()=>{state.windDir=btn.dataset.wind;syncWindButtons();hideAnnouncement();update();}));
  for(const [id,key] of [['powerSlider','power'],['aimSlider','aim'],['windSlider','wind']])$(id).addEventListener('input',event=>{state[key]=Number(event.target.value);hideAnnouncement();update();});
  stage.addEventListener('click',event=>{if(state.animation)return;const rect=stage.getBoundingClientRect();const point=inversePos(event.clientX-rect.left,event.clientY-rect.top);if(point.y<12)return;
    const angle=clamp(Math.round(Math.atan2(point.x,point.y)*180/Math.PI),-35,35);state.aim=angle;$('aimSlider').value=angle;hideAnnouncement();$('canvasHint').classList.add('hide');state.hintDismissed=true;update();
  });
  $('shootBtn').addEventListener('click',shoot);$('shuffleWind').addEventListener('click',randomizeWind);$('newSetupBtn').addEventListener('click',()=>{randomizeWind();state.lastResult=null;update();});$('resetBtn').addEventListener('click',reset);
  document.addEventListener('keydown',event=>{const tag=document.activeElement?.tagName;if(event.code==='Space'&&tag!=='INPUT'&&tag!=='TEXTAREA'&&tag!=='BUTTON'&&tag!=='SELECT'&&!$('helpDialog').open){event.preventDefault();shoot();}});
  $('helpBtn').addEventListener('click',()=>$('helpDialog').showModal());$('closeHelp').addEventListener('click',()=>$('helpDialog').close());$('gotItBtn').addEventListener('click',()=>$('helpDialog').close());$('helpDialog').addEventListener('click',event=>{if(event.target===$('helpDialog'))$('helpDialog').close();});
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(resizeCanvas).observe(stage);else window.addEventListener('resize',resizeCanvas);
  updateStats();update();resizeCanvas();
})();
