/**
 * NTHU OOP · M2 物種原型 (Milestone 2: Species Prototype)
 * 廢棄物拼裝異生體 (Debris & Scrap Assemblage Organism)
 * 
 * 核心特色：
 * 1. 【多種垃圾碎屑外殼拼裝】：
 *    - 身軀由「瓦楞鐵皮/紙板 (Corrugated Plate)」、「紅磚/水泥塊 (Bricks)」、「尖銳玻璃碎片 (Glass Shards)」、
 *      「壓扁彩色鋁罐 (Crushed Cans)」、「廢輪胎橡膠皮 (Tire Treads)」、「廢電路板 (PCBs)」及「生鏽水管/角鐵」
 *      粗糙拼合而成，顏色與質感各異。
 * 2. 【不規則身體拆分/解構 (Exploded Assembly / Disassemble)】：
 *    - 每個零件具備三維離散向量。按「X」或點擊拆分按鈕，不同色彩的垃圾碎屑大幅炸開浮動；
 *    - 直身蓄力時，所有零件伴隨強大磁吸力瞬間咬合鎖死為剛性重矛破城槌！
 * 3. 【垃圾堆掩埋場環境 (Landfill Wasteland)】：
 *    - 泥濘地面散落各類細碎垃圾、輪胎痕與周圍廢棄物山巒。
 * 4. 【可撞開、撞散的動態垃圾堆 (Destructible Scatterable Trash Piles)】：
 *    - 取代原先的白色方塊，改為由數十個實體廢棄物（輪胎、紙箱、鋁罐、磚塊、碎瓶、瓦楞板等）堆疊而成的垃圾堆。
 *    - 異生體高速衝撞時，垃圾堆會被轟然撞散，廢棄物伴隨物理重力與彈跳四散飛濺！
 */

// --- 狀態定義 ---
const STATE_SLITHER = 0;    // 不規則自主蛇行漫遊
const STATE_STRAIGHTEN = 1; // 零件聚攏鎖死，直身蓄力
const STATE_CHARGE = 2;     // 極速向前大力衝撞
const STATE_RECOVER = 3;    // 撞擊反衝與零件震散重整

let currentState = STATE_SLITHER;
let stateTimer = 0;
let slitherDuration = 240;
let isPaused = false;

// --- 不規則拆分控制 ---
let userSplitMode = false;   // 使用者主動開啟拆分狀態
let currentSplit = 0.22;     // 零件拆分離散程度 (0.0 = 緊密壓實, 1.0+ = 大幅拆散)
let targetSplit = 0.22;

// --- 身體關節與零件庫 ---
const NUM_SEGMENTS = 8;
const SEGMENT_SPACING = 34;
let headPos;
let headAngle = 0;
let headSpeed = 2.6;
let segments = [];
let headPieces = []; // 頭部拼裝各類垃圾零件

let slitherWave = 0;
let straightenProgress = 0; // 0 = 彎曲蛇行, 1 = 剛性直線
let wanderNoiseSeed = 100;
let chargeVector;

// --- 環境與垃圾堆系統 ---
let trashPiles = [];
let staticFloorLitter = [];
let particles = [];
let sparks = [];
let allScatteredTimer = 0;

// --- 視角與鏡頭震動 ---
let camMode = 'orbit'; // 'orbit', 'follow', 'action'
let screenShake = 0;

