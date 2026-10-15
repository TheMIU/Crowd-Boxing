const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const Three=require('./three.min.js');let renderedScene;
class TestRenderer{constructor(){this.domElement={addEventListener(){}}}setSize(){}setPixelRatio(){}setClearColor(){}render(scene){renderedScene=scene}}
const context={THREE:{...Three,WebGLRenderer:TestRenderer},window:{},console,Math};vm.createContext(context);vm.runInContext(fs.readFileSync('characters3d.js','utf8'),context);
const pose=context.window.punchPose,graphics=context.window.Boxing3D;
assert.ok(pose('jab',.5).leadX>pose('jab',0).leadX+60,'Jab extends the lead glove');
assert.ok(pose('cross',.5).rearX>pose('cross',0).rearX+70,'Cross drives the rear glove');
assert.ok(Math.abs(pose('hook',.25).leadZ-pose('hook',0).leadZ)>25,'Hook sweeps sideways');
assert.ok(pose('uppercut',.5).rearY>pose('uppercut',0).rearY+30,'Uppercut rises');
for(const attack of ['jab','cross','hook','uppercut'])for(const progress of [.1,.4,.8]){
 graphics.begin();for(let i=0;i<200;i++)graphics.addPerson(100+i*5,300+i%10,'#54b7ef',1,i%3,false,i%2===0,1);
 for(let id=0;id<2;id++)graphics.addBoxer({id,size:20,bx:690+id*60,by:410,attack,punch:1-progress,flash:0},2,'fight');
 graphics.render();const meshes=renderedScene.children.filter(o=>o.isInstancedMesh);assert.equal(meshes.length,3,'Crowd uses three instanced batches');
 for(const mesh of meshes){assert.ok(mesh.count>0);assert.ok(mesh.count<=mesh.instanceMatrix.count);for(const n of mesh.instanceMatrix.array.subarray(0,mesh.count*16))assert.ok(Number.isFinite(n),'Finite 3D transforms')}
}
const contact=context.window.strikePose;
const attacker={id:0,bx:700,by:410,size:20,attack:'jab',punch:1},defender={id:1,bx:760,by:410,size:20};
assert.equal(contact(attacker,defender).contact,false,'Resting glove does not hit');attacker.punch=.5;assert.equal(contact(attacker,defender).contact,true,'Extended glove reaches opponent');defender.bx=1200;assert.equal(contact(attacker,defender).contact,false,'Glove has finite reach');
console.log('PASS: shared glove-contact geometry, finite reach, four punch trajectories, 200-person crowds and three render batches.');
