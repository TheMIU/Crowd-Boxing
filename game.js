'use strict';
const canvas=document.getElementById('game');let ctx=canvas.getContext('2d');
const MAX_CARRY=15,MAX_SIZE=45,spriteCache=new Map();let groundCache=null,drawClock=0;const peopleBuffer=[];
const $=id=>document.getElementById(id),W=1440,H=850,colors=['#35c9df','#ff755c'];
let scale=1,ox=0,oy=0,mode='ai',state='menu',teams=[],neutrals=[],fans=[],fx=[],time=30,elapsed=0,round=1,phase='gather',spawnClock=0,clashClock=0,last=0,seed=718;
let pointer=null,keys={},audio;
let impactBursts=[],cameraShake=0,impactFreeze=0;
const cameraView={x:720,y:425,zoom:1,scale:1,ox:0,oy:0};
let roundResults=[],roundDamage=[0,0],roundKnockout=null,roundMessage='',messageUntil=0;
const difficultyProfiles={
 easy:{label:'EASY',speed:.52,delay:5,batch:5,deposit:.28,sizeRatio:.4},
 harder:{label:'HARDER',speed:1,delay:.8,batch:10,deposit:.14,sizeRatio:.65},
 medium:{label:'MEDIUM',speed:.8,delay:2.5,batch:7,deposit:.18,sizeRatio:.6}
};
let completedAiMatches=0;try{const saved=Number(localStorage.getItem('crowdBoxing.completedAiMatches.v1'));if(Number.isSafeInteger(saved)&&saved>=0)completedAiMatches=saved}catch{}
const difficultyForMatch=number=>number===1?difficultyProfiles.easy:number===2?difficultyProfiles.harder:difficultyProfiles.medium;
let difficulty=difficultyForMatch(completedAiMatches+1);
const rivalName=()=>mode==='ai'?'RIVAL':'PLAYER 2';
const wins=id=>roundResults.filter(r=>r.winner===id).length;
const ring={x:550,y:272,w:340,h:236};
const punches=['jab','cross','hook','uppercut'];
const attackProfiles={
 jab:{damage:3,sizeScale:.55,duration:.22,recovery:.48,dodgeFactor:1,recoil:.35},
 cross:{damage:7,sizeScale:1,duration:.38,recovery:.95,dodgeFactor:1,recoil:.9},
 hook:{damage:6,sizeScale:.9,duration:.44,recovery:.85,dodgeFactor:.45,recoil:.65},
 uppercut:{damage:12,sizeScale:1.4,duration:.70,recovery:1.55,dodgeFactor:1.25,recoil:1.15}
};
const attackDurations=Object.fromEntries(punches.map(type=>[type,attackProfiles[type].duration]));
function attackStats(t,type){const p=attackProfiles[type],trained=support(t,type);return {damage:(p.damage+t.size*.25*p.sizeScale)*(1+Math.min(.6,trained*.025)),recovery:Math.max(p.duration+.12,p.recovery/(1+Math.min(.7,trained*.035))),dodgeFactor:p.dodgeFactor,recoil:p.recoil}}

