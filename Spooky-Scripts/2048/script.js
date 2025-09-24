/* 2048 — Real sliding refactor
   - Tiles live in #grid, positioned via transform (no reparenting to cells)
   - Board state = 4x4 numbers (0 for empty)
   - Smooth slide + merge + spawn pop
*/

const SIZE = 4;
const GAP = 10;            // must match CSS gap
let board;                 // 2D numbers
let tiles;                 // Map id -> {id, r, c, value, el}
let scoreVal = 0;
let nextId = 1;

window.onload = () => {
  initGame();
  addRandomTile();
  addRandomTile();
  renderAll(true);
  bindInputs();
  updateScore();
};

/* ---------- Core setup ---------- */
function initGame(){
  board = Array.from({length: SIZE}, () => Array(SIZE).fill(0));
  tiles = new Map();
  scoreVal = 0;
  nextId = 1;
  const status = document.getElementById('status');
  if (status) status.className = '';
  const grid = document.getElementById('grid');
  if (grid) grid.innerHTML = '';
}

function toggleInfo(){ document.getElementById('description')?.classList.toggle('show'); }
function resetGame(){
  initGame();
  addRandomTile(); addRandomTile();
  renderAll(true);
  updateScore();
}

/* ---------- Geometry / rendering ---------- */
function cellSizePx(){
  const grid = document.getElementById('grid');
  if (!grid) return 0;
  const w = grid.clientWidth; // square
  return Math.round((w - (SIZE-1)*GAP) / SIZE);
}
function xyToTransform(r,c){
  const s = cellSizePx();
  const x = c * (s + GAP);
  const y = r * (s + GAP);
  return `translate(${x}px, ${y}px)`;
}
function makeTileEl(t){
  const el = document.createElement('div');
  el.className = `tile v${t.value} spawn`;
  el.textContent = t.value;
  el.style.transform = xyToTransform(t.r, t.c);
  el.dataset.id = t.id;
  t.el = el;
  return el;
}
function renderAll(spawn=false){
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  for (const t of tiles.values()){
    const el = makeTileEl(t);
    if (!spawn) el.classList.remove('spawn');
    grid.appendChild(el);
  }
}

/* ---------- Score ---------- */
function updateScore(){
  const el = document.getElementById('value');
  if (el) el.textContent = String(scoreVal);
}

