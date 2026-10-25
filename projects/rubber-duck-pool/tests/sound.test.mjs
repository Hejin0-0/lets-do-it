import test from 'node:test';
import assert from 'node:assert/strict';
import {createSound, musicFor} from '../src/pool/sound.js';

// A stand-in AudioContext that records what starts: every node takes any setting, every param takes any automation.
function fakeContext(){
  const started=[];
  const param=()=>({value:0,setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},cancelScheduledValues(){}});
  const node=(kind)=>new Proxy({kind,connect(){},disconnect(){},start(){started.push(kind);},stop(){}},{get(o,k){if(!(k in o))o[k]=param();return o[k];},set(o,k,v){o[k]=v;return true;}});
  const ctx=new Proxy({currentTime:1,sampleRate:8000,destination:node('out'),listener:node('listener'),resume:async()=>{},close(){},
    createBuffer:(channels,length)=>({numberOfChannels:channels,length,getChannelData:()=>new Float32Array(length)})},
    {get(o,k){if(k in o)return o[k];if(String(k).startsWith('create'))return()=>node(String(k).slice(6));return undefined;}});
  return {ctx,started};
}
const sources=(started)=>started.filter((k)=>k==='Oscillator'||k==='BufferSource').length;

test('quiet things stay quiet; a splash, a plop, a tap, a pick-up and a firework each make a sound',()=>{
  const {ctx,started}=fakeContext(),sound=createSound(()=>ctx);
  sound.set(true);sound.frame([]);sound.frame([]);   // the scene's own sound, scheduled ahead
  const settled=sources(started);
  for(const type of ['arrive','knock','land','whee','pop','gurgle','turn','radio','escaped','hop','leap','swanScoop'])sound.frame([{type,id:1,x:0,z:0,speed:2}]);
  assert.equal(sources(started),settled,'arrivals, knocks, rides and switches start nothing');
  for(const type of ['splash','plop','voice','squeak','launch','burst','fishJump','fishSplash']){
    ctx.currentTime+=1;sound.frame([]);const ahead=sources(started);
    sound.frame([{type,id:3,x:0,y:1.2,z:0,speed:1.5}]);
    assert.ok(sources(started)>ahead,`${type} makes a sound`);
  }
  sound.close();
});

test('a faint splash (a float settling) is not heard',()=>{
  const {ctx,started}=fakeContext(),sound=createSound(()=>ctx);
  sound.set(true);sound.frame([]);const n=sources(started);
  sound.frame([{type:'splash',x:0,z:0,speed:0.1}]);
  assert.equal(sources(started),n);sound.close();
});

test('the radio still plays its station, and muting stops what follows',()=>{
  const {ctx,started}=fakeContext(),sound=createSound(()=>ctx);
  sound.set(true);sound.frame([],{station:1});
  assert.ok(started.includes('Oscillator'),'the radio plays');
  const n=started.length;sound.set(false);ctx.currentTime+=5;sound.frame([{type:'splash',x:0,z:0,speed:2}],{station:1});
  assert.equal(started.length,n,'muted: nothing more is scheduled');
  sound.close();
});

test('the music follows the hour: the day, the dusk, the night',()=>{
  assert.equal(musicFor(11),'day');assert.equal(musicFor(18),'dusk');assert.equal(musicFor(23),'night');assert.equal(musicFor(2),'night');assert.equal(musicFor(8),'day');
});

test('without an audio context it stays silent and does not fail',()=>{
  const sound=createSound(()=>null);
  sound.set(true);sound.frame([{type:'splash',x:0,z:0,speed:2}]);sound.close();
});