const zones=[
 {id:'size-blue',x:420,y:230,w:100,h:70,team:0,type:'size'},
 {id:'size-red',x:920,y:230,w:100,h:70,team:1,type:'size'},
 ...[
  ['left-jab-0',420,345,'jab'],['right-jab-0',920,345,'jab'],
  ['left-cross-0',420,440,'cross'],['right-cross-0',920,440,'cross'],
  ['left-hook-0',480,555,'hook'],['left-uppercut-0',600,555,'uppercut'],
  ['right-hook-0',720,555,'hook'],['right-uppercut-0',840,555,'uppercut']
 ].map(([id,x,y,skill])=>({id,x,y,w:100,h:76,type:'cheer',skill}))
];
const zoneById=new Map(zones.map(z=>[z.id,z]));
function refreshSupport(){for(const z of zones){z.counts??=[0,0];z.groups??=[[],[]];z.counts.fill(0);z.groups[0].length=z.groups[1].length=0}for(const t of teams)for(const punch of punches)t.support[punch]=0;for(const f of fans){const z=zoneById.get(f.zone);if(z){z.counts[f.team]++;z.groups[f.team].push(f);teams[f.team].support[z.skill]++}}}
const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296},dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function resize(){let d=Math.min(devicePixelRatio||1,1.5);canvas.width=innerWidth*d;canvas.height=innerHeight*d;ctx.setTransform(d,0,0,d,0,0);scale=Math.min(innerWidth/W,innerHeight/H);ox=(innerWidth-W*scale)/2;oy=(innerHeight-H*scale)/2}addEventListener('resize',resize);resize();
function beep(freq=400,duration=.06,vol=.03){try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.65,audio.currentTime+duration);g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}catch{}}
function punchSound(attack,critical){beep(attack==='jab'?145:attack==='uppercut'?70:95,critical?.17:.09,critical?.07:.045);try{if(!audio)return;const buffer=audio.createBuffer(1,Math.floor(audio.sampleRate*.045),audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);const source=audio.createBufferSource(),gain=audio.createGain();source.buffer=buffer;gain.gain.value=.045;source.connect(gain).connect(audio.destination);source.start()}catch{}}
function bell(){beep(880,.75,.075);setTimeout(()=>beep(1174,.65,.035),130)}
function makeTeam(id){return{id,x:id?1240:200,y:400,carry:[],size:0,cheer:0,hp:100,maxHp:100,active:true,cooldown:1,flash:0,punch:0,deposit:0,target:null,total:0,bx:id?750:690,by:406,dodge:0,damage:0,attack:'jab',recoil:0,strike:null,support:{jab:0,cross:0,hook:0,uppercut:0}}}
function inside(p,r,pad=0){return p.x>r.x-pad&&p.x<r.x+r.w+pad&&p.y>r.y-pad&&p.y<r.y+r.h+pad}
function blocked(x,y,pad=15){return inside({x,y},ring,pad)}
function spawn(n){for(let i=0;i<n;i++){let p,valid=false;for(let j=0;j<100;j++){p={x:85+rand()*1270,y:180+rand()*575,phase:rand()*7};valid=!blocked(p.x,p.y,35)&&!zones.some(z=>inside(p,z,20))&&teams.every(t=>dist(t,p)>70);if(valid)break}if(valid)neutrals.push(p)}}
function reset(){impactBursts=[];cameraShake=0;impactFreeze=0;roundResults=[];roundDamage=[0,0];roundKnockout=null;roundMessage='';messageUntil=0;seed=718;teams=[makeTeam(0),makeTeam(1)];neutrals=[];fans=[];fx=[];time=30;elapsed=0;round=1;phase='gather';spawnClock=0;clashClock=0;pointer=null;keys={};spawn(100);refreshSupport();cameraView.x=720;cameraView.y=425;cameraView.zoom=1;updateCamera(0)}
function start(){difficulty=difficultyForMatch(completedAiMatches+1);reset();state='play';$('menu').hidden=true;$('result').hidden=true;$('hud').hidden=false;$('rival').textContent=mode==='ai'?'RIVAL · '+difficulty.label:'PLAYER 2';beep(520,.14);updateCamera(1);updateHUD()}
function move(t,dx,dy,dt){let len=Math.hypot(dx,dy);if(len<.01)return;let speed=178;dx=dx/len*speed*dt;dy=dy/len*speed*dt;let x=clamp(t.x+dx,65,W-65),y=clamp(t.y+dy,167,780);if(!blocked(x,t.y))t.x=x;if(!blocked(t.x,y))t.y=y}
function route(t,p,dt){let dx=p.x-t.x,dy=p.y-t.y;if(dist(t,p)<8)return;const r={x:ring.x-24,y:ring.y-24,w:ring.w+48,h:ring.h+48};let crosses=false;for(let a=.1;a<1;a+=.1)if(inside({x:t.x+dx*a,y:t.y+dy*a},r))crosses=true;if(crosses){let top=Math.abs(t.y-230)+Math.abs(p.y-230),bottom=Math.abs(t.y-550)+Math.abs(p.y-550),yy=top<bottom?230:550;if(Math.abs(t.y-yy)>12){dx=0;dy=yy-t.y}else{dx=p.x-t.x;dy=0}}move(t,dx,dy,dt)}
function pop(x,y,text,color){fx.push({x,y,text,color,life:1,max:1})}
function support(t,skill){return t.support[skill]||0}
function deposit(t,z){if(phase!=='gather'||!t.carry.length||(z.type==='size'&&(z.team!==t.id||t.size>=MAX_SIZE)))return;const p=t.carry.shift();t.total++;if(z.type==='size'){t.size++;t.maxHp+=19;t.hp=Math.min(t.maxHp,t.hp+23);pop(z.x+z.w/2,z.y+10,'+ SIZE',colors[t.id])}else{t.cheer++;fans.push({team:t.id,x:p.x,y:p.y,phase:rand()*7,slot:rand(),zone:z.id});pop(z.x+z.w/2,z.y+10,'+ '+z.skill.toUpperCase(),colors[t.id])}refreshSupport();t.deposit=t.id===1&&mode==='ai'?difficulty.deposit:.14;if(t.id===0)beep(z.type==='size'?240:650,.035,.018)}
function ai(t,dt){if(t.size>=MAX_SIZE&&t.target?.type==='size')t.target=null;if(30-time<difficulty.delay)return;if(t.carry.length>=difficulty.batch||(t.carry.length&&time<7)||t.target?.type){if(!t.target?.type){let type=t.size<MAX_SIZE&&(t.hp/t.maxHp<.5||t.size<Math.max(2,t.cheer*difficulty.sizeRatio))?'size':'cheer';let options=zones.filter(z=>z.type===type&&(type==='cheer'||z.team===t.id));if(type==='cheer')options.sort((a,b)=>{let count=z=>z.counts[t.id];return count(a)*40+dist(t,{x:a.x+a.w/2,y:a.y+a.h/2})-count(b)*40-dist(t,{x:b.x+b.w/2,y:b.y+b.h/2})});t.target=options[0]}let z=t.target;route(t,{x:z.x+z.w/2,y:z.y+z.h/2},dt*difficulty.speed);if(!t.carry.length)t.target=null}else{let best=null,score=Infinity;for(const p of neutrals){let d=dist(t,p)+(blocked((t.x+p.x)/2,(t.y+p.y)/2)?220:0);if(d<score){best=p;score=d}}if(best)route(t,best,dt*difficulty.speed)}}
function scoreRound(){const percentages=roundDamage.map((damage,id)=>damage/teams[1-id].maxHp*100);const winner=roundKnockout!==null?roundKnockout:Math.abs(percentages[0]-percentages[1])<.01?-1:percentages[0]>percentages[1]?0:1;const result={round,winner,percentages,knockout:roundKnockout!==null};roundResults.push(result);roundMessage=`ROUND ${round} · ${winner<0?'DRAW':winner===0?'YOU WIN':rivalName()+' WINS'}${result.knockout?' · KO':''}`;messageUntil=elapsed+6;return result}
function advancePhase(){bell();pointer=null;keys={};teams.forEach(t=>{t.target=null;t.punch=0;t.strike=null;t.cooldown=.5});if(phase==='gather'){phase='fight';time=10;roundDamage=[0,0];roundKnockout=null;roundMessage='';}else{scoreRound();if(round<3){round++;phase='gather';time=30;teams.forEach(t=>{t.hp=t.maxHp;t.dodge=0;t.flash=0});spawn(20)}else finish(wins(0)===wins(1)?-1:wins(0)>wins(1)?0:1,'FINAL RESULT · 3 ROUNDS')}updateHUD()}
function update(dt){if(state!=='play')return;elapsed+=dt;let step=Math.min(dt,time);time=Math.max(0,time-dt);spawnClock+=step;clashClock+=step;cameraShake*=Math.exp(-22*step);impactFreeze=Math.max(0,impactFreeze-step);for(const burst of impactBursts)burst.age+=step;impactBursts=impactBursts.filter(b=>b.age<b.life);
 if(phase==='gather'&&spawnClock>3){spawnClock=0;if(neutrals.length<100)spawn(10)}
 for(const t of teams){t.recoil=Math.max(0,(t.recoil||0)-step*4);t.flash=Math.max(0,t.flash-step);t.dodge=Math.max(0,t.dodge-step);t.punch=Math.max(0,t.punch-step*(impactFreeze>0?.3:1)/attackDurations[t.attack]);t.deposit-=step;
 if(phase==='gather'){
 if(t.id===1&&mode==='ai')ai(t,step);else{let dx=0,dy=0;if(t.id===0){dx=(keys.d||keys.D?1:0)-(keys.a||keys.A?1:0);dy=(keys.s||keys.S?1:0)-(keys.w||keys.W?1:0);if(mode==='ai'){dx+=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0);dy+=(keys.ArrowDown?1:0)-(keys.ArrowUp?1:0)}}else{dx=(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0);dy=(keys.ArrowDown?1:0)-(keys.ArrowUp?1:0)}if(t.id===0&&pointer){if(Math.hypot(pointer.dx,pointer.dy)>.08)move(t,pointer.dx,pointer.dy,step)}else if(dx||dy)move(t,dx,dy,step)}
 for(let i=neutrals.length-1;i>=0;i--){let p=neutrals[i];if(dist(t,p)<34&&t.carry.length<MAX_CARRY){neutrals.splice(i,1);t.carry.push({...p,phase:rand()*7});if(t.id===0)beep(420+t.carry.length*12,.025,.013)}}
 t.carry.forEach((p,i)=>{let a=i*2.3999,r=28+Math.sqrt(i)*13,tx=t.x+Math.cos(a)*r,ty=t.y+Math.sin(a)*r*.7+22;p.x+=(tx-p.x)*Math.min(1,step*7);p.y+=(ty-p.y)*Math.min(1,step*7)});
 const zone=zones.find(z=>(z.type==='cheer'||(z.team===t.id&&t.size<MAX_SIZE))&&inside(t,z));if(zone&&t.deposit<=0)deposit(t,zone);
 }
 }
 // Group by deployment pad once; unopposed crowds never scan other crowds.
 refreshSupport();
 for(const z of zones){if(z.type!=='cheer')continue;for(let team=0;team<2;team++){const friends=z.groups[team],enemies=z.groups[1-team];for(let i=0;i<friends.length;i++){const f=friends[i],a=f.slot*Math.PI*14,r=8+f.slot*22;let tx=z.x+z.w/2+Math.cos(a)*r,ty=z.y+z.h/2+16+Math.sin(a)*r*.6;if(enemies.length){const e=enemies[i%enemies.length];tx=e.x;ty=e.y}let dx=tx-f.x,dy=ty-f.y,d=Math.hypot(dx,dy);if(d>3){let stepSize=Math.min(d,65*step);f.x+=dx/d*stepSize;f.y+=dy/d*stepSize}}}}
 if(clashClock>.45){clashClock=0;const dead=new Set();for(const z of zones){if(!z.groups[0].length||!z.groups[1].length)continue;for(const f of z.groups[0]){const enemy=z.groups[1].find(g=>!dead.has(g)&&dist(g,f)<21);if(enemy){dead.add(f);dead.add(enemy);pop((f.x+enemy.x)/2,f.y,'✦','#f7ce72')}}}if(dead.size){fans=fans.filter(f=>{if(dead.has(f)){teams[f.team].cheer--;return false}return true});refreshSupport()}}
 for(const t of teams){let foot=t.cheer*.35+support(t,'hook')*.5,fighting=phase==='fight';let orbit=fighting?elapsed*(.7+Math.min(foot,25)*.045):0,travel=fighting?Math.min(40,foot*4):0;let targetX=720+(t.id?1:-1)*(18+Math.min(30,(teams[0].size+teams[1].size)*.55))+Math.sin(orbit)*travel,targetY=410+Math.cos(orbit)*travel*.6+(t.dodge>0?18:0);t.bx+=(targetX-t.bx)*Math.min(1,step*(2+foot*.12));t.by+=(targetY-t.by)*Math.min(1,step*(2+foot*.12))}
 if(phase==='fight'&&roundKnockout===null){
 for(const t of teams){t.cooldown-=step;if(t.cooldown<=0){let total=5+t.cheer*.5,roll=rand()*total;t.attack='jab';for(const punch of punches){roll-=(punch==='jab'?2:1)+support(t,punch)*.5;if(roll<=0){t.attack=punch;break}}const stats=attackStats(t,t.attack);t.cooldown=stats.recovery;t.punch=1;t.strike={...stats,attack:t.attack,resolved:false};}}
 for(const t of teams){const h=t.strike;if(!h||h.resolved||t.punch>.55)continue;const e=teams[1-t.id];if(e.hp<=0)continue;const contact=window.strikePose?window.strikePose(t,e):{contact:t.punch<.55,glove:{x:e.bx,y:65,z:(e.by-425)*Math.SQRT2}};if(!contact.contact){if(t.punch<.18){h.resolved=true;pop(e.bx,e.by-50,'MISS','#d2ddd4')}continue}h.resolved=true;
 const guard=support(e,'hook'),accuracy=support(t,h.attack);if(rand()<Math.min(.4,Math.max(0,(guard*.016+e.cheer*.002)*(h.dodgeFactor||1)-accuracy*.002))){e.dodge=.4;pop(e.bx,e.by-55,'SLIP',colors[e.id]);continue}
 const critical=h.attack==='uppercut'&&rand()<Math.min(.4,.05+support(t,'uppercut')*.018);if(critical)h.damage*=1.6;const dealt=Math.min(e.hp,h.damage);e.hp=Math.max(0,e.hp-h.damage);t.damage+=dealt;roundDamage[t.id]+=dealt;e.flash=.09;e.recoil=critical?1.4:h.recoil;
 const hitX=contact.glove.x,hitY=425+contact.glove.z/Math.SQRT2-contact.glove.y/Math.SQRT2;impactBursts.push({x:hitX,y:hitY,age:0,life:critical?.32:.22,heavy:critical||h.attack==='cross'||h.attack==='uppercut',color:colors[t.id],dir:t.id?-1:1});cameraShake=Math.max(cameraShake,critical?5:h.attack==='jab'?1:3);impactFreeze=critical?.055:.025;
 pop(hitX,hitY-15,critical?'CRITICAL!':'−'+Math.round(dealt),critical?'#ffdd83':'#fff1ce');punchSound(h.attack,critical);
 }
 if(teams.some(t=>t.hp<=0)){roundKnockout=teams[0].hp<=0&&teams[1].hp<=0?-1:teams[0].hp>0?0:1;roundMessage=`ROUND ${round} · ${roundKnockout<0?'DOUBLE KO':roundKnockout===0?'YOU WIN BY KO':rivalName()+' WINS BY KO'} · WAIT FOR BELL`;messageUntil=elapsed+11;teams.forEach(t=>t.punch=0)}}

 fx.forEach(p=>{p.life-=step;p.y-=step*28});fx=fx.filter(p=>p.life>0);if(time<=.000001)advancePhase();updateHUD()}
