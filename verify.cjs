const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const nodes=new Map(),node=()=>({hidden:false,style:{},classList:{toggle(){}},handlers:{},addEventListener(name,handler){this.handlers[name]=handler},setAttribute(){},setPointerCapture(){},textContent:''});
const context={console,Math,Set,Array,String,Infinity,setTimeout(){},devicePixelRatio:1,innerWidth:1280,innerHeight:720,addEventListener(){},requestAnimationFrame(){},document:{getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)},querySelectorAll(){return[]}},window:{}};
nodes.set('game',{...node(),getContext(){return{setTransform(){}}}});vm.createContext(context);vm.runInContext(fs.readFileSync('characters3d.js','utf8'),context);vm.runInContext(fs.readFileSync('game.js','utf8'),context);
const run=code=>vm.runInContext(code,context);
run('start()');assert.ok(run('teams.every(t=>t.active&&t.size===0)'));assert.equal(run('time'),30);assert.equal(run('zones.filter(z=>z.type==="cheer").length'),8);
run('neutrals=[{x:teams[0].x,y:teams[0].y,phase:0}];update(.016)');assert.equal(run('teams[0].carry.length'),1);
run('teams[0].x=470;teams[0].y=290;update(.2)');assert.equal(run('teams[0].size'),1);assert.equal(run('teams[0].maxHp'),119);
run('teams[0].carry.push({x:310,y:430});teams[0].x=470;teams[0].y=383;update(.2)');assert.equal(run('fans[0].zone'),'left-jab-0');assert.equal(run('support(teams[0],"jab")'),1);
run('teams[0].carry.push({x:640,y:700});teams[0].x=470;teams[0].y=478;update(.2)');assert.equal(run('fans[1].zone'),'left-cross-0');assert.equal(run('support(teams[0],"cross")'),1);
run('teams[1].carry.push({x:480,y:700});teams[1].x=770;teams[1].y=593;update(.2)');assert.equal(run('fans[2].zone'),'right-hook-0');assert.equal(run('support(teams[1],"hook")'),1);
run('fans=[{team:0,x:310,y:430,phase:0,slot:0,zone:"left-jab-0"},{team:1,x:311,y:430,phase:0,slot:0,zone:"left-jab-0"}];teams[0].cheer=1;teams[1].cheer=1;clashClock=1;update(.016)');assert.equal(run('fans.length'),0);
run('mode="local";start();for(let i=0;i<599;i++)update(.05)');assert.equal(run('phase'),'gather');assert.equal(run('teams[0].hp'),100);run('update(.05)');assert.equal(run('phase'),'fight');assert.equal(run('time'),10);
run('neutrals=[{x:310,y:315}];teams[0].carry=[{x:310,y:315}];teams[0].x=310;teams[0].y=315;keys={d:true};update(.05)');assert.equal(run('teams[0].x'),310);assert.equal(run('teams[0].carry.length'),1);assert.equal(run('teams[0].size'),0);assert.equal(run('neutrals.length'),1);
run('for(let i=0;i<199;i++)update(.05)');assert.equal(run('phase'),'gather');assert.equal(run('round'),2);assert.equal(run('time'),30);assert.ok(run('teams[0].hp===100&&teams[1].hp===100'));
run('start();mode="local";neutrals=[];for(let i=0;i<2399;i++)update(.05)');assert.equal(run('round'),3);assert.equal(run('phase'),'fight');assert.equal(run('state'),'play');run('update(.05)');assert.equal(run('state'),'end');
run('start();phase="fight";time=10;teams[1].hp=.1;teams[0].cooldown=0;update(.05)');assert.equal(run('state'),'play');
run('mode="local";start();keys={d:true,ArrowLeft:true};let left=teams[0].x,right=teams[1].x;update(.05);if(!(teams[0].x>left&&teams[1].x<right))throw Error("Local controls failed")');
run('start();mode="ai";for(let i=0;i<600;i++)update(.05)');assert.ok(run('teams[1].total>5'));
run('mode="local";start();phase="fight";seed=1;teams[0].cooldown=0;update(.05)');const baseCooldown=run('teams[0].cooldown');
run('start();phase="fight";seed=1;fans=Array.from({length:10},(_,i)=>({team:0,x:600,y:700,phase:0,slot:i/10,zone:"left-jab-0"}));teams[0].cheer=10;teams[0].cooldown=0;update(.05)');assert.ok(run('teams[0].cooldown')<baseCooldown,'Jab supporters increase attack rate');
run('start();phase="fight";seed=10;teams.forEach(t=>t.size=20);fans=Array.from({length:30},(_,i)=>({team:1,x:310,y:430,phase:0,slot:i/30,zone:"right-hook-0"}));teams[1].cheer=30;teams[0].cooldown=0;for(let i=0;i<6;i++)update(.05)');assert.equal(run('teams[1].hp'),100);assert.ok(run('teams[1].dodge')>0,'Hook supporters enable dodges');
run('start();phase="fight";seed=1;fans=Array.from({length:10},(_,i)=>({team:0,x:480,y:700,phase:0,slot:i/10,zone:"left-hook-0"}));teams[0].cheer=10;for(let i=0;i<20;i++)update(.05)');assert.ok(run('Math.abs(teams[0].bx-690)')>5,'Hook support improves movement around the ring');
run('mode="local";start();neutrals=Array.from({length:30},()=>({x:teams[0].x,y:teams[0].y,phase:0}));update(.05)');assert.equal(run('teams[0].carry.length'),15,'Cannot carry more than 15');assert.equal(run('neutrals.length'),15);assert.ok(nodes.get('blueStats').textContent.includes('MAX → DEPLOY'),'Full crowd shows MAX and deployment guidance');
run('update(.05)');assert.equal(run('teams[0].carry.length'),15,'No collection while full');
run('deposit(teams[0],zones[0]);updateHUD()');assert.equal(run('teams[0].carry.length'),14);assert.ok(!nodes.get('blueStats').textContent.includes('MAX'),'MAX clears after deploying');
run('update(.05)');assert.equal(run('teams[0].carry.length'),15,'Can recruit again after making room');
assert.equal(run('zones.filter(z=>z.type==="size").length'),2);
for(const punch of ['jab','cross','hook','uppercut'])assert.equal(run(`zones.filter(z=>z.type==='cheer'&&z.skill==='${punch}').length`),2,'Two of each punch total');
run('start();phase="fight";seed=1;teams.forEach(t=>t.size=20);teams[0].cooldown=0;for(let i=0;i<8;i++)update(.05)');const baseDamage=run('teams[0].damage');
run('start();phase="fight";seed=1;teams.forEach(t=>t.size=20);fans=Array.from({length:30},(_,i)=>({team:0,x:350,y:498,phase:0,slot:i/30,zone:"left-cross-0"}));teams[0].cheer=30;teams[0].cooldown=0;for(let i=0;i<8;i++)update(.05)');assert.equal(run('teams[0].attack'),'cross');assert.ok(run('teams[0].damage')>baseDamage,'Cross training increases punch power');
run('start();phase="fight";seed=2;teams.forEach(t=>t.size=20);fans=Array.from({length:30},(_,i)=>({team:0,x:350,y:688,phase:0,slot:i/30,zone:"left-uppercut-0"}));teams[0].cheer=30;teams[0].cooldown=0;for(let i=0;i<8;i++)update(.05)');assert.equal(run('teams[0].attack'),'uppercut');assert.ok(run('fx.some(p=>p.text.includes("CRITICAL!"))'),'Uppercut training enables critical punches');
run('mode="local";start();advancePhase();roundDamage=[30,20];advancePhase()');assert.equal(run('wins(0)'),1);assert.equal(run('round'),2);assert.ok(nodes.get('roundNotice').textContent.includes('YOU WIN'));
run('advancePhase();roundDamage=[30,20];advancePhase()');assert.equal(run('wins(0)'),2);assert.equal(run('state'),'play','Two wins do not end the match before round three');
run('advancePhase();roundDamage=[0,100];advancePhase()');assert.equal(run('state'),'end');assert.equal(run('wins(0)'),2);assert.equal(run('wins(1)'),1);assert.equal(nodes.get('finalScore').textContent,'2 — 1');assert.equal(nodes.get('resultTitle').textContent,'YOU WIN THE MATCH','Round wins outweigh cumulative damage');assert.ok(nodes.get('roundBreakdown').textContent.includes('ROUND 3'));
run('start();advancePhase();roundKnockout=1;advancePhase()');assert.equal(run('wins(1)'),1);assert.equal(run('state'),'play');assert.ok(run('teams.every(t=>t.hp===t.maxHp)'),'Health resets for the next round');
run('start();for(let i=0;i<3;i++){advancePhase();roundDamage=[10,10];advancePhase()}');assert.equal(nodes.get('resultTitle').textContent,'MATCH DRAW');assert.equal(run('roundResults.length'),3);
run('mode="local";start()');const canvasNode=nodes.get('game'),event=(pointerId,clientX,clientY)=>({pointerId,clientX,clientY,button:0,preventDefault(){}});
canvasNode.handlers.pointerdown(event(1,120,250));const startX=run('teams[0].x');run('update(.05)');assert.equal(run('teams[0].x'),startX,'Pressing without dragging does not move');
canvasNode.handlers.pointermove(event(2,220,250));assert.equal(run('pointer.dx'),0,'Other fingers do not steer');
canvasNode.handlers.pointermove(event(1,220,250));assert.equal(run('pointer.dx'),1,'Stick displacement clamps to its radius');run('update(.05)');assert.ok(run('teams[0].x')>startX,'Dragging right moves right');
canvasNode.handlers.pointerup(event(2,220,250));assert.ok(run('pointer!==null'),'Other finger release does not stop active stick');canvasNode.handlers.pointerup(event(1,220,250));const stopX=run('teams[0].x');run('update(.05)');assert.equal(run('teams[0].x'),stopX,'Releasing stops movement');
canvasNode.handlers.pointerdown(event(3,120,250));canvasNode.handlers.pointercancel(event(3,120,250));assert.equal(run('pointer'),null);
canvasNode.handlers.pointerdown(event(4,120,250));canvasNode.handlers.lostpointercapture(event(4,120,250));assert.equal(run('pointer'),null);
canvasNode.handlers.pointerdown(event(5,120,250));run('advancePhase()');assert.equal(run('pointer'),null,'Bell clears stick');canvasNode.handlers.pointerdown(event(6,120,250));assert.equal(run('pointer'),null,'Fight blocks stick input');
run('mode="ai";start();updateCamera(1)');const gatherZoom=run('cameraView.zoom'),gatherX=run('cameraView.x');run('teams[0].x=850;updateCamera(1)');assert.ok(run('cameraView.x')>gatherX,'Gather camera follows captain');
run('advancePhase();updateCamera(.1)');assert.ok(run('cameraView.zoom')<gatherZoom,'Fight smoothly zooms out');assert.ok(run('cameraView.zoom')>1.35,'Camera transition is gradual');run('updateCamera(2)');assert.ok(Math.abs(run('cameraView.x')-720)<1);assert.ok(Math.abs(run('cameraView.zoom')-1.35)<.01,'Fight view centers ring at wider zoom');
run('mode="local";start();updateCamera(2)');assert.ok(Math.abs(run('cameraView.x')-720)<1,'Local PvP keeps a shared view');
run('mode="local";start();phase="fight";seed=1;teams[0].bx=700;teams[1].bx=740;teams[0].cooldown=0;teams[1].cooldown=999;update(.01)');assert.equal(run('teams[1].hp'),100,'Wind-up does not cause instant damage');run('for(let i=0;i<9;i++)update(.02)');assert.ok(run('teams[1].hp')<100,'Glove contact causes damage');assert.ok(run('teams[1].recoil')>0,'Contact makes defender recoil');assert.ok(run('impactBursts.length')>0,'Contact produces localized impact');
run('start();phase="fight";seed=1;teams[0].bx=400;teams[1].bx=1100;teams[0].cooldown=0;teams[1].cooldown=999;for(let i=0;i<10;i++)update(.04)');assert.equal(run('teams[1].hp'),100,'An out-of-range shot cannot deal damage');assert.ok(run('teams[0].strike.resolved'),'Missed shots resolve');
run('start();refreshSupport()');const baseline=run('Object.fromEntries(punches.map(p=>[p,attackStats(teams[0],p)]))');
assert.ok(baseline.jab.damage<baseline.hook.damage&&baseline.hook.damage<baseline.cross.damage&&baseline.cross.damage<baseline.uppercut.damage,'Distinct damage roles');assert.ok(baseline.jab.recovery<baseline.hook.recovery&&baseline.hook.recovery<baseline.cross.recovery&&baseline.cross.recovery<baseline.uppercut.recovery,'Heavy shots recover more slowly');assert.ok(baseline.hook.dodgeFactor<baseline.jab.dodgeFactor,'Hook is harder to evade');assert.ok(run('attackDurations.uppercut')>run('attackDurations.jab')*2,'Uppercut has a deliberate wind-up');
for(const punch of ['jab','cross','hook','uppercut']){run(`start();fans=Array.from({length:12},(_,i)=>({team:0,zone:zones.find(z=>z.skill==='${punch}').id,slot:i/12,x:0,y:0,phase:0}));refreshSupport()`);const trained=run(`attackStats(teams[0],'${punch}')`);assert.ok(trained.damage>baseline[punch].damage);assert.ok(trained.recovery<baseline[punch].recovery);for(const other of ['jab','cross','hook','uppercut'].filter(p=>p!==punch))assert.equal(run(`attackStats(teams[0],'${other}').damage`),baseline[other].damage,'Training improves its own punch, not unrelated punches');}
assert.equal(run('zones.filter(z=>z.type==="cheer"&&z.y===555).sort((a,b)=>a.x-b.x).map(z=>z.skill).join(",")'),'hook,uppercut,hook,uppercut');
run('mode="ai";completedAiMatches=0;start()');assert.equal(run('difficulty.label'),'EASY');run('start()');assert.equal(run('difficulty.label'),'EASY','Restarting an unfinished match keeps its difficulty');
for(const next of ['HARDER','MEDIUM','MEDIUM']){run('for(let i=0;i<3;i++){advancePhase();roundDamage=[10,5];advancePhase()}');assert.equal(run('state'),'end');run('start()');assert.equal(run('difficulty.label'),next);}
const completedBeforePvP=run('completedAiMatches');run('mode="local";start();for(let i=0;i<3;i++){advancePhase();roundDamage=[10,5];advancePhase()}');assert.equal(run('completedAiMatches'),completedBeforePvP,'PvP does not advance AI difficulty');
const deployments=[];for(const completed of [0,1,2])deployments.push(run(`mode='ai';completedAiMatches=${completed};start();for(let i=0;i<600;i++)update(.05);teams[1].total`));assert.ok(deployments[0]<deployments[2]&&deployments[2]<deployments[1],'Opening economy scales easy < medium < harder');
run('mode="local";start();teams[0].size=MAX_SIZE-1;teams[0].carry=Array.from({length:3},()=>({x:470,y:260}));deposit(teams[0],zones[0])');assert.equal(run('teams[0].size'),45);const cappedHealth=run('teams[0].maxHp');run('deposit(teams[0],zones[0])');assert.equal(run('teams[0].carry.length'),2,'Max size pad preserves recruits');assert.equal(run('teams[0].maxHp'),cappedHealth,'No health upgrades after cap');assert.equal(run('teams[0].size'),45);
run('deposit(teams[0],zones.find(z=>z.skill==="jab"))');assert.equal(run('teams[0].carry.length'),1,'Punch pads still accept recruits');
run('mode="ai";start();teams[1].size=MAX_SIZE;teams[1].target=zones[1];teams[1].carry=Array.from({length:15},()=>({x:970,y:260}));time=20;ai(teams[1],0)');assert.equal(run('teams[1].target.type'),'cheer','AI redirects away from maxed size pad');
console.log('PASS: max-size cap and recruit preservation, AI redirection, difficulty progression, punch roles, scoring and controls.');











