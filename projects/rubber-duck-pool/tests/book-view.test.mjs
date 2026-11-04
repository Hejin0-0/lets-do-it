import test from 'node:test';
import assert from 'node:assert/strict';
import { bookPage, openBookIndex, formatFoundDate } from '../src/pool/book-view.js';
import { COLLECTIBLES } from '../src/pool/collectibles.js';

test('pages follow the supplied order, show discovery and expose both boundaries', () => {
  const pages = [{ id: 'c', found: false }, { id: 'a', found: true }, { id: 'b', found: true }];
  const titles = { a: 'Alpha', b: 'Bravo', c: 'Charlie' };
  assert.deepEqual(bookPage(pages, -1, titles), { index: 0, count: 3, position: 'Page 1 of 3', state: 'empty', title: null, text: 'Not found yet.', description: null, canPrev: false, canNext: true, complete: false, summon: { state: 'locked', label: 'Summon into the pool', hint: 'Find it first to summon it.' } });
  assert.deepEqual(bookPage(pages, 1, titles), { index: 1, count: 3, position: 'Page 2 of 3', state: 'filled', title: 'Alpha', text: 'Found.', description: null, canPrev: true, canNext: true, complete: false, summon: { state: 'ready', label: 'Summon into the pool', hint: 'Summon it to see it float in the pool.' } });
  assert.deepEqual(bookPage(pages, 99, titles), { index: 2, count: 3, position: 'Page 3 of 3', state: 'filled', title: 'Bravo', text: 'Found.', description: null, canPrev: true, canNext: false, complete: false, summon: { state: 'ready', label: 'Summon into the pool', hint: 'Summon it to see it float in the pool.' } });
});

test('completion requires a nonempty list with every page found', () => {
 const pages=COLLECTIBLES.map(({id,kind})=>({id,kind,found:false,at:null}));
 assert.equal(bookPage([],0).complete,false);
 pages.forEach((page,i)=>{assert.equal(bookPage(pages,i).complete,false);page.found=true;});
 assert.equal(bookPage(pages,0).complete,true);assert.equal(bookPage(pages,0).title,COLLECTIBLES[0].title);
});


test('summon state depends on discovery and accepts a set or array of placed ids', () => {
 const pages=[{id:'a',found:false},{id:'b',found:true}];
 assert.deepEqual(bookPage(pages,0,{},new Set(['a'])).summon,{state:'locked',label:'Summon into the pool',hint:'Find it first to summon it.'});
 assert.deepEqual(bookPage(pages,1,{}).summon,{state:'ready',label:'Summon into the pool',hint:'Summon it to see it float in the pool.'});
 for(const ids of [new Set(['b']),['b']]) assert.deepEqual(bookPage(pages,1,{},ids).summon,{state:'placed',label:'In the pool',hint:'It is floating in the pool.'});
});

test('book summon control updates without losing focus and responds to external reset', async () => {
 const {createBookView}=await import('../src/pool/book-view.js');
 class Element extends EventTarget {
  constructor(){super();this.dataset={};this.attrs={};this.isConnected=true;this.open=false;this.writes=0;this._text='';}
  set textContent(value){this.writes++;this._text=value;} get textContent(){return this._text;}
  setAttribute(name,value){this.writes++;this.attrs[name]=value;}
  focus(){globalThis.document.activeElement=this;} showModal(){this.open=true;} close(){this.open=false;} remove(){this.isConnected=false;}
  append(child){this.child=child;}
 }
 const elements=Object.fromEntries(['dialog','.book-position','.book-complete','.book-page','h3','p','.book-description','.book-summon','.book-summon-hint','.book-prev','.book-next','.book-close'].map(key=>[key,new Element()]));
 elements['.book-page'].querySelector=key=>elements[key];
 const ui=new Element();ui.querySelector=key=>elements[key];
 const oldDocument=globalThis.document, oldWindow=globalThis.window;
 globalThis.document={createElement:()=>ui,activeElement:null}; globalThis.window=new EventTarget();
 try {
  const root=new Element(), opener=new Element(), controller=new AbortController(), pages=[{id:'bottle-first',kind:'bottle',found:false},{id:'diorama-first',kind:'diorama',found:false}];
  const placed=new Set(), calls=[];
  const view=createBookView({root,book:{get pages(){return pages;}},signal:controller.signal,summon:{has:id=>placed.has(id),request:id=>{calls.push(id);placed.add(id);return 'placed';}}});
  const button=elements['.book-summon'], hint=elements['.book-summon-hint'];
  view.open(opener); assert.equal(elements['h3'].textContent,'A ship in a bottle'); assert.equal(elements['.book-description'].hidden,true); assert.equal(button.attrs['aria-disabled'],'true'); button.dispatchEvent(new Event('click')); assert.deepEqual(calls,[]);
  pages[1].found=true; pages[1].date=100; view.frame(); assert.equal(view.index,0); assert.equal(elements['h3'].textContent,'A ship in a bottle'); assert.equal(button.attrs['aria-disabled'],'true');
  elements['.book-next'].dispatchEvent(new Event('click')); assert.equal(button.attrs['aria-disabled'],'false'); assert.equal(elements['h3'].textContent,'Volcano island'); assert.equal(elements['.book-description'].textContent,'A smoking peak on a raft of rock, still warm.'); assert.equal(elements['.book-description'].hidden,false);
  button.focus();
  const key=(type,code)=>{const e=new Event(type,{cancelable:true});Object.defineProperties(e,{key:{value:code},code:{value:code},repeat:{value:false}});window.dispatchEvent(e);return e;};
  key('keydown','Space'); assert.equal(key('keyup','Space').cancelBubble,true);
  assert.equal(key('keyup','KeyW').cancelBubble,false);
  button.dispatchEvent(new Event('click')); assert.deepEqual(calls,['diorama-first']); assert.equal(button.textContent,'In the pool'); assert.equal(hint.textContent,'It is floating in the pool.'); assert.equal(button.attrs['aria-disabled'],'true'); assert.equal(document.activeElement,button);
  button.dispatchEvent(new Event('click')); assert.deepEqual(calls,['diorama-first']);
  const writes=Object.values(elements).reduce((n,el)=>n+el.writes,0);view.frame();assert.equal(Object.values(elements).reduce((n,el)=>n+el.writes,0),writes);
  placed.clear();view.frame();assert.equal(button.attrs['aria-disabled'],'false'); assert.equal(button.textContent,'Summon into the pool');
  elements['.book-close'].dispatchEvent(new Event('click'));assert.equal(document.activeElement,opener);assert.equal(view.isOpen,false);view.open(opener);assert.equal(view.index,1);controller.abort();
 } finally {globalThis.document=oldDocument;globalThis.window=oldWindow;}
});


test('kind headings conceal names until found, with English dates and descriptions', () => {
 const pages=COLLECTIBLES.map(({id,kind})=>({id,kind,found:false,date:null}));
 const descriptions=['A little sloop with paper sails, dry inside its glass.','A paddle steamer with a red funnel, its smoke painted on the glass.','A black-sailed ship, its crew too small to see.','A smoking peak on a raft of rock, still warm.','Palms and vines so thick the shore is hidden.','One pine under fresh snow, cold in a summer sea.'];
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
