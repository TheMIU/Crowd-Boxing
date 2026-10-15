/* Shared-geometry, locally bundled Three.js characters. No network needed at runtime. */
(() => {
  'use strict';
  function punchPose(type, progress) {
    const u=Math.max(0,Math.min(1,progress)),hit=Math.sin(Math.PI*u);
    const p={leadX:31,leadY:65,leadZ:12,rearX:20,rearY:66,rearZ:-15,twist:0,lean:0};
    if(type==='jab'){p.leadX+=66*hit;p.leadY+=3*hit;p.lean=4*hit;}
    else if(type==='cross'){p.rearX+=80*hit;p.rearY+=6*hit;p.rearZ+=27*hit;p.twist=.65*hit;p.lean=10*hit;}
    else if(type==='hook'){p.leadX+=48*hit;p.leadZ+=Math.sin(u*Math.PI*2)*34;p.leadY+=10*hit;p.twist=-.7*hit;}
    else if(type==='uppercut'){p.rearX+=39*hit;p.rearY+=Math.sin(Math.PI*u)*38-Math.sin(Math.PI*u*2)*18;p.rearZ+=12*hit;p.lean=-5*hit;p.twist=.3*hit;}
    return p;
  }
  function strikePose(t,e){
    const size=.34+Math.min(t.size,45)*.023,enemySize=.34+Math.min(e.size,45)*.023,side=t.id?-1:1,u=Math.max(0,Math.min(1,1-t.punch)),extension=Math.sin(Math.PI*u),rear=t.attack==='cross'||t.attack==='uppercut';
    const start={x:t.bx+side*(rear?20:31)*size,y:(rear?66:65)*size,z:(t.by-425)*Math.SQRT2+(rear?-15:12)*size};
    const target={x:e.bx-side*12*enemySize,y:Math.min((t.attack==='uppercut'?96:83)*enemySize,112*size),z:(e.by-425)*Math.SQRT2};
    const dx=target.x-start.x,dy=target.y-start.y,dz=target.z-start.z,length=Math.hypot(dx,dy,dz),reach=92*size;
    const reachFactor=Math.min(1,reach/Math.max(1,length));
    const glove={x:start.x+dx*extension*reachFactor,y:start.y+dy*extension*reachFactor,z:start.z+dz*extension*reachFactor};
    if(t.attack==='hook')glove.z+=Math.sin(u*Math.PI*2)*30*size;
    if(t.attack==='uppercut')glove.y-=Math.sin(u*Math.PI*2)*24*size;
    return {glove,target,contact:Math.hypot(glove.x-target.x,glove.y-target.y,glove.z-target.z)<(12*size+11*enemySize),rear};
  }
  window.strikePose=strikePose;
  window.punchPose=punchPose;
  if(typeof THREE==='undefined')return;
  try {
    const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
    renderer.setSize(1440,850);renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-720,720,425,-425,1,4000);
    camera.position.set(0,1000,1000);camera.lookAt(0,0,0);
    scene.add(new THREE.HemisphereLight(0xe7f4ff,0x52616c,1.5));
    const sun=new THREE.DirectionalLight(0xfff1d5,2.5);sun.position.set(-450,900,600);scene.add(sun);
    const rim=new THREE.DirectionalLight(0x8bbfff,1.1);rim.position.set(400,350,-500);scene.add(rim);
    const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.62,metalness:.03});
    const balls=new THREE.InstancedMesh(new THREE.SphereGeometry(1,14,10),material,8192);
    const limbs=new THREE.InstancedMesh(new THREE.CapsuleGeometry(1,1,3,8),material,4096);
    const shadows=new THREE.InstancedMesh(new THREE.SphereGeometry(1,12,6),new THREE.MeshBasicMaterial({color:0x233846,transparent:true,opacity:.17,depthWrite:false}),1024);
    for(const mesh of [balls,limbs,shadows]){mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;scene.add(mesh)}
    const dummy=new THREE.Object3D(),colorCache=new Map(),up=new THREE.Vector3(0,1,0),direction=new THREE.Vector3();
    const color=c=>{if(!colorCache.has(c))colorCache.set(c,new THREE.Color(c));return colorCache.get(c)};
    function sphere(mesh,x,y,z,sx,sy,sz,c){const i=mesh.count++;if(i>=mesh.instanceMatrix.count){mesh.count--;return}dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(c)mesh.setColorAt(i,color(c))}
    function bone(x1,y1,z1,x2,y2,z2,r,c){const i=limbs.count++;if(i>=limbs.instanceMatrix.count){limbs.count--;return}direction.set(x2-x1,y2-y1,z2-z1);const length=direction.length();dummy.position.set((x1+x2)/2,(y1+y2)/2,(z1+z2)/2);dummy.quaternion.setFromUnitVectors(up,direction.normalize());dummy.scale.set(r,Math.max(.1,length/3),r);dummy.updateMatrix();limbs.setMatrixAt(i,dummy.matrix);limbs.setColorAt(i,color(c))}
    function addPerson(x,y,c,s=1,phase=0,leader=false,cheering=false,elapsed=0){
      const X=x-720,Z=(y-425)*Math.SQRT2,bob=Math.sin(elapsed*8+phase)*.8;
      const part=(px,py,pz,a,b,d,col)=>sphere(balls,X+px*s,(py+bob)*s,Z+pz*s,a*s,b*s,d*s,col);
      const arm=(x1,y1,z1,x2,y2,z2,r,col)=>bone(X+x1*s,(y1+bob)*s,Z+z1*s,X+x2*s,(y2+bob)*s,Z+z2*s,r*s,col);
      sphere(shadows,X+3,1,Z+3,12*s,.45,8*s);
      arm(-4,4,0,-4,13,0,2.6,'#334756');arm(4,4,0,4,13,0,2.6,'#334756');
      part(-4,3,2,3.5,2.7,5,'#263a48');part(4,3,2,3.5,2.7,5,'#263a48');
      part(0,21,0,8,10,5.5,c);part(0,32,0,6.5,7,6,'#e8bb95');
      part(0,37,-.5,6.7,3.4,6.2,c);part(-2.3,33,5.6,.7,1,.4,'#354651');part(2.3,33,5.6,.7,1,.4,'#354651');
      const wave=cheering?Math.sin(elapsed*10+phase)*3:0;
      arm(-7,25,0,-11,cheering?38+wave:16,1,2.4,c);arm(7,25,0,11,cheering?38-wave:16,1,2.4,c);
      part(-11,cheering?40+wave:15,1,2.5,2.5,2.5,'#e8bb95');part(11,cheering?40-wave:15,1,2.5,2.5,2.5,'#e8bb95');
    }
    function addBoxer(t,elapsed,phase,opponent){
      const size=.34+Math.min(t.size,45)*.023,side=t.id?-1:1,X=t.bx-720,Z=(t.by-425)*Math.SQRT2;
      const p=punchPose(t.attack,t.punch>0?1-t.punch:0),c=t.id?'#ff755c':'#35c9df',skin=t.flash?'#f7d8af':'#e1ac85';
      if(t.hp<=0){sphere(shadows,X,1,Z,48*size,.7,22*size);sphere(balls,X,10*size,Z,29*size,10*size,17*size,skin);sphere(balls,X-side*34*size,10*size,Z,15*size,13*size,14*size,skin);sphere(balls,X+side*24*size,9*size,Z,17*size,9*size,15*size,c);sphere(balls,X+side*46*size,6*size,Z-9*size,12*size,6*size,7*size,c);sphere(balls,X+side*46*size,6*size,Z+9*size,12*size,6*size,7*size,c);sphere(balls,X-side*18*size,8*size,Z+23*size,11*size,9*size,11*size,c);return;}
      const recoil=t.recoil||0,sway=Math.sin(elapsed*5)*1.5+recoil*3,twist=(p.twist-recoil*.22)*side;
      const transform=(x,y,z)=>[X+(x*side*Math.cos(twist)+z*Math.sin(twist)+(p.lean-recoil*14)*side)*size,(y+sway)*size,Z+(-x*side*Math.sin(twist)+z*Math.cos(twist))*size];
      const part=(x,y,z,a,b,d,col)=>{const q=transform(x,y,z);sphere(balls,...q,a*size,b*size,d*size,col)};
      const arm=(a,b,r,col)=>{const q=transform(...a),v=transform(...b);bone(...q,...v,r*size,col)};
      sphere(shadows,X+5,1,Z+4,29*size,.6,19*size);
      arm([-10,8,-8],[-9,31,-8],6,'#374859');arm([11,8,9],[9,31,9],6,'#374859');
      part(-10,5,-5,9,5,12,c);part(12,5,12,9,5,12,c);
      part(0,31,0,22,13,17,c);part(0,42,0,23,4,17,'#f0e9d6');
      part(0,53,0,16,17,12,skin);part(0,69,0,23,20,15,skin);part(-2,77,0,24,10,16,skin);
      part(1-recoil*6,98,0,16,19,15,skin);part(0,109,-1,18,9,16,c);
      part(13,99,4,4,3,5,skin);part(13,103,9,1.3,2,1.2,'#344654');
      const lead=transform(p.leadX,p.leadY,p.leadZ),rear=transform(p.rearX,p.rearY,p.rearZ);
      if(opponent&&t.punch>0){const strike=strikePose(t,opponent),hand=strike.rear?rear:lead;hand[0]=strike.glove.x-720;hand[1]=strike.glove.y;hand[2]=strike.glove.z;}
      const shoulderLead=transform(9,76,12),shoulderRear=transform(-6,76,-13);
      const elbow=(a,b,z)=>[(a[0]+b[0])*.5,(a[1]+b[1])*.5-9*size,(a[2]+b[2])*.5+z*size];
      const elbowLead=elbow(shoulderLead,lead,8),elbowRear=elbow(shoulderRear,rear,-8);
      bone(...shoulderLead,...elbowLead,6.8*size,skin);bone(...elbowLead,...lead,6.2*size,skin);
      bone(...shoulderRear,...elbowRear,6.8*size,skin);bone(...elbowRear,...rear,6.2*size,skin);
      sphere(balls,...lead,12*size,12*size,12*size,c);sphere(balls,...rear,12*size,12*size,12*size,c);
      sphere(balls,lead[0]-side*5*size,lead[1]-3*size,lead[2],5*size,5*size,9*size,'#f2e5cf');
      sphere(balls,rear[0]-side*5*size,rear[1]-3*size,rear[2],5*size,5*size,9*size,'#f2e5cf');

    }
    window.Boxing3D={begin(){balls.count=limbs.count=shadows.count=0},addPerson,addBoxer,render(){for(const mesh of [balls,limbs,shadows]){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true}renderer.render(scene,camera);return renderer.domElement}};
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();window.Boxing3D=null});
  }catch(error){console.warn('3D unavailable; using lightweight character fallback.',error)}
})();

