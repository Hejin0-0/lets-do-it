#!/bin/zsh
# usage: cap.sh LABEL  (captures the 8 matched A/B shots of /private/tmp/claude-501/ink-iron-ab/LABEL.html)
P=${0:A:h:h:h} # the project root (this script lives in scripts/ab/)
AB=/private/tmp/claude-501/ink-iron-ab; V=$1; U="file://$AB/$V.html"; cd $P
H="const h=window.__THREE_GAME_TEST_HOOKS__,w=(ms)=>new Promise(r=>setTimeout(r,ms))"
shot() { node scripts/probe.mjs --url "$U" --w $2 --h $3 --wait ${5:-9000} --shot $AB/shots/$V-$1.png --eval "$4" >/dev/null 2>&1 }
shot 1-library 1280 720 "(async()=>{$H;h.setState('library-overview');await w(2500);return 'ok'})()"
shot 2-s1 1280 720 "(async()=>{$H;h.loadScenario('s1',42,'veteran');h.skipIntro();await w(3500);return 'ok'})()"
shot 3-forecast 1280 720 "(async()=>{$H;h.loadScenario('s1',42,'veteran');h.skipIntro();await w(3000);const c=document.querySelector('#game-canvas'),e=(t,p)=>c.dispatchEvent(new PointerEvent(t,{clientX:p.x,clientY:p.y,bubbles:true,button:0,pointerId:1,isPrimary:true}));const m=h.legalActions().find(a=>a.t==='move'),u=h.getState().units.find(x=>x.id===m.unit);let p=h.hexScreen(u.hex);e('pointermove',p);e('pointerdown',p);await w(30);e('pointerup',p);await w(500);p=h.hexScreen(m.to);e('pointermove',p);await w(700);return 'ok'})()"
shot 4-bell 1280 720 "(async()=>{$H;h.loadScenario('s1',42,'veteran');h.skipIntro();await w(3000);window.dispatchEvent(new KeyboardEvent('keydown',{key:' '}));await w(300);window.dispatchEvent(new KeyboardEvent('keydown',{key:' '}));await w(1500);return 'ok'})()"
shot 5-s2 1280 720 "(async()=>{$H;h.loadScenario('s2',42,'veteran');h.skipIntro();await w(3500);return 'ok'})()"
shot 6-yawed 1280 720 "(async()=>{$H;h.loadScenario('s1',42,'veteran');h.skipIntro();await w(1500);for(let i=0;i<7;i++)window.dispatchEvent(new KeyboardEvent('keydown',{key:'a'}));await w(2500);return 'ok'})()"
shot 7-tablet 768 1024 "(async()=>{$H;h.loadScenario('s3',42,'veteran');h.skipIntro();await w(3500);return 'ok'})()"
shot 8-title 1280 720 "(async()=>'ok')()" 1500
for S in s1 s2; do printf "$V $S "; node scripts/probe.mjs --url "$U" --w 1280 --h 720 --wait 9000 --eval "(async()=>{$H;h.loadScenario('$S',42,'veteran');h.skipIntro();await w(3500);const d=window.__THREE_GAME_DIAGNOSTICS__;return JSON.stringify({calls:d.renderer.calls,tris:d.renderer.triangles})})()" 2>&1 | grep -o '{"calls[^}]*}'; done
ls $AB/shots/$V-*.png | wc -l
