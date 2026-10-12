/* Original side-scrolling canvas action engine. No study answers enter combat. */
(() => {
'use strict';
const TAU=Math.PI*2, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const LAND=486,LENGTH=4600;
let canvas,ctx,W=960,H=540,last=0,clock=0,running=false,paused=false,difficulty='normal',camera=0;
let hp=100,hits=0,knockdowns=0,onHit=()=>{},onRecover=()=>{},soundEnabled=false,audio;
let player,boss,hazards=[],effects=[],particles=[],floaters=[],pattern=0,patternClock=2,announcement='',announceTime=0;
let keys=new Set(),joyId=null,stickInput=0,touchAttack=false,shotClock=0,shake=0,weapon=0,energy=0,clears=0,skillCD=[0,0,0],ultCD=0;
const palette={mint:'#91ffe0',lime:'#f5ef9b',rose:'#ff829e'};
const weapons=[{name:'청진기',skill:'공명 보호막',color:'#91ffe0',cd:8},{name:'DTR 반사망치',skill:'반사 충격파',color:'#ffc17e',cd:6},{name:'펜라이트',skill:'섬광 집중빔',color:'#d2c1ff',cd:7}];
const patterns=[{id:'wave',name:'지면 충격파',hint:'점프로 넘기!',delay:1},{id:'charge',name:'불호령 돌진',hint:'뛰어서 등 뒤로!',delay:1.1},{id:'stomp',name:'도약 내려찍기',hint:'붉은 착지점에서 벗어나!',delay:1.2},{id:'rain',name:'낙제 도장 낙하',hint:'표시된 자리에서 이동!',delay:1.2},{id:'beam',name:'상단 훈수 레이저',hint:'땅에서 아래키로 숙이기!',delay:1.25},{id:'sweep',name:'바닥 쓸기',hint:'점프하거나 발판으로!',delay:1.15},{id:'adds',name:'잔소리 분신 소환',hint:'공격으로 없애기!',delay:1.0},{id:'pillars',name:'양옆 압박 장벽',hint:'두 표시 사이가 안전!',delay:1.2}];
const platforms=Array.from({length:17},(_,i)=>({x:210+i*245,y:[370,285,355,330][i%4],w:i%3===0?190:150}));
function phase(){return boss?boss.hp<boss.max*.32?3:boss.hp<boss.max*.67?2:1:1;}
function clearInput(){keys.clear();joyId=null;stickInput=0;touchAttack=false;const s=document.getElementById('stick');if(s)s.style.transform='';}
function defaults(){player={x:340,y:LAND,vx:0,vy:0,dir:1,ground:true,jumps:0,inv:1.5,dash:0,dashCooldown:0,shield:0,crouch:false,attack:0,drop:0};boss={x:820,y:LAND,hp:720,max:720,hit:0,stun:0,move:0,vx:0,targetX:820,mode:'idle',ko:0};}
function getState(){return {running,paused,hp,hits,knockdowns,time:clock,bullets:0,hazards:hazards.length,pattern:announcement,patternIndex:pattern,difficulty,phase:phase(),weapon:weapons[weapon].name,weaponIndex:weapon,skillCooldowns:[...skillCD],energy,ultCooldown:ultCD,clears,camera,world:{width:W,height:H,length:LENGTH},player:{...player,x:(player?.x||0)-camera,worldX:player?.x},boss:{...boss,x:(boss?.x||0)-camera,worldX:boss?.x}};}
function unlock(){if(!soundEnabled)return;try{if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{}}
function tone(f,t=.13,type='triangle',vol=.025,end){if(!soundEnabled||!audio)return;try{const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(f,audio.currentTime);if(end)o.frequency.exponentialRampToValueAtTime(end,audio.currentTime+t);g.gain.setValueAtTime(vol,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+t);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+t);}catch{}}
function tell(message,time=2){announcement=message;announceTime=time;}
function floater(x,y,message,color=palette.lime){floaters.push({x,y,text:message,color,life:1.3});}
function burst(x,y,color,count=14){for(let i=0;i<(reduced?4:count);i++){const a=Math.random()*TAU,s=40+Math.random()*180;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.55,color});}}
function start(options={}){const r=options.resume||{};difficulty=['calm','normal','chaos'].includes(options.density)?options.density:'normal';onHit=options.onHit||(()=>{});onRecover=options.onRecover||(()=>{});clock=Math.max(0,+r.time||0);hp=clamp(+r.hp||100,1,100);hits=+r.hits||0;knockdowns=+r.knockdowns||0;clears=+r.clears||0;weapon=clamp(+r.weaponIndex||0,0,2);energy=clamp(+r.energy||0,0,100);skillCD=[0,0,0];ultCD=0;defaults();boss.max=boss.hp=720+clears*80;camera=0;hazards=[];effects=[];particles=[];floaters=[];pattern=0;patternClock=2.4;shotClock=0;running=true;paused=false;clearInput();tell('밤의 실기숲 · 점프하며 대본을 떠올려!',3);unlock();canvas?.focus({preventScroll:true});return getState();}
function stop(){running=false;clearInput();return getState();}
function pause(value=true){paused=!!value;clearInput();return getState();}
function active(){return running&&!paused;}
function direction(){return clamp(stickInput+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),-1,1);}
function jump(){if(!active())return false;if(player.crouch&&player.ground&&player.y<LAND-4){player.drop=.3;player.ground=false;player.y+=8;return true;}if(player.jumps>=2)return false;player.vy=player.jumps===0?-670:-590;player.jumps++;player.ground=false;burst(player.x,player.y,'#ccfffa',9);tone(360,.12,'sine',.025,720);return true;}
function dash(){if(!active()||player.dashCooldown>0)return false;const d=direction();if(Math.abs(d)>.2)player.dir=Math.sign(d);player.dash=.2;player.inv=Math.max(player.inv,.35);player.dashCooldown=1.35;burst(player.x,player.y-30,palette.mint);return true;}
function selectWeapon(index){if(!active())return false;weapon=clamp(index,0,2);updateControls();return true;}
function damageBoss(amount){if(boss.ko)return;boss.hp=Math.max(0,boss.hp-amount);boss.hit=.2;energy=Math.min(100,energy+2);floater(boss.x,boss.y-90,String(Math.round(amount)),weapons[weapon].color);burst(boss.x,boss.y-45,weapons[weapon].color,10);if(boss.hp===0){boss.ko=3;clears++;hazards=[];boss.mode='idle';player.inv=3.5;hp=Math.min(100,hp+20);tell('신유 격파! 다음 라운드 · 회상 진도는 계속',3);floater(player.x,player.y-85,'격파! 집중력 +20');}}
function hitRange(range,damage,all=false){if(!boss.ko&&Math.abs(boss.y-player.y)<100&&Math.abs(boss.x-player.x)<range&&(all||(boss.x-player.x)*player.dir>=-35))damageBoss(damage);for(const h of hazards)if(h.kind==='add'&&Math.abs(h.x-player.x)<range&&Math.abs(h.y-player.y)<110&&(all||(h.x-player.x)*player.dir>=-35)){h.life=0;burst(h.x,h.y-20,weapons[weapon].color,14);energy=Math.min(100,energy+5);}}
function effect(kind,x,y,range,color,life=.3){effects.push({kind,x,y,range,color,life,max:life,dir:player.dir});}
function attack(){if(!active()||shotClock>0)return false;player.attack=.27;shotClock=[.32,.52,.36][weapon];const range=[165,118,560][weapon];effect(['arc','hammer','beam'][weapon],player.x,player.y-37,range,weapons[weapon].color);hitRange(range,[22,39,17][weapon]);window.dispatchEvent(new CustomEvent('sidequest:attack',{detail:{weapon}}));tone(weapon===1?180:600,.08);return true;}
function skill(){if(!active()||skillCD[weapon]>0)return false;skillCD[weapon]=weapons[weapon].cd;player.attack=.5;
 if(weapon===0){player.shield=3;player.inv=Math.max(player.inv,.45);effect('ring',player.x,player.y-35,220,palette.mint,.6);hitRange(235,75,true);floater(player.x,player.y-100,'공명 보호막 · 3초',palette.mint);}
 if(weapon===1){effect('wave',player.x,player.y-12,440,'#ffc17e',.7);hitRange(460,130,true);if(Math.abs(boss.x-player.x)<460&&!boss.ko)boss.stun=1.4;floater(player.x,player.y-100,'반사 충격파 · 기절','#ffc17e');}
 if(weapon===2){effect('beam',player.x,player.y-36,900,'#ddd1ff',.65);hitRange(920,110);floater(player.x,player.y-100,'섬광 집중빔','#ddd1ff');}
 window.dispatchEvent(new CustomEvent('sidequest:skill',{detail:{weapon}}));return true;
}
function ultimate(){if(!active()||energy<100||ultCD>0)return false;energy=0;ultCD=12;player.inv=2;hazards=[];effect('ultimate',player.x,player.y-35,W,palette.lime,1.1);damageBoss(220);hp=Math.min(100,hp+10);tell('종합진찰! · 화면 정화 + 집중력 10 회복',2);window.dispatchEvent(new CustomEvent('sidequest:skill',{detail:{weapon:3}}));return true;}
function strike(power=1){if(!active())return false;hp=Math.min(100,hp+4);energy=Math.min(100,energy+24);player.inv=Math.max(player.inv,.65);effect('recall',player.x,player.y-35,Math.abs(boss.x-player.x),palette.lime,.55);damageBoss(35*clamp(+power||1,1,4));floater(player.x,player.y-100,'회상 반격! 집중력 +4 · 기력 +24',palette.mint);return true;}
function hurt(amount){if(!active()||player.inv>0||player.shield>0)return;amount=amount||(difficulty==='calm'?4:difficulty==='chaos'?10:7);hp=Math.max(0,hp-amount);hits++;player.inv=.85;shake=reduced?0:5;burst(player.x,player.y-35,palette.rose);floater(player.x,player.y-70,'−'+amount,palette.rose);onHit(getState());if(hp===0){knockdowns++;hp=100;player.inv=3;hazards=[];tell('다시 집중! 회상 진도는 그대로',2.5);onRecover(getState());}}
function addHazard(h){hazards.push({delay:0,life:1,age:0,...h});}
function queuePattern(force){if(boss.ko)return;const index=force??pattern++%patterns.length,p=patterns[index];const tx=clamp(player.x,100,LENGTH-100);tell(p.name+' · '+p.hint,p.delay+1.6);const delay=p.delay*(difficulty==='calm'?1.25:1);
 if(p.id==='wave'){for(const d of [-1,1])addHazard({kind:'wave',x:boss.x,y:LAND,w:50,h:38,vx:d*(280+phase()*35),delay,life:5});}
 if(p.id==='charge'){boss.mode='warn-charge';boss.move=delay;boss.vx=Math.sign(player.x-boss.x||-1)*650;addHazard({kind:'charge-mark',x:boss.x,y:LAND,w:560,h:72,dir:Math.sign(boss.vx),delay,life:.05});}
 if(p.id==='stomp'){boss.mode='warn-stomp';boss.move=delay;boss.targetX=tx;addHazard({kind:'stomp',x:tx,y:LAND,w:160,h:100,delay:delay+.55,life:.32});}
 if(p.id==='rain'){for(let i=-1;i<=1;i++)addHazard({kind:'stamp',x:clamp(tx+i*170,50,LENGTH-50),y:-100,w:64,h:64,delay:delay+Math.abs(i)*.16,life:3,vy:540});}
 if(p.id==='beam')addHazard({kind:'beam',x:tx-440,y:LAND-57,w:880,h:22,delay,life:1.25});
 if(p.id==='sweep')addHazard({kind:'sweep',x:tx-360,y:LAND-23,w:720,h:24,delay,life:.75});
 if(p.id==='adds')for(const d of [-1,1])addHazard({kind:'add',x:clamp(tx+d*340,40,LENGTH-40),y:LAND,w:42,h:48,delay,life:10,vx:-d*105});
 if(p.id==='pillars')for(const d of [-1,1])addHazard({kind:'pillar',x:clamp(tx+d*145,40,LENGTH-40),y:100,w:72,h:LAND-100,delay,life:1.5});
 patternClock=delay+(difficulty==='calm'?2.6:difficulty==='chaos'?1.1:1.8)-phase()*.12;
}
function boxHit(x,y,w,h){const ph=player.crouch?30:66;return player.x+17>x&&player.x-17<x+w&&player.y>y&&player.y-ph<y+h;}
function update(dt){clock+=dt;announceTime=Math.max(0,announceTime-dt);shotClock=Math.max(0,shotClock-dt);ultCD=Math.max(0,ultCD-dt);skillCD=skillCD.map(t=>Math.max(0,t-dt));shake=Math.max(0,shake-dt*20);
 for(const k of ['inv','dash','dashCooldown','shield','attack','drop'])player[k]=Math.max(0,player[k]-dt);boss.hit=Math.max(0,boss.hit-dt);boss.stun=Math.max(0,boss.stun-dt);
 const m=direction();player.crouch=player.ground&&(keys.has('ArrowDown')||keys.has('KeyS'));if(Math.abs(m)>.1)player.dir=Math.sign(m);player.vx=player.dash>0?player.dir*830:m*(player.crouch?100:285);player.x=clamp(player.x+player.vx*dt,28,LENGTH-28);const oldY=player.y;player.vy+=1700*dt;player.y+=player.vy*dt;player.ground=false;
 if(player.vy>=0){for(const p of [...platforms,{x:0,w:LENGTH,y:LAND}])if((player.drop<=0||p.y===LAND)&&oldY<=p.y+2&&player.y>=p.y&&player.x+12>p.x&&player.x-12<p.x+p.w){player.y=p.y;player.vy=0;player.ground=true;player.jumps=0;break;}}
 if(player.y>LAND){player.y=LAND;player.vy=0;player.ground=true;player.jumps=0;}
 camera=clamp(player.x-W*.38,0,Math.max(0,LENGTH-W));
 if(keys.has('KeyZ')||touchAttack)attack();
 if(boss.ko>0){boss.ko-=dt;if(boss.ko<=0){boss.max=boss.hp=720+clears*80;boss.x=clamp(player.x+400,120,LENGTH-100);boss.y=LAND;boss.mode='idle';patternClock=2;tell('ROUND '+(clears+1)+' · 새로운 압박면접',2);}}
 else if(boss.stun<=0){
  boss.move-=dt;
  if(boss.mode==='warn-charge'&&boss.move<=0){boss.mode='charge';boss.move=.8;}
  else if(boss.mode==='charge'){boss.x=clamp(boss.x+boss.vx*dt,60,LENGTH-60);boss.y=LAND;if(boxHit(boss.x-38,LAND-75,76,75))hurt();if(boss.move<=0)boss.mode='idle';}
  else if(boss.mode==='warn-stomp'&&boss.move<=0){boss.mode='stomp';boss.move=.55;}
  else if(boss.mode==='stomp'){boss.x+=(boss.targetX-boss.x)*Math.min(1,dt*12);boss.y=LAND-Math.sin(Math.max(0,boss.move)/.55*Math.PI)*230;if(boss.move<=0){boss.y=LAND;boss.mode='idle';}}
  else if(boss.mode==='idle'){const distance=Math.abs(player.x-boss.x);if(distance>300)boss.x+=Math.sign(player.x-boss.x)*120*dt;boss.y=LAND;}
  if(Math.abs(boss.x-player.x)>W*.85&&boss.mode==='idle'){boss.x=clamp(player.x+(player.x>LENGTH-600?-1:1)*Math.min(420,W*.6),70,LENGTH-70);burst(boss.x,boss.y-30,'#bfaaff');}
  patternClock-=dt;if(patternClock<=0&&boss.mode==='idle')queuePattern();
 }
 for(const h of hazards){if(h.delay>0){h.delay-=dt;continue;}h.age+=dt;h.life-=dt;if(h.vx)h.x+=h.vx*dt;if(h.vy)h.y+=h.vy*dt;if(h.kind==='add')h.vx=Math.sign(player.x-h.x)*110;
  let x=h.x,y=h.y,w=h.w,height=h.h;if(['wave','add','stomp'].includes(h.kind)){x-=w/2;y-=height;}if(h.kind==='stamp'){x-=w/2;y-=height;if(h.y>LAND+64)h.life=0;}if(h.kind==='pillar')x-=w/2;
  if(h.kind!=='charge-mark'&&boxHit(x,y,w,height))hurt();
 }hazards=hazards.filter(h=>h.life>0&&h.x>-150&&h.x<LENGTH+150);
 for(const e of effects)e.life-=dt;effects=effects.filter(e=>e.life>0);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=300*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);for(const f of floaters){f.y-=26*dt;f.life-=dt;}floaters=floaters.filter(f=>f.life>0);updateControls();
}
function updateControls(){const alert=document.getElementById('bossAlert');if(alert){const label=announceTime>0?announcement:'Z 공격 · Space 이단 점프 · X 스킬';if(alert.textContent!==label)alert.textContent=label;}const label=document.getElementById('bossStatus');if(label)label.textContent='신유 · ROUND '+(clears+1)+' · '+Math.ceil(boss.hp)+' / '+boss.max;const bar=document.getElementById('bossHpFill');if(bar)bar.style.width=(boss.hp/boss.max*100)+'%';document.querySelectorAll('[data-weapon]').forEach(b=>{b.setAttribute('aria-pressed',String(+b.dataset.weapon===weapon));});const names={skillBtn:weapons[weapon].skill+(skillCD[weapon]>0?' '+Math.ceil(skillCD[weapon])+'s':' · X'),ultBtn:energy>=100?'종합진찰 · C':'종합진찰 '+Math.floor(energy)+'%',dashBtn:player.dashCooldown>0?'회피 '+player.dashCooldown.toFixed(1):'회피 ⇧'};for(const [id,label] of Object.entries(names)){const el=document.getElementById(id);if(el){if(el.textContent!==label)el.textContent=label;el.setAttribute('aria-disabled',String(!active()||(id==='skillBtn'&&skillCD[weapon]>0)||(id==='ultBtn'&&(energy<100||ultCD>0))));}}}
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

