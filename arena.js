/* Buildless bullet-hell engine. Study content and answers never enter this file. */
(() => {
'use strict';
const TAU=Math.PI*2, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let canvas,ctx,W=960,H=600,last=0,clock=0,running=false,paused=false,difficulty='normal';
let hp=100,hits=0,knockdowns=0,onHit=()=>{},onRecover=()=>{};
let player={x:480,y:430,r:11,dx:0,dy:-1,inv:0,dash:0,dashCooldown:0};
let boss={x:480,y:130,hit:0};
let bullets=[],shots=[],particles=[],trail=[],telegraphs=[],beams=[],floaters=[];
let pattern=0,patternClock=2.3,shotClock=0,shake=0,flash=0;
let soundEnabled=false,audio=null,joyId=null,stickInput={x:0,y:0};
const keys=new Set();
const palette={ink:'#091626',mint:'#79f5cf',lime:'#e8ff7d',rose:'#ff718d',ice:'#a2e8f1'};
function unlock(){if(!soundEnabled)return;try{if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
function tone(f=440,t=.1,type='triangle',volume=.025,end){if(!soundEnabled||!audio)return;try{const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(f,audio.currentTime);if(end)o.frequency.exponentialRampToValueAtTime(end,audio.currentTime+t);g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+t);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+t);}catch{}}
function phase(){return clock<35?1:clock<80?2:3;}
function clearInput(){keys.clear();joyId=null;stickInput={x:0,y:0};const stick=document.getElementById('stick');if(stick)stick.style.transform='';}
function positionDefault(){player={x:W*.5,y:H*.76,r:11,dx:0,dy:-1,inv:1.5,dash:0,dashCooldown:0};boss={x:W*.5,y:H*.25,hit:0};}
function getState(){return {running,paused,hp,hits,knockdowns,time:clock,bullets:bullets.length,player:{x:player.x,y:player.y,dashCooldown:player.dashCooldown},difficulty,phase:phase(),world:{width:W,height:H}};}
function start(options={}){difficulty=['calm','normal','chaos'].includes(options.density)?options.density:'normal';onHit=typeof options.onHit==='function'?options.onHit:()=>{};onRecover=typeof options.onRecover==='function'?options.onRecover:()=>{};const resume=options.resume||{};clock=Math.max(0,Number(resume.time)||0);hp=clamp(Number(resume.hp)||100,1,100);hits=Math.max(0,Number(resume.hits)||0);knockdowns=Math.max(0,Number(resume.knockdowns)||0);paused=false;running=true;pattern=0;patternClock=2.5;shotClock=.2;shake=0;flash=0;bullets=[];shots=[];particles=[];trail=[];telegraphs=[];beams=[];floaters=[];clearInput();positionDefault();unlock();if(canvas)canvas.focus({preventScroll:true});return getState();}
function stop(){running=false;clearInput();return getState();}
function pause(value=true){paused=Boolean(value);clearInput();if(!paused)unlock();return getState();}
function movement(){let x=stickInput.x+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),y=stickInput.y+(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);const l=Math.hypot(x,y);if(l>1){x/=l;y/=l;}return {x,y,length:l};}
function dash(){if(!running||paused||player.dashCooldown>0)return false;const m=movement();if(m.length>.1){const l=Math.hypot(m.x,m.y);player.dx=m.x/l;player.dy=m.y/l;}player.dash=.18;player.inv=Math.max(player.inv,.28);player.dashCooldown=1;tone(220,.12,'sawtooth',.018,620);return true;}
function burst(x,y,color,count=15){for(let i=0;i<count;i++){const a=Math.random()*TAU,s=45+Math.random()*170;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.4+Math.random()*.25,max:.65,r:2+Math.random()*3,color});}}
function strike(power=1){if(!running||paused)return false;power=clamp(Number(power)||1,1,4);hp=Math.min(100,hp+4);bullets=bullets.filter(b=>{if(Math.hypot(b.x-player.x,b.y-player.y)<100+power*9){burst(b.x,b.y,palette.mint,3);return false;}return true;});beams.push({x:player.x,y:player.y-8,tx:boss.x,ty:boss.y-15,life:.45,max:.45,power});boss.hit=.35;shake=reduced?0:5;flash=.13;burst(boss.x,boss.y-15,palette.lime,22+power*6);floaters.push({x:boss.x,y:boss.y-68,text:'자기확인 반격!',color:palette.lime,life:1.2});floaters.push({x:player.x,y:player.y-45,text:'멘탈 +4',color:palette.mint,life:1});tone(240,.22,'triangle',.035,960);return true;}
function hurt(){if(player.inv>0||!running||paused)return;const amount=difficulty==='calm'?4:difficulty==='chaos'?9:7;hp=Math.max(0,hp-amount);hits++;player.inv=.8;shake=reduced?0:5;burst(player.x,player.y,palette.rose,12);floaters.push({x:player.x,y:player.y-40,text:`−${amount}`,color:palette.rose,life:.8});tone(130,.12,'sawtooth',.026,60);try{onHit(getState());}catch(e){console.error('Hit callback failed',e);}if(hp<=0){knockdowns++;hp=100;player.inv=3;bullets=[];telegraphs=[];burst(player.x,player.y,palette.mint,32);floaters.push({x:player.x,y:player.y-65,text:'다시 집중! 회상은 계속',color:palette.mint,life:2.5});try{onRecover(getState());}catch(e){console.error('Recovery callback failed',e);}}}
function queuePattern(){const p=phase(),mult=difficulty==='calm'?.78:difficulty==='chaos'?1.15:1;const kind=pattern++%3;const angle=Math.atan2(player.y-boss.y,player.x-boss.x);const angles=[];const speed=(130+p*15)*mult;
if(kind===0){const n=5+p*2+(difficulty==='chaos'?2:0);for(let i=0;i<n;i++)angles.push(angle+(i-(n-1)/2)*.18);}
else if(kind===1){const n=(difficulty==='calm'?10:14)+p*3;const shift=clock*.23;for(let i=0;i<n;i++){if(i===2||i===3)continue;angles.push(i/n*TAU+shift);}}
else{for(let i=0;i<3+p;i++)angles.push(angle+(i-(2+p)/2)*.11);}
telegraphs.push({x:boss.x,y:boss.y+10,angles,speed:kind===2?speed*1.23:speed,life:kind===2?.8:.6,max:kind===2?.8:.6,kind});patternClock=(difficulty==='calm'?2.9:difficulty==='chaos'?1.8:2.35)-p*.15;
}
function update(dt){clock+=dt;shake=Math.max(0,shake-dt*24);flash=Math.max(0,flash-dt);for(const name of ['inv','dash','dashCooldown'])player[name]=Math.max(0,player[name]-dt);boss.hit=Math.max(0,boss.hit-dt);const m=movement();if(player.dash>0){player.x+=player.dx*620*dt;player.y+=player.dy*620*dt;trail.push({x:player.x,y:player.y,life:.18});}else{player.x+=m.x*225*dt;player.y+=m.y*225*dt;if(m.length>.1){const l=Math.hypot(m.x,m.y);player.dx=m.x/l;player.dy=m.y/l;}}player.x=clamp(player.x,28,W-28);player.y=clamp(player.y,65,H-35);boss.x=W*.5+Math.sin(clock*.5)*W*.16;boss.y=H*.23+Math.cos(clock*.7)*H*.035;
patternClock-=dt;if(patternClock<=0)queuePattern();for(const t of telegraphs){t.life-=dt;if(t.life<=0){for(const a of t.angles)bullets.push({x:t.x,y:t.y,vx:Math.cos(a)*t.speed,vy:Math.sin(a)*t.speed,r:t.kind===2?6:7,rot:a,life:9,kind:t.kind});}}telegraphs=telegraphs.filter(t=>t.life>0);
for(const b of bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;b.rot+=dt*1.2;if(Math.hypot(b.x-player.x,b.y-player.y)<b.r+player.r){hurt();b.life=0;}}bullets=bullets.filter(b=>b.life>0&&b.x>-24&&b.x<W+24&&b.y>-24&&b.y<H+24);
shotClock-=dt;if(shotClock<=0){shotClock=.3;const a=Math.atan2(boss.y-10-player.y,boss.x-player.x);shots.push({x:player.x,y:player.y-15,vx:Math.cos(a)*600,vy:Math.sin(a)*600,life:2});}for(const s of shots){s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;if(Math.hypot(s.x-boss.x,s.y-boss.y)<28){s.life=0;burst(s.x,s.y,palette.mint,2);}}shots=shots.filter(s=>s.life>0);
for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);for(const f of floaters){f.y-=24*dt;f.life-=dt;}floaters=floaters.filter(f=>f.life>0);for(const t of trail)t.life-=dt;trail=trail.filter(t=>t.life>0);for(const b of beams)b.life-=dt;beams=beams.filter(b=>b.life>0);
const button=document.getElementById('dashBtn');if(button){button.style.setProperty('--cooldown',String(player.dashCooldown));button.classList.toggle('cooling',player.dashCooldown>0);button.setAttribute('aria-label',player.dashCooldown>0?'회피 충전 중':'회피');}}
function rr(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke();}}
function circle(x,y,r,fill,stroke,width=2){ctx.beginPath();ctx.arc(x,y,r,0,TAU);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function line(x1,y1,x2,y2,color,width=2){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function text(t,x,y,size=16,color='#d3e6ec',align='center',weight=700){ctx.font=`${weight} ${size}px Pretendard, "Noto Sans KR", sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(t,x,y);}
function drawShinyu(dog,walk){
  const ink='#0b1420',skin='#efbc9e';
  ctx.lineJoin='round';ctx.lineCap='round';
  if(dog){ctx.save();ctx.translate(20,9);ctx.rotate(Math.sin(clock*15)*.5);ctx.beginPath();ctx.arc(4,-2,9,-2,1.7);ctx.strokeStyle='#453c37';ctx.lineWidth=8;ctx.stroke();ctx.restore();}
  // Dark denim and the light hoodie showing beneath an open, quilted black puffer.
  rr(-15,11+walk,11,16,4,'#263c52',ink);rr(4,11-walk,11,16,4,'#263c52',ink);
  line(-12,17+walk,-12,23+walk,'#40536a',1.5);line(7,17-walk,7,23-walk,'#40536a',1.5);
  rr(-20,-13,40,34,9,'#181e29',ink);rr(-12,-15,24,38,5,'#c7ced2',ink);
  rr(-9,11,18,8,3,'#b7c0c7');line(-7,14,7,14,'#9eabb4',1);
  rr(-26,-9,11,27,6,'#1c222c',ink);rr(15,-9,11,27,6,'#1c222c',ink);
  rr(-21,-12,10,34,4,'#202530',ink);rr(11,-12,10,34,4,'#202530',ink);
  for(const row of [-1,8,16]){line(-24,row,-18,row+1,'#3c414b',1.3);line(18,row+1,24,row,'#3c414b',1.3);line(-19,row,-13,row,'#3b414c',1.3);line(13,row,19,row,'#3b414c',1.3);}
  line(-11,-8,-11,19,'#76818b',1.1);line(11,-8,11,19,'#76818b',1.1);
  rr(-26,13,10,5,2,'#111722');rr(16,13,10,5,2,'#111722');
  circle(-21,18,4.5,skin,ink);circle(21,18,4.5,skin,ink);
  // Broad gray hood and white cords make the outfit readable even on mobile.
  ctx.beginPath();ctx.moveTo(-18,-16);ctx.quadraticCurveTo(-13,-23,0,-19);ctx.quadraticCurveTo(13,-23,18,-16);ctx.lineTo(10,-5);ctx.quadraticCurveTo(0,1,-10,-5);ctx.closePath();ctx.fillStyle='#dfe3e4';ctx.fill();ctx.strokeStyle='#8796a1';ctx.lineWidth=1.4;ctx.stroke();
  line(-8,-6,-6,7,'#f8f6f0',1.8);line(7,-6,5,6,'#f8f6f0',1.8);
  // A clean-shaven, gently tapered face with visible ears; no glasses.
  circle(-20,-23,4.5,skin,ink,1.6);circle(20,-23,4.5,skin,ink,1.6);
  ctx.beginPath();ctx.moveTo(-19,-28);ctx.bezierCurveTo(-21,-14,-12,-4,0,-3);ctx.bezierCurveTo(12,-4,21,-14,19,-28);ctx.bezierCurveTo(17,-46,-17,-46,-19,-28);ctx.closePath();ctx.fillStyle=skin;ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();ctx.ellipse(-12,-16,4,2,0,0,TAU);ctx.ellipse(12,-16,4,2,0,0,TAU);ctx.fillStyle=dog?'#e9a28f':'#e6a68f';ctx.fill();
  // Rounded, straight black fringe with a soft center split, not the old spiky silhouette.
  ctx.beginPath();ctx.moveTo(-21,-20);ctx.bezierCurveTo(-26,-33,-20,-48,-5,-48);ctx.bezierCurveTo(6,-53,24,-43,22,-29);ctx.lineTo(19,-20);ctx.lineTo(16,-33);ctx.quadraticCurveTo(13,-29,10,-27);ctx.lineTo(11,-36);ctx.quadraticCurveTo(7,-30,3,-27);ctx.lineTo(3,-37);ctx.quadraticCurveTo(-1,-31,-6,-27);ctx.lineTo(-5,-35);ctx.quadraticCurveTo(-10,-30,-14,-27);ctx.lineTo(-17,-32);ctx.lineTo(-18,-21);ctx.closePath();ctx.fillStyle='#171a22';ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=1.6;ctx.stroke();
  ctx.beginPath();ctx.moveTo(-17,-36);ctx.quadraticCurveTo(-12,-45,-5,-44);ctx.moveTo(2,-46);ctx.quadraticCurveTo(12,-44,16,-37);ctx.strokeStyle='#343039';ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,-21);ctx.lineTo(-1,-16);ctx.lineTo(2,-15);ctx.strokeStyle='#bd816e';ctx.lineWidth=1.2;ctx.stroke();
  if(dog){
    // Same person, softened expression, with floppy ears and a wagging tail added.
    for(const side of [-1,1]){ctx.save();ctx.translate(side*21,-36);ctx.rotate(side*-.2);ctx.beginPath();ctx.ellipse(0,5,6.5,13,0,0,TAU);ctx.fillStyle='#403632';ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=1.5;ctx.stroke();ctx.beginPath();ctx.ellipse(0,7,3,8,0,0,TAU);ctx.fillStyle='#a87765';ctx.fill();ctx.restore();}
    ctx.beginPath();ctx.moveTo(-13,-21);ctx.quadraticCurveTo(-8,-26,-4,-21);ctx.moveTo(4,-21);ctx.quadraticCurveTo(8,-26,13,-21);ctx.strokeStyle='#25232a';ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.moveTo(-5,-11);ctx.quadraticCurveTo(0,-6,6,-11);ctx.strokeStyle='#94564f';ctx.lineWidth=1.8;ctx.stroke();
  }else{
    line(-13,-28,-4,-25,'#25232a',2.3);line(4,-25,13,-28,'#25232a',2.3);
    line(-12,-22,-5,-22,'#35292b',1.4);line(5,-22,12,-22,'#35292b',1.4);circle(-8,-21,1.8,'#1c1e26');circle(8,-21,1.8,'#1c1e26');
    ctx.beginPath();ctx.moveTo(-6,-9);ctx.quadraticCurveTo(0,-15,7,-10);ctx.strokeStyle='#874b4e';ctx.lineWidth=2;ctx.stroke();
    // A compact comic anger mark communicates the villain role without altering his features.
    line(25,-38,25,-32,'#ff7183',1.8);line(22,-35,28,-35,'#ff7183',1.8);
  }
}

function background(){ctx.fillStyle='#102534';ctx.fillRect(0,0,W,H);const tile=48;ctx.strokeStyle='#1b3948';ctx.lineWidth=1;for(let x=0;x<W;x+=tile){line(x,47,x,H,'#1b3948',1);}for(let y=47;y<H;y+=tile){line(0,y,W,y,'#1b3948',1);}rr(13,51,W-26,H-66,10,null,'#2d5865');ctx.save();ctx.globalAlpha=.06;text('RECALL',W*.5,H*.53,Math.min(W/7,110),'#b3eee2');text('UNDER PRESSURE',W*.5,H*.53+62,Math.min(W/28,24),'#b3eee2');ctx.restore();ctx.fillStyle='#0c1d2c';ctx.fillRect(0,0,W,44);circle(24,22,4,running&&!paused?palette.mint:'#667b88');text(running?`LIVE · PHASE ${phase()}`:'RECALL BARRAGE',40,22,12,palette.mint,'left');text('국시 30년차 · 신유의 훈수 탄막',W-22,22,12,'#9bb9c6','right');for(const x of [44,W-69]){for(const y of [H*.28,H*.7]){rr(x,y,25,52,4,'#1d3c4c','#345b6b');rr(x+4,y+6,17,12,2,'#6cb6b1');line(x+5,y+27,x+20,y+27,'#4b7881',2);line(x+5,y+34,x+20,y+34,'#4b7881',2);}}}
function actorBoss(){ctx.save();ctx.translate(boss.x,boss.y);ctx.scale(1.28,1.28);ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(0,22,29,10,0,0,TAU);ctx.fill();drawShinyu(false,Math.sin(clock*5));if(boss.hit>0){circle(0,-10,36,`rgba(232,255,125,${boss.hit*.45})`);}ctx.restore();text('김신유 · 30년 묵은 훈수',boss.x,boss.y+49,12,'#ffb5c4');}
function actorPlayer(){ctx.save();ctx.translate(player.x,player.y);if(player.inv>0&&Math.floor(clock*18)%2)ctx.globalAlpha=.5;circle(0,2,20,'#79f5cf14',player.dash>0?palette.lime:'#79f5cf70',1.5);const walk=Math.sin(clock*15)*(movement().length>.1?2:0);rr(-11,5+walk,8,12,3,'#152536');rr(3,5-walk,8,12,3,'#152536');rr(-16,-16,32,27,7,'#50c8b9','#0b1520');rr(-20,-11,7,21,3,'#3ca496');rr(13,-11,7,21,3,'#3ca496');line(-4,-9,4,-9,'#ecfff6',2);line(0,-13,0,-5,'#ecfff6',2);circle(0,-28,15,'#efbe99','#0b1520',2);ctx.beginPath();ctx.moveTo(-15,-28);ctx.lineTo(-16,-41);ctx.lineTo(-5,-46);ctx.lineTo(5,-44);ctx.lineTo(14,-38);ctx.lineTo(14,-27);ctx.lineTo(5,-35);ctx.lineTo(-2,-32);ctx.lineTo(-9,-34);ctx.closePath();ctx.fillStyle='#192434';ctx.fill();circle(-5,-28,1.5,'#162131');circle(5,-28,1.5,'#162131');line(-3,-21,3,-21,'#8b5a49',1.5);ctx.restore();circle(player.x,player.y,3,palette.mint);text('강렬',player.x,player.y+29,11,palette.mint);if(player.dashCooldown>0){ctx.beginPath();ctx.arc(player.x,player.y,23,-Math.PI/2,-Math.PI/2+TAU*(1-player.dashCooldown));ctx.strokeStyle=palette.mint;ctx.lineWidth=2;ctx.stroke();}}
function draw(){if(!ctx)return;ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);ctx.save();if(shake&&!reduced)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);background();
for(const t of telegraphs){ctx.save();ctx.globalAlpha=.14+(1-t.life/t.max)*.16;ctx.setLineDash([8,11]);for(const a of t.angles)line(t.x,t.y,t.x+Math.cos(a)*Math.max(W,H),t.y+Math.sin(a)*Math.max(W,H),t.kind===2?'#ffd789':palette.rose,2);ctx.restore();circle(t.x,t.y,18+(1-t.life/t.max)*18,null,t.kind===2?'#ffd78966':'#ff718d66',2);}
for(const t of trail){ctx.globalAlpha=t.life/.18*.35;circle(t.x,t.y,19,palette.mint);}ctx.globalAlpha=1;actorBoss();actorPlayer();
for(const s of shots){line(s.x,s.y,s.x-s.vx*.018,s.y-s.vy*.018,palette.mint,2);circle(s.x,s.y,3,'#e0fff0');}
for(const b of bullets){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.rot);if(b.kind===2){circle(0,0,6,'#ffd789','#ff9a67',2);circle(0,0,2,'#fff4ce');}else{rr(-5,-7,10,14,2,b.kind===1?'#ffbfcb':'#eae0ce',palette.rose);line(-2,-3,3,-3,'#ad5470',1.5);line(-2,1,3,1,'#ad5470',1.5);}ctx.restore();}
for(const beam of beams){ctx.save();ctx.globalAlpha=beam.life/beam.max;line(beam.x,beam.y,beam.tx,beam.ty,'#79f5cf33',28+beam.power*6);line(beam.x,beam.y,beam.tx,beam.ty,palette.lime,6+beam.power*2);line(beam.x,beam.y,beam.tx,beam.ty,'#fff',2);circle(beam.tx,beam.ty,18+(1-beam.life/beam.max)*65,null,palette.lime,3);ctx.restore();}
for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.r,p.r);}ctx.globalAlpha=1;for(const f of floaters){ctx.globalAlpha=Math.min(1,f.life*2);text(f.text,f.x,f.y,16,f.color);}ctx.globalAlpha=1;if(flash>0){ctx.fillStyle=`rgba(121,245,207,${flash*.3})`;ctx.fillRect(0,0,W,H);}if(paused&&running){ctx.fillStyle='#091626bb';ctx.fillRect(0,44,W,H-44);text('잠깐 숨 고르기',W*.5,H*.5,24,palette.mint);text('다시 시작하면 탄막과 회상이 함께 이어집니다',W*.5,H*.5+35,13,'#b5c9d2');}ctx.restore();}
function resize(){if(!canvas)return;const r=canvas.getBoundingClientRect();if(r.width<1||r.height<1)return;const oldW=W,oldH=H;W=r.width<650?660:960;H=Math.max(280,Math.round(W*r.height/r.width));const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));for(const p of [player,boss,...bullets,...shots,...particles,...trail,...floaters,...telegraphs,...beams]){p.x=p.x/oldW*W;p.y=p.y/oldH*H;if('tx'in p){p.tx=p.tx/oldW*W;p.ty=p.ty/oldH*H;}}if(!running&&clock===0)positionDefault();draw();}
function frame(now){const dt=Math.min((now-last)/1000||0,.033);last=now;if(running&&!paused)update(dt);draw();requestAnimationFrame(frame);}
function editable(target){return target instanceof Element&&Boolean(target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]'));}
function init(){canvas=document.getElementById('arena');if(!canvas)return;ctx=canvas.getContext('2d');canvas.setAttribute('tabindex','0');window.addEventListener('keydown',e=>{if(editable(e.target)||!running||paused)return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='Space'&&!e.repeat)dash();}});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});
const joy=document.getElementById('joystick'),stick=document.getElementById('stick');if(joy&&stick){joy.style.touchAction='none';const setJoy=e=>{const r=joy.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,len=Math.hypot(x,y),radius=Math.max(1,r.width*.3),scale=len>radius?radius/len:1;stickInput={x:x*scale/radius,y:y*scale/radius};stick.style.transform=`translate(${x*scale}px,${y*scale}px)`;};joy.addEventListener('pointerdown',e=>{e.preventDefault();if(joyId!==null)return;joyId=e.pointerId;joy.setPointerCapture(e.pointerId);setJoy(e);unlock();});joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)setJoy(e);});const release=e=>{if(e.pointerId!==joyId)return;joyId=null;stickInput={x:0,y:0};stick.style.transform='';};joy.addEventListener('pointerup',release);joy.addEventListener('pointercancel',release);joy.addEventListener('lostpointercapture',release);}
const dashBtn=document.getElementById('dashBtn');if(dashBtn){dashBtn.style.touchAction='none';dashBtn.addEventListener('pointerdown',e=>{e.preventDefault();unlock();dash();});dashBtn.addEventListener('click',e=>{if(e.detail===0)dash();});}
window.addEventListener('resize',resize);if(window.ResizeObserver)new ResizeObserver(resize).observe(canvas);resize();requestAnimationFrame(frame);}
if(['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).has('qa'))window.barrageQA={hit(){player.inv=0;hurt();return getState();}};
window.Barrage={start,stop,pause,dash,strike,setSound(value){soundEnabled=Boolean(value);if(soundEnabled)unlock();},getState};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
