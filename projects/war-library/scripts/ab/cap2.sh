#!/bin/zsh
# usage: cap2.sh LABEL MODE  — three extra A/B shots (9-book, 10-ledger, 11-round); MODE campaign|plain picks
# how the after-action page is reached (through the campaign link, or the plain "skip the tutorial")
P=${0:A:h:h:h} # the project root (this script lives in scripts/ab/)
AB=/private/tmp/claude-501/ink-iron-ab; V=$1; U="file://$AB/$V.html"; cd $P
H="const h=window.__THREE_GAME_TEST_HOOKS__,w=(ms)=>new Promise(r=>setTimeout(r,ms)),btn=(t)=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(t))"
shot() { node scripts/probe.mjs --url "$U" --w 1280 --h 720 --wait ${3:-9000} --shot $AB/shots/$V-$1.png --eval "$2" >/dev/null 2>&1 }
shot 9-book "(async()=>{$H;h.loadScenario('s1',42,'veteran');h.skipIntro();await w(1500);btn('Menu').click();await w(900);return 'ok'})()"
if [[ $2 == campaign ]]; then
  shot 10-ledger "(async()=>{$H;btn('The campaign: the Yser').click();await w(1500);btn('To the table').click();await w(500);h.setState('victory');await w(2500);return 'ok'})()" 2500
else
  shot 10-ledger "(async()=>{$H;btn('skip the tutorial').click();await w(1500);h.setState('victory');await w(2500);return 'ok'})()" 2500
fi
shot 11-round "(async()=>{$H;h.loadScenario('s3',42,'veteran');h.skipIntro();await w(1500);window.dispatchEvent(new KeyboardEvent('keydown',{key:' '}));await w(300);window.dispatchEvent(new KeyboardEvent('keydown',{key:' '}));const t0=performance.now();while(window.__THREE_GAME_DIAGNOSTICS__.phase!=='player-orders'&&performance.now()-t0<20000)await w(100);await w(1000);return 'ok'})()"
ls $AB/shots/$V-9-book.png $AB/shots/$V-10-ledger.png $AB/shots/$V-11-round.png | wc -l
