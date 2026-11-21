import test from 'node:test';
import assert from 'node:assert/strict';
import { bookPage, openBookIndex, formatFoundDate } from '../src/pool/book-view.js';
import { COLLECTIBLES } from '../src/pool/collectibles.js';

test('pages follow the supplied order, show discovery and expose both boundaries', () => {
  const pages = [{ id: 'c', found: false }, { id: 'a', found: true }, { id: 'b', found: true }];
  const titles = { a: 'Alpha', b: 'Bravo', c: 'Charlie' };
  assert.deepEqual(bookPage(pages, -1, titles), { index: 0, count: 3, position: 'Page 1 of 3', state: 'empty', title: null, text: 'Not found yet.', description: null, canPrev: false, canNext: true, complete: false, note: null, summon: { state: 'locked', label: 'Summon into the pool', hint: 'Find it first to summon it. The boat brings home what drifts in at sea.' } });
  assert.deepEqual(bookPage(pages, 1, titles), { index: 1, count: 3, position: 'Page 2 of 3', state: 'filled', title: 'Alpha', text: 'Found.', description: null, canPrev: true, canNext: true, complete: false, note: null, summon: { state: 'ready', label: 'Summon into the pool', hint: 'Summon it to see it float in the pool.' } });
  assert.deepEqual(bookPage(pages, 99, titles), { index: 2, count: 3, position: 'Page 3 of 3', state: 'filled', title: 'Bravo', text: 'Found.', description: null, canPrev: true, canNext: false, complete: false, note: null, summon: { state: 'ready', label: 'Summon into the pool', hint: 'Summon it to see it float in the pool.' } });
});

test('completion requires a nonempty list with every page found', () => {
 const pages=COLLECTIBLES.map(({id,kind})=>({id,kind,found:false,at:null}));
 assert.equal(bookPage([],0).complete,false);
 pages.forEach((page,i)=>{assert.equal(bookPage(pages,i).complete,false);page.found=true;});
 assert.equal(bookPage(pages,0).complete,true);assert.equal(bookPage(pages,0).title,COLLECTIBLES[0].title);
});

test('the note says when the second shelf is open and when every page is found', () => {
 const pages=COLLECTIBLES.map(({id,kind,shelf})=>({id,kind,shelf,found:shelf===1,date:null}));
 assert.equal(bookPage(pages.filter(p=>p.shelf===1).map(p=>({...p,found:false})),0).note,null);
 assert.equal(bookPage(pages,0).note,'The first shelf is full. A second shelf is open.');
 pages.forEach(p=>{p.found=true;}); assert.equal(bookPage(pages,0).note,'Every page is found.');
});


test('summon state depends on discovery, placement and a gull taking it, from sets or arrays of ids', () => {
 const pages=[{id:'a',found:false},{id:'b',found:true}];
 assert.deepEqual(bookPage(pages,0,{},new Set(['a'])).summon,{state:'locked',label:'Summon into the pool',hint:'Find it first to summon it. The boat brings home what drifts in at sea.'});
 assert.deepEqual(bookPage(pages,1,{}).summon,{state:'ready',label:'Summon into the pool',hint:'Summon it to see it float in the pool.'});
 for(const ids of [new Set(['b']),['b']]) assert.deepEqual(bookPage(pages,1,{},ids).summon,{state:'placed',label:'Send it back',hint:'A gull will take it away.'});
 for(const ids of [new Set(['b']),['b']]) assert.deepEqual(bookPage(pages,1,{},['b'],undefined,ids).summon,{state:'leaving',label:'A gull is coming',hint:'A gull is taking it away.'});
 assert.equal(bookPage(pages,0,{},['a'],undefined,['a']).summon.state,'locked');
});