function finish(winner,reason){if(state==='end')return;if(mode==='ai'){completedAiMatches++;try{localStorage.setItem('crowdBoxing.completedAiMatches.v1',String(completedAiMatches))}catch{}}state='end';pointer=null;document.getElementById("hud").hidden=true;document.getElementById("roundNotice").hidden=true;$('result').hidden=false;$('resultType').textContent=reason;$('resultTitle').textContent=winner<0?'MATCH DRAW':winner===0?'YOU WIN THE MATCH':rivalName()+' WINS THE MATCH';$('finalScore').textContent=`${wins(0)} — ${wins(1)}`;$('finalLabels').textContent=`YOU                         ${rivalName()}`;$('roundBreakdown').textContent=roundResults.map(r=>`ROUND ${r.round}    ${r.winner<0?'DRAW':r.winner===0?'YOU WIN':rivalName()+' WINS'}${r.knockout?' · KO':''}\nDamage dealt: YOU ${r.percentages[0].toFixed(1)}% · ${rivalName()} ${r.percentages[1].toFixed(1)}%`).join('\n\n');$('resultText').textContent=winner<0?'Both corners won the same number of rounds.':'Most rounds won decides the match.';beep(winner===0?700:180,.4)}
function setText(id,value){const el=$(id);if(el.textContent!==value)el.textContent=value}
function updateHUD(){$('hud').className=phase+'-hud '+(mode==='local'?'local-mode':'ai-mode');for(let i=0;i<2;i++){let t=teams[i],prefix=i?'red':'blue',width=Number(Math.max(0,t.hp/t.maxHp*100).toFixed(1))+'%';if($(prefix+'Health').style.width!==width)$(prefix+'Health').style.width=width;setText(prefix+'Hearts',Array.from({length:3},(_,j)=>t.hp/t.maxHp>j/3?'♥':'♡').join(' '));document.getElementById(prefix+'Stats').setAttribute('data-full',String(t.carry.length===MAX_CARRY));setText(prefix+'Stats',`CROWD ${t.carry.length}/${MAX_CARRY}${t.carry.length===MAX_CARRY?' MAX → DEPLOY':''}`)}setText('time',`0:${String(Math.ceil(time)).padStart(2,'0')}`);setText('phase',phase==='gather'?'GATHER':'FIGHT');setText('roundLabel',`ROUND ${round} / 3`);setText('roundScore',`ROUNDS ${wins(0)} — ${wins(1)}`);setText('roundHistory',Array.from({length:3},(_,i)=>{const r=roundResults[i];return `R${i+1} ${!r?'—':r.winner<0?'DRAW':r.winner===0?'YOU':rivalName()}`}).join('  ·  '));setText('roundNotice',state==='play'&&elapsed<messageUntil?roundMessage:'');$('roundNotice').hidden=!(state==='play'&&elapsed<messageUntil)}
function rr(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke()}}
function ellipse(x,y,rx,ry,c){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=c;ctx.fill()}
function line(x,y,x2,y2,c,width=2){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.strokeStyle=c;ctx.lineWidth=width;ctx.stroke()}
function text(s,x,y,size,color,align='center',font='DM Sans'){ctx.fillStyle=color;ctx.font=`700 ${size}px "${font}",Arial`;ctx.textAlign=align;ctx.fillText(s,x,y)}
function drawPerson(x,y,color,s=1,phase=0,leader=false,cheering=false){ctx.save();ctx.translate(x,y);ctx.scale(s,s);let bob=Math.sin(elapsed*9+phase)*1.3;ellipse(3,4,11,4,'#1b273438');line(-4,-5,-5,2,'#334451',5);line(4,-5,5,2,'#334451',5);let g=ctx.createLinearGradient(-8,0,9,0);g.addColorStop(0,color);g.addColorStop(1,color==='#91a5a8'?'#d1d9dc':'#d2e9f0');rr(-8,-23+bob,16,20,7,g);line(-9,-17+bob,-12,cheering?-34+bob:-9+bob,color,5);line(9,-17+bob,12,cheering?-34+bob:-9+bob,color,5);ellipse(0,-29+bob,7,7,'#e6c3a3');ellipse(0,-32+bob,7,4,color);if(leader){ctx.strokeStyle='#ffe39c';ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(0,3,17,8,0,0,7);ctx.stroke();text('▼',0,-48,14,'#f7ce72')}ctx.restore()}
// Reuse pre-rendered people rather than rebuilding body paths and gradients per unit.
function person(x,y,color,s=1,phase=0,leader=false,cheering=false){if(window.Boxing3D){window.Boxing3D.addPerson(x,y,color,s,phase,leader,cheering,elapsed);if(leader){ctx.strokeStyle='#ffe39c';ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(x,y+3,17*s,8*s,0,0,7);ctx.stroke();text('▼',x,y-50*s,14,'#f7ce72')}return}const key=color+(cheering?'cheer':'walk');let image=spriteCache.get(key);if(!image){image=document.createElement('canvas');image.width=64;image.height=100;const main=ctx;ctx=image.getContext('2d');drawPerson(32,80,color,1,0,false,cheering);ctx=main;spriteCache.set(key,image)}ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.drawImage(image,-32,-80+Math.sin(elapsed*9+phase)*1.3);if(leader){ctx.strokeStyle='#ffe39c';ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(0,3,17,8,0,0,7);ctx.stroke();text('▼',0,-48,14,'#f7ce72')}ctx.restore()}
function boxer(t){if(!t.active)return;if(window.Boxing3D){window.Boxing3D.addBoxer(t,elapsed,phase,teams[1-t.id]);text(`LV ${t.size}`,t.bx,t.by+25,10,colors[t.id]);if(phase==='fight'&&t.punch>.5)text(t.attack.toUpperCase(),t.bx,t.by-(.34+Math.min(t.size,45)*.023)*145,10,colors[t.id]);return}const s=.34+Math.min(t.size,45)*.023;let x=t.bx,y=t.by,bob=Math.sin(elapsed*5)*2,dir=t.id?-1:1;ctx.save();ctx.translate(x,y);ctx.scale(s,s);ellipse(0,7,30,10,'#1e293b40');line(-12,-4,-15,12,'#374654',13);line(12,-4,15,12,'#374654',13);rr(-23,-41,46,40,10,t.flash?'#fff0cf':colors[t.id]);rr(-24,-18,48,13,3,'#e9e8df');rr(-25,-66+bob,50,49,20,t.flash?'#fff1d7':'#dbac8c');ellipse(0,-82+bob,20,22,'#ecc4a1');ellipse(0,-96+bob,20,9,colors[t.id]);line(-7,-83,7,-83,'#755448',2);let reach=t.punch*(t.attack==='cross'?48:t.attack==='jab'?42:30);line(-22,-56,-31,-39,'#dbac8c',16);line(22,-56,dir===1?41+reach:31,-58,'#dbac8c',17);ellipse(-31,-39,15,16,colors[t.id]);ellipse(dir===1?41+reach:31,-58,16,17,colors[t.id]);if(dir<0){line(-22,-56,-41-reach,-58,'#dbac8c',17);ellipse(-41-reach,-58,16,17,colors[t.id])}ctx.restore();text(`LV ${t.size}`,x,y+25,10,colors[t.id]);if(phase==='fight'&&t.punch>.65)text(t.attack.toUpperCase(),x,y-120*s,9,colors[t.id])}
function draw(){if(window.Boxing3D)window.Boxing3D.begin();ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#202935';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();ctx.save();ctx.translate(cameraView.ox+Math.sin(elapsed*143)*cameraShake,cameraView.oy+Math.cos(elapsed*119)*cameraShake*.5);ctx.scale(cameraView.scale,cameraView.scale);
 ctx.drawImage(getGround(),0,0);
 zones.forEach(z=>{let counts=z.counts;let owner=z.type==='size'?z.team:-1;let c=owner<0?'#e3c77f':colors[owner],occupied=phase==='gather'&&teams.some(t=>inside(t,z)&&t.carry.length&&(z.type==='cheer'||(z.team===t.id&&t.size<MAX_SIZE)));rr(z.x,z.y+6,z.w,z.h,10,'#50686b');rr(z.x,z.y,z.w,z.h,10,occupied?'#f7ce7250':owner<0?'#9b9e89':owner?'#835c59':'#4c778e',occupied?'#f7ce72':c);ctx.setLineDash([5,5]);rr(z.x+5,z.y+5,z.w-10,z.h-10,6,null,c+'88');ctx.setLineDash([]);if(z.type==='size'){text(teams[z.team].size>=MAX_SIZE?'MAX':'↑ SIZE',z.x+z.w/2,z.y+30,15,'#f7ce72');text(teams[z.team].size>=MAX_SIZE?'SIZE COMPLETE':'HEALTH + GROWTH',z.x+z.w/2,z.y+49,8,'#f1eadc')}else{text('+',z.x+z.w/2,z.y+44,24,'#c5cbbb88');cheerGroundStats(z)}});
 // Ring plinth and mat.
 rr(541,280,358,252,12,'#263c4c88');rr(550,272,340,246,8,'#293f50');rr(550,262,340,236,8,'#eddcb4');rr(561,272,318,211,3,'#357b86');ctx.save();ctx.beginPath();ctx.rect(561,272,318,211);ctx.clip();ctx.fillStyle='#51b6ea13';ctx.fillRect(561,272,159,211);ctx.fillStyle='#ed7d7013';ctx.fillRect(720,272,159,211);ctx.restore();ellipse(720,386,60,42,'#d5ddd01f');text('CB',720,403,56,'#5c747b22','center','Barlow Condensed');text('BOXING FIELD',720,471,10,'#5f777e');
 const posts=[{x:558,y:278},{x:882,y:278},{x:558,y:492},{x:882,y:492}];for(let h of [14,29,44]){line(558,278-h,882,278-h,'#fff0c9',3);line(558,278-h,558,492-h,'#65b6db',3);line(882,278-h,882,492-h,'#e6a29a',3)}posts.slice(0,2).forEach(p=>{line(p.x,p.y+4,p.x,p.y-53,'#425d6c',8);ellipse(p.x,p.y-53,5,3,'#d8dfda')});
 // Sort references, without cloning every unit on every frame.
 const people=peopleBuffer;people.length=0;
 for(const p of neutrals){p.color='#91a5a8';p.s=.93;p.leader=false;p.cheering=false;people.push(p)}
 for(const t of teams){for(const p of t.carry){p.color=colors[t.id];p.s=1;p.leader=false;p.cheering=false;people.push(p)}t.color=colors[t.id];t.s=1.28;t.leader=true;t.cheering=false;people.push(t)}
 for(const f of fans){f.color=colors[f.team];f.s=1;f.leader=false;f.cheering=state==='play'&&phase==='fight'&&roundKnockout===null;people.push(f)}people.sort((a,b)=>a.y-b.y);
 for(const p of people)if(p.y<272)person(p.x,p.y,p.color,p.s,p.phase,p.leader,p.cheering);
 boxer(teams[0]);boxer(teams[1]);for(let h of [14,29,44])line(558,492-h,882,492-h,'#fff0c9',3);posts.slice(2).forEach(p=>{line(p.x,p.y+4,p.x,p.y-53,'#425d6c',8);ellipse(p.x,p.y-53,5,3,'#d8dfda')});
 for(const p of people)if(p.y>=272)person(p.x,p.y,p.color,p.s,p.phase,p.leader,p.cheering);
 if(window.Boxing3D){ctx.drawImage(window.Boxing3D.render(),0,0,W,H);for(let h of [14,29,44])line(558,492-h,882,492-h,'#fff0c9',3)}



 if(state==='play'&&phase==='gather')for(const t of teams)if(t.carry.length===MAX_CARRY&&(t.id===0||mode==='local')){ctx.save();ctx.translate(t.x,t.y-83);ctx.scale(1/cameraView.scale,1/cameraView.scale);rr(-62,-17,124,32,9,'#f8d36f','#ffe9ad');text('MAX · DEPLOY',0,4,13,'#263d48');ctx.restore()}
 if(state==='play'&&phase==='gather'&&pointer){ctx.save();ctx.translate((pointer.x-cameraView.ox)/cameraView.scale,(pointer.y-cameraView.oy)/cameraView.scale);ctx.scale(1/cameraView.scale,1/cameraView.scale);ellipse(0,0,48,48,'#ffffff12');ctx.strokeStyle='#ffffff66';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,48,0,Math.PI*2);ctx.stroke();ellipse(pointer.dx*34,pointer.dy*34,17,17,'#f7ce72bb');ctx.strokeStyle='#ffe7ac';ctx.beginPath();ctx.arc(pointer.dx*34,pointer.dy*34,17,0,Math.PI*2);ctx.stroke();ctx.restore()}
 for(const burst of impactBursts){const u=burst.age/burst.life,a=1-u,r=(burst.heavy?30:19)*(u+.25);ctx.save();ctx.translate(burst.x,burst.y);ctx.globalAlpha=a;ctx.strokeStyle='#fff1c6';ctx.lineWidth=3*a;ctx.beginPath();ctx.ellipse(0,0,r,r*.7,0,0,Math.PI*2);ctx.stroke();for(let i=0;i<7;i++){let angle=i*Math.PI*2/7;line(Math.cos(angle)*r*.45,Math.sin(angle)*r*.4,Math.cos(angle)*r,Math.sin(angle)*r*.8,i%2?'#fff2c4':burst.color,3*a)}ellipse(0,0,7*a,5*a,'#fff7d9');ctx.restore()}
 for(const p of fx){ctx.globalAlpha=Math.max(0,p.life);text(p.text,p.x,p.y,15,p.color)}ctx.globalAlpha=1;
 
 ctx.restore()}
