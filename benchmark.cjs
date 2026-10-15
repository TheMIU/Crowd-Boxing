const fs=require('node:fs'),vm=require('node:vm'),{performance}=require('node:perf_hooks');
let calls=0;const noop=()=>{calls++},gradient={addColorStop:noop};const graphics=new Proxy({createLinearGradient:()=>gradient},{get:(t,k)=>k in t?t[k]:noop,set:(t,k,v)=>(t[k]=v,true)});
const elements=new Map(),element=()=>({style:{},classList:{toggle:noop},addEventListener:noop,getContext:()=>graphics});
const sandbox={console,Math,Set,Map,Array,String,Infinity,setTimeout:noop,devicePixelRatio:1,innerWidth:1280,innerHeight:720,addEventListener:noop,requestAnimationFrame:noop,document:{createElement:element,getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},querySelectorAll:()=>[]},window:{}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('game.js','utf8'),sandbox);
vm.runInContext('start();mode="local";fans=Array.from({length:320},(_,i)=>{let z=zones.filter(z=>z.type==="cheer")[i%zones.filter(z=>z.type==="cheer").length];return {team:i%2,zone:z.id,slot:(i%20)/20,phase:0,x:z.x+z.w/2,y:z.y+z.h/2}});teams.forEach(t=>t.cheer=160);',sandbox);
let begin=performance.now();vm.runInContext('for(let i=0;i<300;i++){time=30;update(1/60)}',sandbox);let updateMs=performance.now()-begin;
vm.runInContext('draw()',sandbox);calls=0;begin=performance.now();vm.runInContext('for(let i=0;i<120;i++)draw()',sandbox);let drawMs=performance.now()-begin;
console.log(JSON.stringify({supporters:320,update300ms:+updateMs.toFixed(1),mockDraw120ms:+drawMs.toFixed(1),canvasCallsPerFrame:Math.round(calls/120)}));