function setup() {
  const container = document.getElementById('canvas-container');
  const canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  canvas.parent(container);
  canvas.elt.oncontextmenu = () => false;

  headPos = createVector(0, 0, 80);
  headAngle = -HALF_PI;
  chargeVector = createVector(0, 0, -1);

  // 1. 程序化生成頭部「粗獷重型垃圾撞角」拼裝零件 (包含瓦楞板、紅磚、碎玻璃、易開罐等)
  buildHeadPieces();

  // 2. 程序化生成 8 節軀幹（每節由多種不同形態、材質與顏色的垃圾碎屑拼湊而成）
  for (let i = 0; i < NUM_SEGMENTS; i++) {
    let segPieces = generateJunkPiecesForSegment(i);
    segments.push({
      pos: createVector(headPos.x, 0, headPos.z + (i + 1) * SEGMENT_SPACING),
      angle: headAngle,
      pieces: segPieces
    });
  }

  // 3. 生成散落在地面的微型廢棄物雜質 (報紙碎屑、瓶蓋、碎石頭等)
  generateStaticFloorLitter();

  // 4. 生成可被撞開、撞散的 3D 垃圾堆
  buildTrashPiles();

  setupUI();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ----------------------------------------------------
// 1. 生成生物頭部零件 (瓦楞板、紅磚頭、尖銳玻璃碎片、鋁罐等多色拼裝)
// ----------------------------------------------------
function buildHeadPieces() {
  headPieces = [
    // (1) 主引擎底盤結構 (深灰鏽蝕鋼骨)
    {
      type: 'box',
      offset: createVector(0, -14, 0),
      size: createVector(42, 22, 38),
      rot: createVector(0, 0, 0),
      col: [48, 50, 56],
      splitDir: createVector(0, -0.8, 0)
    },
    // (2) 頭頂鏽蝕瓦楞鐵皮板頂蓋 (帶凸肋條紋)
    {
      type: 'corrugated',
      offset: createVector(0, -29, -2),
      size: createVector(40, 5, 34),
      rot: createVector(-0.15, 0, 0),
      col: [170, 85, 45], // 氧化鏽橘色
      ridges: 5,
      splitDir: createVector(0, -1.8, -0.3)
    },
    // (3) 左頰銲接的厚重紅磚塊 (重物配重)
    {
      type: 'brick',
      offset: createVector(-26, -10, 6),
      size: createVector(12, 18, 30),
      rot: createVector(0.08, 0.22, -0.1),
      col: [180, 65, 48], // 經典紅磚色
      isCinder: false,
      splitDir: createVector(-1.5, 0.2, 0)
    },
    // (4) 右頰廢棄黃黑警戒標誌鐵板
    {
      type: 'hazard_plate',
      offset: createVector(26, -11, 8),
      size: createVector(9, 20, 32),
      rot: createVector(0.05, -0.2, 0.1),
      col: [225, 185, 35], // 亮黃斑駁警戒
      splitDir: createVector(1.5, 0.2, 0)
    },
    // (5) 前端核心尖刺：巨型碎啤酒瓶翡翠綠尖銳玻璃晶體！
    {
      type: 'glass_shard',
      offset: createVector(0, -12, 36),
      w: 22,
      h: 48,
      d: 14,
      rot: createVector(HALF_PI, 0, 0),
      col: [35, 190, 115], // 翡翠透綠碎玻璃
      specCol: [200, 255, 230],
      splitDir: createVector(0, 0, 1.8)
    },
    // (6) 前端次級副尖刺：琥珀棕色藥酒瓶玻璃碎片
    {
      type: 'glass_shard',
      offset: createVector(-10, -16, 26),
      w: 12,
      h: 28,
      d: 8,
      rot: createVector(1.4, 0.3, -0.2),
      col: [205, 125, 30], // 琥珀棕啤酒玻璃
      specCol: [255, 220, 180],
      splitDir: createVector(-0.8, -0.8, 1.2)
    },
    // (7) 下顎卡緊的壓扁紅色可樂鋁罐
    {
      type: 'can',
      offset: createVector(0, -3, 14),
      r: 9,
      h: 20,
      rot: createVector(0, HALF_PI, HALF_PI),
      col: [215, 38, 38], // 艷紅鋁罐
      splitDir: createVector(0, 1.2, 0.5)
    },
    // (8) 頸部保護的廢輪胎厚橡膠皮
    {
      type: 'tire_chunk',
      offset: createVector(0, -22, -18),
      size: createVector(36, 10, 16),
      rot: createVector(0.3, 0, 0),
      col: [32, 33, 36], // 消光輪胎黑
      splitDir: createVector(0, -1.2, -1.2)
    },
    // (9) 兩側斜伸出噴火的破舊廢排氣鐵管
    {
      type: 'pipe',
      offset: createVector(18, -22, -8),
      r: 5,
      h: 30,
      rot: createVector(-0.4, 0.5, 0.3),
      col: [75, 58, 48],
      splitDir: createVector(1.0, -1.0, -0.6)
    }
  ];
}

// ----------------------------------------------------
// 2. 生成生物軀幹各節零件 (瓦楞板、紅磚、碎玻璃、易開罐、輪胎皮、電路板等)
// ----------------------------------------------------
function generateJunkPiecesForSegment(segIndex) {
  let pieces = [];
  let baseScale = map(segIndex, 0, NUM_SEGMENTS - 1, 1.0, 0.5);
  let seed = segIndex * 211 + 43;
  randomSeed(seed);

  // 1. 中央主承重金屬骨架
  pieces.push({
    type: 'box',
    offset: createVector(random(-2, 2), -12 * baseScale, random(-2, 2)),
    size: createVector(34 * baseScale, 16 * baseScale, 26 * baseScale),
    rot: createVector(random(-0.08, 0.08), random(-0.08, 0.08), random(-0.08, 0.08)),
    col: (segIndex % 2 === 0) ? [46, 48, 54] : [62, 45, 36], // 鐵灰與深鏽交替
    splitDir: createVector(0, -0.5, 0)
  });

  // 2. 瓦楞板外殼組件 (鐵皮綠、鏽橘、紙箱棕交錯)
  let corrColors = [
    [175, 85, 45],  // 鏽蝕瓦楞鐵皮
    [58, 120, 108], // 鍍鋅綠/氧化青瓦楞板
    [148, 108, 68]  // 廢紙箱瓦楞紙板
  ];
  let cCol = corrColors[segIndex % corrColors.length];
  let sideSign = (segIndex % 2 === 0) ? -1 : 1;
  pieces.push({
    type: 'corrugated',
    offset: createVector((20 + random(2, 6)) * sideSign * baseScale, (-12 + random(-4, 4)) * baseScale, random(-4, 4)),
    size: createVector(random(14, 20) * baseScale, random(4, 7) * baseScale, random(24, 34) * baseScale),
    rot: createVector(random(-0.2, 0.2), random(-0.2, 0.2), sideSign * 0.3),
    col: cCol,
    ridges: 3,
    splitDir: createVector(sideSign * 1.4, random(-0.5, 0.5), random(-0.5, 0.5))
  });

  // 3. 磚頭 / 水泥塊 (紅磚頭或灰水泥磚)
  let isCinder = (segIndex % 3 === 1);
  let brickCol = isCinder ? [125, 128, 134] : [182, 68, 50];
  pieces.push({
    type: 'brick',
    offset: createVector((-22 - random(2, 6)) * sideSign * baseScale, (-10 + random(-3, 3)) * baseScale, random(-5, 5)),
    size: createVector(random(12, 16) * baseScale, random(10, 15) * baseScale, random(20, 28) * baseScale),
    rot: createVector(random(-0.15, 0.15), random(-0.2, 0.2), -sideSign * 0.25),
    col: brickCol,
    isCinder: isCinder,
    splitDir: createVector(-sideSign * 1.5, random(-0.4, 0.4), random(-0.5, 0.5))
  });

  // 4. 尖銳背棘玻璃碎片 (高光澤、不同色系的透亮尖角！)
  let glassColors = [
    { col: [35, 185, 120], spec: [210, 255, 235] }, // 綠啤酒瓶
    { col: [40, 115, 225], spec: [200, 230, 255] }, // 寶藍玻璃
    { col: [205, 125, 30], spec: [255, 225, 190] }, // 琥珀深褐
    { col: [110, 215, 230], spec: [230, 255, 255] }  // 淺青水玻璃
  ];
  let gInfo = glassColors[segIndex % glassColors.length];
  pieces.push({
    type: 'glass_shard',
    offset: createVector(random(-6, 6) * baseScale, (-22 - random(4, 10)) * baseScale, random(-6, 6)),
    w: random(10, 16) * baseScale,
    h: random(24, 38) * baseScale,
    d: random(8, 12) * baseScale,
    rot: createVector(-0.35 + random(-0.2, 0.2), random(-0.3, 0.3), random(-0.2, 0.2)),
    col: gInfo.col,
    specCol: gInfo.spec,
    splitDir: createVector(random(-0.6, 0.6), -1.8, random(-0.6, 0.6))
  });

  // 5. 壓扁鋁罐 / 鐵罐 (可樂紅、百事藍、雪碧綠、檸檬黃)
  let canColors = [
    [210, 40, 40],   // 可樂紅
    [35, 95, 215],   // 百事藍
    [225, 180, 30],  // 金黃能量罐
    [40, 175, 75]    // 雪碧綠
  ];
  pieces.push({
    type: 'can',
    offset: createVector(random(-12, 12) * baseScale, (-4 + random(-3, 3)) * baseScale, (10 + random(2, 6)) * baseScale),
    r: random(6, 9) * baseScale,
    h: random(14, 22) * baseScale,
    rot: createVector(random(-0.5, 0.5), random(-1, 1), HALF_PI),
    col: canColors[(segIndex * 2 + 1) % canColors.length],
    splitDir: createVector(random(-0.8, 0.8), 0.8, 1.2)
  });

  // 6. 輪胎橡膠皮或廢電路板 (交替出現增添生活與科技垃圾感)
  if (segIndex % 2 === 0) {
    pieces.push({
      type: 'tire_chunk',
      offset: createVector(random(-14, 14) * baseScale, -18 * baseScale, random(-8, 8)),
      size: createVector(random(16, 26) * baseScale, 6 * baseScale, random(14, 22) * baseScale),
      rot: createVector(random(-0.3, 0.3), random(-0.3, 0.3), random(-0.2, 0.2)),
      col: [32, 33, 36],
      splitDir: createVector(random(-0.8, 0.8), -1.2, random(-0.8, 0.8))
    });
  } else {
    pieces.push({
      type: 'pcb',
      offset: createVector(random(-14, 14) * baseScale, -17 * baseScale, random(-8, 8)),
      size: createVector(random(18, 24) * baseScale, 4 * baseScale, random(18, 24) * baseScale),
      rot: createVector(random(-0.2, 0.2), random(-0.4, 0.4), random(-0.2, 0.2)),
      col: [24, 88, 48], // 墨綠電路板
      splitDir: createVector(random(-0.8, 0.8), -1.1, random(-0.8, 0.8))
    });
  }

  // 尾端最後一節：追加一把巨大的碎玻璃拖刀與鏽蝕角鐵尾刺
  if (segIndex === NUM_SEGMENTS - 1) {
    pieces.push({
      type: 'glass_shard',
      offset: createVector(0, -6, 32),
      w: 16,
      h: 46,
      d: 12,
      rot: createVector(-1.8, 0, 0),
      col: [35, 190, 115],
      specCol: [200, 255, 230],
      splitDir: createVector(0, 0.6, 2.2)
    });
    pieces.push({
      type: 'brick',
      offset: createVector(0, -4, 18),
      size: createVector(14, 10, 20),
      rot: createVector(0.2, 0, 0),
      col: [180, 68, 50],
      isCinder: false,
      splitDir: createVector(0, 0.4, 1.4)
    });
  }

  return pieces;
}

// ----------------------------------------------------
// 3. 生成可撞散的 3D 垃圾堆 (Destructible Trash Piles)
// ----------------------------------------------------
function buildTrashPiles() {
  trashPiles = [];
  randomSeed(999);

  let numPiles = 9;
  for (let i = 0; i < numPiles; i++) {
    let angle = (TWO_PI / numPiles) * i + random(-0.25, 0.25);
    let distVal = random(360, 560);
    let pilePos = createVector(cos(angle) * distVal, 0, sin(angle) * distVal);

    let pile = {
      id: i,
      pos: pilePos,
      radius: random(65, 85),
      height: random(55, 80),
      scattered: false,
      scatterTimer: 0,
      hitShake: 0,
      items: []
    };

    // 每個垃圾堆由 16~22 個不同種類的實體垃圾零件堆疊而成
    let itemCount = floor(random(16, 22));
    for (let j = 0; j < itemCount; j++) {
      let rRatio = (j / itemCount);
      let ringRadius = pile.radius * (1 - rRatio * 0.7) * random(0.3, 0.95);
      let ringAngle = random(TWO_PI);
      let lx = cos(ringAngle) * ringRadius;
      let lz = sin(ringAngle) * ringRadius;
      let ly = -map(rRatio, 0, 1, 8, pile.height) + random(-5, 5);

      // 隨機垃圾物種：輪胎、紙箱、鋁罐、紅磚頭、酒瓶碎片、瓦楞鐵板
      let itemType;
      let roll = random();
      let col, size, r, h, w, d;
      let isCinder = false;

      if (roll < 0.2) {
        // 廢輪胎
        itemType = 'tire';
        col = [34, 35, 38];
        r = random(14, 20);
        h = random(7, 10);
      } else if (roll < 0.4) {
        // 破紙箱 / 木箱
        itemType = 'box';
        col = random() > 0.4 ? [145, 110, 72] : [98, 76, 52];
        size = createVector(random(20, 36), random(14, 24), random(20, 34));
      } else if (roll < 0.6) {
        // 紅磚 / 混凝土
        itemType = 'brick';
        isCinder = random() > 0.6;
        col = isCinder ? [128, 130, 136] : [185, 70, 52];
        size = createVector(random(14, 22), random(10, 16), random(18, 28));
      } else if (roll < 0.78) {
        // 壓扁彩色鋁罐 / 鐵桶
        itemType = 'can';
        let cans = [[210, 42, 42], [38, 92, 215], [225, 185, 32], [42, 175, 78], [195, 198, 205]];
        col = random(cans);
        r = random(8, 13);
        h = random(14, 24);
      } else if (roll < 0.9) {
        // 碎玻璃瓶身 / 尖角
        itemType = 'glass_shard';
        let gColors = [[35, 185, 118], [205, 125, 32], [45, 110, 225]];
        col = random(gColors);
        w = random(12, 18);
        h = random(22, 34);
        d = random(8, 14);
      } else {
        // 瓦楞鐵皮碎片
        itemType = 'corrugated';
        col = random() > 0.5 ? [165, 82, 44] : [60, 115, 105];
        size = createVector(random(24, 36), 5, random(24, 36));
      }

      pile.items.push({
        type: itemType,
        localOffset: createVector(lx, ly, lz),
        pos: createVector(pilePos.x + lx, ly, pilePos.z + lz),
        vel: createVector(0, 0, 0),
        rot: createVector(random(-0.4, 0.4), random(TWO_PI), random(-0.4, 0.4)),
        rotVel: createVector(0, 0, 0),
        col: col,
        size: size,
        r: r,
        h: h,
        w: w,
        d: d,
        isCinder: isCinder,
        isResting: true,
        groundOffset: (itemType === 'can' || itemType === 'tire') ? (r || 8) : 6
      });
    }

    trashPiles.push(pile);
  }
}

// 散落於掩埋場地面的微量靜態垃圾碎屑
function generateStaticFloorLitter() {
  staticFloorLitter = [];
  randomSeed(777);
  for (let i = 0; i < 90; i++) {
    let r = random(60, 680);
    let a = random(TWO_PI);
    let roll = random();
    let col, size;
    if (roll < 0.35) {
      col = [190, 185, 175]; // 丟棄廢紙/塑膠袋
      size = createVector(random(8, 16), 1, random(8, 16));
    } else if (roll < 0.65) {
      col = [160, 75, 48]; // 碎磚塊泥土
      size = createVector(random(6, 12), 3, random(6, 12));
    } else {
      col = [55, 60, 70]; // 廢金屬/瓶蓋
      size = createVector(random(6, 10), 2, random(6, 10));
    }
    staticFloorLitter.push({
      pos: createVector(cos(a) * r, 0, sin(a) * r),
      rot: random(TWO_PI),
      col: col,
      size: size
    });
  }
}

// ----------------------------------------------------
// 主繪製迴圈
// ----------------------------------------------------
function draw() {
  background(12, 11, 14);

  // 鏡頭與震動
  applyCamera();

  // 垃圾場厚重視覺光照（陰暗帶點鏽紅與冷金屬光澤）
  ambientLight(55, 50, 48);
  directionalLight(215, 218, 228, 0.45, 0.85, -0.55); // 冷白頂光
  directionalLight(160, 95, 55, -0.6, -0.3, 0.6);    // 地面生鏽暖光
  pointLight(180, 185, 195, headPos.x, headPos.y - 120, headPos.z); // 跟隨車頭光暈

  // 繪製廢棄物掩埋場地形與垃圾堆
  drawGroundWasteland();
  drawTrashPiles();

  // 更新動態與物理狀態
  if (!isPaused) {
    updateCreatureAI();
    updateTrashPilesPhysics();
    updateEffects();
  }

  // 繪製生物本體與粒子特效
  drawScrapCreature();
  drawEffects();

  updateHUD();
}

// ----------------------------------------------------
// 生物運動學與自主 AI
// ----------------------------------------------------
function updateCreatureAI() {
  stateTimer++;

  // 平滑過渡拆分量 (currentSplit)
  currentSplit = lerp(currentSplit, targetSplit, 0.12);

  switch (currentState) {
    case STATE_SLITHER:
      // 【階段一：地面自主波狀蛇行】
      slitherWave += 0.088;
      straightenProgress = lerp(straightenProgress, 0, 0.08);

      // 若使用者沒有開啟全拆分，蛇行時維持鬆散自然的呼吸拆分度 (0.2 ~ 0.35)
      if (!userSplitMode) {
        targetSplit = 0.22 + sin(slitherWave * 0.5) * 0.1;
      }

      // Perlin 噪聲不規則自主轉向
      wanderNoiseSeed += 0.008;
      let turnRate = map(noise(wanderNoiseSeed), 0, 1, -0.055, 0.055);

      // 邊界防跑出軟性約束
      let distFromCenter = headPos.mag();
      if (distFromCenter > 490) {
        let returnAngle = atan2(-headPos.x, -headPos.z);
        let diff = returnAngle - headAngle;
        while (diff < -PI) diff += TWO_PI;
        while (diff > PI) diff -= TWO_PI;
        turnRate += diff * 0.045;
      }

      headAngle += turnRate;

      // 前進移動
      headSpeed = 2.75;
      headPos.x += sin(headAngle) * headSpeed;
      headPos.z += cos(headAngle) * headSpeed;

      if (frameCount % 5 === 0) {
        spawnDust(headPos.x + random(-14, 14), 0, headPos.z + random(-14, 14), 1);
      }

      if (stateTimer >= slitherDuration) {
        triggerStraighten();
      }
      break;

    case STATE_STRAIGHTEN:
      // 【階段二：鎖定蓄力直身，所有零件瞬間磁吸壓實鎖死！】
      straightenProgress = min(1.0, straightenProgress + 0.05);
      
      // 強制所有零件瞬間咬合鎖緊為剛性實心長矛
      targetSplit = 0.0;

      // 向後微縮蓄勁
      headPos.x -= sin(headAngle) * 0.16;
      headPos.z -= cos(headAngle) * 0.16;

      // 機械緊繃的高頻震顫
      screenShake = max(screenShake, 1.5);
      spawnSparks(headPos.x + random(-14, 14), 0, headPos.z + random(-14, 14), random(-1, 1));

      if (stateTimer > 40) {
        triggerCharge();
      }
      break;

    case STATE_CHARGE:
      // 【階段三：極速直身猛撞垃圾堆】
      straightenProgress = 1.0;
      targetSplit = 0.0; // 衝撞過程保持緊固筆直

      let chargeSpeed = 18.5;
      headPos.x += chargeVector.x * chargeSpeed;
      headPos.z += chargeVector.z * chargeSpeed;
      screenShake = 3.8;

      // 地面刮擦火星與飛塵
      for (let i = 0; i < 3; i++) {
        spawnSparks(
          headPos.x - chargeVector.x * random(10, 30) + random(-10, 10),
          0,
          headPos.z - chargeVector.z * random(10, 30) + random(-10, 10),
          -chargeVector.x * 5
        );
      }

      // 檢測是否衝撞到任何垃圾堆
      for (let pile of trashPiles) {
        let d = dist(headPos.x, headPos.z, pile.pos.x, pile.pos.z);
        if (d < pile.radius + 36) {
          if (!pile.scattered) {
            // 猛烈撞碎並轟散垃圾堆！
            scatterTrashPile(pile, chargeVector, chargeSpeed);
            triggerImpact();
            break;
          } else {
            // 衝過已撞散的垃圾碎屑堆時，將地面碎屑再度踢飛踢散
            for (let item of pile.items) {
              let idist = dist(headPos.x, headPos.z, item.pos.x, item.pos.z);
              if (idist < 42 && item.isResting) {
                item.isResting = false;
                item.vel.x = chargeVector.x * random(8, 16) + random(-4, 4);
                item.vel.z = chargeVector.z * random(8, 16) + random(-4, 4);
                item.vel.y = -random(5, 11);
                item.rotVel = createVector(random(-0.3, 0.3), random(-0.3, 0.3), random(-0.3, 0.3));
              }
            }
          }
        }
      }

      if (stateTimer > 42) {
        triggerImpact();
      }
      break;

    case STATE_RECOVER:
      // 【階段四：撞擊反衝與零件震散重整】
      straightenProgress = lerp(straightenProgress, 0.25, 0.05);

      if (stateTimer > 48) {
        currentState = STATE_SLITHER;
        stateTimer = 0;
        slitherDuration = floor(random(160, 320));
        targetSplit = userSplitMode ? 1.0 : 0.25;
      }
      break;
  }

  // --- 關節跟隨約束 (IK + 行波) ---
  let leaderPos = headPos.copy();

  for (let i = 0; i < NUM_SEGMENTS; i++) {
    let seg = segments[i];

    if (straightenProgress >= 0.98) {
      // 直身狀態：嚴格沿著直線鎖死緊扣
      let straightOffset = (i + 1) * SEGMENT_SPACING;
      let targetX = headPos.x - sin(headAngle) * straightOffset;
      let targetZ = headPos.z - cos(headAngle) * straightOffset;
      seg.pos.x = lerp(seg.pos.x, targetX, 0.68);
      seg.pos.z = lerp(seg.pos.z, targetZ, 0.68);
      seg.angle = headAngle;
    } else {
      // 蛇行狀態：牽引跟隨 + 側向正弦行波
      let toLeader = p5.Vector.sub(leaderPos, seg.pos);
      toLeader.normalize();

      let waveOffset = sin(slitherWave - i * 0.52) * (34 - i * 1.8) * (1 - straightenProgress);
      let normalVec = createVector(-toLeader.z, 0, toLeader.x).mult(waveOffset * 0.22);

      let targetPos = p5.Vector.sub(leaderPos, p5.Vector.mult(toLeader, SEGMENT_SPACING)).add(normalVec);
      seg.pos.x = lerp(seg.pos.x, targetPos.x, 0.55);
      seg.pos.y = 0;
      seg.pos.z = lerp(seg.pos.z, targetPos.z, 0.55);

      seg.angle = atan2(leaderPos.x - seg.pos.x, leaderPos.z - seg.pos.z);
    }

    leaderPos = seg.pos.copy();
  }
}

// 直身瞄準前方垃圾堆
function triggerStraighten() {
  if (currentState !== STATE_SLITHER) return;
  currentState = STATE_STRAIGHTEN;
  stateTimer = 0;

  // 優先鎖定前方尚未被撞散的垃圾堆
  let bestTarget = null;
  let closestDist = 9999;

  for (let pile of trashPiles) {
    let d = dist(headPos.x, headPos.z, pile.pos.x, pile.pos.z);
    if (d > 70 && d < 650) {
      let toP = createVector(pile.pos.x - headPos.x, 0, pile.pos.z - headPos.z).normalize();
      let fwd = createVector(sin(headAngle), 0, cos(headAngle));
      let dot = toP.dot(fwd);

      // 如果尚未撞散，給予極高優先權
      let weight = pile.scattered ? 0.35 : 1.0;
      if (dot > 0.25 && (d / weight) < closestDist) {
        closestDist = d / weight;
        bestTarget = pile;
      }
    }
  }

  if (bestTarget) {
    headAngle = atan2(bestTarget.pos.x - headPos.x, bestTarget.pos.z - headPos.z);
  }
  chargeVector = createVector(sin(headAngle), 0, cos(headAngle)).normalize();
}

function triggerCharge() {
  currentState = STATE_CHARGE;
  stateTimer = 0;
}

function triggerImpact() {
  currentState = STATE_RECOVER;
  stateTimer = 0;
  screenShake = 18.0;

  // 撞擊瞬間：自身外殼所有零件受到衝擊波強烈震散彈開！
  currentSplit = 1.7;
  targetSplit = userSplitMode ? 1.0 : 0.28;

  // 撞擊產生的大量火花與塵埃
  for (let i = 0; i < 50; i++) {
    sparks.push({
      pos: createVector(headPos.x, -14, headPos.z),
      vel: createVector(random(-14, 14), random(-16, 2), random(-14, 14)),
      life: 255,
      size: random(3, 8),
      col: random() > 0.35 ? color(245, 150, 40) : color(210, 215, 225)
    });
  }
}

// ----------------------------------------------------
// 垃圾堆物理爆散系統 (Scatter Trash Pile)
// ----------------------------------------------------
function scatterTrashPile(pile, chargeDir, speed) {
  pile.scattered = true;
  pile.hitShake = 30;

  // 產生大量掩埋場煙塵與廢紙碎屑
  for (let k = 0; k < 35; k++) {
    particles.push({
      pos: createVector(pile.pos.x + random(-25, 25), -10, pile.pos.z + random(-25, 25)),
      vel: createVector(
        chargeDir.x * random(3, 10) + random(-6, 6),
        random(-12, -2),
        chargeDir.z * random(3, 10) + random(-6, 6)
      ),
      life: 140,
      size: random(8, 20),
      col: color(110, 95, 80, 130)
    });
  }

  // 將垃圾堆內的每一個物件炸開四散！
  for (let item of pile.items) {
    item.isResting = false;

    // 計算自中心擴散 + 前進衝力的噴散向量
    let away = p5.Vector.sub(item.pos, pile.pos);
    away.y = 0;
    if (away.mag() < 0.1) {
      away = createVector(random(-1, 1), 0, random(-1, 1));
    }
    away.normalize();
    away.add(p5.Vector.mult(chargeDir, 1.8)).normalize();

    let blastForce = random(12, 28);
    item.vel = p5.Vector.mult(away, blastForce);
    item.vel.y = random(-16, -7); // 拋射升空

    item.rotVel = createVector(random(-0.35, 0.35), random(-0.35, 0.35), random(-0.35, 0.35));
  }
}

// 垃圾堆實體物理模擬更新 (重力、彈跳、地面滑動摩擦)
function updateTrashPilesPhysics() {
  let allScattered = true;

  for (let pile of trashPiles) {
    if (pile.hitShake > 0) pile.hitShake--;

    if (!pile.scattered) {
      allScattered = false;
      continue;
    }

    pile.scatterTimer++;

    for (let item of pile.items) {
      if (item.isResting) continue;

      item.pos.add(item.vel);
      item.rot.add(item.rotVel);

      // 重力加速度
      item.vel.y += 0.58;

      // 地面碰撞檢測與反彈 (地面 y = 0)
      let groundY = -item.groundOffset;
      if (item.pos.y >= groundY) {
        item.pos.y = groundY;
        item.vel.y = -item.vel.y * 0.35; // 彈跳能量衰減
        item.vel.x *= 0.82;             // 地面滾動摩擦
        item.vel.z *= 0.82;
        item.rotVel.mult(0.85);

        // 當速度極小時判定靜止
        if (abs(item.vel.y) < 0.4 && (item.vel.x * item.vel.x + item.vel.z * item.vel.z) < 0.15) {
          item.isResting = true;
          item.vel.set(0, 0, 0);
          item.rotVel.set(0, 0, 0);
        }
      }
    }
  }

  // 若所有垃圾堆皆已被撞散超過 240 幀 (~4 秒)，自動重新凝聚堆整
  if (allScattered) {
    allScatteredTimer++;
    if (allScatteredTimer > 240) {
      resetAllTrashPiles();
      allScatteredTimer = 0;
    }
  } else {
    allScatteredTimer = 0;
  }
}

// 重新堆整所有垃圾堆
function resetAllTrashPiles() {
  allScatteredTimer = 0;
  for (let pile of trashPiles) {
    pile.scattered = false;
    pile.scatterTimer = 0;
    pile.hitShake = 0;
    for (let item of pile.items) {
      item.isResting = true;
      item.pos = p5.Vector.add(pile.pos, item.localOffset);
      item.vel.set(0, 0, 0);
      item.rot.set(random(-0.3, 0.3), random(TWO_PI), random(-0.3, 0.3));
      item.rotVel.set(0, 0, 0);
    }
  }
  // 揚起重整塵埃
  for (let p of trashPiles) {
    spawnDust(p.pos.x, 0, p.pos.z, 8);
  }
}

// ----------------------------------------------------
// 繪製垃圾堆與垃圾場環境
// ----------------------------------------------------
function drawGroundWasteland() {
  push();
  translate(0, 1, 0);

  // 1. 垃圾掩埋場泥濘地表 (深黑褐色與沉積層質感)
  noStroke();
  fill(18, 16, 15);
  push();
  rotateX(HALF_PI);
  plane(2600, 2600);
  pop();

  // 2. 掩埋場深色壓痕網格與輪胎痕輪廓
  stroke(38, 32, 28, 90);
  strokeWeight(1);
  for (let z = -1200; z <= 1200; z += 90) {
    line(-1200, 0, z, 1200, 0, z);
  }
  for (let x = -1200; x <= 1200; x += 90) {
    line(x, 0, -1200, x, 0, 1200);
  }

  // 3. 散落於地面的靜態微細垃圾碎屑
  for (let litter of staticFloorLitter) {
    push();
    translate(litter.pos.x, -1, litter.pos.z);
    rotateY(litter.rot);
    fill(litter.col[0], litter.col[1], litter.col[2]);
    box(litter.size.x, litter.size.y, litter.size.z);
    pop();
  }

  // 4. 周圍遠景垃圾山巒邊界 (大型廢料堆包圍感)
  fill(25, 22, 20);
  for (let i = 0; i < 14; i++) {
    let ang = (TWO_PI / 14) * i;
    let distR = 720;
    push();
    translate(cos(ang) * distR, -35, sin(ang) * distR);
    rotateY(ang);
    box(180, 70, 90);
    pop();
  }

  pop();
}

function drawTrashPiles() {
  for (let pile of trashPiles) {
    push();
    if (pile.hitShake > 0) {
      translate(random(-pile.hitShake, pile.hitShake) * 0.35, 0, random(-pile.hitShake, pile.hitShake) * 0.35);
    }

    // 繪製該垃圾堆下的所有垃圾單元
    for (let item of pile.items) {
      push();
      translate(item.pos.x, item.pos.y, item.pos.z);
      rotateX(item.rot.x);
      rotateY(item.rot.y);
      rotateZ(item.rot.z);

      drawSingleTrashItem(item);
      pop();
    }

    pop();
  }
}

// 繪製單個垃圾實體 (輪胎、紙箱、磚塊、罐子、玻璃、瓦楞板)
function drawSingleTrashItem(item) {
  noStroke();

  if (item.type === 'tire') {
    // 廢輪胎：黑色橡膠圓環
    fill(item.col[0], item.col[1], item.col[2]);
    specularMaterial(50, 52, 56);
    shininess(4);
    rotateX(HALF_PI);
    torus(item.r, item.h * 0.55);
  } else if (item.type === 'box') {
    // 廢紙箱 / 雜物方塊
    fill(item.col[0], item.col[1], item.col[2]);
    specularMaterial(item.col[0] * 0.7, item.col[1] * 0.7, item.col[2] * 0.7);
    shininess(6);
    box(item.size.x, item.size.y, item.size.z);

    // 封箱膠帶細節
    fill(item.col[0] * 0.75, item.col[1] * 0.75, item.col[2] * 0.6);
    push();
    translate(0, -item.size.y * 0.51, 0);
    box(item.size.x * 0.9, 1, 6);
    pop();
  } else if (item.type === 'brick') {
    drawBrickShape(item.size.x, item.size.y, item.size.z, item.col, item.isCinder);
  } else if (item.type === 'can') {
    drawCanShape(item.r, item.h, item.col);
  } else if (item.type === 'glass_shard') {
    drawGlassShardShape(item.w, item.h, item.d, item.col, [220, 255, 235]);
  } else if (item.type === 'corrugated') {
    drawCorrugatedPlateShape(item.size.x, item.size.y, item.size.z, item.col, 3);
  }
}

// ----------------------------------------------------
// 繪製生物本體 (支援不規則拆分解構與各類垃圾材質)
// ----------------------------------------------------
function drawScrapCreature() {
  push();

  // 1. 繪製拼裝頭部
  push();
  translate(headPos.x, headPos.y - 12, headPos.z);
  rotateY(headAngle);

  for (let piece of headPieces) {
    push();
    // 依據拆分量 (currentSplit) 沿零件的拆分向量向外離散展開
    let sx = piece.splitDir.x * currentSplit * 26;
    let sy = piece.splitDir.y * currentSplit * 22;
    let sz = piece.splitDir.z * currentSplit * 26;
    translate(piece.offset.x + sx, piece.offset.y + sy, piece.offset.z + sz);

    // 拆分時零件的各向微旋轉
    rotateX(piece.rot.x + piece.splitDir.z * currentSplit * 0.45);
    rotateY(piece.rot.y + piece.splitDir.x * currentSplit * 0.45);
    rotateZ(piece.rot.z + piece.splitDir.y * currentSplit * 0.45);

    drawJunkShape(piece);
    pop();
  }
  pop(); // 結束頭部

  // 2. 繪製 8 節多關節軀幹
  for (let i = 0; i < NUM_SEGMENTS; i++) {
    let seg = segments[i];
    push();
    translate(seg.pos.x, seg.pos.y, seg.pos.z);
    rotateY(seg.angle);

    // 蛇行時的側傾 (Roll)
    let roll = sin(slitherWave - i * 0.5) * 0.08 * (1 - straightenProgress);
    rotateZ(roll);

    for (let piece of seg.pieces) {
      push();
      // 每個垃圾零件獨立沿其隨機 splitDir 展開
      let sx = piece.splitDir.x * currentSplit * 30;
      let sy = piece.splitDir.y * currentSplit * 26;
      let sz = piece.splitDir.z * currentSplit * 30;
      translate(piece.offset.x + sx, piece.offset.y + sy, piece.offset.z + sz);

      // 拆分時伴隨不規則翻動
      rotateX(piece.rot.x + piece.splitDir.z * currentSplit * 0.5);
      rotateY(piece.rot.y + piece.splitDir.x * currentSplit * 0.5);
      rotateZ(piece.rot.z + piece.splitDir.y * currentSplit * 0.5);

      drawJunkShape(piece);
      pop();
    }

    pop();
  }

  pop();
}

// ----------------------------------------------------
// 各類專屬垃圾零件的外觀繪製
// ----------------------------------------------------
function drawJunkShape(piece) {
  noStroke();

  if (piece.type === 'corrugated') {
    // 【瓦楞板】：底板 + 表面突起肋條
    drawCorrugatedPlateShape(piece.size.x, piece.size.y, piece.size.z, piece.col, piece.ridges || 4);
  } else if (piece.type === 'brick') {
    // 【紅磚頭 / 混泥土塊】
    drawBrickShape(piece.size.x, piece.size.y, piece.size.z, piece.col, piece.isCinder);
  } else if (piece.type === 'glass_shard') {
    // 【尖銳玻璃碎片】：高光澤多面體尖刺
    drawGlassShardShape(piece.w, piece.h, piece.d, piece.col, piece.specCol);
  } else if (piece.type === 'can') {
    // 【壓扁彩色鋁罐】：罐身 + 銀色封口邊緣
    drawCanShape(piece.r, piece.h, piece.col);
  } else if (piece.type === 'tire_chunk') {
    // 【輪胎橡膠皮】：消光黑 + 表面胎面凹槽條紋
    drawTireChunkShape(piece.size.x, piece.size.y, piece.size.z, piece.col);
  } else if (piece.type === 'hazard_plate') {
    // 【黃黑警戒標誌碎片】
    drawHazardPlateShape(piece.size.x, piece.size.y, piece.size.z, piece.col);
  } else if (piece.type === 'pcb') {
    // 【綠色電路板】：深綠板身 + 金黃銅導線
    drawPCBShape(piece.size.x, piece.size.y, piece.size.z, piece.col);
  } else if (piece.type === 'pipe') {
    // 【生鏽鋼管 / 角鐵】
    specularMaterial(piece.col[0], piece.col[1], piece.col[2]);
    shininess(12);
    fill(piece.col[0], piece.col[1], piece.col[2]);
    cylinder(piece.r, piece.h);
  } else if (piece.type === 'box') {
    // 通用廢鐵座塊
    specularMaterial(piece.col[0], piece.col[1], piece.col[2]);
    shininess(10);
    fill(piece.col[0], piece.col[1], piece.col[2]);
    box(piece.size.x, piece.size.y, piece.size.z);
  }
}

// 1. 瓦楞板形狀繪製
function drawCorrugatedPlateShape(w, h, d, col, ridgesCount) {
  fill(col[0], col[1], col[2]);
  specularMaterial(col[0], col[1], col[2]);
  shininess(10);
  box(w, h, d);

  // 繪製波紋凸肋
  push();
  fill(col[0] * 0.8, col[1] * 0.8, col[2] * 0.8);
  let step = w / (ridgesCount + 1);
  for (let r = 0; r < ridgesCount; r++) {
    push();
    translate(-w * 0.5 + (r + 1) * step, -h * 0.5 - 1.2, 0);
    box(step * 0.45, 2.4, d * 0.98);
    pop();
  }
  pop();
}

// 2. 磚頭形狀繪製 (紅磚 / 水泥空心磚)
function drawBrickShape(w, h, d, col, isCinder) {
  fill(col[0], col[1], col[2]);
  specularMaterial(col[0] * 0.6, col[1] * 0.6, col[2] * 0.6);
  shininess(4);
  box(w, h, d);

  if (isCinder) {
    // 繪製水泥空心磚的兩處通孔凹洞
    push();
    fill(32, 34, 38);
    translate(-w * 0.22, -h * 0.51, 0);
    box(w * 0.26, 2, d * 0.55);
    translate(w * 0.44, 0, 0);
    box(w * 0.26, 2, d * 0.55);
    pop();
  }
}

// 3. 尖銳透亮玻璃碎片形狀繪製 (多面尖椎三角形)
function drawGlassShardShape(w, h, d, col, specCol) {
  shininess(90);
  if (specCol) {
    specularMaterial(specCol[0], specCol[1], specCol[2]);
  }
  fill(col[0], col[1], col[2]);

  // 尖銳楔形晶體 (三個尖面組成的銳角三稜椎)
  beginShape(TRIANGLES);
  // 面 1 (前斜面)
  vertex(0, -h, 0);
  vertex(-w * 0.5, 0, -d * 0.5);
  vertex(w * 0.5, 0, -d * 0.5);
  // 面 2 (右斜面)
  vertex(0, -h, 0);
  vertex(w * 0.5, 0, -d * 0.5);
  vertex(0, 0, d * 0.5);
  // 面 3 (左斜面)
  vertex(0, -h, 0);
  vertex(0, 0, d * 0.5);
  vertex(-w * 0.5, 0, -d * 0.5);
  // 底面
  vertex(-w * 0.5, 0, -d * 0.5);
  vertex(w * 0.5, 0, -d * 0.5);
  vertex(0, 0, d * 0.5);
  endShape();
}

// 4. 壓扁鋁罐形狀繪製
function drawCanShape(r, h, col) {
  fill(col[0], col[1], col[2]);
  specularMaterial(col[0], col[1], col[2]);
  shininess(40);
  cylinder(r, h);

  // 上下銀色鋁質封蓋
  push();
  fill(200, 205, 215);
  specularMaterial(230, 235, 245);
  translate(0, -h * 0.5, 0);
  cylinder(r * 0.9, 1.5);
  translate(0, h, 0);
  cylinder(r * 0.9, 1.5);
  pop();
}

// 5. 輪胎橡膠皮形狀繪製
function drawTireChunkShape(w, h, d, col) {
  fill(col[0], col[1], col[2]);
  specularMaterial(45, 46, 50);
  shininess(3);
  box(w, h, d);

  // 橡膠胎面花紋溝槽
  push();
  fill(18, 19, 21);
  let step = d / 4;
  for (let k = 1; k < 4; k++) {
    push();
    translate(0, -h * 0.51, -d * 0.5 + k * step);
    box(w * 0.88, 1.2, step * 0.35);
    pop();
  }
  pop();
}

// 6. 警戒標誌板碎片繪製
function drawHazardPlateShape(w, h, d, col) {
  fill(col[0], col[1], col[2]);
  specularMaterial(col[0], col[1], col[2]);
  shininess(14);
  box(w, h, d);

  // 表面斜向黑色警戒斑馬線
  push();
  fill(30, 30, 34);
  let count = 3;
  let step = d / (count + 1);
  for (let k = 0; k < count; k++) {
    push();
    translate(0, -h * 0.52, -d * 0.5 + (k + 1) * step);
    rotateY(0.4);
    box(w * 0.8, 1, step * 0.45);
    pop();
  }
  pop();
}

// 7. 電路板形狀繪製
function drawPCBShape(w, h, d, col) {
  fill(col[0], col[1], col[2]);
  specularMaterial(col[0], col[1], col[2]);
  shininess(25);
  box(w, h, d);

  // 銅金導線晶片細節
  push();
  fill(210, 175, 45);
  translate(0, -h * 0.52, 0);
  box(w * 0.4, 1, d * 0.4);
  pop();
}

// ----------------------------------------------------
// 粒子系統 (煙塵與火星)
// ----------------------------------------------------
function spawnDust(x, y, z, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      pos: createVector(x + random(-6, 6), y - 2, z + random(-6, 6)),
      vel: createVector(random(-0.7, 0.7), random(-1.1, -0.2), random(-0.7, 0.7)),
      life: 120,
      size: random(5, 10),
      col: color(90, 80, 72, 110)
    });
  }
}

