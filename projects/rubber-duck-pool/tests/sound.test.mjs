import test from 'node:test';
import assert from 'node:assert/strict';
import {createSound} from '../src/pool/sound.js';

// Observe the actual scheduling boundary, including noise loops created when audio is enabled.
function audioProbe(t){
  const started=[],gains=[];
  const param=()=>({value:0,setValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;}});
  class Context {
    currentTime=1;sampleRate=8000;destination={};
    createGain(){const gain=param();gains.push(gain);return {gain,connect(){}};}
    createBuffer(_channels,length){return {getChannelData:()=>new Float32Array(length)};}
    createBiquadFilter(){return {type:'',frequency:param(),Q:param(),connect(){}};}
    createBufferSource(){return {connect(){},start(){started.push('noise');},stop(){}};}
    createOscillator(){return {frequency:param(),detune:param(),connect(){},start(){started.push('tone');},stop(){}};}
    resume(){} close(){}
  }
  const oldWindow=globalThis.window,oldContext=globalThis.AudioContext;
  globalThis.window={AudioContext:Context};globalThis.AudioContext=Context;
  t.after(()=>{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;if(oldContext===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=oldContext;});
  return {started,gains};
}

test('enabling sound, duck arrivals, rides and interactions schedule no effects or ambient hiss',t=>{
  const {started}=audioProbe(t),sound=createSound();
  t.after(()=>sound.close());sound.set(true);
  for(const type of ['arrive','splash','knock','squeak','voice','falls','plop','scoop','turn','radio','whee','gurgle','pop','land']){
    sound.frame([{type,id:1,colour:0,speed:2}],1,0);
  }
  assert.deepEqual(started,[],'world events and background loops must stay silent');
});

test('an explicitly selected radio station still schedules music, and disabled sound stays silent',t=>{
  const {started,gains}=audioProbe(t),sound=createSound();t.after(()=>sound.close());
  sound.set(true);sound.frame([],1,1);
  assert.ok(started.includes('tone'),'the radio still plays');
  const count=started.length;sound.set(false);sound.frame([],1,1);
  assert.equal(started.length,count,'disabled audio must not schedule more notes');
  assert.equal(gains[0].value,0,'muting also silences radio notes already scheduled');
});
