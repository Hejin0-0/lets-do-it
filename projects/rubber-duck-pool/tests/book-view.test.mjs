import test from 'node:test';
import assert from 'node:assert/strict';
import { bookPage } from '../src/pool/book-view.js';
import { COLLECTIBLES } from '../src/pool/collectibles.js';

test('pages follow the supplied order, show discovery and expose both boundaries', () => {
  const pages = [{ id: 'c', found: false }, { id: 'a', found: true }, { id: 'b', found: true }];
  const titles = { a: 'Alpha', b: 'Bravo', c: 'Charlie' };
  assert.deepEqual(bookPage(pages, -1, titles), { index: 0, count: 3, position: 'Page 1 of 3', state: 'empty', title: null, text: 'Not found yet.', canPrev: false, canNext: true, complete: false, summon: { state: 'locked', label: 'Summon into the pool', hint: 'Find it first to summon it.' } });
  assert.deepEqual(bookPage(pages, 1, titles), { index: 1, count: 3, position: 'Page 2 of 3', state: 'filled', title: 'Alpha', text: 'Found.', canPrev: true, canNext: true, complete: false, summon: { state: 'ready', label: 'Summon into the pool', hint: 'Summon it to see it float in the pool.' } });
  assert.deepEqual(bookPage(pages, 99, titles), { index: 2, count: 3, position: 'Page 3 of 3', state: 'filled', title: 'Bravo', text: 'Found.', canPrev: true, canNext: false, complete: false, summon: { state: 'ready', label: 'Summon into the pool', hint: 'Summon it to see it float in the pool.' } });
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
 const elements=Object.fromEntries(['dialog','.book-position','.book-complete','.book-page','h3','p','.book-summon','.book-summon-hint','.book-prev','.book-next','.book-close'].map(key=>[key,new Element()]));
 elements['.book-page'].querySelector=key=>elements[key];
 const ui=new Element();ui.querySelector=key=>elements[key];
 const oldDocument=globalThis.document, oldWindow=globalThis.window;
 globalThis.document={createElement:()=>ui,activeElement:null}; globalThis.window=new EventTarget();
 try {
  const root=new Element(), opener=new Element(), controller=new AbortController(), pages=[{id:'a',found:false},{id:'b',found:true}];
  const placed=new Set(), calls=[];
  const view=createBookView({root,book:{get pages(){return pages;}},signal:controller.signal,summon:{has:id=>placed.has(id),request:id=>{calls.push(id);placed.add(id);return 'placed';}}});
  const button=elements['.book-summon'], hint=elements['.book-summon-hint'];
  view.open(opener); assert.equal(button.attrs['aria-disabled'],'true'); button.dispatchEvent(new Event('click')); assert.deepEqual(calls,[]);
  elements['.book-next'].dispatchEvent(new Event('click')); assert.equal(button.attrs['aria-disabled'],'false');
  button.focus();
  const key=(type,code)=>{const e=new Event(type,{cancelable:true});Object.defineProperties(e,{key:{value:code},code:{value:code},repeat:{value:false}});window.dispatchEvent(e);return e;};
  key('keydown','Space'); assert.equal(key('keyup','Space').cancelBubble,true);
  assert.equal(key('keyup','KeyW').cancelBubble,false);
  button.dispatchEvent(new Event('click')); assert.deepEqual(calls,['b']); assert.equal(button.textContent,'In the pool'); assert.equal(hint.textContent,'It is floating in the pool.'); assert.equal(button.attrs['aria-disabled'],'true'); assert.equal(document.activeElement,button);
  button.dispatchEvent(new Event('click')); assert.deepEqual(calls,['b']);
  const writes=Object.values(elements).reduce((n,el)=>n+el.writes,0);view.frame();assert.equal(Object.values(elements).reduce((n,el)=>n+el.writes,0),writes);
  placed.clear();view.frame();assert.equal(button.attrs['aria-disabled'],'false'); assert.equal(button.textContent,'Summon into the pool');
  elements['.book-close'].dispatchEvent(new Event('click'));assert.equal(document.activeElement,opener);assert.equal(view.isOpen,false);controller.abort();
 } finally {globalThis.document=oldDocument;globalThis.window=oldWindow;}
});
