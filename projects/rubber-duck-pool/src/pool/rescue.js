// Grid routing keeps every segment over water, including around headlands.
import { isleSd, JETTY } from './island.js';
import { P } from './layout.js';
import { oceanAt } from './ocean.js';

export const MOORING = [JETTY.x1 - .55, P.SEA, JETTY.z + .84];
const STEP = .4, LIMIT = 50;
const key = (x, z) => `${x},${z}`;
function waterLine(a, b) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0]-a[0], b[1]-a[1]) / .1));
  for (let i = 0; i <= n; i++) if (isleSd(a[0]+(b[0]-a[0])*i/n, a[1]+(b[1]-a[1])*i/n) < .04) return false;
  return true;
}
function route(a, b) {
  if (isleSd(...a) < .04 || isleSd(...b) < .04) return null;
  if (waterLine(a,b)) return [b];
  const origin = [Math.round(a[0]/STEP), Math.round(a[1]/STEP)];
  const candidates = [];
  for (let x=-2;x<=2;x++) for (let z=-2;z<=2;z++) { const p=[origin[0]+x,origin[1]+z]; if (waterLine(a,p.map(v=>v*STEP))) candidates.push(p); }
  candidates.sort((u,v)=>Math.hypot(u[0]*STEP-a[0],u[1]*STEP-a[1])-Math.hypot(v[0]*STEP-a[0],v[1]*STEP-a[1]));
  if (!candidates.length) return null;
  const start = candidates[0], end = [Math.round(b[0]/STEP), Math.round(b[1]/STEP)];
  const open = [{ p: start, g: 0, f: 0 }], best = new Map([[key(...start), 0]]), prev = new Map();
  while (open.length) {
    open.sort ( (u,v) => v.f-u.f );
    const {p,g} = open.pop(), k = key(...p);
    if (g !== best.get(k)) continue;
    const here = p.map(v=>v*STEP);
    if (Math.hypot(here[0]-b[0],here[1]-b[1]) < STEP*1.5 && waterLine(here,b)) {
      const path = [b, here]; let cur = k;
      while (prev.has(cur)) { const parent=prev.get(cur); path.push(parent.p.map(v=>v*STEP)); cur=parent.k; }
      path.reverse();
      if (!waterLine(a,path[0])) return null;
      return path;
    }
    for (const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const q=[p[0]+dx,p[1]+dz], qk=key(...q), dest=q.map(v=>v*STEP);
      if (Math.abs(q[0])>LIMIT || Math.abs(q[1])>LIMIT || !waterLine(here,dest)) continue;
      const ng=g+Math.hypot(dx,dz); if (ng >= (best.get(qk) ?? Infinity)) continue;
      best.set(qk,ng); prev.set(qk,{k,p}); open.push({p:q,g:ng,f:ng+Math.hypot(q[0]-end[0],q[1]-end[1])});
    }
  }
  return null;
}
export const reachable = point => !!route([MOORING[0], MOORING[2]], point);

export function createRescue(W, dropIn, collectibles) {
  const boat = { state: 'moored', p: MOORING.slice(), yaw: .05, aboard: [] };
  let path = [], plans = [], targetKind = null;
  const next = () => {
    const plan=plans.shift();
    boat.target=plan.id; targetKind=plan.kind; boat.state=plan.id === null ? 'home' : 'out'; path=plan.path;
  };
  W.sendBoat = () => {
    if (boat.state !== 'moored') return false;
    const targets = [
      ...W.ducks.filter(d=>d.state==='sea').map(d=>({id:d.id, kind:'duck', at:[d.body.p[0],d.body.p[2]]})),
      ...collectibles.api.adrift.map(item=>({id:item.id, kind:'collectible', at:item.at})),
    ].sort((a,b)=>Math.hypot(a.at[0]-boat.p[0],a.at[1]-boat.p[2])-Math.hypot(b.at[0]-boat.p[0],b.at[1]-boat.p[2]));
    if (!targets.length) return false;
    let from=[boat.p[0],boat.p[2]]; const prepared=[];
    for (const target of [...targets, null]) {
      const to=target ? target.at : [MOORING[0],MOORING[2]], leg=route(from,to);
      if (!leg) return false;
      prepared.push({id:target?.id ?? null,kind:target?.kind,path:leg}); from=to;
    }
    plans=prepared; next(); return true;
  };
  const step = dt => {
    if (boat.state === 'moored') return;
    if (path.length) {
      const q=path[0], dx=q[0]-boat.p[0], dz=q[1]-boat.p[2], dist=Math.hypot(dx,dz), move=Math.min(dist,dt*.8);
      if (dist>1e-9) { boat.p[0]+=dx/dist*move; boat.p[2]+=dz/dist*move; boat.yaw=-Math.atan2(dz,dx); }
      if (dist<=move+1e-9) path.shift();
    } else if (boat.state === 'out') {
      if (targetKind === 'collectible') { if (collectibles.board(boat.target)) boat.aboard.push(boat.target); }
      else { const d=W.ducks.find(x=>x.id===boat.target && x.state==='sea'); if (d) { d.state='aboard'; boat.aboard.push(d.id); } }
      next();
    } else {
      const ids=boat.aboard.slice();
      for (const id of ids) { const d=W.ducks.find(x=>x.id===id); if (d) { d.stats.rescued++; d.body.ghost=false; dropIn(d); } }
      boat.aboard=[]; boat.state='moored'; boat.p=MOORING.slice(); boat.yaw=.05;
      const duckIds=ids.filter(id=>typeof id === 'number');
      const collectedIds=collectibles.returnAboard(ids);
      if (duckIds.length) W.events.push({type:'rescued',ids:duckIds});
      if (collectedIds.length) W.events.push({type:'collected',ids:collectedIds});
    }
    boat.p[1]=P.SEA+oceanAt(boat.p[0],boat.p[2],W.time)[0];
    boat.aboard.forEach((id,i)=>{ const d=W.ducks.find(x=>x.id===id); if (!d) return; const offset=(i-(boat.aboard.length-1)/2)*.15; d.body.p=[boat.p[0]+Math.cos(boat.yaw)*offset,boat.p[1]+.16,boat.p[2]-Math.sin(boat.yaw)*offset]; d.body.q=[0,Math.sin(boat.yaw/2),0,Math.cos(boat.yaw/2)]; });
  };
  return {boat, step};
}
