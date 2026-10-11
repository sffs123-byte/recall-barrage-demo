/* Original Recall Rush sound design + bounded Canvas effects. No study content or progress writes. */
(() => {
  'use strict';
  const VERSION='recall-rush-2', KEY='recall-barrage-av-v1';
  const scriptURL=document.currentScript?.src || location.href;
  const musicURL=new URL('assets/audio/recall-rush-loop.mp3',scriptURL).href;
  const reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  let prefs={music:.35,sfx:.65,motion:'full'};
  try{const p=JSON.parse(localStorage.getItem(KEY)||'{}');for(const k of ['music','sfx'])if(Number.isFinite(p[k]))prefs[k]=clamp(p[k],0,1);if(['full','gentle'].includes(p.motion))prefs.motion=p.motion;}catch{}
  let enabled=false,active=false,paused=false,context=null,master=null,musicGain=null,sfxGain=null,track=null;
  let musicState='idle',audioError='',canvas,paint,wrap,banner,settings,notice;
  let width=1,height=1,previousState=null,lastFrame=0,lastPoll=0,combo=0,duckUntil=0,unlocked=false;
  let bits=[],rings=[],labels=[],settingsTrigger=null;
  const counts={},recent={},timers=new Set();
  const gentle=()=>reducedQuery.matches||prefs.motion==='gentle';
  const studyCombo=()=>{const value=window.StudyDemo?.state?.().combo;return Number.isFinite(value)?value:parseInt(document.getElementById('comboValue')?.textContent||'0',10)||0;};
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch{}};
  function smooth(node,value,seconds=.08){if(!context||!node)return;node.gain.cancelScheduledValues(context.currentTime);node.gain.setTargetAtTime(value,context.currentTime,seconds);}
  function levels(){smooth(master,enabled&&!paused&&!document.hidden?1:0);smooth(musicGain,prefs.music*(performance.now()<duckUntil?.45:1));smooth(sfxGain,prefs.sfx);}
  function timeout(fn,ms){const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;}
  function clearTimers(){for(const id of timers)clearTimeout(id);timers.clear();document.getElementById('studyPanel')?.classList.remove('fx-confirm');}
  function setNotice(message){if(notice)notice.textContent=message;}
  function unlock(){
    if(!enabled)return;
    try{
      if(!context){
        const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Audio unavailable');
        context=new Audio({latencyHint:'interactive'});master=context.createGain();musicGain=context.createGain();sfxGain=context.createGain();
        const limiter=context.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=5;limiter.attack.value=.003;limiter.release.value=.16;
        musicGain.connect(master);sfxGain.connect(master);master.connect(limiter);limiter.connect(context.destination);master.gain.value=0;musicGain.gain.value=prefs.music;sfxGain.gain.value=prefs.sfx;
        track=new window.Audio();track.src=musicURL;track.loop=true;track.preload='none';
        context.createMediaElementSource(track).connect(musicGain);
        track.addEventListener('playing',()=>{musicState='playing';audioError='';setNotice('RECALL RUSH · 오리지널 아케이드 BGM');});
        track.addEventListener('error',()=>{musicState='unavailable';audioError='music-file';setNotice('음악을 불러오지 못했어요. 효과음은 계속 사용할 수 있어요.');});
      }
      unlocked=true;context.resume().then(()=>{levels();syncMusic();}).catch(()=>{audioError='gesture';setNotice('소리 버튼을 눌러 음악을 다시 시작해 주세요.');});levels();
    }catch{audioError='unsupported';setNotice('이 브라우저에서 오디오를 시작하지 못했어요. 게임은 계속할 수 있어요.');}
  }
  function syncMusic(){
    if(!track)return;
    if(enabled&&active&&!paused&&!document.hidden&&prefs.music>0&&context?.state==='running'){
      if(track.paused){musicState='loading';track.play().catch(()=>{musicState='blocked';audioError='play';setNotice('소리 버튼을 다시 누르면 음악을 시작해요.');});}
    }else{track.pause();if(musicState==='playing')musicState='paused';}
    levels();
  }
  function setEnabled(value){enabled=Boolean(value);const btn=document.getElementById('soundBtn');if(btn){btn.textContent=enabled?'소리 ON':'소리 OFF';btn.setAttribute('aria-pressed',String(enabled));btn.setAttribute('aria-label',enabled?'배경음악과 효과음 끄기':'배경음악과 효과음 켜기');}if(enabled)unlock();syncMusic();}
  function note(freq,start,duration,volume=.09,type='sine',end){
    if(!enabled||paused||document.hidden||!context||context.state!=='running'||prefs.sfx===0)return;
    const at=context.currentTime+start,o=context.createOscillator(),g=context.createGain();o.type=type;o.frequency.setValueAtTime(freq,at);if(end)o.frequency.exponentialRampToValueAtTime(Math.max(20,end),at+duration);
    g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),at+.008);g.gain.exponentialRampToValueAtTime(.0001,at+duration);o.connect(g);g.connect(sfxGain);o.start(at);o.stop(at+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  function chord(notes,speed=.06,duration=.22,volume=.08){notes.forEach((n,i)=>note(n,i*speed,duration,volume,'triangle'));}
  function sound(name,detail){
    if(name==='start')chord([261.63,329.63,392,523.25],.065,.24,.085);
    else if(name==='correct'){const shift=Math.min(detail.combo||1,8)*9;chord([523.25+shift,659.25+shift,783.99+shift],.045,.19,.07);}
    else if(name==='combo'){chord([523.25,659.25,783.99,1046.5],.07,.32,.075);note(130.81,0,.24,.10);}
    else if(name==='dash'){note(190,0,.13,.065,'sine',880);note(700,.035,.09,.025,'triangle',240);}
    else if(name==='hit'){note(120,0,.12,.07,'triangle',58);note(82,.035,.1,.04,'sine');}
    else if(name==='miss')chord([392,329.63],.10,.19,.065);
    else if(name==='reveal')chord([659.25,783.99],.055,.12,.04);
    else if(name==='recover')chord([261.63,392,523.25,659.25],.09,.24,.07);
    else if(name==='phase'){chord([196,261.63,392],.10,.3,.055);}
    else if(name==='complete'){chord([261.63,329.63,392,523.25,659.25,783.99,1046.5],.10,.48,.075);note(130.81,0,.65,.09);}
  }
  function point(state=window.Barrage?.getState()){const p=state?.player,w=state?.world;return p&&w?{x:p.x/w.width*width,y:p.y/w.height*height}:{x:width*.5,y:height*.65};}
  function ring(x,y,color='#8affdc',radius=75){rings.push({x,y,color,radius,age:0,life:gentle()?.28:.55});rings=rings.slice(-10);}
  function particles(x,y,color,count=18){if(gentle())return;for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=35+Math.random()*145;bits.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-25,age:0,life:.45+Math.random()*.35,size:1.5+Math.random()*2.5,color});}bits=bits.slice(-110);}
  function floating(text,x,y,color){labels=labels.filter(l=>l.text!==text);labels.push({text,x,y,color,age:0,life:1.1});labels=labels.slice(-2);}
  function announce(title,sub='',color='mint'){if(!banner)return;banner.replaceChildren();const b=document.createElement('b'),small=document.createElement('span');b.textContent=title;small.textContent=sub;banner.append(b,small);banner.dataset.color=color;banner.classList.remove('show');void banner.offsetWidth;banner.classList.add('show');banner.dataset.until=String(performance.now()+1600);}
  function emit(name,detail={}){
    const now=performance.now();if(now-(recent[name]??-10000)<(name==='hit'?200:65))return;recent[name]=now;counts[name]=(counts[name]||0)+1;
    if(name==='start'){combo=studyCombo();bits=[];rings=[];labels=[];announce('RECALL RUSH','피하면서, 하나씩 떠올려.');}
    if(name==='correct'){
      combo=Number.isFinite(detail.combo)?detail.combo:combo+1;detail={...detail,combo};const p=point();ring(p.x,p.y,'#a4ffe0',65);particles(width*.5,height*.27,'#eaff97',22);floating('기억 반격!',width*.5,height*.43,'#eaff97');
      document.getElementById('studyPanel')?.classList.add('fx-confirm');timeout(()=>document.getElementById('studyPanel')?.classList.remove('fx-confirm'),450);
      if(combo>=3&&(combo===3||combo===5||combo%10===0)){const streak=combo;timeout(()=>{if(studyCombo()>=streak)emit('combo',{combo:streak});},110);}
    }
    if(name==='combo'){announce(`${detail.combo||combo} 연속 회상!`,(detail.combo||combo)>=10?'기억이 쌓이고 있어!':'좋아, 리듬 탔어!','gold');particles(width*.5,height*.35,'#ffe493',36);ring(width*.5,height*.35,'#ffe493',130);}
    if(name==='dash'){const p=point();ring(p.x,p.y,'#98eaff',45);particles(p.x,p.y,'#98eaff',9);}
    if(name==='hit'){const p=point();ring(p.x,p.y,'#ff91aa',34);combo=studyCombo();}
    if(name==='miss'){combo=0;floating('다시 만나면 기억할 거야',width*.5,height*.52,'#ffc78f');}
    if(name==='recover'){announce('다시 집중!','회상은 계속된다.');const p=point();ring(p.x,p.y,'#a4ffe0',110);particles(p.x,p.y,'#a4ffe0',28);}
    if(name==='phase')announce(`PHASE ${detail.phase||2}`,'탄막은 거세져도, 기억은 선명하게.','ice');
    if(name==='complete'){announce('RECALL COMPLETE','오늘의 회상을 해냈어!','gold');particles(width*.5,height*.4,'#ffe493',60);}
    if(['correct','combo','complete','reveal'].includes(name)){duckUntil=now+(name==='complete'?1300:480);levels();}
    sound(name,detail);
  }
  function resize(){if(!canvas||!wrap)return;const r=wrap.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);paint.setTransform(dpr,0,0,dpr,0,0);}
  function poll(){
    const s=window.Barrage?.getState();if(!s)return;
    if(s.running&&!s.paused&&previousState?.running){if(s.hits>previousState.hits)emit('hit');if(s.knockdowns>previousState.knockdowns)emit('recover');if(s.player.dashCooldown>previousState.player.dashCooldown+.3)emit('dash');if(s.phase>previousState.phase)emit('phase',{phase:s.phase});}
    previousState=s;
  }
  function frame(now){
    const dt=Math.min((now-lastFrame)/1000||0,.04);lastFrame=now;
    if(now-lastPoll>65){lastPoll=now;poll();if(duckUntil&&now>duckUntil){duckUntil=0;levels();}}
    if(banner?.classList.contains('show')&&now>Number(banner.dataset.until))banner.classList.remove('show');
    if(paint){paint.clearRect(0,0,width,height);if(!paused&&!document.hidden){
      for(const r of rings){r.age+=dt;const t=r.age/r.life;paint.globalAlpha=(1-t)*.65;paint.strokeStyle=r.color;paint.lineWidth=gentle()?2:3;paint.beginPath();paint.arc(r.x,r.y,gentle()?26:12+t*r.radius,0,Math.PI*2);paint.stroke();}
      for(const p of bits){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=65*dt;paint.globalAlpha=1-p.age/p.life;paint.fillStyle=p.color;paint.fillRect(p.x,p.y,p.size,p.size);}
      for(const l of labels){l.age+=dt;paint.globalAlpha=Math.min(1,(l.life-l.age)*3);paint.font=`700 ${width<450?12:16}px system-ui`;paint.textAlign='center';paint.fillStyle=l.color;paint.fillText(l.text,l.x,l.y-(gentle()?0:l.age*19));}
      rings=rings.filter(r=>r.age<r.life);bits=bits.filter(p=>p.age<p.life);labels=labels.filter(l=>l.age<l.life);paint.globalAlpha=1;
    }}requestAnimationFrame(frame);
  }
  function connectArena(){
    const api=window.Barrage;if(!api||api.__recallFX)return;Object.defineProperty(api,'__recallFX',{value:true});
    const original={start:api.start,stop:api.stop,pause:api.pause,strike:api.strike,setSound:api.setSound};
    api.setSound=value=>{original.setSound(false);setEnabled(value);};
    api.start=options=>{clearTimers();const state=original.start(options);active=true;paused=false;previousState=state;if(track)track.currentTime=0;unlock();syncMusic();emit('start');return state;};
    api.stop=()=>{const state=original.stop();active=false;clearTimers();syncMusic();return state;};
    api.pause=value=>{const state=original.pause(value);paused=state.paused;if(paused){clearTimers();bits=[];rings=[];labels=[];}else unlock();syncMusic();return state;};
    api.strike=power=>{const result=original.strike(power);if(result)emit('correct',{power,combo:studyCombo()});return result;};
  }
  function init(){
    wrap=document.querySelector('.arena-wrap');if(wrap){canvas=document.createElement('canvas');canvas.className='recall-fx-canvas';canvas.setAttribute('aria-hidden','true');wrap.append(canvas);paint=canvas.getContext('2d');banner=document.createElement('div');banner.className='recall-fx-banner';banner.setAttribute('aria-hidden','true');wrap.append(banner);new ResizeObserver(resize).observe(wrap);resize();}
    settings=document.createElement('section');settings.className='recall-av-panel';settings.id='recallAVPanel';settings.hidden=true;settings.setAttribute('aria-label','음악과 연출 설정');
    settings.innerHTML='<div class="av-heading"><b>나만의 게임 리듬</b><button type="button" class="av-close" aria-label="음악과 연출 설정 닫기">×</button></div><label>음악 <input type="range" min="0" max="100" step="5" data-av="music" aria-label="배경음악 음량"><output></output></label><label>효과음 <input type="range" min="0" max="100" step="5" data-av="sfx" aria-label="효과음 음량"><output></output></label><label>연출 <select aria-label="시각 효과 강도"><option value="full">생동감 있게</option><option value="gentle">은은하게</option></select></label><p class="av-note" role="status">소리 ON을 누르면 음악과 효과음이 시작돼요.</p>';
    document.body.append(settings);notice=settings.querySelector('.av-note');
    for(const input of settings.querySelectorAll('input')){const k=input.dataset.av;input.value=String(Math.round(prefs[k]*100));input.nextElementSibling.value=input.value+'%';input.addEventListener('input',()=>{prefs[k]=Number(input.value)/100;input.nextElementSibling.value=input.value+'%';save();syncMusic();});}
    const select=settings.querySelector('select');select.value=gentle()?'gentle':'full';select.addEventListener('change',()=>{prefs.motion=select.value;save();bits=[];document.body.classList.toggle('fx-gentle',gentle());});
    function close(){settings.hidden=true;document.querySelectorAll('[data-av-open]').forEach(b=>b.setAttribute('aria-expanded','false'));settingsTrigger?.focus({preventScroll:true});}
    function open(e){settingsTrigger=e.currentTarget;settings.hidden=!settings.hidden;document.querySelectorAll('[data-av-open]').forEach(b=>b.setAttribute('aria-expanded',String(!settings.hidden)));if(!settings.hidden)settings.querySelector('.av-close').focus({preventScroll:true});}
    settings.querySelector('.av-close').addEventListener('click',close);
    for(const parent of [document.querySelector('.top-actions'),document.querySelector('.saved-record')])if(parent){const b=document.createElement('button');b.type='button';b.className=parent.matches('.top-actions')?'icon-button av-open':'text-button av-title-open';b.dataset.avOpen='';b.textContent='음악·연출';b.setAttribute('aria-controls',settings.id);b.setAttribute('aria-expanded','false');b.addEventListener('click',open);parent.append(b);}
    // Settings do not change combat, recall progress, or game rules.
    for(const b of document.querySelectorAll('[data-av-open],#soundBtn'))b.addEventListener('keydown',e=>{if(['Enter','NumpadEnter','Space'].includes(e.code))e.stopPropagation();});
    settings.addEventListener('keydown',e=>{e.stopPropagation();if(e.code==='Escape'){e.preventDefault();close();}});
    settings.addEventListener('pointerdown',e=>e.stopPropagation());
    document.addEventListener('pointerdown',e=>{if(!settings.hidden&&!settings.contains(e.target)&&!e.target.closest('[data-av-open]'))close();});
    document.addEventListener('visibilitychange',()=>{syncMusic();if(document.hidden){bits=[];rings=[];labels=[];}});
    document.body.classList.toggle('fx-gentle',gentle());reducedQuery.addEventListener?.('change',()=>{bits=[];document.body.classList.toggle('fx-gentle',gentle());});
    // Observe presentation-only state so this module needs no edits to study.js.
    const feedback=document.getElementById('feedback');
    if(feedback)new MutationObserver(()=>{if(active&&feedback.classList.contains('miss'))emit('miss');}).observe(feedback,{childList:true,characterData:true,subtree:true});
    const source=document.getElementById('sourceText');
    if(source)new MutationObserver(()=>{if(active&&!source.hidden)emit('reveal');}).observe(source,{attributes:true,attributeFilter:['hidden']});
    const end=document.getElementById('endScreen');
    if(end)new MutationObserver(()=>{if(!end.hidden)emit('complete');}).observe(end,{attributes:true,attributeFilter:['hidden']});
    const preview=document.createElement('button');preview.type='button';preview.className='av-preview';preview.textContent='소리 켜기 / 끄기';preview.addEventListener('click',()=>{document.getElementById('soundBtn')?.click();if(enabled)emit('reveal');});settings.insertBefore(preview,notice);
    connectArena();setEnabled(false);requestAnimationFrame(frame);
  }
  window.StudyFX={version:VERSION,emit,setEnabled,getState:()=>({version:VERSION,enabled,active,paused,unlocked,musicState,audioError,audioContext:context?.state||'none',musicTime:track?.currentTime||0,musicPaused:track?.paused??true,preferences:{...prefs},reducedMotion:gentle(),events:{...counts},particles:bits.length,rings:rings.length})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