/* ---------- RNG tile ---------- */
function addRandomTile(){
  const empty = [];
  for (let r=0;r<SIZE;r++){
    for (let c=0;c<SIZE;c++){
      if (board[r][c] === 0) empty.push([r,c]);
    }
  }
  if (!empty.length) return false;
  const [r,c] = empty[Math.floor(Math.random()*empty.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  const id = nextId++;
  tiles.set(id, { id, r, c, value, el:null });
  board[r][c] = id;
  return true;
}

/* ---------- Move helpers ---------- */
function compactAndMerge(values){ // values: array of tile objects (same row/col order)
  const out = [];
  let gained = 0;
  for (let i=0;i<values.length;i++){
    const cur = values[i];
    const nxt = values[i+1];
    if (nxt && cur.value === nxt.value){
      cur.value *= 2;                // merge into cur
      gained += cur.value;
      nxt._remove = true;            // mark next for removal
      out.push(cur);
      i++;                           // skip the next
    } else {
      out.push(cur);
    }
  }
  return { out, gained };
}

function anyMovesLeft(){
  // empty cell?
  for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++) if (board[r][c]===0) return true;
  // neighbor merge?
  for (let r=0;r<SIZE;r++){
    for (let c=0;c<SIZE;c++){
      const id = board[r][c];
      if (!id) continue;
      const v = tiles.get(id).value;
      if (r+1<SIZE && board[r+1][c] && tiles.get(board[r+1][c]).value === v) return true;
      if (c+1<SIZE && board[r][c+1] && tiles.get(board[r][c+1]).value === v) return true;
    }
  }
  return false;
}

/* ---------- Moves ---------- */
function move(direction){
  // direction: 'left'|'right'|'up'|'down'
  let moved = false;
  const removedIds = new Set();

  const apply = (t, r, c) => {
    if (t.r !== r || t.c !== c) moved = true;
    t.r = r; t.c = c;
  };

  if (direction === 'left' || direction === 'right'){
    for (let r=0;r<SIZE;r++){
      const rowIds = board[r].slice();
      if (direction === 'right') rowIds.reverse();

      // extract tiles for nonzero ids in travel order
      const tilesInLine = rowIds.filter(id=>id!==0).map(id=>tiles.get(id));
      const { out, gained } = compactAndMerge(tilesInLine);
      scoreVal += gained;

      // rebuild row
      const newIds = Array(SIZE).fill(0);
      out.forEach((t,i)=>{
        if (t._remove){ removedIds.add(t.id); return; }
        const idx = direction==='right' ? (SIZE-1-i) : i;
        newIds[idx] = t.id;
        apply(t, r, idx);
      });
      board[r] = newIds;
    }
  } else {
    for (let c=0;c<SIZE;c++){
      const colIds = board.map(row=>row[c]);
      if (direction === 'down') colIds.reverse();

      const tilesInLine = colIds.filter(id=>id!==0).map(id=>tiles.get(id));
      const { out, gained } = compactAndMerge(tilesInLine);
      scoreVal += gained;

      const newCol = Array(SIZE).fill(0);
      out.forEach((t,i)=>{
        if (t._remove){ removedIds.add(t.id); return; }
        const idx = direction==='down' ? (SIZE-1-i) : i;
        newCol[idx] = t.id;
        apply(t, idx, c);
      });
      for (let r=0;r<SIZE;r++) board[r][c] = newCol[r];
    }
  }

  if (!moved) return false;

  // 1) animate to new positions
  for (const t of tiles.values()){
    if (t.el) t.el.style.transform = xyToTransform(t.r, t.c);
  }

  // 2) after transition, remove merged-away tiles, update surviving tiles
  const AFTER = 160; // must be >= CSS transition
  setTimeout(()=>{
    // remove losers
    for (const id of removedIds){
      const t = tiles.get(id);
      if (t?.el?.parentNode) t.el.parentNode.removeChild(t.el);
      tiles.delete(id);
    }
    // bump merged tiles & update labels/classes
    for (const t of tiles.values()){
      if (t._remove){ delete t._remove; continue; }
      if (!t.el) continue;
      t.el.textContent = t.value;
      // swap class to color by value + add a quick merge pulse
      t.el.className = `tile v${t.value} merge`;
      t.el.style.transform = xyToTransform(t.r, t.c);
    }

    updateScore();

    // 3) spawn new tile (with pop)
    const spawned = addRandomTile();
    if (spawned){
      const newest = [...tiles.values()].reduce((a,b)=> a.id>b.id?a:b);
      const grid = document.getElementById('grid');
      if (!newest.el){
        newest.el = makeTileEl(newest);
        grid.appendChild(newest.el);
      }
    }

    // 4) check end states
    const full = [...tiles.values()].length === SIZE*SIZE;
    if (full && !anyMovesLeft()){
      document.getElementById('status').className = 'lose';
    }
    if ([...tiles.values()].some(t=>t.value===2048)){
      document.getElementById('status').className = 'won';
    }
  }, AFTER);

  return true;
}

/* ---------- Inputs ---------- */
function bindInputs(){
  // Keyboard
  document.addEventListener('keydown', (e)=>{
    const dir = ({37:'left',38:'up',39:'right',40:'down'})[e.keyCode];
    if (!dir) return;
    e.preventDefault();
    move(dir);
  }, {passive:false});

  // Basic touch
  let sx=0, sy=0;
  document.addEventListener('touchstart', e=>{
    const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY;
  }, {passive:true});
  document.addEventListener('touchend', e=>{
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax,ay) < 24) return;
    move(ax>ay ? (dx>0?'right':'left') : (dy>0?'down':'up'));
  }, {passive:true});

  // Resize safety: keep tiles aligned if the board size changes
  window.addEventListener('resize', ()=>{
    for (const t of tiles.values()){
      if (t.el) t.el.style.transform = xyToTransform(t.r, t.c);
    }
  });
}

/* ---------- Buttons exposed to HTML ---------- */
window.toggleInfo = toggleInfo;
window.resetGame  = resetGame;