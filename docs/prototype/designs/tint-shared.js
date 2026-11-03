/* Tint page mockups: shared data and pieces. One grade, stored as a graph, shown as layers (Baby Seal) or nodes (Leader Seal). */
(function(){
  var P='M',I={
    image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    scissors:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1L20 20M8.1 15.9L20 4"/>',
    palette:'<path d="M12 3a9 9 0 100 18c1.4 0 2-1 2-2 0-1.5-1.3-1.6-1.3-3 0-1 .8-1.6 2-1.6H17a4 4 0 004-4c0-4-4-7.4-9-7.4z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
    lines:'<path d="M4 12h2M8 7v10M12 4v16M16 8v8M20 11v2"/>',
    upload:'<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>',
    play:'<path d="M8 5l11 7-11 7z" fill="currentColor"/>',
    back:'<path d="M19 5L9 12l10 7zM6 5v14"/>',
    fwd:'<path d="M5 5l10 7-10 7zM18 5v14"/>',
    loop:'<path d="M17 2l3 3-3 3M4 11V9a4 4 0 014-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 01-4 4H4"/>',
    eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff:'<path d="M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3 3.9M6.6 6.6A17 17 0 002 12s3.5 7 10 7a9.7 9.7 0 005.4-1.6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    drop:'<path d="M14 4l6 6M17 7l-9 9-4 1 1-4 9-9"/>',
    circle:'<circle cx="12" cy="12" r="8"/>',
    square:'<rect x="4" y="6" width="16" height="12" rx="1"/>',
    grad:'<path d="M3 8h18M3 16h18" stroke-dasharray="2 2"/><path d="M12 4v16"/>',
    pen:'<path d="M4 20l4-1 11-11-3-3L5 16z"/>',
    copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    paste:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9z"/>',
    folder:'<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
    lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    reset:'<path d="M4 12a8 8 0 108-8 8 8 0 00-6 2.7L4 9M4 4v5h5"/>',
    split:'<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M12 5v14"/>',
    key:'<path d="M12 2l1.6 3.8L17.5 6l-3 2.7.9 4-3.4-2.1-3.4 2.1.9-4-3-2.7 3.9-.2z"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    track:'<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
    still:'<rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>',
    wand:'<path d="M4 20L15 9M14 4v3M19 9h-3M17.5 5.5l-2 2M18 14l1 1M10 4l1 1"/>',
    diamond:'<path d="M12 4l8 8-8 8-8-8z"/>',
    nodes:'<rect x="2" y="9" width="6" height="6" rx="1"/><rect x="16" y="3" width="6" height="6" rx="1"/><rect x="16" y="15" width="6" height="6" rx="1"/><path d="M8 12h4M12 6v12M12 6h4M12 18h4"/>',
    list:'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    chev:'<path d="M9 6l6 6-6 6"/>',
    chevd:'<path d="M6 9l6 6 6-6"/>'
  };
  function ico(n,cls){return '<svg class="ico'+(cls?' '+cls:'')+'" viewBox="0 0 24 24">'+(I[n]||'')+'</svg>';}
  function icons(root){(root||document).querySelectorAll('[data-ic]').forEach(function(e){e.insertAdjacentHTML('afterbegin',ico(e.getAttribute('data-ic')));e.removeAttribute('data-ic');});}

  var IMG='footage/plaza.jpg';
  function W(){return {lift:[0,0],gamma:[0,0],gain:[0,0],offset:[0,0]};}
  function M(){return {lift:0,gamma:0,gain:0,offset:0};}
  function corr(no,name,g,extra){var c={kind:'corr',no:no,name:name,on:true,op:100,limit:null,lut:null,
    g:Object.assign({exp:0,con:1,pivot:.435,sat:1,hue:0,temp:0,tint:0,hi:0,sh:0,vib:0,wheel:W(),master:M()},g)};return Object.assign(c,extra||{});}
  var N={
    n1:corr('01','Balance',{temp:14,tint:-3,wheel:{lift:[0,0],gamma:[0,0],gain:[.0,0],offset:[.18,.1]}},{note:'White balance and exposure'}),
    n2:corr('02','Contrast',{con:1.14,exp:.03}),
    n3:corr('03','Skin',{sat:1.06,temp:6},{limit:'key',limitLabel:'Color key'}),
    n4:corr('04','Sky',{sat:1.12,temp:-9,exp:-.04},{limit:'shape',limitLabel:'Gradient'}),
    n5:corr('05','Warm look',{temp:9,sat:.92,wheel:{lift:[-.12,.18],gamma:[0,0],gain:[.2,-.1],offset:[0,0]}},{lut:'Kodak 2383',op:80}),
    g1:{kind:'group',name:'Skin and sky',blend:'Parallel',on:true,op:100,kids:['n3','n4']},
    s1:{kind:'sealed',name:'Channel split',on:true,op:100,g:{con:1.03}}
  };
  var STACK=['n1','n2','g1','n5','s1'];
  var state={sel:'n3',mode:'baby',compare:false,matte:false,wipe:50,listeners:[]};

  function emit(){state.listeners.forEach(function(f){f();});}
  function on(f){state.listeners.push(f);}
  function sel(id){state.sel=id;emit();}

  /* how the stack looks in the viewer: a rough CSS stand-in for the real grade */
  function compose(upto){
    var b=1,c=1,s=1,temp=0,tint=0,wx=0,wy=0,ids=[];
    STACK.forEach(function(id){var n=N[id];if(n.kind==='group'){if(n.on){n.kids.forEach(function(k){ids.push([k,n.op/100]);});}}else{ids.push([id,1]);}});
    for(var i=0;i<ids.length;i++){
      var id=ids[i][0],n=N[id],w=ids[i][1]*n.op/100;if(!n.on){continue;}
      if(n.kind==='sealed'){c*=1+(n.g.con-1)*w;continue;}
      var g=n.g;if(n.limit){w*=.55;}
      b*=1+(g.exp+g.master.gain*.3+g.master.gamma*.2+g.master.lift*.1+g.master.offset*.25+g.hi*.002+g.sh*.002)*w;
      c*=1+(g.con-1)*w;s*=1+(g.sat-1+g.vib*.004)*w;temp+=g.temp*w;tint+=g.tint*w;
      ['lift','gamma','gain','offset'].forEach(function(k,j){var f=[.35,.55,.75,1][j];wx+=g.wheel[k][0]*f*w;wy+=g.wheel[k][1]*f*w;});
      if(n.lut){temp+=4*w;c*=1+.05*w;s*=1-.04*w;}
      if(upto===id){break;}
    }
    return {b:b,c:c,s:s,temp:temp,tint:tint,wx:wx,wy:wy};
  }
  function filterOf(k){return 'brightness('+k.b.toFixed(3)+') contrast('+k.c.toFixed(3)+') saturate('+k.s.toFixed(3)+')';}
  function overlays(k){
    var t=Math.min(Math.abs(k.temp)/60,.8),ti=Math.min(Math.abs(k.tint)/60,.6);
    var mag=Math.min(Math.hypot(k.wx,k.wy),1),hue=(Math.atan2(k.wx,-k.wy)*180/Math.PI+360)%360;
    return [k.temp>=0?'rgb(255 140 40/'+t+')':'rgb(40 120 255/'+t+')',k.tint>=0?'rgb(220 60 210/'+ti+')':'rgb(60 200 90/'+ti+')','hsl('+hue+' 90% 55%/'+(mag*.7)+')'];
  }
  function thumbStyle(id){var k=compose(id);return 'filter:'+filterOf(k)+' sepia('+Math.max(0,k.temp/140).toFixed(2)+')';}

  /* Baby Seal: the layer list */
  function layerRow(id,inGroup){
    var n=N[id],chips='';
    if(n.limit){chips+='<span class="chip key">'+n.limitLabel+'</span>';}
    if(n.lut){chips+='<span class="chip lut">LUT '+n.lut+'</span>';}
    if(!chips){chips='<span class="chip">'+(n.note||'Whole picture')+'</span>';}
    return '<div class="layer'+(state.sel===id?' sel':'')+(n.on?'':' off')+'" data-id="'+id+'"><span class="grip">⋮⋮</span>'+
      '<button class="eye" data-eye="'+id+'">'+ico(n.on?'eye':'eyeoff')+'</button>'+
      '<span class="thumb"><img src="'+IMG+'" style="'+thumbStyle(id)+'" alt=""></span>'+
      '<span style="min-width:0"><div class="nm"><b>'+n.no+'</b>'+n.name+'</div><div class="meta">'+chips+'</div></span>'+
      '<span class="op">'+n.op+'%</span></div>';
  }
  function renderLayers(el){
    var h='<div class="flow">Picture in · '+'S-Log3 → Rec.709</div>';
    STACK.forEach(function(id){
      var n=N[id];
      if(n.kind==='corr'){h+=layerRow(id);}
      else if(n.kind==='group'){
        h+='<div class="group'+(state.sel===id?' sel':'')+'" data-id="'+id+'"><div class="group-h">'+ico('folder')+n.name+
          '<span class="chip">'+n.blend+'</span><span class="grow"></span><span class="op" style="font:400 12px var(--mono);color:var(--ink-2)">'+n.op+'%</span>'+
          '<button class="eye" data-eye="'+id+'">'+ico(n.on?'eye':'eyeoff')+'</button></div><div class="kids">'+n.kids.map(function(k){return layerRow(k,true);}).join('')+'</div>'+
          '<div class="hint" style="padding:5px 2px 0 24px">Both start from 02 and are blended back together.</div></div>';
      }else{
        h+='<div class="sealed'+(state.sel===id?' sel':'')+'" data-id="'+id+'">'+ico('lock')+'<button class="eye" data-eye="'+id+'">'+ico(n.on?'eye':'eyeoff')+'</button>'+
          '<span class="mini"><i style="background:#e0545a"></i><i style="background:#4fbf6a"></i><i style="background:#4d8fe0"></i></span>'+
          '<span class="nm">'+n.name+'<small>Made in Leader Seal · 5 nodes · <a data-open-leader>open there</a></small></span></div>';
      }
    });
    h+='<div class="flow">Out to the timeline</div>';
    el.innerHTML=h;
  }
  function wireLayers(el){
    el.addEventListener('click',function(e){
      var eye=e.target.closest('[data-eye]');
      if(eye){e.stopPropagation();var n=N[eye.getAttribute('data-eye')];n.on=!n.on;emit();return;}
      if(e.target.closest('[data-open-leader]')){setMode('leader');sel('s1');return;}
      var row=e.target.closest('[data-id]');if(row){sel(row.getAttribute('data-id'));}
    });
  }

  /* Leader Seal: the same grade as a node graph */
  var POS={n1:[70,150],n2:[215,150],n3:[385,55],n4:[385,245],mix:[540,177],n5:[610,150],split:[765,177],cr:[835,80],cg:[835,177],cb:[835,274],comb:[920,177]};
  var OWN={mix:'g1',split:'s1',cr:'s1',cg:'s1',cb:'s1',comb:'s1'};
  function box(id){var p=POS[id];if(/^n/.test(id)){return {x:p[0],y:p[1],w:116,h:82};}if(/^c[rgb]$/.test(id)){return {x:p[0],y:p[1]-4,w:52,h:38};}return {x:p[0],y:p[1],w:40,h:40};}
  function out(id){var b=box(id);return [b.x+b.w,b.y+b.h/2];}
  function inn(id){var b=box(id);return [b.x,b.y+b.h/2];}
  function wire(a,b,cls){return '<path class="wire '+(cls||'')+'" d="M'+a[0]+' '+a[1]+'C'+(a[0]+40)+' '+a[1]+' '+(b[0]-40)+' '+b[1]+' '+b[0]+' '+b[1]+'"/>';}
  function renderGraph(el){
    var src=[22,192],end=[1010,197],h='';
    h+='<rect class="region" x="368" y="34" width="232" height="318" rx="6"/><text class="region-t" x="378" y="50">Skin and sky · Parallel</text>';
    h+='<rect class="region" x="748" y="56" width="226" height="282" rx="6"/><text class="region-t" x="758" y="72">Channel split</text>';
    var W2=[[src,inn('n1')],[out('n1'),inn('n2')],[out('n2'),inn('n3')],[out('n2'),inn('n4')],[out('n3'),inn('mix')],[out('n4'),inn('mix')],[out('mix'),inn('n5')],[out('n5'),inn('split')]];
    W2.forEach(function(w){h+=wire(w[0],w[1]);});
    [['cr','r'],['cg','g'],['cb','b']].forEach(function(c){h+=wire(out('split'),inn(c[0]),c[1])+wire(out(c[0]),inn('comb'),c[1]);});
    h+=wire(out('comb'),end);
    h+='<circle class="end" cx="'+src[0]+'" cy="'+src[1]+'" r="7"/><text class="end-t" x="6" y="'+(src[1]+24)+'">Source</text>';
    h+='<circle class="end" cx="'+end[0]+'" cy="'+end[1]+'" r="7"/><text class="end-t" x="988" y="'+(end[1]+24)+'">Out</text>';
    ['n1','n2','n3','n4','n5'].forEach(function(id){
      var n=N[id],b=box(id),s=state.sel===id;
      h+='<g class="node'+(s?' sel':'')+(n.on?'':' off')+'" data-id="'+id+'"><rect class="box" x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+'" rx="4"/>'+
        '<image href="'+IMG+'" x="'+(b.x+4)+'" y="'+(b.y+4)+'" width="'+(b.w-8)+'" height="'+(b.h-28)+'" preserveAspectRatio="xMidYMid slice" style="'+thumbStyle(id)+'"/>'+
        '<text class="no" x="'+(b.x+7)+'" y="'+(b.y+b.h-8)+'">'+n.no+'</text><text class="lbl" x="'+(b.x+27)+'" y="'+(b.y+b.h-8)+'">'+n.name+'</text>'+
        (n.limit||n.lut?'<rect x="'+(b.x+b.w-48)+'" y="'+(b.y+6)+'" width="42" height="13" rx="2" fill="#0e1013" opacity=".85"/><text class="badge" x="'+(b.x+b.w-27)+'" y="'+(b.y+16)+'" text-anchor="middle"'+(n.lut?' style="fill:#e8b86b"':'')+'>'+(n.lut?'LUT':n.limit==='key'?'KEY':'SHAPE')+'</text>':'')+
        '<circle class="port in" cx="'+b.x+'" cy="'+(b.y+b.h/2)+'" r="4"/><circle class="port" cx="'+(b.x+b.w)+'" cy="'+(b.y+b.h/2)+'" r="4"/></g>';
    });
    [['mix','∥','Parallel'],['split','⑃','Splitter'],['comb','⑂','Combiner']].forEach(function(m){
      var b=box(m[0]),s=state.sel===OWN[m[0]];
      h+='<g class="node'+(s?' sel':'')+'" data-id="'+OWN[m[0]]+'"><rect class="box" x="'+b.x+'" y="'+b.y+'" width="40" height="40" rx="20"/>'+
        '<text class="lbl" x="'+(b.x+20)+'" y="'+(b.y+26)+'" text-anchor="middle">'+m[1]+'</text><text class="no" x="'+(b.x+20)+'" y="'+(b.y+56)+'" text-anchor="middle">'+m[2]+'</text></g>';
    });
    [['cr','Red','#e0545a'],['cg','Green','#4fbf6a'],['cb','Blue','#4d8fe0']].forEach(function(c){
      var b=box(c[0]),s=state.sel==='s1';
      h+='<g class="node'+(s?' sel':'')+'" data-id="s1"><rect class="box" x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+'" rx="4"/>'+
        '<rect x="'+(b.x+6)+'" y="'+(b.y+8)+'" width="6" height="22" rx="1" fill="'+c[2]+'"/><text class="lbl" x="'+(b.x+17)+'" y="'+(b.y+24)+'" style="font-size:12px">'+c[1]+'</text></g>';
    });
    var host=el.querySelector('.ng-wrap');
    if(!host){host=document.createElement('div');host.className='ng-wrap';host.style.cssText='position:absolute;inset:0';el.prepend(host);}
    host.innerHTML='<svg class="ng" viewBox="0 0 1030 380" preserveAspectRatio="xMidYMid meet">'+h+'</svg>'+
      '<div class="hud">Right-click to add a node · same grade as Baby Seal</div>';
  }
  function nodeMenu(){
    return '<div class="menu" id="nodemenu"><div class="mh">Add node</div>'+
      '<button>'+ico('plus')+'Corrector<small>Alt S</small></button><button>'+ico('folder')+'Parallel mixer<small>Alt P</small></button>'+
      '<button>'+ico('folder')+'Layer mixer<small>Alt L</small></button><button>'+ico('key')+'Key mixer</button>'+
      '<button>'+ico('split')+'Splitter + Combiner</button><hr><button>'+ico('reset')+'Reset grade</button><button>'+ico('nodes')+'Tidy up graph</button></div>';
  }
  function wireGraph(el){
    el.insertAdjacentHTML('beforeend',nodeMenu());
    el.addEventListener('click',function(e){var m=el.querySelector('#nodemenu');m.classList.remove('open');var g=e.target.closest('.node');if(g){sel(g.getAttribute('data-id'));}});
    el.addEventListener('contextmenu',function(e){e.preventDefault();var m=el.querySelector('#nodemenu'),r=el.getBoundingClientRect();
      m.style.left=Math.min(e.clientX-r.left,r.width-210)+'px';m.style.top=Math.min(e.clientY-r.top,r.height-230)+'px';m.classList.add('open');});
  }
  function addMenu(){
    return '<div class="menu" id="addmenu" style="bottom:42px;left:8px"><div class="mh">Add above the selection</div>'+
      '<button>'+ico('plus')+'Correction<small>Alt S</small></button><button>'+ico('folder')+'Group (blended)<small>Alt P</small></button>'+
      '<button>'+ico('palette')+'Look from a LUT</button><hr><button>'+ico('key')+'Correction limited by color</button><button>'+ico('circle')+'Correction limited by a shape</button></div>';
  }

  /* viewer */
  function renderViewer(el){
    el.innerHTML='<div class="shot" id="shot"><img src="'+IMG+'" alt="">'+
      '<div class="graded"><img id="gimg" src="'+IMG+'" alt=""><div class="ov" id="ov0"></div><div class="ov" id="ov1"></div><div class="ov" id="ov2"></div></div>'+
      '<svg class="mask" id="mask" viewBox="0 0 160 90" preserveAspectRatio="none"></svg>'+
      '<span class="tag before" style="left:8px">Before</span><span class="tag" style="right:8px">After</span><div class="wipe"></div></div>';
    var shot=el.querySelector('#shot');
    function drag(e){var r=shot.getBoundingClientRect();state.wipe=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));shot.style.setProperty('--wipe',state.wipe+'%');}
    shot.querySelector('.wipe').addEventListener('pointerdown',function(e){e.preventDefault();var mv=function(ev){drag(ev);},up=function(){removeEventListener('pointermove',mv);removeEventListener('pointerup',up);};addEventListener('pointermove',mv);addEventListener('pointerup',up);});
  }
  function paintViewer(){
    var shot=document.getElementById('shot');if(!shot){return;}
    var k=compose(),ov=overlays(k),img=document.getElementById('gimg');
    img.style.filter=filterOf(k)+(state.matte?' grayscale(1) contrast(3.2) brightness(1.15)':'');
    for(var i=0;i<3;i++){document.getElementById('ov'+i).style.background=state.matte?'none':ov[i];}
    shot.classList.toggle('compare',state.compare);shot.style.setProperty('--wipe',(state.compare?state.wipe:0)+'%');
    var n=N[state.sel],m='';
    if(n&&n.limit==='key'){m='<ellipse cx="62" cy="42" rx="13" ry="17" fill="none" stroke="#6fb7e6" stroke-width=".5" stroke-dasharray="2 1.4" vector-effect="non-scaling-stroke"/>';}
    if(n&&n.limit==='shape'){m='<line x1="0" y1="26" x2="160" y2="20" stroke="#6fb7e6" stroke-width="1.5" vector-effect="non-scaling-stroke"/><line x1="0" y1="34" x2="160" y2="28" stroke="#6fb7e6" stroke-width="1" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/><circle cx="80" cy="23" r="1.6" fill="#eceff1"/>';}
    document.getElementById('mask').innerHTML=m;
  }

  /* scopes: read the real frame when the browser allows it, otherwise a painted stand-in */
  var src=null,tainted=false,fake=null;
  function sample(k){
    var w=180,h=100,cv=document.createElement('canvas');cv.width=w;cv.height=h;var x=cv.getContext('2d');x.filter=filterOf(k);
    if(!tainted&&src&&src.complete&&src.naturalWidth){x.drawImage(src,0,0,w,h);try{return adj(x.getImageData(0,0,w,h),k);}catch(e){tainted=true;x=cv.getContext('2d');x.filter=filterOf(k);}}
    if(!fake){fake=document.createElement('canvas');fake.width=w;fake.height=h;var f=fake.getContext('2d'),g=f.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#9cc4e4');g.addColorStop(.3,'#e8d6b8');g.addColorStop(.55,'#b78a5a');g.addColorStop(1,'#3a2a20');f.fillStyle=g;f.fillRect(0,0,w,h);
      for(var i=0;i<260;i++){f.fillStyle='hsl('+(20+Math.random()*30)+' '+(30+Math.random()*40)+'% '+(15+Math.random()*60)+'%)';f.fillRect(Math.random()*w,30+Math.random()*70,4+Math.random()*14,3+Math.random()*10);}
      f.fillStyle='#2c4a2a';for(var j=0;j<40;j++){f.fillRect(Math.random()*w,40+Math.random()*30,6,8);}}
    x.drawImage(fake,0,0);return adj(x.getImageData(0,0,w,h),k);
  }
  function adj(d,k){var a=d.data,t=k.temp*.9,ti=k.tint*.7;for(var i=0;i<a.length;i+=4){a[i]+=t;a[i+1]-=ti;a[i+2]-=t;}return d;}
  function drawScope(cv,kind){
    var r=cv.getBoundingClientRect(),W=Math.max(10,Math.round(r.width)),H=Math.max(10,Math.round(r.height));
    if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;}
    var x=cv.getContext('2d'),d=sample(compose()),a=d.data,w=d.width,h=d.height;
    x.globalCompositeOperation='source-over';x.fillStyle='#0b0d0f';x.fillRect(0,0,W,H);
    x.strokeStyle='rgba(123,134,144,.25)';x.lineWidth=1;
    if(kind!=='vector'){for(var g=0;g<=4;g++){var gy=Math.round(6+(H-12)*g/4)+.5;x.beginPath();x.moveTo(0,gy);x.lineTo(W,gy);x.stroke();}}
    x.globalCompositeOperation='lighter';
    function cl(v){return v<0?0:v>255?255:v;}
    if(kind==='wave'||kind==='parade'){
      var cols=kind==='parade'?3:1,seg=W/cols;
      for(var i=0;i<a.length;i+=4){var px=(i/4)%w,R=cl(a[i]),G=cl(a[i+1]),B=cl(a[i+2]);
        if(cols===1){var L=.2126*R+.7152*G+.0722*B;x.fillStyle='rgba(180,230,190,.10)';x.fillRect(px/w*W,6+(H-12)*(1-L/255),1.6,1.6);}
        else{[[R,'rgba(255,80,70,.12)'],[G,'rgba(80,230,110,.12)'],[B,'rgba(80,140,255,.14)']].forEach(function(c,j){x.fillStyle=c[1];x.fillRect(j*seg+px/w*(seg-4),6+(H-12)*(1-c[0]/255),1.6,1.6);});}}
    }else if(kind==='vector'){
      var cx=W/2,cy=H/2,rad=Math.min(W,H)/2-8;x.globalCompositeOperation='source-over';
      x.strokeStyle='rgba(123,134,144,.35)';[1,.5].forEach(function(f){x.beginPath();x.arc(cx,cy,rad*f,0,7);x.stroke();});
      x.strokeStyle='rgba(232,184,107,.5)';x.beginPath();x.moveTo(cx,cy);var sk=-123*Math.PI/180;x.lineTo(cx+Math.cos(sk)*rad,cy+Math.sin(sk)*rad);x.stroke();
      x.fillStyle='rgba(123,134,144,.8)';x.font='10px Courier Prime';[['R',-103],['Yl',-167],['G',119],['Cy',77],['B',13],['Mg',-61]].forEach(function(t){var an=t[1]*Math.PI/180;x.fillText(t[0],cx+Math.cos(an)*(rad*.86)-5,cy+Math.sin(an)*(rad*.86)+4);});
      x.globalCompositeOperation='lighter';
      for(var v=0;v<a.length;v+=4){var r2=cl(a[v]),g2=cl(a[v+1]),b2=cl(a[v+2]),cb=(-.1146*r2-.3854*g2+.5*b2)/128,cr=(.5*r2-.4542*g2-.0458*b2)/128;
        x.fillStyle='rgba(200,240,210,.13)';x.fillRect(cx+cb*rad*1.6,cy-cr*rad*1.6,1.5,1.5);}
    }else{
      var bins=[[],[],[]],max=1;for(var q=0;q<64;q++){bins[0][q]=bins[1][q]=bins[2][q]=0;}
      for(var z=0;z<a.length;z+=4){for(var c=0;c<3;c++){var bi=Math.min(63,cl(a[z+c])>>2);bins[c][bi]++;if(bins[c][bi]>max){max=bins[c][bi];}}}
      ['rgba(255,80,70,.45)','rgba(80,230,110,.45)','rgba(80,140,255,.5)'].forEach(function(col,c){x.fillStyle=col;x.beginPath();x.moveTo(0,H);
        for(var q=0;q<64;q++){x.lineTo(q/63*W,H-4-(H-14)*Math.sqrt(bins[c][q]/max));}x.lineTo(W,H);x.fill();});
    }
  }
  var scopes=[];
  function addScope(el,kind){var cv=document.createElement('canvas');el.appendChild(cv);var s={el:el,cv:cv,kind:kind};scopes.push(s);
    if(kind==='wave'||kind==='parade'){el.insertAdjacentHTML('beforeend','<span class="ax" style="top:2px">1023</span><span class="ax" style="top:50%">512</span><span class="ax" style="bottom:2px">0</span>');}return s;}
  var raf=0;function paintScopes(){if(raf){return;}raf=requestAnimationFrame(function(){raf=0;scopes.forEach(function(s){if(s.el.offsetParent){drawScope(s.cv,s.kind);}});});}

  /* tools: each returns HTML for the selected correction */
  function cur(){var n=N[state.sel];return n&&n.kind==='corr'?n:null;}
  function slider(k,label,min,max,step,fmt,tr){var n=cur(),v=n.g[k],d={con:1,sat:1,pivot:.435}[k];if(d===undefined){d=0;}
    return '<div class="sl'+(Math.abs(v-d)>1e-6?' chg':'')+'"><label>'+label+'</label><input type="range" class="'+(tr||'')+'" data-k="'+k+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+v+'"><output>'+(fmt?fmt(v):v)+'</output></div>';}
  var F={pct:function(v){return Math.round(v*100);},x:function(v){return v.toFixed(2);},i:function(v){return Math.round(v);},ev:function(v){return (v>=0?'+':'')+v.toFixed(2);}};
  function wheels(sz){var n=cur();
    return '<div class="wheels" style="--wd:'+(sz||108)+'px">'+['lift','gamma','gain','offset'].map(function(k){var p=n.g.wheel[k],m=n.g.master[k],base=k==='gain'?1:k==='offset'?25:0;
      var y=(base+m).toFixed(2),r=(base+m+p[0]*.1).toFixed(2),g=(base+m-p[1]*.1).toFixed(2),b=(base+m-p[0]*.1+p[1]*.05).toFixed(2);
      return '<div class="wheel"><h5>'+k[0].toUpperCase()+k.slice(1)+'<button data-wreset="'+k+'">'+ico('reset')+'</button></h5><div class="disc" data-w="'+k+'"><span class="puck" style="left:'+(50+p[0]*40)+'%;top:'+(50+p[1]*40)+'%"></span></div>'+
        '<div class="nums"><span>'+y+'</span><span>'+r+'</span><span>'+g+'</span><span>'+b+'</span></div><input type="range" data-m="'+k+'" min="-1" max="1" step=".01" value="'+m+'"></div>';}).join('')+'</div>';}
  function primaries(){return '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px 16px;margin-bottom:10px">'+
    slider('temp','Temperature',-100,100,1,F.i,'tr-temp')+slider('tint','Tint',-100,100,1,F.i,'tr-tint')+slider('con','Contrast',.5,1.6,.01,F.x)+
    slider('pivot','Pivot',0,1,.005,function(v){return v.toFixed(3);})+slider('sat','Saturation',0,2,.01,F.pct,'tr-sat')+slider('hue','Hue',-180,180,1,F.i,'tr-hue')+'</div>';}
  function basics(){return slider('exp','Exposure',-1,1,.01,F.ev)+slider('con','Contrast',.5,1.6,.01,F.x)+slider('hi','Highlights',-100,100,1,F.i)+slider('sh','Shadows',-100,100,1,F.i)+
    '<div style="height:6px"></div>'+slider('temp','Temperature',-100,100,1,F.i,'tr-temp')+slider('tint','Tint',-100,100,1,F.i,'tr-tint')+
    '<div style="height:6px"></div>'+slider('vib','Vibrance',-100,100,1,F.i,'tr-sat')+slider('sat','Saturation',0,2,.01,F.pct,'tr-sat')+
    '<div style="display:flex;gap:6px;margin-top:8px"><button class="btn">'+ico('drop')+'Pick white</button><button class="btn">'+ico('wand')+'Auto balance</button></div>';}
  var curveKind='custom';
  function curves(){
    var kinds=[['custom','Custom RGB'],['hh','Hue vs Hue'],['hs','Hue vs Sat'],['hl','Hue vs Lum'],['ls','Lum vs Sat']],svg;
    if(curveKind==='custom'){svg='<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 75H100M0 50H100M0 25H100M25 0V100M50 0V100M75 0V100" stroke="#33383f" stroke-width=".5" vector-effect="non-scaling-stroke"/>'+
      '<path d="M0 100L100 0" stroke="#4b5a68" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/><path d="M0 100C18 96 22 80 32 70S62 34 72 24 92 4 100 0" fill="none" stroke="#eceff1" stroke-width="1.8" vector-effect="non-scaling-stroke"/>'+
      '<path d="M0 100C30 92 60 30 100 2" fill="none" stroke="#e0545a" stroke-width="1" opacity=".7" vector-effect="non-scaling-stroke"/></svg>'+
      '<span style="position:absolute;left:30%;top:68%;width:9px;height:9px;margin:-4px;border-radius:50%;background:#eceff1"></span><span style="position:absolute;left:72%;top:24%;width:9px;height:9px;margin:-4px;border-radius:50%;background:#eceff1"></span>';}
    else{svg='<div style="position:absolute;left:0;right:0;bottom:0;height:10px;background:linear-gradient(90deg,red,#ff0,lime,cyan,blue,#f0f,red);opacity:.8"></div>'+
      '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 50H100" stroke="#4b5a68" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/><path d="M0 50C8 50 10 38 14 38S20 50 26 50 100 50 100 50" fill="none" stroke="#eceff1" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>'+
      '<span style="position:absolute;left:14%;top:38%;width:9px;height:9px;margin:-4px;border-radius:50%;background:#e8b86b"></span><span class="hint" style="position:absolute;left:20%;top:26%">skin hues</span>';}
    return '<div class="curves"><div class="curve-box">'+svg+'</div><div><div class="ckinds">'+kinds.map(function(k){return '<button data-ck="'+k[0]+'" class="'+(curveKind===k[0]?'on':'')+'">'+k[1]+'</button>';}).join('')+'</div>'+
      (curveKind==='custom'?'<div class="chans"><button class="on">Y</button><button>R</button><button>G</button><button>B</button></div>':'<button class="btn" style="margin-top:6px">'+ico('drop')+'Pick hue</button>')+'</div></div>';}
  function limit(){var n=cur(),key=n.limit==='key',shp=n.limit==='shape';
    function rng(lbl,bg,a,b){return '<div class="sl" style="grid-template-columns:70px 1fr 70px"><label>'+lbl+'</label><div class="range-wrap"><div class="range" style="background:'+bg+'"><span class="win" style="left:'+a+'%;width:'+(b-a)+'%"></span></div></div><output>'+a+'–'+b+'</output></div>';}
    return '<div class="two" style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:16px">'+
      '<div><div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font:700 13px var(--hand)"><span class="toggle'+(key?' on':'')+'"></span>By color<span class="grow"></span><button class="btn on">'+ico('drop')+'Pick</button><button class="btn">+</button><button class="btn">−</button></div>'+
      rng('Hue','linear-gradient(90deg,red,#ff0,lime,cyan,blue,#f0f,red)',4,14)+rng('Saturation','linear-gradient(90deg,#888,#e05a3a)',22,64)+rng('Luminance','linear-gradient(90deg,#000,#fff)',30,82)+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 12px">'+'<div class="sl" style="grid-template-columns:62px 1fr"><label>Softness</label><input type="range" value="30"></div><div class="sl" style="grid-template-columns:62px 1fr"><label>Clean up</label><input type="range" value="20"></div></div>'+
      '<div style="display:flex;gap:6px;margin-top:6px"><button class="btn'+(state.matte?' on':'')+'" data-matte>'+ico('eye')+'Show what is picked</button><button class="btn">Invert</button></div></div>'+
      '<div><div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font:700 13px var(--hand)"><span class="toggle'+(shp?' on':'')+'"></span>By shape</div>'+
      '<div class="shapes"><button class="btn">'+ico('circle')+'Circle</button><button class="btn">'+ico('square')+'Box</button><button class="btn'+(shp?' on':'')+'">'+ico('grad')+'Gradient</button><button class="btn">'+ico('pen')+'Draw</button></div>'+
      (shp?'<div class="shape-row" style="margin-top:6px">'+ico('grad')+'Gradient 1<span class="grow"></span><span class="chip">soft 40</span></div>':'<div class="hint" style="margin-top:8px">No shapes yet.</div>')+
      '<div style="display:flex;gap:6px;margin-top:8px;align-items:center"><button class="btn">'+ico('track')+'Follow motion</button><span class="hint">tracks the shape through the clip</span></div></div></div>';}
  var lutSel='Kodak 2383';
  function luts(){var L=[['Kodak 2383','Film print'],['Fuji 3513','Film print'],['Teal and orange','Look'],['Bleach bypass','Look'],['Sony S-Log3 to Rec.709','Camera'],['Apple Log to Rec.709','Camera'],['Canon C-Log2 to Rec.709','Camera']];
    return '<div class="two" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px"><div><div class="lut-list">'+L.map(function(l){return '<button data-lut="'+l[0]+'" class="'+(lutSel===l[0]?'on':'')+'">'+l[0]+'<small>'+l[1]+'</small></button>';}).join('')+'</div>'+
      '<button class="btn" style="margin-top:8px">'+ico('plus')+'Import .cube</button></div><div>'+
      '<div class="sl"><label>Strength</label><input type="range" value="80"><output>80%</output></div>'+
      '<div style="font:700 13px var(--hand);margin:12px 0 6px">Color space</div>'+
      '<div class="sl" style="grid-template-columns:88px 1fr"><label>Camera</label><button class="btn">Sony S-Log3 / S-Gamut3.Cine '+ico('chevd')+'</button></div>'+
      '<div class="sl" style="grid-template-columns:88px 1fr"><label>Working</label><button class="btn">DaVinci Wide Gamut '+ico('chevd')+'</button></div>'+
      '<div class="sl" style="grid-template-columns:88px 1fr"><label>Output</label><button class="btn">Rec.709 Gamma 2.4 '+ico('chevd')+'</button></div>'+
      '<div class="hint" style="margin-top:6px">Set once per clip; every correction then works in the same space.</div></div></div>';}
  function match(){return '<div class="two" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px">'+
    '<div><div style="font:700 13px var(--hand);margin-bottom:6px">Balance</div><div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start"><button class="btn">'+ico('wand')+'Auto balance</button><button class="btn">'+ico('drop')+'Pick something white</button><button class="btn">'+ico('drop')+'Pick something gray</button></div></div>'+
    '<div><div style="font:700 13px var(--hand);margin-bottom:6px">Match another shot</div><div class="hint" style="margin-bottom:6px">Click a clip in the strip to match this one to it.</div><button class="btn on">Match to 02 Plaza</button></div>'+
    '<div><div style="font:700 13px var(--hand);margin-bottom:6px">Skin</div><div class="hint" style="margin-bottom:6px">Pulls faces toward the skin line on the vectorscope.</div><div class="sl" style="grid-template-columns:60px 1fr"><label>Amount</label><input type="range" value="35"></div></div></div>';}
  function groupInfo(){var n=N[state.sel];
    if(n.kind==='group'){return '<div style="max-width:440px"><div style="font:700 14px var(--hand);margin-bottom:6px">'+ico('folder')+' '+n.name+'</div><div class="hint" style="margin-bottom:10px">A group: every layer inside starts from the same picture, then they are blended back. In Leader Seal it is a Parallel mixer.</div>'+
      '<div class="sl" style="grid-template-columns:88px 1fr"><label>Blend</label><button class="btn">'+n.blend+' '+ico('chevd')+'</button></div><div class="sl"><label>Opacity</label><input type="range" value="'+n.op+'"><output>'+n.op+'%</output></div></div>';}
    return '<div style="max-width:440px"><div style="font:700 14px var(--hand);margin-bottom:6px">'+ico('lock')+' '+n.name+'</div><div class="hint" style="margin-bottom:10px">Built in Leader Seal: a Splitter sends red, green and blue down their own nodes and a Combiner joins them. That has no honest shape as layers, so here it stays sealed. You can still switch it off or fade it.</div>'+
      '<div class="sl"><label>Opacity</label><input type="range" value="'+n.op+'"><output>'+n.op+'%</output></div><button class="btn on" data-open-leader style="margin-top:8px">'+ico('nodes')+'Open in Leader Seal</button></div>';}

  /* one place to wire every control in a tools container */
  function wireTools(el,rerender){
    el.addEventListener('input',function(e){var n=cur();if(!n){return;}var t=e.target,k=t.getAttribute('data-k'),m=t.getAttribute('data-m');
      if(k){n.g[k]=Number(t.value);var o=t.parentNode.querySelector('output');if(o){o.textContent=t.parentNode.querySelector('label').textContent==='Exposure'?F.ev(n.g[k]):({con:F.x,pivot:function(v){return v.toFixed(3);},sat:F.pct}[k]||F.i)(n.g[k]);}t.parentNode.classList.add('chg');paintAll(true);}
      if(m){n.g.master[m]=Number(t.value);paintAll(true);}});
    el.addEventListener('click',function(e){var ck=e.target.closest('[data-ck]');if(ck){curveKind=ck.getAttribute('data-ck');rerender();return;}
      var lu=e.target.closest('[data-lut]');if(lu){lutSel=lu.getAttribute('data-lut');rerender();return;}
      if(e.target.closest('[data-matte]')){state.matte=!state.matte;rerender();paintAll(true);return;}
      if(e.target.closest('[data-open-leader]')){setMode('leader');return;}
      var wr=e.target.closest('[data-wreset]');if(wr){var n=cur();n.g.wheel[wr.getAttribute('data-wreset')]=[0,0];n.g.master[wr.getAttribute('data-wreset')]=0;rerender();paintAll(true);}});
    el.addEventListener('pointerdown',function(e){var d=e.target.closest('.disc');if(!d){return;}e.preventDefault();var n=cur(),k=d.getAttribute('data-w'),pk=d.querySelector('.puck');
      function mv(ev){var r=d.getBoundingClientRect(),x=((ev.clientX-r.left)/r.width-.5)/.4,y=((ev.clientY-r.top)/r.height-.5)/.4,l=Math.hypot(x,y);if(l>1){x/=l;y/=l;}
        n.g.wheel[k]=[x,y];pk.style.left=(50+x*40)+'%';pk.style.top=(50+y*40)+'%';paintAll(true);}
      mv(e);function up(){removeEventListener('pointermove',mv);removeEventListener('pointerup',up);rerender();}addEventListener('pointermove',mv);addEventListener('pointerup',up);});
  }

  /* clip strip and looks */
  var CLIPS=[['plaza','01','0:00','Plaza',1],['plaza','02','0:04','Plaza wide',1],['highway','03','0:09','Highway',0],['city','04','0:13','City',1],['meadow','05','0:18','Meadow',0],['wheat','06','0:22','Wheat',0],['tractor','07','0:27','Tractor',0],['plane','08','0:31','Plane',0]];
  function renderStrip(el){el.innerHTML=CLIPS.map(function(c,i){return '<div class="sclip'+(i===1?' sel':'')+'"><div class="im"><img src="footage/'+c[0]+'.jpg" alt=""><span class="no">'+c[1]+'</span>'+(c[4]?'<span class="gd">● graded</span>':'')+'</div><div class="cap">'+c[3]+'<b>'+c[2]+'</b></div></div>';}).join('');
    el.addEventListener('click',function(e){var s=e.target.closest('.sclip');if(s){el.querySelectorAll('.sclip').forEach(function(x){x.classList.toggle('sel',x===s);});}});}
  function renderLooks(el){var L=[['Golden hour','your still','sepia(.35) saturate(1.2) contrast(1.05)'],['Teal and orange','look','hue-rotate(-12deg) saturate(1.35) contrast(1.1)'],['Bleach bypass','look','saturate(.45) contrast(1.35)'],['Soft film','look','contrast(.9) brightness(1.05) sepia(.15)'],['Night blue','look','hue-rotate(190deg) saturate(.6) brightness(.8)'],['Mono','look','grayscale(1) contrast(1.15)']];
    el.innerHTML=L.map(function(l,i){return '<button class="look'+(i===0?' on':'')+'"><img src="'+IMG+'" style="filter:'+l[2]+'" alt="">'+l[0]+'<small>'+l[1]+'</small></button>';}).join('');}

  /* switching views */
  function setMode(m){state.mode=m;document.body.classList.toggle('leader',m==='leader');document.querySelectorAll('[data-mode]').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-mode')===m);});emit();setTimeout(function(){paintScopes();},0);}
  var painters=[];
  function paintAll(light){paintViewer();paintScopes();painters.forEach(function(p){p(light);});}

  function boot(){
    icons();
    src=new Image();src.src=window.TINT_FRAME||IMG;src.onload=function(){paintScopes();};
    document.querySelectorAll('[data-mode]').forEach(function(b){b.addEventListener('click',function(){setMode(b.getAttribute('data-mode'));});});
    document.addEventListener('click',function(e){var am=document.getElementById('addmenu');if(!am){return;}if(e.target.closest('[data-add]')){am.classList.toggle('open');}else if(!e.target.closest('#addmenu')){am.classList.remove('open');}});
    addEventListener('resize',paintScopes);
    if(location.hash==='#leader'){setMode('leader');}
  }

  window.Tint={STACK:STACK,sampleNow:function(){return sample(compose());},addIcons:function(o){Object.assign(I,o);},ico:ico,icons:icons,N:N,state:state,on:on,sel:sel,cur:cur,setMode:setMode,boot:boot,paintAll:paintAll,painters:painters,
    renderLayers:renderLayers,wireLayers:wireLayers,renderGraph:renderGraph,wireGraph:wireGraph,addMenu:addMenu,renderViewer:renderViewer,
    addScope:addScope,paintScopes:paintScopes,renderStrip:renderStrip,renderLooks:renderLooks,wireTools:wireTools,
    tools:{slider:slider,F:F,wheels:wheels,primaries:primaries,basics:basics,curves:curves,limit:limit,luts:luts,match:match,groupInfo:groupInfo}};
})();
