(() => {
  const canvas = document.getElementById('mazeCanvas');
  const ctx = canvas.getContext('2d', { willReadFrequently:true });

  // ---------- Make the maze less dense by default ----------
  let COLS = 26;   // fewer columns => bigger cells (adjust to taste)
  let ROWS = 15;
  let LINE = 6;    // wall thickness (px)

  // ----- runtime sizes -----
  let W=0, H=0, CELL=0, PADX=0, PADY=0;
  let PLAYER=28, STEP=5, HIT_MARGIN=3;   // these are derived from CELL in computeGrid()

  // player/goal (canvas px)
  let player = { x:0, y:0 };
  let goal   = { x:0, y:0 };

  // ========= canvas sizing =========
  function fitCanvasToCSS(){
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    W = canvas.width; H = canvas.height;
  }
  function computeGrid(){
    CELL = Math.min(Math.floor(W/COLS), Math.floor(H/ROWS));
    PADX = Math.floor((W - COLS*CELL)/2);
    PADY = Math.floor((H - ROWS*CELL)/2);

    // Corridor width (the black path between white walls)
    const corridor = Math.max(6, CELL - LINE);

    // Safety gap so we don't scrape walls
    const SAFE = Math.max(2, Math.round(LINE * 0.35));

    // Auto-size orb: never bigger than corridor - 2*SAFE
    PLAYER = Math.min(34, Math.max(12, corridor - 2*SAFE));

    // Movement step: small enough to avoid “teleporting” into walls
    STEP   = Math.max(2, Math.min(Math.floor(PLAYER/3), Math.floor(corridor/3)));

    // Collision margin shrinks the hitbox slightly vs the emoji graphic
    HIT_MARGIN = SAFE;
  }
  const centerOf = (cx,cy)=>({
    x: PADX + cx*CELL + (CELL - PLAYER)/2,
    y: PADY + cy*CELL + (CELL - PLAYER)/2
  });

  // ========= maze gen (perfect maze) =========
  function genMaze(cols, rows){
    const N=1,S=2,E=4,Ww=8;
    const DX={ [E]:1,[Ww]:-1,[N]:0,[S]:0 }, DY={ [E]:0,[Ww]:0,[N]:-1,[S]:1 };
    const OPP={ [E]:Ww,[Ww]:E,[N]:S,[S]:N };
    const grid=Array.from({length:rows},()=>Array(cols).fill(0));
    const seen=Array.from({length:rows},()=>Array(cols).fill(false));
    const stack=[[0,0]]; seen[0][0]=true;
    const dirs=[N,S,E,Ww];
    while(stack.length){
      const [x,y]=stack[stack.length-1];
      const opts=[];
      for(const d of dirs.sort(()=>Math.random()-0.5)){
        const nx=x+DX[d], ny=y+DY[d];
        if(nx>=0&&nx<cols&&ny>=0&&ny<rows&&!seen[ny][nx]) opts.push(d);
      }
      if(!opts.length){ stack.pop(); continue; }
      const d=opts[Math.floor(Math.random()*opts.length)];
      const nx=x+DX[d], ny=y+DY[d];
      grid[y][x]|=d; grid[ny][nx]|=OPP[d]; seen[ny][nx]=true; stack.push([nx,ny]);
    }
    return { grid, N, S, E, Ww };
  }

  // ========= drawing =========
  function drawWalls(M){
    ctx.fillStyle = '#0b0b11';
    ctx.fillRect(0,0,W,H);

    ctx.strokeStyle = '#d5d5d5';
    ctx.lineWidth = LINE;
    ctx.lineCap = 'square';
    ctx.strokeRect(PADX+LINE/2, PADY+LINE/2, COLS*CELL - LINE, ROWS*CELL - LINE);

    ctx.strokeStyle = '#ffffff';
    const line=(x0,y0,x1,y1)=>{ ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke(); };
    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        const c=M.grid[y][x];
        const x0=PADX+x*CELL, y0=PADY+y*CELL, x1=x0+CELL, y1=y0+CELL;
        if(!(c&M.N)) line(x0,y0,x1,y0);
        if(!(c&M.Ww)) line(x0,y0,x0,y1);
        if(y===ROWS-1 && !(c&M.S)) line(x0,y1,x1,y1);
        if(x===COLS-1 && !(c&M.E)) line(x1,y0,x1,y1);
      }
    }
  }
  function drawIcons(){
    ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font = `${Math.floor(PLAYER*0.9)}px sans-serif`;
    ctx.fillText('🕸', goal.x + PLAYER/2, goal.y + PLAYER/2);
    ctx.font = `${PLAYER}px sans-serif`;
    ctx.fillText('🔮', player.x + PLAYER/2, player.y + PLAYER/2);
    ctx.restore();
  }
  function render(){ drawWalls(currentMaze); drawIcons(); }

  // ========= collision (axis-separated + margin) =========
  function circleHitsWall(nx, ny){
    const r = (PLAYER/2) - HIT_MARGIN;           // slightly smaller than the drawn orb
    const cx = nx + PLAYER/2, cy = ny + PLAYER/2;
    for(let i=0;i<12;i++){
      const ang = (i * 2*Math.PI) / 12;
      const sx = cx + Math.cos(ang)*r, sy = cy + Math.sin(ang)*r;
      if(sx<0||sy<0||sx>=W||sy>=H) return true;
      const d = ctx.getImageData(sx|0, sy|0, 1, 1).data;
      if(d[0]>200 && d[1]>200 && d[2]>200) return true; // white wall
    }
    return false;
  }

  // slide along walls instead of sticking
  function move(dx, dy){
    if (dx !== 0){
      const step = Math.sign(dx) * Math.min(Math.abs(dx), STEP);
      const nx = player.x + step;
      if (!circleHitsWall(nx, player.y)) player.x = nx;
    }
    if (dy !== 0){
      const step = Math.sign(dy) * Math.min(Math.abs(dy), STEP);
      const ny = player.y + step;
      if (!circleHitsWall(player.x, ny)) player.y = ny;
    }
    render();
    checkWin();
  }

  function checkWin(){
    const s=PLAYER, a=player, b=goal;
    const hit = !(a.x+s<=b.x || a.x>=b.x+s || a.y+s<=b.y || a.y>=b.y+s);
    if(hit){
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#dff7ff'; ctx.font='24px sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('You escaped! Press any arrow for a new maze.', W/2, H/2);
      ctx.restore();
      awaitingRestart = true;
    }
  }

  // ========= inputs =========
  let awaitingRestart = false;
  function bindInputs(){
    const repeatHold = (fn)=>(e)=>{
      e.preventDefault(); fn();
      const t=setInterval(fn, 90);
      const stop=()=>clearInterval(t);
      window.addEventListener('pointerup',stop,{once:true});
      window.addEventListener('pointercancel',stop,{once:true});
      window.addEventListener('blur',stop,{once:true});
    };
    const map = {
      bu: ()=>move(0,-STEP), bd: ()=>move(0, STEP),
      bl: ()=>move(-STEP,0), br: ()=>move( STEP,0)
    };
    Object.entries(map).forEach(([id,fn])=>{
      const el=document.getElementById(id);
      el.addEventListener('pointerdown', repeatHold(fn));
      el.addEventListener('click', fn);
    });

    const KEY = {
      ArrowUp:()=>move(0,-STEP), ArrowDown:()=>move(0,STEP),
      ArrowLeft:()=>move(-STEP,0), ArrowRight:()=>move(STEP,0),
      w:()=>move(0,-STEP), s:()=>move(0,STEP), a:()=>move(-STEP,0), d:()=>move(STEP,0),
    };
    window.addEventListener('keydown',(e)=>{
      const f=KEY[e.key]; if(!f) return;
      e.preventDefault();
      if (awaitingRestart){ awaitingRestart=false; rebuild(); return; }
      f();
    });
  }

  // ========= init / resize =========
  let currentMaze = null;

  // If the spawn overlaps a wall (due to rounding), shrink the orb until it fits.
  function ensureSpawnFits(){
    let tries = 6;
    while (tries-- > 0 && circleHitsWall(player.x, player.y)){
      PLAYER = Math.max(10, PLAYER - 2);
      // recentre both on their cells with the new size
      player = centerOf(0,0);
      goal   = centerOf(COLS-1, ROWS-1);
    }
  }

  function rebuild(){
    fitCanvasToCSS();
    computeGrid();
    currentMaze = genMaze(COLS, ROWS);
    player = centerOf(0,0);
    goal   = centerOf(COLS-1, ROWS-1);
    ensureSpawnFits();      // <-- new: guarantees we’re not colliding at start
    render();
  }

  const ro = new ResizeObserver(rebuild);
  ro.observe(document.getElementById('maze'));

  function init(){ bindInputs(); rebuild(); }
  init();
})();