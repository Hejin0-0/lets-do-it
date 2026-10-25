// Camera navigation belongs to this map; it never tilts the island or disturbs floating bodies.
export function installNavigation({canvas,signal,view,block,onMove,onReset}) {
  const keys=new Set();let pan=null;
  const on=(el,event,fn,options={})=>el.addEventListener(event,fn,{signal,...options});
  const editable=el=>el?.closest?.('input,textarea,select,[contenteditable="true"]');
  function move(dx,dz) {
    const c=view.cam,t=c.target.slice(),s=Math.sin(c.az),a=Math.cos(c.az);
    t[0]=Math.max(-12,Math.min(13,t[0]+a*dx-s*dz));
    t[2]=Math.max(-10,Math.min(12,t[2]-s*dx-a*dz));
    go(t,c.dist);onMove();
  }
  function go(t,dist) {
    const c=view.cam,ce=Math.cos(c.el),eye=[t[0]+dist*ce*Math.sin(c.az),t[1]+dist*Math.sin(c.el),t[2]+dist*ce*Math.cos(c.az)];
    view.lookFrom(block.toLocal(eye),block.toLocal(t),.001);
  }
  on(window,'keydown',e=>{
    if(editable(e.target)||e.ctrlKey||e.metaKey||e.altKey)return;
    if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code)){keys.add(e.code);e.preventDefault();}
    if(e.code==='KeyR'&&!e.repeat){keys.clear();onReset();e.preventDefault();}
  });
  on(window,'keyup',e=>keys.delete(e.code));
  const clear=()=>{keys.clear();pan=null;canvas.style.cursor='grab';};
  on(window,'blur',clear);on(document,'visibilitychange',()=>{if(document.hidden)clear();});
  on(canvas,'pointerdown',e=>{
    if(e.button!==1&&!(e.button===0&&e.shiftKey))return;
    e.preventDefault();e.stopImmediatePropagation();onMove();
    canvas.setPointerCapture(e.pointerId);pan={id:e.pointerId,x:e.clientX,y:e.clientY};
    canvas.style.cursor='grabbing';
  },{capture:true});
  on(canvas,'pointermove',e=>{
    if(!pan||e.pointerId!==pan.id)return;
    e.preventDefault();e.stopImmediatePropagation();
    const k=2*view.cam.dist*Math.tan(view.cam.fov/2)/Math.max(1,canvas.clientHeight);
    move(-(e.clientX-pan.x)*k,(e.clientY-pan.y)*k);pan.x=e.clientX;pan.y=e.clientY;
  },{capture:true});
  const end=e=>{if(pan?.id===e.pointerId){e.stopImmediatePropagation();pan=null;canvas.style.cursor='grab';}};
  on(canvas,'pointerup',end,{capture:true});on(canvas,'pointercancel',end,{capture:true});
  on(canvas,'lostpointercapture',()=>{pan=null;canvas.style.cursor='grab';});
  on(canvas,'wheel',e=>{
    e.preventDefault();e.stopImmediatePropagation();onMove();
    const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);
    go(view.cam.target,Math.max(1.8,Math.min(42,view.cam.dist*Math.exp(Math.max(-120,Math.min(120,pixels))*.0018))));
  },{capture:true,passive:false});
  signal.addEventListener('abort',clear);
  return {frame(dt){
    let dx=Number(keys.has('KeyD'))-Number(keys.has('KeyA')),dz=Number(keys.has('KeyW'))-Number(keys.has('KeyS'));
    const n=Math.hypot(dx,dz);if(!n)return;
    const speed=Math.max(1.5,Math.min(5,view.cam.dist*.18))*(keys.has('ShiftLeft')||keys.has('ShiftRight')?2.5:1);
    move(dx/n*speed*Math.min(.05,dt),dz/n*speed*Math.min(.05,dt));
  }};
}