function cheerGroundStats(z){const profile=attackProfiles[z.skill],bottom=z.y===555,left=z.x<720,w=88,h=23;const x=bottom?z.x+(z.w-w)/2:left?z.x-w+1:z.x+z.w-1,y=bottom?z.y+z.h-1:z.y+14;ctx.save();rr(x,y,w,h,bottom?[0,0,10,10]:left?[11,0,0,11]:[0,11,11,0],'#4c686a');text(z.skill.toUpperCase(),x+w/2,y+16,11,'#fff0ce');text(profile.damage+' DMG',x+w/2,y+h+19,10,'#344651');text(profile.recovery+' SEC',x+w/2,y+h+35,9,'#344651');ctx.restore()}
function getGround(){if(!groundCache){groundCache=document.createElement('canvas');groundCache.width=W;groundCache.height=H;const main=ctx;ctx=groundCache.getContext('2d');drawGround();ctx=main}return groundCache}
function drawGround(){
 const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#234c60');bg.addColorStop(1,'#163748');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 // A raised city plaza, lit from the upper left.
 rr(44,154,1352,653,36,'#182632');rr(39,142,1352,653,36,'#526e77');rr(49,151,1332,628,30,'#bdc8b9');
 ctx.save();rr(49,151,1332,628,30);ctx.clip();for(let x=50;x<1400;x+=62)line(x,150,x,790,'#f9f2da33',1);for(let y=150;y<800;y+=62)line(45,y,1390,y,'#f9f2da33',1);
 // Promenade markings.
 ctx.setLineDash([12,13]);rr(97,192,1246,545,29,null,'#dce4dd30');ctx.setLineDash([]);ctx.restore();
 text('NORTH PLAZA',720,211,10,'#dbe5df77');text('GATHERING GROUNDS',720,739,11,'#dbe5df88');
 // Planters, benches, street lights.
 for(const p of [{x:120,y:240},{x:1300,y:240},{x:120,y:683},{x:1300,y:683},{x:370,y:218},{x:1070,y:218}]){ellipse(p.x+5,p.y+8,29,11,'#344c5a38');rr(p.x-22,p.y-10,44,28,9,'#536a72');rr(p.x-21,p.y-18,42,27,8,'#b7c3bc');ellipse(p.x,p.y-16,18,12,'#536c69');ellipse(p.x-5,p.y-22,13,11,'#6f8a76')}
 for(let x of [260,1180]){rr(x-30,685,65,13,4,'#405966');rr(x-30,676,65,13,4,'#bd9363');line(x-20,686,x-20,700,'#405966',4);line(x+23,686,x+23,700,'#405966',4)}
}
if(document.fonts)document.fonts.ready.then(()=>{groundCache=null});
function updateCamera(dt){const gathering=state==='play'&&phase==='gather';const targetZoom=state==='play'?(gathering?(mode==='local'?1.2:1.65):1.35):1;const a=1-Math.exp(-dt*4.5);cameraView.zoom+=(targetZoom-cameraView.zoom)*a;const targetX=gathering&&mode!=='local'?teams[0].x:720,targetY=gathering&&mode!=='local'?teams[0].y+65:state==='play'&&phase==='fight'?400:425;const halfW=Math.min(W/2,innerWidth/(scale*cameraView.zoom*2)),halfH=Math.min(H/2,innerHeight/(scale*cameraView.zoom*2));const x=clamp(targetX,halfW,W-halfW),y=clamp(targetY,halfH,H-halfH);cameraView.x+=(x-cameraView.x)*a;cameraView.y+=(y-cameraView.y)*a;cameraView.scale=scale*cameraView.zoom;cameraView.ox=innerWidth/2-cameraView.x*cameraView.scale;cameraView.oy=innerHeight/2-cameraView.y*cameraView.scale}
function frame(ms){let dt=Math.min((ms-last)/1000,.05);last=ms;update(dt);updateCamera(dt);if(state==='play'||ms-drawClock>=100){draw();drawClock=ms}requestAnimationFrame(frame)}
addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys[e.key]=true});addEventListener('keyup',e=>keys[e.key]=false);addEventListener('blur',()=>{keys={};pointer=null});
function releaseStick(e){if(!e||!pointer||e.pointerId===pointer.id)pointer=null}
canvas.addEventListener('pointerdown',e=>{if(state!=='play'||phase!=='gather'||pointer||e.button>0)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0};canvas.setPointerCapture(e.pointerId);e.preventDefault();beep(200,.015,.001)});
canvas.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;let dx=e.clientX-pointer.x,dy=e.clientY-pointer.y,length=Math.hypot(dx,dy),factor=length>34?34/length:1;pointer.dx=dx*factor/34;pointer.dy=dy*factor/34;e.preventDefault()});
canvas.addEventListener('pointerup',releaseStick);canvas.addEventListener('pointercancel',releaseStick);canvas.addEventListener('lostpointercapture',releaseStick);
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(a=>a.classList.toggle('selected',a===b));$('controls').textContent=mode==='ai'?'WASD / arrows · hold & drag for thumbstick':'Player 1: WASD / thumbstick · Player 2: arrow keys'});$('play').onclick=start;$('again').onclick=start;$('back').onclick=()=>{state='menu';$('menu').hidden=false;$('result').hidden=true;$('hud').hidden=true;reset()};
reset();requestAnimationFrame(frame);
// Small read-only inspection surface for balance and gameplay verification.
window.crowdBoxing={snapshot:()=>({state,mode,time,elapsed,difficulty:mode==='ai'?difficulty.label:null,matchNumber:completedAiMatches+(state==='end'?0:1),camera:{zoom:cameraView.zoom,x:cameraView.x,y:cameraView.y},round,phase,roundResults,roundWins:[wins(0),wins(1)],roundKnockout,neutralCount:neutrals.length,teams:teams.map(t=>({id:t.id,x:t.x,y:t.y,carrying:t.carry.length,size:t.size,cheer:t.cheer,hp:t.hp,maxHp:t.maxHp,active:t.active,total:t.total,maxCarry:MAX_CARRY,full:t.carry.length===MAX_CARRY,jab:support(t,"jab"),cross:support(t,"cross"),hook:support(t,"hook"),uppercut:support(t,"uppercut")})),fans:fans.length})};




















