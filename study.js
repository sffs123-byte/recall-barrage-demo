(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const deckData=window.STUDY_DECK||{}, deck=deckData.cards||[], byId=new Map(deck.map(c=>[c.id,c]));
  const levels={core:'한줄 핵심 · 최우선','3':'빨강 · 3단계 강조','2':'주황 · 2단계 강조','1':'노랑 · 1단계 강조','0':'CC 전범위 · 원문 회상'};
  const STORE='recall-sidequest-progress-v3', LEGACY='recall-barrage-progress-v2', schema=3;
  let hash=2166136261;for(const c of deck)for(const ch of String(c.id)){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619);}
  const fingerprint=String(deckData.version||'full-cc')+':'+deck.length+':'+(hash>>>0).toString(16);
  let density='normal',sound=false,mode='title',queue=[],mastered=new Set(),reports={},attempts=[],card=null,stage='recall';
  let elapsed=0,score=0,combo=0,bestCombo=0,repeats=0,answerCount=0,combatSaved=null,saved=false,storageFailed=false,last=performance.now(),lastSave=0,lastReadout=0;
  const shuffle=values=>{const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const text=(id,value)=>{const el=$(id);if(el)el.textContent=String(value);};
  // A touch can end on a newly rendered button; share suppression across replacements.
  let lastAnswerTouch=-1000;
  function button(label,fn,className='answer-btn'){
    const b=document.createElement('button');b.type='button';b.className=className;b.textContent=label;
    b.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){e.preventDefault();lastAnswerTouch=performance.now();fn();b.blur();}});
    b.addEventListener('click',e=>{if(e.pointerType==='touch'||e.detail!==0&&performance.now()-lastAnswerTouch<700)return;fn();b.blur();});return b;
  }
  function freshQueue(){
    // Rotate between card types and emphasis levels, so a large category never monopolizes the opening.
    const buckets=new Map();for(const c of deck){const k=String(c.level)+'|'+c.kind;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(c.id);}
    const rank={core:5,'3':4,'2':3,'1':2,'0':1};
    const groups=[...buckets.entries()].sort((a,b)=>(rank[b[0].split('|')[0]]||0)-(rank[a[0].split('|')[0]]||0)).map(([,v])=>shuffle(v));
    const out=[];for(let round=0;groups.some(g=>g.length>round);round++)for(const group of groups)if(group[round])out.push(group[round]);return out;
  }
  function resetState(){queue=freshQueue();mastered=new Set();reports={};attempts=[];card=null;stage='recall';elapsed=score=combo=bestCombo=repeats=answerCount=0;combatSaved=null;saved=false;lastSave=0;lastReadout=0;}
  function restore(){
    resetState();try{
      const raw=localStorage.getItem(STORE)||localStorage.getItem(LEGACY);if(!raw)return;let data=JSON.parse(raw);
      if(data.schema===2){const prior=new Set(data.mastered||[]);const converted=deck.filter(c=>prior.has(c.id)||(c.replaces?.length&&c.replaces.every(id=>prior.has(id)))).map(c=>c.id);data={...data,schema,fingerprint,mastered:converted,queue:(data.queue||[]).filter(id=>byId.has(id)),stage:'recall'};text('savedProgress','기존 진도를 이어왔어요. CC별 강조는 묶음으로 다시 확인해요.');}
      if(data.schema!==schema||data.fingerprint!==fingerprint){text('savedProgress','범위가 업데이트되어 이번 전범위는 새 기록으로 시작합니다.');return;}
      mastered=new Set((data.mastered||[]).filter(id=>byId.has(id)));
      queue=[...new Set((data.queue||[]).filter(id=>byId.has(id)&&!mastered.has(id)))];
      for(const c of deck)if(!mastered.has(c.id)&&!queue.includes(c.id))queue.push(c.id);
      reports={};for(const [id,r] of Object.entries(data.reports||{}))if(byId.has(id)&&r&&typeof r==='object')reports[id]={attempts:Math.max(0,Number(r.attempts)||0),misses:Math.max(0,Number(r.misses)||0),lastOk:!!r.lastOk};
      attempts=(data.attempts||[]).filter(r=>byId.has(r.id)).slice(-100).map(r=>({id:r.id,ok:!!r.ok,type:'self',retry:!!r.retry}));
      for(const name of ['elapsed','score','combo','bestCombo','repeats','answerCount'])data[name]=Math.max(0,Number(data[name])||0);
      ({elapsed,score,combo,bestCombo,repeats,answerCount}=data);stage=data.stage==='selfcheck'?'selfcheck':'recall';combatSaved=data.combat||null;
      if(['calm','normal','chaos'].includes(data.density))density=data.density;saved=true;
    }catch{storageFailed=true;resetState();}
  }
  function save(){
    if(!deck.length)return;
    if(mode!=='title')combatSaved=window.Barrage.getState();
    try{localStorage.setItem(STORE,JSON.stringify({schema,fingerprint,mastered:[...mastered],queue,reports,attempts,elapsed,score,combo,bestCombo,repeats,answerCount,stage,density,combat:combatSaved}));saved=true;storageFailed=false;text('saveStatus','이 브라우저에 자동 저장 · CNU 진도와 별개');}
    catch{storageFailed=true;text('saveStatus','브라우저 저장 불가 · 창을 닫으면 진도가 사라질 수 있어요');}
    lastSave=elapsed;
  }
  function duration(value){return Math.floor(value/60)+':'+String(Math.floor(value%60)).padStart(2,'0');}
  function readout(){
    const state=mode==='title'&&combatSaved?combatSaved:window.Barrage.getState();
    text('healthValue',Math.max(0,Math.ceil(state.hp??100)));text('scoreValue',score.toLocaleString());text('comboValue',combo+'×');text('clockValue',duration(elapsed));
    text('progressValue',mastered.size.toLocaleString()+' / '+deck.length.toLocaleString());text('retryValue',repeats.toLocaleString());
    text('questionTimer',mode==='result'?'전체 확인':stage==='selfcheck'?'자기확인':'무제한 회상');
    if($('timeFill'))$('timeFill').style.width=(deck.length?mastered.size/deck.length*100:0)+'%';
  }
  function intro(){
    mode='title';$('startScreen').hidden=false;$('endScreen').hidden=true;document.body.classList.remove('playing','paused');$('pauseBtn').disabled=true;
    const meta=deckData.meta||{};text('deckCount',deck.length.toLocaleString());text('ccCount',meta.ccCount?meta.ccCount+(meta.commonCount?' + 공통 '+meta.commonCount:''):'전범위');text('caseCount',meta.caseCount||'전범위');
    text('scopeSummary','한줄 · CC별 내 강조 회상 · 신체진찰\n증례 진단 · 감별 · 검사 · 치료 · 교육');
    text('startBtn',saved?(mastered.size===deck.length?'전체 완료 · 결과 보기':'저장한 진도 이어하기'):'실기숲 모험 시작');
    if($('resetBtn'))$('resetBtn').hidden=!saved;
    if(saved)text('savedProgress',`${mastered.size.toLocaleString()} / ${deck.length.toLocaleString()}개 확인 · ${duration(elapsed)} 플레이 · 이어서 할 수 있어요.`);
    else if(!$('savedProgress')?.textContent)text('savedProgress','같은 브라우저에서는 자동 저장됩니다. 언제든 끊었다가 이어하세요.');
    text('saveStatus',storageFailed?'이 브라우저에서 저장을 사용할 수 없습니다.':'이 브라우저에 자동 저장 · CNU 진도와 별개');
    text('topicLabel','CC 전범위 · 동시 회상');text('priorityLabel','선택지 없이 자기확인');text('questionText','발판을 뛰어넘으며 머릿속 대본을 꺼내봐.');
    text('questionHint','Enter로 답 보기 → Enter로 떠올렸어 · 2 / Backspace로 놓쳤어');text('feedback','');text('referenceText','');$('sourceText').hidden=true;$('answerArea').replaceChildren();
    document.querySelectorAll('[data-density]').forEach(b=>{const on=b.dataset.density===density;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});readout();
  }
  function begin(){
    if(!deck.length){text('savedProgress','회상 자료를 불러오지 못했습니다. 새로고침해 주세요.');return;}
    mode='running';$('startScreen').hidden=true;$('endScreen').hidden=true;document.body.classList.add('playing');document.body.classList.remove('paused');
    $('pauseBtn').disabled=false;$('pauseBtn').textContent='Ⅱ';$('pauseBtn').setAttribute('aria-label','일시정지');
    window.Barrage.setSound(sound);window.Barrage.start({density,resume:combatSaved||{},onHit:readout,onRecover:()=>{text('feedback','멘탈 충전! 진행 기록은 그대로, 회상은 계속.');$('feedback').className='feedback';save();readout();}});
    last=performance.now();if(!queue.length){finish();return;}showCard();save();
  }
  function renderAnswer(){
    const target=$('sourceText'),answer=String(card.answer??card.answerText??'');target.replaceChildren();
    const ranges=[];
    for(const h of card.highlights||[]){
      const level=String(h.level);if(!['1','2','3'].includes(level))continue;
      if(Number.isInteger(h.start)&&Number.isInteger(h.end)&&h.start>=0&&h.end>h.start&&h.end<=answer.length){ranges.push({start:h.start,end:h.end,level});continue;}
      const phrase=String(h.text||'');if(!phrase.trim())continue;let pos=0;
      while((pos=answer.indexOf(phrase,pos))!==-1){ranges.push({start:pos,end:pos+phrase.length,level});pos+=phrase.length;}
    }
    ranges.sort((a,b)=>a.start-b.start||b.end-a.end||Number(b.level)-Number(a.level));
    let pos=0;for(const r of ranges){if(r.start<pos)continue;if(r.start>pos)target.append(document.createTextNode(answer.slice(pos,r.start)));const span=document.createElement('span');span.className='source-highlight';span.dataset.level=r.level;span.textContent=answer.slice(r.start,r.end);target.append(span);pos=r.end;}
    target.append(document.createTextNode(answer.slice(pos)));target.hidden=false;target.scrollTop=0;
  }
  function showCard(message='',ok=null){
    card=byId.get(queue[0]);if(!card){finish();return;}
    $('studyPanel').dataset.level=String(card.level??0);
    text('topicLabel',((reports[card.id]?.attempts||0)>0?'다시 회상 · ':'')+(card.topic||'CC 증례'));
    text('priorityLabel',card.kind==='cc-emphasis'?'내 강조 · CC 전체':levels[card.level]||levels['0']);text('questionText',card.prompt);
    text('feedback',message);$('feedback').className='feedback'+(ok===true?' success':ok===false?' miss':'');text('referenceText','');
    $('answerArea').replaceChildren();$('sourceText').hidden=true;
    if(stage==='selfcheck'){
      renderAnswer();text('questionHint','방금 답을 보기 전에 빠짐없이 떠올렸어? 자기확인하면 바로 다음 항목.');
      text('referenceText',[card.source,card.reference].filter(Boolean).join(' · '));
      $('answerArea').append(button('Enter · 떠올렸어 → 다음',()=>submit(true),'answer-btn primary'),button('2 · 놓쳤어 → 다시 만나기',()=>submit(false)));
    }else{
      stage='recall';text('questionHint',card.hint||'떠올리는 동안에도 전투는 계속. 준비되면 Enter로 원문과 비교해.');
      $('answerArea').append(button('Enter · 원문 보기',reveal,'answer-btn primary'));
    }
    const content=document.querySelector('.recall-content');if(content){content.scrollTop=0;if(stage==='selfcheck')content.scrollTop=Math.max(0,$('sourceText').getBoundingClientRect().top-content.getBoundingClientRect().top-8);}readout();
  }
  function reveal(){if(mode!=='running'||stage!=='recall'||!card)return;stage='selfcheck';showCard();save();}
  function submit(ok){
    if(mode!=='running'||stage!=='selfcheck'||!card)return;
    const id=card.id,r=reports[id]||(reports[id]={attempts:0,misses:0,lastOk:false}),retry=r.attempts>0;r.attempts++;r.lastOk=ok;answerCount++;
    attempts.push({id,ok,type:'self',retry});if(attempts.length>100)attempts.shift();queue.shift();
    if(ok){mastered.add(id);combo++;bestCombo=Math.max(bestCombo,combo);const points=card.level==='core'?200:String(card.level)==='3'?160:String(card.level)==='2'?130:100;score+=points+Math.min(combo,6)*10;window.Barrage.strike(card.level==='core'?2:String(card.level)==='3'?1.5:1);}
    else{r.misses++;repeats++;combo=0;queue.splice(Math.min(3,queue.length),0,id);}
    stage='recall';const message=ok?'떠올렸어로 기록 · 자기확인 반격!':'놓쳤어로 기록 · 잠시 뒤 다시 등장해요.';
    save();if(queue.length)showCard(message,ok);else finish();
  }
  function togglePause(){
    if(mode==='running'){mode='paused';window.Barrage.pause(true);document.body.classList.add('paused');$('pauseBtn').textContent='▶';$('pauseBtn').setAttribute('aria-label','계속하기');save();}
    else if(mode==='paused'){mode='running';window.Barrage.pause(false);document.body.classList.remove('paused');$('pauseBtn').textContent='Ⅱ';$('pauseBtn').setAttribute('aria-label','일시정지');last=performance.now();}
  }
  function finish(){
    if(mastered.size!==deck.length)return;
    combatSaved=window.Barrage.getState();mode='result';stage='complete';window.Barrage.stop();document.body.classList.remove('playing','paused');$('pauseBtn').disabled=true;$('endScreen').hidden=false;
    text('resultTitle','CC 전범위 회상 완료!');text('resultSummary','모든 항목을 한 번 이상 ‘떠올렸어’로 확인했어. 놓쳤던 원문도 다시 살펴봐.');$('resultStats').replaceChildren();
    for(const [label,value] of [['회상 확인',mastered.size.toLocaleString()+' / '+deck.length.toLocaleString()],['자기확인 반격 점수',score.toLocaleString()],['총 회상 / 다시 회상',answerCount.toLocaleString()+'회 / '+repeats.toLocaleString()+'회'],['플레이 / 멘탈 충전',duration(elapsed)+' / '+(combatSaved.knockdowns||0)+'회']]){const box=document.createElement('div'),small=document.createElement('small'),b=document.createElement('b');small.textContent=label;b.textContent=value;box.append(small,b);$('resultStats').append(box);}
    const review=$('reviewList');review.replaceChildren();const title=document.createElement('h3');title.textContent='놓쳤다가 다시 떠올린 원문';review.append(title);
    const missed=Object.entries(reports).filter(([,r])=>r.misses>0).sort((a,b)=>b[1].misses-a[1].misses);let shown=0;
    const more=button('원문 더 보기',addReview,'answer-btn');
    function addReview(){for(const [id,r] of missed.slice(shown,shown+20)){const c=byId.get(id),row=document.createElement('div'),h=document.createElement('strong'),p=document.createElement('p');row.className='review-item';h.textContent=c.topic+' · 놓쳤어 '+r.misses+'회';p.textContent=c.answer??c.answerText??'';row.append(h,p);review.insertBefore(row,more);}shown+=20;more.hidden=shown>=missed.length;}
    review.append(more);addReview();if(!missed.length){const p=document.createElement('p');p.textContent='이번 회차에서 놓쳤어로 표시한 항목이 없어요.';review.append(p);}
    const note=document.createElement('p');note.className='muted';note.textContent='모든 기록은 본인의 자기확인입니다. 실제 시험 능력이나 장기 기억의 자동 판정이 아니며, CNU 진도에는 저장되지 않습니다.';review.append(note);
    save();readout();$('restartBtn').focus({preventScroll:true});
  }
  function resetProgress(startNow=false){
    if(saved&&!window.confirm('이 브라우저의 모험 회상 진도를 지우고 처음부터 시작할까요? CNU 기록은 바뀌지 않습니다.'))return;
    window.Barrage.stop();try{localStorage.removeItem(STORE);localStorage.removeItem(LEGACY);}catch{}resetState();text('savedProgress','이 브라우저의 진도를 초기화했어요. CNU 기록은 그대로입니다.');intro();if(startNow)begin();
  }
  function tick(dt){if(mode!=='running')return;elapsed+=dt;if(elapsed-lastSave>=5)save();if(elapsed-lastReadout>.15){readout();lastReadout=elapsed;}}
  function frame(time){const dt=Math.min((time-last)/1000,.033);last=time;tick(dt);requestAnimationFrame(frame);}
  document.querySelectorAll('[data-density]').forEach(b=>b.addEventListener('click',()=>{density=b.dataset.density;document.querySelectorAll('[data-density]').forEach(v=>{const on=v===b;v.classList.toggle('selected',on);v.setAttribute('aria-pressed',String(on));});}));
  $('startBtn').addEventListener('click',begin);$('restartBtn').addEventListener('click',()=>resetProgress(true));$('pauseBtn').addEventListener('click',togglePause);$('resetBtn')?.addEventListener('click',()=>resetProgress(false));
  $('soundBtn').addEventListener('click',()=>{sound=!sound;window.Barrage.setSound(sound);text('soundBtn',sound?'소리 ON':'소리 OFF');$('soundBtn').setAttribute('aria-pressed',String(sound));});
  window.addEventListener('keydown',e=>{
    if(e.repeat||e.isComposing||e.target instanceof Element&&e.target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]'))return;
    if(['KeyP','Escape'].includes(e.code)){e.preventDefault();togglePause();return;}if(e.target instanceof Element&&e.target.closest('.combat-bar,.touch-controls,.top-actions,.recall-av-panel'))return;if(mode!=='running')return;
    if(e.code==='Enter'||e.code==='NumpadEnter'){e.preventDefault();if(stage==='recall')reveal();else if(stage==='selfcheck')submit(!e.shiftKey);return;}
    if(['Digit2','Numpad2','Backspace'].includes(e.code)){e.preventDefault();if(stage==='selfcheck')submit(false);}
    else if(['Digit1','Numpad1'].includes(e.code)){e.preventDefault();if(stage==='selfcheck')submit(true);}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='running')togglePause();});window.addEventListener('pagehide',()=>{if(mode!=='title'||saved)save();});
  const snapshot=()=>({mode,stage,remaining:null,elapsed:Math.round(elapsed*10)/10,score,combo,bestCombo,index:answerCount,total:deck.length,pending:queue.length,remembered:mastered.size,repeats,current:card?{id:card.id,kind:card.kind,level:card.level,topic:card.topic,retry:(reports[card.id]?.attempts||0)>0}:null,attempts:attempts.map(r=>({...r})),combat:window.Barrage.getState(),deckVersion:deckData.version,storageKey:STORE});
  window.StudyDemo={state:snapshot};
  if(['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).has('qa'))window.demoQA={step:seconds=>{for(let i=0;i<Math.round(seconds*60);i++)tick(1/60);return snapshot();},pendingIds:()=>[...queue],finishAll:()=>{let guard=deck.length+1;while(mode==='running'&&queue.length&&guard-->0){if(stage==='recall')reveal();submit(true);}return snapshot();}};
  restore();intro();requestAnimationFrame(frame);
})();