function spawnSparks(x, y, z, vx) {
  particles.push({
    pos: createVector(x, y - 2, z),
    vel: createVector(vx + random(-2, 2), random(-3.5, -0.5), random(-2, 2)),
    life: 75,
    size: random(2, 5),
    col: color(240, 160, 45)
  });
}

function updateEffects() {
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.pos.add(p.vel);
    p.life -= 4;
    if (p.life <= 0) particles.splice(i, 1);
  }

  for (let i = sparks.length - 1; i >= 0; i--) {
    let s = sparks[i];
    s.pos.add(s.vel);
    s.vel.y += 0.5;
    s.life -= 7;
    if (s.life <= 0) sparks.splice(i, 1);
  }
}

function drawEffects() {
  noStroke();
  for (let p of particles) {
    push();
    translate(p.pos.x, p.pos.y, p.pos.z);
    fill(red(p.col), green(p.col), blue(p.col), p.life);
    sphere(p.size * 0.5);
    pop();
  }

  for (let s of sparks) {
    push();
    translate(s.pos.x, s.pos.y, s.pos.z);
    fill(red(s.col), green(s.col), blue(s.col), s.life);
    box(s.size);
    pop();
  }
}

// ----------------------------------------------------
// 攝影機視角與震動
// ----------------------------------------------------
function applyCamera() {
  let sx = random(-screenShake, screenShake);
  let sy = random(-screenShake, screenShake);
  let sz = random(-screenShake, screenShake);
  screenShake = max(0, screenShake * 0.88);

  if (camMode === 'orbit') {
    orbitControl(1.5, 1.5, 0.05);
    camera(
      0 + sx, -340 + sy, 540 + sz,
      headPos.x * 0.3, -20, headPos.z * 0.3,
      0, 1, 0
    );
  } else if (camMode === 'follow') {
    let camDist = 320;
    let camHeight = 115;
    let cx = headPos.x - sin(headAngle) * camDist + sx;
    let cz = headPos.z - cos(headAngle) * camDist + sz;
    camera(
      cx, -camHeight + sy, cz,
      headPos.x, headPos.y - 15, headPos.z,
      0, 1, 0
    );
  } else if (camMode === 'action') {
    let aheadDist = 190;
    let ax = headPos.x + sin(headAngle) * aheadDist + sx;
    let az = headPos.z + cos(headAngle) * aheadDist + sz;
    camera(
      ax, -45 + sy, az,
      headPos.x, headPos.y - 10, headPos.z,
      0, 1, 0
    );
  }
}