async function withBookEnv(pages, fn) {
 const {createBookView}=await import('../src/pool/book-view.js');
 class Element extends EventTarget {
  constructor(){super();this.dataset={};this.attrs={};this.isConnected=true;this.open=false;this.writes=0;this._text='';}
  set textContent(value){this.writes++;this._text=value;} get textContent(){return this._text;}
  set hidden(value){this.writes++;this._hidden=value;} get hidden(){return this._hidden;}
  setAttribute(name,value){this.writes++;this.attrs[name]=value;}
  focus(){globalThis.document.activeElement=this;} showModal(){this.open=true;} close(){this.open=false;} remove(){this.isConnected=false;}
  append(child){this.child=child;}
 }
 const elements=Object.fromEntries(['dialog','.book-position','.book-complete','.book-keep','.book-page','h3','p','.book-description','.book-summon','.book-summon-hint','.book-prev','.book-next','.book-close'].map(key=>[key,new Element()]));
 elements['.book-page'].querySelector=key=>elements[key];
 const ui=new Element();ui.querySelector=key=>elements[key];
 const oldDocument=globalThis.document, oldWindow=globalThis.window;
 globalThis.document={createElement:()=>ui,activeElement:null}; globalThis.window=new EventTarget();
 try {
  const root=new Element(), opener=new Element(), controller=new AbortController();
  const placed=new Set(), going=new Set(), calls=[], sent=[];
  const book={keeps:true,get pages(){return pages;}};
  const view=createBookView({root,book,signal:controller.signal,summon:{has:id=>placed.has(id),leaving:id=>going.has(id),request:id=>{calls.push(id);placed.add(id);return 'placed';},sendBack:id=>{sent.push(id);going.add(id);return 'sent';}}});
  return await fn({view,book,ui,elements,root,opener,controller,placed,going,calls,sent});
 } finally {globalThis.document=oldDocument;globalThis.window=oldWindow;}
}

test('storage warning changes in an open book without moving its page or focus', async () => {
 const pages=[{id:'bottle-first',kind:'bottle',found:true,date:null},{id:'diorama-first',kind:'diorama',found:false,date:null}];
 await withBookEnv(pages, ({view,book,elements,opener,controller}) => {
  const keep=elements['.book-keep'],focus=elements['.book-prev'];
  view.open(opener);elements['.book-next'].dispatchEvent(new Event('click'));focus.focus();
  assert.equal(view.index,1);assert.equal(keep.hidden,true);
  book.keeps=false;view.frame();
  assert.equal(keep.hidden,false);assert.equal(keep.textContent,'This browser is not keeping the book. It lasts while this page is open.');
  assert.equal(view.index,1);assert.equal(elements['.book-position'].textContent,'Page 2 of 2');assert.equal(document.activeElement,focus);
  book.keeps=true;view.frame();
  assert.equal(keep.hidden,true);assert.equal(keep.textContent,'');
  assert.equal(view.index,1);assert.equal(elements['.book-position'].textContent,'Page 2 of 2');assert.equal(document.activeElement,focus);
  view.close();book.keeps=false;view.open(opener);assert.equal(keep.hidden,false);
  assert.equal(keep.textContent,'This browser is not keeping the book. It lasts while this page is open.');
  controller.abort();
 });
});

