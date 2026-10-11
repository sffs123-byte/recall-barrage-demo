(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const deck = window.STUDY_DECK.cards;
  const levels = {core:'한줄 핵심 · 최우선','3':'빨강 · 3단계 강조','2':'주황 · 2단계 강조','1':'노랑 · 1단계 강조'};
  let density='normal', sound=false, mode='title', previous='running', queue=[], cursor=0, records=[], card=null, stage='idle', remaining=0, stageLimit=1, feedbackTime=0, elapsed=0, score=0, combo=0, bestCombo=0, repeats=0, choiceOrder=[], last=performance.now();
  const shuffle = values => {const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  function setText(id,text){$(id).textContent=text;}
  function button(label,fn,className='answer-btn') {const b=document.createElement('button');b.type='button';b.className=className;b.textContent=label;let lastTouch=-1000;b.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){e.preventDefault();lastTouch=performance.now();fn();b.blur();}});b.addEventListener('click',e=>{if(e.detail!==0&&performance.now()-lastTouch<700)return;fn();b.blur();});return b;}
  function clearAnswers(){ $('answerArea').replaceChildren(); }
  function readout(){
    const state=window.Barrage.getState();
    setText('healthValue',Math.max(0,Math.ceil(state.hp)));
    setText('scoreValue',score.toLocaleString());setText('comboValue',combo+'×');
    setText('clockValue',Math.floor(elapsed/60)+':'+String(Math.floor(elapsed%60)).padStart(2,'0'));
    setText('progressValue',mode==='title'?'0 / 9':Math.min(cursor+1,queue.length)+' / '+queue.length);
    setText('questionTimer',stage==='feedback'?'확인':Math.max(0,Math.ceil(remaining))+'초');
    $('timeFill').style.width=Math.max(0,Math.min(100,remaining/stageLimit*100))+'%';
  }
  function begin(){
    queue=deck.map(c=>({...c,retry:false}));cursor=0;records=[];repeats=0;elapsed=0;score=0;combo=0;bestCombo=0;mode='running';
    $('startScreen').hidden=true;$('endScreen').hidden=true;document.body.classList.add('playing');document.body.classList.remove('paused');
    $('pauseBtn').disabled=false;$('pauseBtn').textContent='Ⅱ';$('pauseBtn').setAttribute('aria-label','일시정지');
    window.Barrage.setSound(sound);window.Barrage.start({density,onHit:readout,onDefeat:()=>finish('defeat')});
    nextCard();readout();
  }
  function nextCard(){
    if(cursor>=queue.length){finish('complete');return;}
    card=queue[cursor];stage=card.kind==='recall'?'recall':'think';stageLimit=card.seconds;remaining=stageLimit;feedbackTime=0;
    $('studyPanel').dataset.level=card.level;
    setText('topicLabel',(card.retry?'다시 도전 · ':'')+card.topic);setText('priorityLabel',levels[card.level]);setText('questionText',card.prompt);
    setText('feedback','');$('feedback').className='feedback';setText('sourceText','');$('sourceText').hidden=true;clearAnswers();
    if(card.kind==='recall'){
      setText('questionHint','한줄 전체를 회상 → 원문과 자기확인. 탄막은 계속!');
      $('answerArea').append(button('Enter · 떠올렸으면 답 보기',reveal,'answer-btn primary'));
    }else{
      choiceOrder=shuffle(card.choices.map((text,index)=>({text,index})));
      setText('questionHint','2.5초 먼저 떠올려봐. Enter로 보기를 바로 열 수도 있어.');
      $('answerArea').append(button('Enter · 보기 열기',reveal,'answer-btn'));
    }
    readout();
  }
  function reveal(){
    if(mode!=='running')return;
    if(stage==='think'){
      stage='choice';clearAnswers();setText('questionHint','1 · 2 · 3 또는 터치로 선택 · 이동과 회피는 계속');
      choiceOrder.forEach((c,index)=>$('answerArea').append(button((index+1)+' · '+c.text,()=>answerChoice(index))));
    }else if(stage==='recall'){
      stage='selfcheck';remaining=8;stageLimit=8;clearAnswers();
      setText('questionText','원문과 비교해. 핵심을 빠짐없이 떠올렸어?');
      setText('questionHint','자기확인 방식 · 자동 음성 채점 아님');setText('sourceText',card.answerText);$('sourceText').hidden=false;
      $('answerArea').append(button('1 · 떠올렸어',()=>submit(true,'self')),button('2 · 놓쳤어',()=>submit(false,'self')));
    }
  }
  function answerChoice(index){if(mode!=='running'||stage!=='choice'||!choiceOrder[index])return;submit(choiceOrder[index].index===card.answer,'choice',index);}
  function submit(ok,type,selected=-1){
    if(mode!=='running'||!['choice','selfcheck','recall','think'].includes(stage))return;
    records.push({id:card.id,topic:card.topic,kind:card.kind,ok,type,retry:card.retry,source:card.source,reference:card.reference});
    if(ok){combo++;bestCombo=Math.max(bestCombo,combo);const points=card.level==='core'?200:card.level==='3'?160:100;score+=points+Math.min(combo,6)*10;window.Barrage.strike(card.level==='core'?2:card.level==='3'?1.5:1);}
    else {combo=0;if(!card.retry&&repeats<3){const insertion=Math.min(cursor+3,queue.length);queue.splice(insertion,0,{...card,retry:true});repeats++;}}
    stage='feedback';feedbackTime=2.6;remaining=0;
    setText('feedback',ok?(type==='self'?'자기확인 완료! 기억 반격 +200':'정답! 기억 반격 발동'):(type==='timeout'?'시간 초과 · 원문을 보고 다시 만나자':'놓친 핵심을 확인! 잠시 뒤 다시 등장'));
    $('feedback').className='feedback '+(ok?'success':'miss');
    setText('sourceText',card.source);$('sourceText').hidden=false;setText('questionHint',card.reference+' · 정답 확인 중에도 탄막 진행');
    if(card.kind==='choice'){
      clearAnswers();choiceOrder.forEach((c,i)=>{const b=button((i+1)+' · '+c.text,()=>{});b.disabled=true;if(c.index===card.answer)b.classList.add('correct');else if(i===selected)b.classList.add('wrong');$('answerArea').append(b);});
    }else{clearAnswers();$('answerArea').append(button('다음 핵심 준비 중…',()=>{},'answer-btn'));$('answerArea').firstChild.disabled=true;}
    readout();
  }
  function togglePause(){
    if(mode==='running'){previous=mode;mode='paused';window.Barrage.pause(true);document.body.classList.add('paused');$('pauseBtn').textContent='▶';$('pauseBtn').setAttribute('aria-label','계속하기');}
    else if(mode==='paused'){mode=previous;window.Barrage.pause(false);document.body.classList.remove('paused');$('pauseBtn').textContent='Ⅱ';$('pauseBtn').setAttribute('aria-label','일시정지');last=performance.now();}
  }
  function finish(reason){
    if(!['running','paused'].includes(mode))return;
    const combat=window.Barrage.getState();mode='result';window.Barrage.stop();document.body.classList.remove('playing','paused');$('pauseBtn').disabled=true;$('endScreen').hidden=false;
    const choices=records.filter(r=>r.kind==='choice'), recall=records.filter(r=>r.kind==='recall');
    setText('resultTitle',reason==='complete'?'압박면접 완주!':'멘탈이 먼저 방전됐다!');
    setText('resultSummary',reason==='complete'?'피하면서 떠올린 핵심, 놓친 것만 한 번 더 확인해.':'중간에 놓친 핵심을 확인하고 다시 도전해. 문제와 탄막은 계속 함께 간다.');
    $('resultStats').replaceChildren();
    for(const [label,value] of [['점수',score.toLocaleString()],['키워드 선택',choices.filter(r=>r.ok).length+' / '+choices.length],['한줄 자기확인',recall.filter(r=>r.ok).length+' / '+recall.length],['피격 / 최고콤보',combat.hits+'회 / '+bestCombo+'×']]){const box=document.createElement('div');const small=document.createElement('small');small.textContent=label;const b=document.createElement('b');b.textContent=value;box.append(small,b);$('resultStats').append(box);}
    $('reviewList').replaceChildren();
    const missed=[...new Map(records.filter(r=>!r.ok).map(r=>[r.id,r])).values()];
    if(reason==='defeat'&&card&&!records.some(r=>r.id===card.id))missed.push({...card,reference:'아직 답하지 않은 핵심'});
    const title=document.createElement('h3');title.textContent=missed.length?'놓친 핵심 · 원문 그대로':'한줄 핵심 3개 · 다시 꺼내보기';$('reviewList').append(title);
    const review=missed.length?missed:deck.filter(r=>r.kind==='recall');
    for(const r of review){const row=document.createElement('div');row.className='review-item';const h=document.createElement('strong');h.textContent=r.topic;const text=document.createElement('p');text.textContent=r.source;row.append(h,text);$('reviewList').append(row);}
    const note=document.createElement('p');note.className='muted';note.textContent='선택 정답과 한줄 자기확인은 별도 기록입니다. 점수는 실제 시험 실력 판정이 아니며 CNU 진도에는 저장되지 않습니다.';$('reviewList').append(note);
    $('restartBtn').focus({preventScroll:true});readout();
  }
  function tick(dt){
    if(mode!=='running')return;
    elapsed+=dt;
    if(stage==='feedback'){feedbackTime-=dt;if(feedbackTime<=0){cursor++;nextCard();}}
    else{
      remaining-=dt;
      if(stage==='think'&&remaining<=stageLimit-2.5)reveal();
      if(remaining<=0){if(stage==='recall')reveal();else submit(false,'timeout');}
    }
    readout();
  }
  function frame(time){const dt=Math.min((time-last)/1000,.033);last=time;tick(dt);requestAnimationFrame(frame);}
  document.querySelectorAll('[data-density]').forEach(b=>b.addEventListener('click',()=>{density=b.dataset.density;document.querySelectorAll('[data-density]').forEach(v=>{const on=v===b;v.classList.toggle('selected',on);v.setAttribute('aria-pressed',String(on));});}));
  $('startBtn').addEventListener('click',begin);$('restartBtn').addEventListener('click',begin);$('pauseBtn').addEventListener('click',togglePause);
  $('soundBtn').addEventListener('click',()=>{sound=!sound;window.Barrage.setSound(sound);$('soundBtn').textContent=sound?'소리 ON':'소리 OFF';$('soundBtn').setAttribute('aria-pressed',String(sound));});
  window.addEventListener('keydown',e=>{
    if(e.repeat)return;
    if(['KeyP','Escape'].includes(e.code)){e.preventDefault();togglePause();return;}
    if(mode!=='running')return;
    if(e.code==='Enter'){e.preventDefault();reveal();return;}
    const n={Digit1:0,Digit2:1,Digit3:2,Numpad1:0,Numpad2:1,Numpad3:2}[e.code];
    if(n===undefined)return;e.preventDefault();if(stage==='choice')answerChoice(n);else if(stage==='selfcheck'&&n<2)submit(n===0,'self');
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='running')togglePause();});
  const snapshot=()=>({mode,stage,remaining:Math.round(remaining*10)/10,elapsed:Math.round(elapsed*10)/10,score,combo,bestCombo,index:cursor,total:queue.length,repeats,current:card?{id:card.id,kind:card.kind,level:card.level,topic:card.topic,retry:card.retry}:null,attempts:records.map(({id,ok,type,retry})=>({id,ok,type,retry})),combat:window.Barrage.getState()});
  window.StudyDemo={state:snapshot};
  if(['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).has('qa'))window.demoQA={step:seconds=>{for(let i=0;i<Math.round(seconds*60);i++)tick(1/60);return snapshot();}};
  setText('topicLabel','동시 회상 모드');setText('priorityLabel','3개 CC 체험판');setText('questionText','탄막을 피하며 머릿속 대본을 꺼내봐.');setText('questionHint','문제와 정답 확인 중에도 멈추지 않습니다.');setText('feedback','');$('sourceText').hidden=true;readout();requestAnimationFrame(frame);
})();
