(() => {
  const REAL_W_MM = 2362;
  const SNAP_PX = 12;
  const ANGLE_SNAP_STEP = 10;
  const ANGLE_SNAP_TOL = 2;

  // Single category only
  const CATEGORY = {
  key: 'taskmaster',
  label: 'Task Master',
  image: 'img/MARCTM.png'
};


  const img = document.getElementById('fieldImg');
  const canvas = document.getElementById('overlay');
  const ctx = canvas.getContext('2d');

  const btnAdd = document.getElementById('btnAdd');
  const btnDel = document.getElementById('btnDel');
  const btnSave = document.getElementById('btnSave');
  const status = document.getElementById('status');
  const tbody = document.getElementById('resultBody');
  const wheelDiaEl = document.getElementById('wheelDia');

  const currentCategory = CATEGORY.key; // fixed
  let picking = false;
  let tempPts = [];
  let items = [];
  let colorIdx = 0;
  const colors = ['#ef4444','#22c55e','#3b82f6','#f59e0b','#a855f7','#14b8a6','#e11d48'];

  const setStatus = (m)=> status.textContent = m;
  const norm360 = (d)=>{ let x = d % 360; if(x<0) x+=360; return x; };
  const circDiff = (a,b)=> Math.abs(((a-b+540)%360)-180);
  const fmtHeading = (d)=>{ const n=Math.round(d/10)*10%360; return circDiff(d,n)<1e-6?String(n):d.toFixed(2); };

  // single storage key
  const lsKey = () => `lineItems:${CATEGORY.key}`;

  function getCanvasSize(){ return { w: canvas.clientWidth, h: canvas.clientHeight }; }
  function pxToNorm(p){ const {w,h}=getCanvasSize(); return { x:w? p.x/w:0, y:h? p.y/h:0 }; }
  function normToPx(n){ const {w,h}=getCanvasSize(); return { x:n.x*w, y:n.y*h }; }

  function resizeCanvas(){
    const r = img.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.style.width = r.width + "px";
    canvas.style.height = r.height + "px";
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    redrawAll();
  }
  function mmPerPx(){ const r = img.getBoundingClientRect(); return REAL_W_MM / r.width; }

  const clampToCanvas = (p)=>({x:Math.min(Math.max(p.x,0),canvas.clientWidth),y:Math.min(Math.max(p.y,0),canvas.clientHeight)});
  const eventToPoint = (ev)=> clampToCanvas({x:ev.offsetX,y:ev.offsetY});

  function getAllEndpointsPx(){ const out=[]; for(const it of items){ out.push(normToPx(it.p1n)); out.push(normToPx(it.p2n)); } return out; }
  function findSnapEndpoint(p){
    let best=null,bestD2=SNAP_PX*SNAP_PX;
    for(const q of getAllEndpointsPx()){
      const dx=p.x-q.x, dy=p.y-q.y, d2=dx*dx+dy*dy;
      if(d2<=bestD2){ best=q; bestD2=d2; }
    }
    return best;
  }
  const withSnap = (p)=>{ const s=findSnapEndpoint(p); return s?{...s}:p; };

  function applyAngleSnap(p1,p2){
    const dx=(p2.x-p1.x), dy_up=-(p2.y-p1.y), dist_px=Math.hypot(dx,dy_up);
    if(dist_px===0) return p2;
    let heading=norm360(Math.atan2(dy_up,dx)*180/Math.PI);
    const nearest=(Math.round(heading/ANGLE_SNAP_STEP)*ANGLE_SNAP_STEP)%360;
    if(circDiff(heading,nearest)<=ANGLE_SNAP_TOL){
      const rad=nearest*Math.PI/180;
      const nx=dist_px*Math.cos(rad), ny=dist_px*Math.sin(rad);
      return { x:p1.x+nx, y:p1.y-ny };
    }
    return p2;
  }

  function computeDistAngleHeading(p1,p2){
    const k = mmPerPx();
    const dx_mm=(p1.x-p2.x)*k, dy_mm=(p1.y-p2.y)*k;
    const dist=Math.hypot(dx_mm,dy_mm);
    const D=parseFloat(wheelDiaEl.value);
    const angle=(isFinite(D)&&D>0)?(360*dist)/(Math.PI*D):NaN;
    const dx=(p2.x-p1.x), dy_up=-(p2.y-p1.y);
    const heading=norm360(Math.atan2(dy_up,dx)*180/Math.PI);
    return {dist,angle,headingDeg:heading};
  }

  function clearCanvas(){ ctx.clearRect(0,0,canvas.clientWidth,canvas.clientHeight); }
  function drawPoint(p,c='#111'){ ctx.fillStyle=c; ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2); ctx.fill(); ctx.stroke(); }
  function drawLine(a,b,c='#111',dash=false){ ctx.save(); if(dash) ctx.setLineDash([8,6]); ctx.lineWidth=3; ctx.strokeStyle=c; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); ctx.restore(); }
  function drawSnapHalo(p){ ctx.save(); ctx.lineWidth=2; ctx.strokeStyle='rgba(59,130,246,.9)'; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.arc(p.x,p.y,SNAP_PX,0,Math.PI*2); ctx.stroke(); ctx.restore(); }
  function drawAngleLabel(p1,p2,deg){
    if(!isFinite(deg)) return;
    const mid={x:(p1.x+p2.x)/2,y:(p1.y+p2.y)/2};
    const txt=`${deg.toFixed(2)}°`;
    ctx.save();
    ctx.font='13px ui-sans-serif, system-ui, -apple-system, "Microsoft JhengHei"';
    const padX=8,padY=5,h=22,w=ctx.measureText(txt).width+padX*2;
    const x=mid.x-w/2,y=mid.y-h-8;
    const r=8;
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.fillStyle='rgba(17,24,39,.85)';
    ctx.fill();
    ctx.fillStyle='#fff';
    ctx.fillText(txt,x+padX,y+h-padY);
    ctx.restore();
  }

  function redrawAll(){
    clearCanvas();
    for(const it of items){
      const p1=normToPx(it.p1n), p2=normToPx(it.p2n);
      drawLine(p1,p2,it.color,false);
      drawPoint(p1,it.color); drawPoint(p2,it.color);
      drawAngleLabel(p1,p2,it.angle);
    }
    if(tempPts.length===1){
      drawPoint(tempPts[0],'#111');
    }else if(tempPts.length===2){
      drawLine(tempPts[0],tempPts[1],'#111',true);
      drawPoint(tempPts[0],'#111'); drawPoint(tempPts[1],'#111');
      const {angle}=computeDistAngleHeading(tempPts[0],tempPts[1]);
      drawAngleLabel(tempPts[0],tempPts[1],angle);
    }
  }

  function saveToLocalStorage(){
    const pack = {
      wheelDia: parseFloat(wheelDiaEl.value),
      items: items.map(it => ({
        p1n: it.p1n, p2n: it.p2n, color: it.color, dist: it.dist, angle: it.angle, headingDeg: it.headingDeg
      }))
    };
    localStorage.setItem(lsKey(), JSON.stringify(pack));
  }

  function loadFromLocalStorage(){
    const data = localStorage.getItem(lsKey());
    items = [];
    if (!data) { rebuildTable(); redrawAll(); return; }
    try{
      const pack = JSON.parse(data);
      if (pack && Array.isArray(pack.items)) {
        if (typeof pack.wheelDia === 'number' && !Number.isNaN(pack.wheelDia)) {
          wheelDiaEl.value = String(pack.wheelDia);
        }
        items = pack.items.map(it => ({
          p1n: it.p1n, p2n: it.p2n,
          color: it.color, dist: Number(it.dist),
          angle: Number(it.angle), headingDeg: Number(it.headingDeg)
        }));
      }
    }catch(_){}
    rebuildTable();
    redrawAll();
  }

  function doSave(){
    if(tempPts.length!==2){ setStatus('Please select two points first.'); return; }
    const color=colors[colorIdx++%colors.length];
    const {dist,angle,headingDeg}=computeDistAngleHeading(tempPts[0],tempPts[1]);
    const p1n=pxToNorm(tempPts[0]), p2n=pxToNorm(tempPts[1]);
    items.push({p1n,p2n,color,dist,angle,headingDeg});
    rebuildTable();
    saveToLocalStorage();
    tempPts=[]; picking=true; canvas.style.pointerEvents='auto';
    setStatus('Saved. Switched to ADD mode.');
    redrawAll();
  }

  function rebuildTable(){
    tbody.innerHTML='';
    items.forEach((it,idx)=>{
      const tr=document.createElement('tr');
      const tdIdx=document.createElement('td'); tdIdx.textContent=idx+1;
      const tdColor=document.createElement('td'); const dot=document.createElement('span'); dot.className='color-dot'; dot.style.background=it.color; tdColor.appendChild(dot);
      const tdDist=document.createElement('td'); tdDist.textContent=Number(it.dist).toFixed(2);
      const tdAng=document.createElement('td'); tdAng.textContent=isNaN(it.angle)?'—':Number(it.angle).toFixed(2);
      const tdHead=document.createElement('td'); tdHead.textContent=fmtHeading(Number(it.headingDeg));
      tr.append(tdIdx,tdColor,tdDist,tdAng,tdHead);
      tbody.appendChild(tr);
    });
  }

  btnAdd.addEventListener('click', ()=>{ picking=true; tempPts=[]; canvas.style.pointerEvents='auto'; setStatus('ADD mode: click two points.'); redrawAll(); });
  btnDel.addEventListener('click', ()=>{ if(tempPts.length>0){ tempPts=[]; setStatus('Cleared current points.'); } else if(items.length>0){ items.pop(); rebuildTable(); saveToLocalStorage(); setStatus('Deleted last item.'); } else { setStatus('No data to delete.'); } redrawAll(); });
  btnSave.addEventListener('click', doSave);
  canvas.addEventListener('contextmenu', ev=>{ ev.preventDefault(); doSave(); });
  document.addEventListener('keydown', ev=>{ if(ev.key==='Enter'){ ev.preventDefault(); doSave(); } });

  canvas.addEventListener('click', (ev)=>{
    if(!picking) return;
    const raw=eventToPoint(ev), p=withSnap(raw);
    tempPts.push(p); if(tempPts.length>2) tempPts.shift();
    if(tempPts.length===2){
      tempPts[1]=applyAngleSnap(tempPts[0],tempPts[1]);
      const {dist,angle,headingDeg}=computeDistAngleHeading(tempPts[0],tempPts[1]);
      const msg = isFinite(angle)
        ? `Ready | Dist ${dist.toFixed(2)} mm | Wheel angle ${angle.toFixed(2)}° | Line heading ${fmtHeading(headingDeg)}° (unsaved)`
        : `Ready | Dist ${dist.toFixed(2)} mm | Invalid wheel diameter | Line heading ${fmtHeading(headingDeg)}°`;
      setStatus(msg);
    }else{
      setStatus('First point selected, click the second point.');
    }
    redrawAll();
  });

  canvas.addEventListener('mousemove', (ev)=>{
    if(!picking) return;
    redrawAll();
    const near=findSnapEndpoint(eventToPoint(ev));
    if(near) drawSnapHalo(near);
  });

  wheelDiaEl.addEventListener('input', ()=>{
    saveToLocalStorage();
    if(tempPts.length===2){
      const {dist,angle,headingDeg}=computeDistAngleHeading(tempPts[0],tempPts[1]);
      const msg=isFinite(angle)
        ? `Ready | Dist ${dist.toFixed(2)} mm | Wheel angle ${angle.toFixed(2)}° | Line heading ${fmtHeading(headingDeg)}° (unsaved)`
        : `Ready | Dist ${dist.toFixed(2)} mm | Invalid wheel diameter | Line heading ${fmtHeading(headingDeg)}°`;
      setStatus(msg);
      redrawAll();
    }
  });

  img.addEventListener('load', ()=>{ resizeCanvas(); });
  new ResizeObserver(resizeCanvas).observe(img);

  // init
  img.src = CATEGORY.image;
  setStatus(`Category: ${CATEGORY.label} | Loading image...`);
  loadFromLocalStorage();
})();