test('book summon control updates without losing focus and responds to external reset', async () => {
 const pages=[{id:'bottle-first',kind:'bottle',found:false},{id:'diorama-first',kind:'diorama',found:false}];
 await withBookEnv(pages, ({view,ui,elements,opener,controller,placed,going,calls,sent}) => {
  assert.match(ui.innerHTML, /<button\b[^>]*class="book-summon"[^>]*>/, 'Summon is a native button');
  const button=elements['.book-summon'], hint=elements['.book-summon-hint'];
  view.open(opener); assert.equal(elements['h3'].textContent,'A ship in a bottle'); assert.equal(elements['.book-description'].hidden,true); assert.equal(hint.textContent,'Find it first to summon it. The boat brings home what drifts in at sea.'); assert.equal(button.attrs['aria-disabled'],'true'); button.dispatchEvent(new Event('click')); assert.deepEqual(calls,[]);
  pages[1].found=true; pages[1].date=100; view.frame(); assert.equal(view.index,0); assert.equal(elements['h3'].textContent,'A ship in a bottle'); assert.equal(button.attrs['aria-disabled'],'true');
  elements['.book-next'].dispatchEvent(new Event('click')); assert.equal(button.attrs['aria-disabled'],'false'); assert.equal(elements['h3'].textContent,'Volcano island'); assert.equal(elements['.book-description'].textContent,'A smoking peak on a raft of rock, still warm.'); assert.equal(elements['.book-description'].hidden,false);
  button.focus();
  // These keys check modal isolation; native activation is checked by pool-summon.js.
  const key=(type,code)=>{const e=new Event(type,{cancelable:true});Object.defineProperties(e,{key:{value:code},code:{value:code},repeat:{value:false}});window.dispatchEvent(e);return e;};
  key('keydown','Space'); assert.equal(key('keyup','Space').cancelBubble,true);
  assert.equal(key('keyup','KeyW').cancelBubble,false);
  button.dispatchEvent(new Event('click')); assert.deepEqual(calls,['diorama-first']); assert.equal(button.textContent,'Send it back'); assert.equal(hint.textContent,'A gull will take it away.'); assert.equal(button.attrs['aria-disabled'],'false'); assert.equal(document.activeElement,button);
  button.dispatchEvent(new Event('click')); assert.deepEqual(calls,['diorama-first']); assert.deepEqual(sent,['diorama-first']);
  assert.equal(button.textContent,'A gull is coming'); assert.equal(hint.textContent,'A gull is taking it away.'); assert.equal(button.attrs['aria-disabled'],'true'); assert.equal(document.activeElement,button);
  button.dispatchEvent(new Event('click')); assert.deepEqual(sent,['diorama-first']); assert.deepEqual(calls,['diorama-first']);
  const writes=Object.values(elements).reduce((n,el)=>n+el.writes,0);view.frame();assert.equal(Object.values(elements).reduce((n,el)=>n+el.writes,0),writes);
  placed.clear();going.clear();view.frame();assert.equal(button.attrs['aria-disabled'],'false'); assert.equal(button.textContent,'Summon into the pool');
  elements['.book-close'].dispatchEvent(new Event('click'));assert.equal(document.activeElement,opener);assert.equal(view.isOpen,false);view.open(opener);assert.equal(view.index,1);controller.abort();
 });
});

test('modal book blocks later window capture listeners for open keys and post-close releases', async () => {
 const pages=[{id:'bottle-first',kind:'bottle',found:false}];
 await withBookEnv(pages, ({view,opener,controller}) => {
  const seen=[];
  window.addEventListener('keydown', e => seen.push(`down:${e.code}`), { signal: controller.signal, capture: true });
  window.addEventListener('keyup', e => seen.push(`up:${e.code}`), { signal: controller.signal, capture: true });
  const key=(type,code)=>{const e=new Event(type,{cancelable:true});Object.defineProperties(e,{key:{value:code},code:{value:code},repeat:{value:false}});window.dispatchEvent(e);return e;};
  key('keydown','KeyM'); key('keyup','KeyM');
  assert.deepEqual(seen.splice(0),['down:KeyM','up:KeyM']);
  view.open(opener);
  key('keydown','KeyM'); key('keyup','KeyM');
  key('keydown','Space'); key('keyup','Space');
  assert.deepEqual(seen,[]);
  key('keydown','KeyW'); view.close(); key('keyup','KeyW');
  assert.deepEqual(seen,[]);
  key('keydown','KeyM'); key('keyup','KeyM');
  assert.deepEqual(seen,['down:KeyM','up:KeyM']);
  controller.abort();
 });
});


test('kind headings conceal names until found, with English dates and descriptions', () => {
 const pages=COLLECTIBLES.map(({id,kind})=>({id,kind,found:false,date:null}));
 const descriptions=['A little sloop with paper sails, dry inside its glass.','A paddle steamer with a red funnel, its smoke painted on the glass.','A black-sailed ship, its crew too small to see.','A smoking peak on a raft of rock, still warm.','Palms and vines so thick the shore is hidden.','One pine under fresh snow, cold in a summer sea.','A little rowboat with a lantern at the bow, oars shipped.','A round-windowed submarine, its periscope up.','A striped square sail over a row of round shields.','A striped lighthouse on a rock, its lamp still lit.','A wrecked hull on a coral reef, half under the waves.','Three tiny houses by a jetty, smoke from one chimney.'];
 for(const [i,item] of COLLECTIBLES.entries()) {
  const empty=bookPage(pages,i);assert.equal(empty.title,item.kind==='bottle'?'A ship in a bottle':'An island');assert.notEqual(empty.title,item.title);assert.equal(empty.text,'Not found yet.');assert.equal(empty.description,null);
  pages[i].found=true;pages[i].date=Date.UTC(2026,10,4,12);
  const found=bookPage(pages,i,undefined,[],'UTC');assert.equal(found.title,item.title);assert.equal(found.text,'Found on 4 Nov 2026.');assert.equal(found.description,descriptions[i]);
  pages[i].date=null;assert.equal(bookPage(pages,i).text,'Found.');
 }
 assert.equal(formatFoundDate(Date.UTC(2026,10,4,1),'America/Los_Angeles'),'3 Nov 2026');
});