// ----------------------------------------------------
// 介面按鈕與鍵盤事件
// ----------------------------------------------------
function setupUI() {
  // 衝撞按鈕
  document.getElementById('btn-ram').addEventListener('click', () => {
    if (currentState === STATE_SLITHER) {
      triggerStraighten();
    }
  });

  // 零件拆分切換按鈕
  const btnSplit = document.getElementById('btn-split');
  btnSplit.addEventListener('click', () => {
    toggleSplit();
  });

  // 重整垃圾堆按鈕
  const btnReset = document.getElementById('btn-reset-piles');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      resetAllTrashPiles();
    });
  }

  document.getElementById('cam-orbit').addEventListener('click', (e) => setCam('orbit', e.target));
  document.getElementById('cam-follow').addEventListener('click', (e) => setCam('follow', e.target));
  document.getElementById('cam-action').addEventListener('click', (e) => setCam('action', e.target));

  document.getElementById('btn-pause').addEventListener('click', (e) => {
    isPaused = !isPaused;
    e.target.textContent = isPaused ? '▶ 繼續播放' : '⏸ 暫停 / 播放';
  });
}

function toggleSplit() {
  userSplitMode = !userSplitMode;
  targetSplit = userSplitMode ? 1.0 : 0.22;
  const btn = document.getElementById('btn-split');
  if (btn) {
    btn.textContent = userSplitMode ? '🧩 緊湊咬合 (X)' : '💥 不規則拆分 (X)';
    btn.classList.toggle('active', userSplitMode);
  }
}