function scenery(){const gradient=ctx.createLinearGradient(0,0,0,H);gradient.addColorStop(0,'#17283e');gradient.addColorStop(.6,'#486078');gradient.addColorStop(1,'#253e52');ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);circle(W*.77-camera*.025,90,47,'#f7e5b5');circle(W*.77+19-camera*.025,78,42,'#213149');
 for(let layer=0;layer<3;layer++){const par=.08+layer*.12,color=['#304258','#324f5f','#2d5863'][layer];ctx.beginPath();ctx.moveTo(0,H);for(let x=-100;x<W+130;x+=80){const y=210+layer*60+Math.sin((x+camera*par)*.006+layer)*45;ctx.lineTo(x,y);}ctx.lineTo(W,H);ctx.closePath();ctx.fillStyle=color;ctx.fill();}
 for(let i=0;i<35;i++){const sx=((i*137-camera*.24)%(W+100)+W+100)%(W+100)-50,sy=60+(i*83)%310;circle(sx,sy,1.2,'#f4edc299');}
 for(let i=0;i<26;i++){const x=i*210-camera*.55;if(x<-100||x>W+100)continue;rr(x,255,13,260,6,'#223f4e');for(let j=0;j<3;j++){ctx.beginPath();ctx.moveTo(x+6,130+j*38);ctx.lineTo(x-60+j*7,310+j*34);ctx.lineTo(x+76-j*7,310+j*34);ctx.closePath();ctx.fillStyle=['#2a5461','#31636c','#387274'][j];ctx.fill();}}
 ctx.save();ctx.translate(-camera,0);
 for(let i=0;i<8;i++){const x=120+i*620;rr(x,LAND-117,95,117,6,'#2d4a59','#6b8d89');rr(x+11,LAND-103,73,25,4,'#f0dea9');text(['한줄 진료소','기억의 숲','강조 보관소','회상 정류장'][i%4],x+48,LAND-91,11,'#314753');rr(x+29,LAND-60,37,60,8,'#132c42','#88cbbb');circle(x+46,LAND-30,10,'#87d2bc33','#b8ead5');line(x+46,LAND-36,x+46,LAND-24,'#c9fbe2',3);line(x+40,LAND-30,x+52,LAND-30,'#c9fbe2',3);}
 rr(0,LAND,LENGTH,100,0,'#423c50');rr(0,LAND,LENGTH,10,0,'#a2c49b');rr(0,LAND+10,LENGTH,7,0,'#577e77');for(let x=0;x<LENGTH;x+=90){line(x,LAND+23,x+40,LAND+23,'#605566',3);circle(x+60,LAND+39,3,'#807081');}
 for(const p of platforms){rr(p.x,p.y,p.w,22,7,'#556072','#8daea4');rr(p.x-3,p.y,p.w+6,7,4,'#b7d7a8');for(let x=p.x+12;x<p.x+p.w-10;x+=25)line(x,p.y+10,x+12,p.y+15,'#7d8794',2);}
 for(let i=0;i<15;i++){const x=65+i*320;line(x,LAND-118,x,LAND,'#728c8c',4);rr(x-12,LAND-126,24,30,5,'#f3d599','#bbad85');circle(x,LAND-111,27,'#ffe0a80a');}
 ctx.restore();
}
function actorPlayer(){ctx.save();ctx.translate(player.x,player.y);if(player.inv>0&&Math.floor(clock*18)%2)ctx.globalAlpha=.6;ctx.scale(player.dir,player.crouch?.55:1);const walk=Math.sin(clock*15)*(Math.abs(player.vx)>10?4:0);ctx.fillStyle='#0c263d66';ctx.beginPath();ctx.ellipse(0,0,25,6,0,0,TAU);ctx.fill();rr(-15,-20+walk,12,20,4,'#263749');rr(3,-20-walk,12,20,4,'#263749');rr(-20,-46,40,32,7,'#f7f1df','#1a374b');rr(-24,-40,8,28,4,'#d5e7dc');rr(16,-40,8,28,4,'#d5e7dc');rr(-7,-41,14,26,3,'#64b8ad');circle(0,-62,18,'#eec6a6','#233242');ctx.beginPath();ctx.moveTo(-18,-61);ctx.lineTo(-19,-77);ctx.lineTo(-7,-84);ctx.lineTo(9,-82);ctx.lineTo(19,-74);ctx.lineTo(18,-61);ctx.lineTo(10,-72);ctx.lineTo(-1,-69);ctx.lineTo(-12,-73);ctx.closePath();ctx.fillStyle='#233341';ctx.fill();circle(-6,-61,2,'#22323e');circle(7,-61,2,'#22323e');line(-4,-54,4,-54,'#a46e5a',1.5);
 // Stethoscope always worn; held tool changes with weapon selection.
 ctx.beginPath();ctx.arc(0,-33,10,0,Math.PI);ctx.strokeStyle='#2a5969';ctx.lineWidth=3;ctx.stroke();circle(9,-34,4,'#bfdad8','#426878');
 ctx.save();ctx.translate(24,-29);ctx.rotate(player.attack>0?-.65:-.18);if(weapon===0){ctx.beginPath();ctx.arc(9,0,17,-2,1.8);ctx.strokeStyle='#91ffe0';ctx.lineWidth=4;ctx.stroke();circle(4,17,7,'#d4f4e3','#3c6c6b');}else if(weapon===1){line(0,10,6,-26,'#d6b987',6);rr(-11,-37,36,15,5,'#92bed1','#233e58');rr(-16,-36,9,13,3,'#546579');}else{rr(0,-18,9,35,3,'#dccdf4','#4e4d79');rr(-1,-22,11,7,2,'#fff3ba');}ctx.restore();ctx.restore();
 if(player.shield>0)circle(player.x,player.y-38,62,'#91ffe010','#91ffe0',3);if(player.dash>0)circle(player.x-player.dir*20,player.y-36,28,'#91ffe033');
 text('강렬',player.x,player.y+20,12,palette.mint);
}
function actorBoss(){ctx.save();ctx.translate(boss.x,boss.y-34);ctx.scale(1.65,1.65);if(boss.ko>0){ctx.rotate(Math.sin(clock*8)*.15);ctx.globalAlpha=.55;}drawShinyu(false,boss.mode==='charge'?Math.sin(clock*18)*3:Math.sin(clock*5));if(boss.hit>0)circle(0,-15,35,'#fff6');if(boss.stun>0)text('✦  ✦  ✦',0,-66,16,'#ffe0a0');ctx.restore();text(boss.ko>0?'잠깐… 대본 좀 보자…':'신유 · 압박면접관',boss.x,boss.y+20,12,'#ffd8dd');}
function drawHazard(h){const warning=h.delay>0;ctx.save();if(warning){ctx.globalAlpha=.38+Math.sin(clock*12)*.12;const x=h.kind==='beam'||h.kind==='sweep'?h.x:h.x-h.w/2;if(h.kind==='charge-mark'){rr(h.dir<0?h.x-h.w:h.x,LAND-10,h.w,10,3,'#ff8098');}else if(h.kind==='beam'||h.kind==='sweep'){rr(x,h.y,h.w,h.h,3,'#ffadbf');}else{rr(x,LAND-8,h.w,8,3,'#ffa1b5');ctx.setLineDash([6,9]);line(h.x,100,h.x,LAND,'#ffbccb',2);}ctx.restore();return;}
 if(h.kind==='wave'){ctx.beginPath();ctx.arc(h.x,LAND,h.w*.6,Math.PI,TAU);ctx.strokeStyle='#ffba90';ctx.lineWidth=12;ctx.stroke();}
 if(h.kind==='stamp'){rr(h.x-32,h.y-64,64,64,8,'#52344b','#ff8f9c');text('낙제',h.x,h.y-32,21,'#ffbbbe');}
 if(h.kind==='stomp'){rr(h.x-h.w/2,LAND-h.h,h.w,h.h,18,'#ff9b823a');line(h.x-h.w/2,LAND-3,h.x+h.w/2,LAND-3,'#ffc78d',9);}
 if(h.kind==='beam'||h.kind==='sweep'){rr(h.x,h.y,h.w,h.h,7,'#ff9dbbb0');rr(h.x,h.y+h.h*.35,h.w,h.h*.3,2,'#ffe8cd');}
 if(h.kind==='pillar'){rr(h.x-36,h.y,72,h.h,12,'#bc9ced99','#f2caff');for(let y=h.y+15;y<LAND;y+=35)line(h.x-22,y,h.x+22,y,'#ead5ff',2);}
 if(h.kind==='add'){rr(h.x-21,h.y-48,42,48,9,'#64516b','#dca3c2');circle(h.x-8,h.y-31,4,'#ffddad');circle(h.x+8,h.y-31,4,'#ffddad');text('잔소리',h.x,h.y-62,11,'#e3b6d7');}ctx.restore();
}
function drawEffect(e){ctx.save();ctx.globalAlpha=clamp(e.life/e.max,0,1);const r=1-e.life/e.max;ctx.translate(e.x,e.y);ctx.scale(e.dir,1);if(e.kind==='beam'){line(0,0,e.range,0,e.color+'55',30);line(0,0,e.range,0,e.color,7);}else if(e.kind==='recall'){ctx.scale(e.dir,1);line(0,0,boss.x-e.x,boss.y-50-e.y,'#f5ef9b',6);}else if(e.kind==='wave'||e.kind==='ring'||e.kind==='ultimate'){circle(0,0,e.range*(.2+r*.8),null,e.color,e.kind==='ultimate'?16:8);}else if(e.kind==='trail'){circle(0,0,22,e.color+'44');}else{ctx.beginPath();ctx.arc(0,0,e.range*(.4+r*.6),-1.1,1.1);ctx.strokeStyle=e.color;ctx.lineWidth=e.kind==='hammer'?19:7;ctx.stroke();}ctx.restore();}
function draw(){if(!ctx)return;ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);scenery();ctx.save();ctx.translate(-camera+(shake?(Math.random()-.5)*shake:0),0);for(const h of hazards)drawHazard(h);actorBoss();actorPlayer();for(const e of effects)drawEffect(e);for(const p of particles){ctx.globalAlpha=p.life/.55;circle(p.x,p.y,2.5,p.color);}ctx.globalAlpha=1;for(const f of floaters){ctx.globalAlpha=Math.min(1,f.life*2);text(f.text,f.x,f.y,15,f.color);}ctx.restore();
 rr(20,H-20,W-40,3,2,'#809c9966');circle(20+player.x/LENGTH*(W-40),H-18,4,palette.mint);
}
function resize(){if(!canvas)return;const r=canvas.getBoundingClientRect();if(r.width<1||r.height<1)return;H=540;W=Math.max(640,H*r.width/r.height);const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);camera=clamp(player.x-W*.38,0,Math.max(0,LENGTH-W));draw();}
function frame(now){const dt=Math.min((now-last)/1000||0,.033);last=now;if(active())update(dt);draw();requestAnimationFrame(frame);}
function editable(el){return el instanceof Element&&!!el.closest('input,textarea,select,[contenteditable="true"],[role="textbox"],.recall-av-panel');}
function init(){canvas=document.getElementById('arena');if(!canvas)return;ctx=canvas.getContext('2d');defaults();window.addEventListener('keydown',e=>{if(editable(e.target)||!active()||(e.code==='Space'&&e.target.closest?.('button')))return;const move=['KeyA','KeyD','KeyS','ArrowLeft','ArrowRight','ArrowDown','KeyZ'];const actions={Space:jump,KeyW:jump,ArrowUp:jump,ShiftLeft:dash,ShiftRight:dash,KeyX:skill,KeyC:ultimate,KeyQ:()=>selectWeapon(0),KeyE:()=>selectWeapon(1),KeyF:()=>selectWeapon(2),KeyR:()=>selectWeapon((weapon+1)%3)};if(move.includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='KeyZ'&&!e.repeat)attack();}else if(actions[e.code]){e.preventDefault();if(!e.repeat)actions[e.code]();}});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});
 const joy=document.getElementById('joystick'),stick=document.getElementById('stick');const setJoy=e=>{const r=joy.getBoundingClientRect(),delta=clamp((e.clientX-r.left-r.width/2)/(r.width*.3),-1,1);stickInput=delta;stick.style.transform=`translate(${delta*r.width*.3}px,0)`;};joy?.addEventListener('pointerdown',e=>{e.preventDefault();if(joyId!==null)return;joyId=e.pointerId;joy.setPointerCapture(e.pointerId);setJoy(e);});joy?.addEventListener('pointermove',e=>{if(e.pointerId===joyId)setJoy(e);});const release=e=>{if(e.pointerId===joyId){joyId=null;stickInput=0;stick.style.transform='';}};for(const n of ['pointerup','pointercancel','lostpointercapture'])joy?.addEventListener(n,release);
 const bind=(id,fn,hold=false)=>{const b=document.getElementById(id);if(!b)return;b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(hold)touchAttack=true;fn();});for(const n of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(n,()=>{if(hold)touchAttack=false;});b.addEventListener('click',e=>{if(e.detail===0&&e.pointerType!=='touch')fn();});};bind('jumpBtn',jump);bind('dashBtn',dash);bind('attackBtn',attack,true);bind('skillBtn',skill);bind('ultBtn',ultimate);const crouch=document.getElementById('crouchBtn');crouch?.addEventListener('pointerdown',e=>{e.preventDefault();crouch.setPointerCapture(e.pointerId);keys.add('ArrowDown');});for(const n of ['pointerup','pointercancel','lostpointercapture'])crouch?.addEventListener(n,()=>keys.delete('ArrowDown'));document.querySelectorAll('[data-weapon]').forEach(b=>b.addEventListener('click',()=>{selectWeapon(+b.dataset.weapon);b.blur();}));
 window.addEventListener('resize',resize);new ResizeObserver(resize).observe(canvas);resize();updateControls();requestAnimationFrame(frame);
}
window.Barrage={start,stop,pause,jump,dash,attack,skill,ultimate,selectWeapon,strike,setSound(value){soundEnabled=!!value;if(soundEnabled)unlock();},getState};
if(['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).has('qa'))window.barrageQA={hit(){player.inv=0;player.shield=0;hurt();return getState();},step(seconds){for(let i=0;i<Math.round(seconds*60);i++)if(active())update(1/60);return getState();},pattern(i){hazards=[];boss.mode='idle';boss.stun=0;boss.ko=0;queuePattern(i);return getState();},place(x,y=LAND){player.x=x;player.y=y;player.vy=0;player.ground=y===LAND;player.jumps=0;return getState();},bossNear(){boss.x=player.x+90;boss.y=player.y;boss.stun=10;return getState();},energy(){energy=100;ultCD=0;return getState();},hazards(){return hazards.map(h=>({...h}));}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