test('opening selects latest dated find and later page on ties', () => {
 const pages=COLLECTIBLES.map(({id,kind})=>({id,kind,found:false,date:null}));
 assert.equal(openBookIndex([]),0);assert.equal(openBookIndex(pages),0);
 pages[2].found=true;assert.equal(openBookIndex(pages),2);pages[4].found=true;assert.equal(openBookIndex(pages),4);
 pages[1].found=true;pages[1].date=100;assert.equal(openBookIndex(pages),1);pages[3].found=true;pages[3].date=200;assert.equal(openBookIndex(pages),3);pages[5].found=true;pages[5].date=200;assert.equal(openBookIndex(pages),5);
});

test('an open page redraws when its find date changes', async () => {
 const d1=Date.UTC(2026,10,10,12), d2=Date.UTC(2026,10,4,12);
 const pages=[{id:'bottle-first',kind:'bottle',found:true,date:d1}];
 await withBookEnv(pages, ({view,elements,opener,controller}) => {
  view.open(opener);
  assert.equal(elements['p'].textContent,`Found on ${formatFoundDate(d1)}.`);
  pages[0].date=d2;
  view.frame();
  assert.equal(elements['p'].textContent,`Found on ${formatFoundDate(d2)}.`);
  pages[0].date=null;
  view.frame();
  assert.equal(elements['p'].textContent,'Found.');
  controller.abort();
 });
});

test('unchanged book nodes are not rewritten on other-page finds or same-kind empty turns', async () => {
 const pages=[{id:'bottle-first',kind:'bottle',found:false,date:null},{id:'bottle-second',kind:'bottle',found:false,date:null},{id:'diorama-first',kind:'diorama',found:false,date:null}];
 const shown=['.book-position','.book-complete','.book-keep','.book-summon-hint','h3','p','.book-description','.book-summon'];
 await withBookEnv(pages, ({view,elements,opener,controller}) => {
  const mark=()=>{for(const el of Object.values(elements)) el.writes=0;};
  const written=keys=>Object.fromEntries(keys.map(k=>[k,elements[k].writes]));
  view.open(opener);
  mark();
  pages[2].found=true; pages[2].date=100;
  view.frame();
  assert.deepEqual(written(shown),Object.fromEntries(shown.map(k=>[k,0])));
  assert.equal(elements['.book-prev'].writes,0); assert.equal(elements['.book-next'].writes,0);
  mark();
  elements['.book-next'].dispatchEvent(new Event('click'));
  assert.deepEqual(written(shown),{'.book-position':1,'.book-complete':0,'.book-keep':0,'.book-summon-hint':0,'h3':0,'p':0,'.book-description':0,'.book-summon':0});
  assert.equal(elements['.book-position'].textContent,'Page 2 of 3');
  assert.equal(elements['.book-prev'].writes,1); assert.equal(elements['.book-next'].writes,0);
  mark();
  elements['.book-prev'].dispatchEvent(new Event('click'));
  assert.deepEqual(written(shown),{'.book-position':1,'.book-complete':0,'.book-keep':0,'.book-summon-hint':0,'h3':0,'p':0,'.book-description':0,'.book-summon':0});
  assert.equal(elements['.book-position'].textContent,'Page 1 of 3');
  assert.equal(elements['.book-prev'].writes,1); assert.equal(elements['.book-next'].writes,0);
  elements['.book-next'].dispatchEvent(new Event('click'));
  elements['.book-next'].dispatchEvent(new Event('click'));
  assert.equal(elements['.book-position'].textContent,'Page 3 of 3');
  assert.equal(elements['h3'].textContent,'Volcano island');
  assert.equal(elements['.book-description'].hidden,false);
  controller.abort();
 });
});