function setCam(mode, targetBtn) {
  camMode = mode;
  document.querySelectorAll('.hud-controls .btn').forEach(btn => {
    if (btn.id.startsWith('cam-')) btn.classList.remove('active');
  });
  if (targetBtn) targetBtn.classList.add('active');
}

function keyPressed() {
  if (key === ' ' || keyCode === 32) {
    if (currentState === STATE_SLITHER) {
      triggerStraighten();
    }
    return false;
  } else if (key === 'x' || key === 'X') {
    toggleSplit();
  } else if (key === 'r' || key === 'R') {
    resetAllTrashPiles();
  } else if (key === 'c' || key === 'C') {
    if (camMode === 'orbit') setCam('follow', document.getElementById('cam-follow'));
    else if (camMode === 'follow') setCam('action', document.getElementById('cam-action'));
    else setCam('orbit', document.getElementById('cam-orbit'));
  }
}

function updateHUD() {
  const phaseBadge = document.getElementById('badge-phase');
  const statusLight = document.getElementById('status-light');
  const statusText = document.getElementById('status-text');

  if (!phaseBadge || !statusText) return;

  if (currentState === STATE_SLITHER) {
    phaseBadge.textContent = userSplitMode ? '階段一：垃圾外殼零件散解漫遊中' : '階段一：多種垃圾碎屑拼裝蛇行中';
    phaseBadge.style.background = userSplitMode ? '#ebcb8b' : '#81a1c1';
    statusLight.style.background = userSplitMode ? '#ebcb8b' : '#88c0d0';
    statusLight.style.boxShadow = '0 0 8px #88c0d0';
    statusText.textContent = userSplitMode 
      ? '動態階段：【身體不規則拆分中】紅磚、瓦楞板、碎玻璃零件浮動解構，維持 S 型巡弋！'
      : '動態階段：瓦楞板、紅磚、玻璃碎片與易開罐拼裝成型，在廢棄物掩埋場中靈活 S 型蛇行巡弋';
  } else if (currentState === STATE_STRAIGHTEN) {
    phaseBadge.textContent = '階段二：磁吸緊咬·鎖定前方垃圾堆！';
    phaseBadge.style.background = '#d08770';
    statusLight.style.background = '#d08770';
    statusLight.style.boxShadow = '0 0 10px #d08770';
    statusText.textContent = '動態階段：各類散亂垃圾零件瞬間磁吸壓實！鎖死為筆直實心重矛，劇烈機械震顫！';
  } else if (currentState === STATE_CHARGE) {
    phaseBadge.textContent = '階段三：極速衝撞垃圾堆！！';
    phaseBadge.style.background = '#bf616a';
    statusLight.style.background = '#bf616a';
    statusLight.style.boxShadow = '0 0 14px #bf616a';
    statusText.textContent = '動態階段：7倍極速直矛破城突進，沿地面飛馳猛烈撞散巨型垃圾堆！';
  } else if (currentState === STATE_RECOVER) {
    phaseBadge.textContent = '階段四：撞擊爆散與緩衝';
    phaseBadge.style.background = '#b48ead';
    statusLight.style.background = '#b48ead';
    statusLight.style.boxShadow = '0 0 8px #b48ead';
    statusText.textContent = '動態階段：轟然撞散垃圾堆！垃圾零件四散飛濺彈跳，生物外殼震散後重新吸附重整...';
  }
}
