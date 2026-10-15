/**
 * NTHU OOP · M2 物種原型 (Milestone 2: Species Prototype)
 * 星際垃圾拼裝異生體 (Scrap Assemblage Organism)
 * 
 * 核心特色：
 * 1. 【垃圾拼裝外型】：由廢鐵板、彎曲水管、重型鋼梁、鉚釘角鋼等多種工業廢棄物粗糙焊接/拼湊而成（非發光金屬與深色生鏽質感）。
 * 2. 【不規則身體拆分/解構 (Disassemble / Exploded Assembly)】：
 *    - 每個垃圾零件皆有獨立的浮動向量與三維偏移。
 *    - 蛇行時零件處於微幅呼吸鬆散狀態；點擊「💥 不規則拆分」或按「X」時，零件大幅炸開向外浮動解構。
 *    - 直身蓄力時，所有散亂零件「匡鐺！」強力磁吸壓緊，瞬間鎖死為筆直實心重型長槍破城槌！
 *    - 撞擊瞬間受衝擊波震盪，零件猛烈震散彈開，隨後吸附復原。
 * 3. 【不規則自主地面蛇行】：Perlin 噪聲自主巡弋漫遊，靈活多關節波狀扭動。
 * 4. 【極速直身猛撞】：筆直突刺飛馳，劃擦地面火星，猛烈撞擊廢鐵巨石！
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
let currentSplit = 0.25;     // 零件拆分離散程度 (0.0 = 緊密壓實, 1.0+ = 大幅拆散)
let targetSplit = 0.25;

// --- 身體關節與零件庫 ---
const NUM_SEGMENTS = 8;
const SEGMENT_SPACING = 34;
let headPos;
let headAngle = 0;
let headSpeed = 2.6;
let segments = [];
let headPieces = []; // 頭部拼裝垃圾零件

let slitherWave = 0;
let straightenProgress = 0; // 0 = 彎曲蛇行, 1 = 剛性直線
let wanderNoiseSeed = 100;
let chargeVector;

// --- 環境與特效 ---
let scrapBoulders = [];
let particles = [];
let sparks = [];

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

  // 1. 程序化生成頭部「粗獷重型垃圾撞角」拼裝零件
  buildHeadPieces();

  // 2. 程序化生成 8 節軀幹（每節由 5~8 個不同形態的廢棄金屬件拼湊而成）
  for (let i = 0; i < NUM_SEGMENTS; i++) {
    let segPieces = generateJunkPiecesForSegment(i);
    segments.push({
      pos: createVector(headPos.x, 0, headPos.z + (i + 1) * SEGMENT_SPACING),
      angle: headAngle,
      pieces: segPieces
    });
  }

  // 3. 散佈環境廢鐵巨石標靶
  randomSeed(888);
  for (let i = 0; i < 9; i++) {
    let angle = (TWO_PI / 9) * i + random(-0.3, 0.3);
    let dist = random(340, 540);
    scrapBoulders.push({
      pos: createVector(cos(angle) * dist, -28, sin(angle) * dist),
      size: createVector(random(80, 130), random(60, 95), random(70, 110)),
      hitShake: 0
    });
  }

  setupUI();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ----------------------------------------------------
// 程序化生成垃圾拼裝結構
// ----------------------------------------------------
function buildHeadPieces() {
  // 頭部由多塊異形廢鋼板、彎曲水管、以及大型粗尖錐焊死組合
  headPieces = [
    // 主引擎座塊 (深鋼)
    { type: 'box', offset: createVector(0, -14, 0), size: createVector(42, 24, 40), rot: createVector(0, 0, 0), col: [42, 45, 52], splitDir: createVector(0, -1, 0) },
    // 粗尖破城角鋼錐 (前導突刺)
    { type: 'cone', offset: createVector(0, -12, 34), r: 16, h: 46, rot: createVector(HALF_PI, 0, 0), col: [68, 72, 80], splitDir: createVector(0, 0, 1.4) },
    // 歪斜銲接在左側的生鏽擋泥板
    { type: 'box', offset: createVector(-25, -8, 8), size: createVector(8, 20, 34), rot: createVector(0, 0.25, -0.1), col: [65, 42, 30], splitDir: createVector(-1.2, 0.3, 0) },
    // 右側厚重角鐵護罩
    { type: 'box', offset: createVector(26, -10, 10), size: createVector(10, 18, 30), rot: createVector(0.1, -0.2, 0.15), col: [48, 52, 58], splitDir: createVector(1.2, 0.2, 0) },
    // 頭頂橫跨的斷裂水管/液壓管
    { type: 'cylinder', offset: createVector(-2, -28, -4), r: 6, h: 36, rot: createVector(0, 0.3, HALF_PI), col: [35, 38, 44], splitDir: createVector(0, -1.5, -0.5) },
    // 斜刺出去的鋼筋尖刺
    { type: 'box', offset: createVector(14, -24, 18), size: createVector(4, 4, 28), rot: createVector(-0.4, 0.3, 0), col: [80, 75, 70], splitDir: createVector(0.8, -1, 0.8) }
  ];
}

function generateJunkPiecesForSegment(segIndex) {
  let pieces = [];
  let baseScale = map(segIndex, 0, NUM_SEGMENTS - 1, 1.0, 0.45);
  let seed = segIndex * 133 + 7;
  randomSeed(seed);

  // 1. 中央主骨架廢鐵梁
  pieces.push({
    type: 'box',
    offset: createVector(random(-3, 3), -12 * baseScale, random(-3, 3)),
    size: createVector(36 * baseScale, 18 * baseScale, 26 * baseScale),
    rot: createVector(random(-0.1, 0.1), random(-0.1, 0.1), random(-0.1, 0.1)),
    col: (segIndex % 2 === 0) ? [40, 42, 48] : [58, 40, 30], // 交替鏽鋼色
    splitDir: createVector(0, -0.4, 0)
  });

  // 2. 左側外擴拼接金屬板（帶外翻不對稱角度）
  pieces.push({
    type: 'box',
    offset: createVector((-22 - random(4, 10)) * baseScale, -10 * baseScale, random(-6, 6)),
    size: createVector(random(8, 14) * baseScale, random(12, 18) * baseScale, random(18, 28) * baseScale),
    rot: createVector(random(-0.2, 0.2), random(-0.3, 0.3), random(-0.2, 0.2)),
    col: [48, 50, 56],
    splitDir: createVector(-1.3, random(-0.4, 0.4), random(-0.5, 0.5))
  });

  // 3. 右側破水管或排氣廢鐵筒
  pieces.push({
    type: 'cylinder',
    offset: createVector((20 + random(4, 8)) * baseScale, -12 * baseScale, random(-4, 4)),
    r: random(4, 7) * baseScale,
    h: random(18, 28) * baseScale,
    rot: createVector(HALF_PI + random(-0.3, 0.3), random(-0.2, 0.2), 0),
    col: [62, 46, 35],
    splitDir: createVector(1.3, random(-0.4, 0.4), random(-0.5, 0.5))
  });

  // 4. 背部斜插的散熱鰭刺／角鋼條
  pieces.push({
    type: 'box',
    offset: createVector(random(-6, 6), (-20 - random(4, 8)) * baseScale, random(-6, 6)),
    size: createVector(random(6, 12) * baseScale, random(14, 22) * baseScale, random(6, 12) * baseScale),
    rot: createVector(-0.4 + random(-0.2, 0.2), random(-0.2, 0.2), random(-0.2, 0.2)),
    col: [32, 34, 38],
    splitDir: createVector(random(-0.5, 0.5), -1.6, random(-0.6, 0.6))
  });

  // 5. 連接鉸軸與螺栓雜件
  pieces.push({
    type: 'cylinder',
    offset: createVector(0, -6 * baseScale, 14 * baseScale),
    r: 6 * baseScale,
    h: 14 * baseScale,
    rot: createVector(HALF_PI, 0, 0),
    col: [24, 25, 28],
    splitDir: createVector(0, 0.5, 1.0)
  });

  // 尾端最後一節：追加一把巨大鏽蝕刮地拖刀
  if (segIndex === NUM_SEGMENTS - 1) {
    pieces.push({
      type: 'box',
      offset: createVector(0, -4, 26),
      size: createVector(8, 14, 32),
      rot: createVector(-0.45, 0, 0),
      col: [75, 78, 85],
      splitDir: createVector(0, 0.5, 2.0)
    });
  }

  return pieces;
}

function draw() {
  background(13, 14, 18);

  // 鏡頭與震動
  applyCamera();

  // 廢鐵工業光照（無自發光）
  ambientLight(42, 45, 52);
  directionalLight(215, 220, 230, 0.4, 0.8, -0.6);
  directionalLight(125, 90, 60, -0.5, -0.4, 0.5);
  pointLight(160, 165, 180, headPos.x, headPos.y - 120, headPos.z);

  // 繪製廢棄物平原與標靶巨石
  drawGroundWasteland();
  drawScrapBoulders();

  // 更新動態與物理狀態
  if (!isPaused) {
    updateCreatureAI();
    updateEffects();
  }

  // 繪製生物與特效
  drawScrapCreature();
  drawEffects();

  updateHUD();
}

// ----------------------------------------------------
// 生物運動學與不規則狀態機
// ----------------------------------------------------
function updateCreatureAI() {
  stateTimer++;

  // 平滑過渡拆分量 (currentSplit)
  currentSplit = lerp(currentSplit, targetSplit, 0.1);

  switch (currentState) {
    case STATE_SLITHER:
      // 【階段一：不規則地面自主蛇行】
      slitherWave += 0.088;
      straightenProgress = lerp(straightenProgress, 0, 0.08);

      // 若使用者沒有強制全拆分，蛇行時保持鬆散自然呼吸拆分度 (0.2 ~ 0.35)
      if (!userSplitMode) {
        targetSplit = 0.22 + sin(slitherWave * 0.5) * 0.1;
      }

      // Perlin 噪聲不規則自主轉向漫遊
      wanderNoiseSeed += 0.008;
      let turnRate = map(noise(wanderNoiseSeed), 0, 1, -0.055, 0.055);

      // 邊界防跑出軟性約束
      let distFromCenter = headPos.mag();
      if (distFromCenter > 480) {
        let returnAngle = atan2(-headPos.x, -headPos.z);
        let diff = returnAngle - headAngle;
        while (diff < -PI) diff += TWO_PI;
        while (diff > PI) diff -= TWO_PI;
        turnRate += diff * 0.04;
      }

      headAngle += turnRate;

      // 前進移動
      headSpeed = 2.7;
      headPos.x += sin(headAngle) * headSpeed;
      headPos.z += cos(headAngle) * headSpeed;

      if (frameCount % 6 === 0) {
        spawnDust(headPos.x + random(-12, 12), 0, headPos.z + random(-12, 12), 1);
      }

      if (stateTimer >= slitherDuration) {
        triggerStraighten();
      }
      break;

    case STATE_STRAIGHTEN:
      // 【階段二：鎖定蓄力直身，所有散亂零件強力磁吸咬合鎖死！】
      straightenProgress = min(1.0, straightenProgress + 0.05);
      
      // 無論先前多拆散，此處強制將零件瞬間夾緊鎖死為 0！
      targetSplit = 0.0;

      // 向後微縮蓄勁
      headPos.x -= sin(headAngle) * 0.16;
      headPos.z -= cos(headAngle) * 0.16;

      // 機械緊繃的高頻震顫
      screenShake = max(screenShake, 1.4);
      spawnSparks(headPos.x + random(-14, 14), 0, headPos.z + random(-14, 14), random(-1, 1));

      if (stateTimer > 42) {
        triggerCharge();
      }
      break;

    case STATE_CHARGE:
      // 【階段三：極速直身猛撞】
      straightenProgress = 1.0;
      targetSplit = 0.0; // 衝撞過程保持緊固筆直剛性長槍

      let chargeSpeed = 17.5;
      headPos.x += chargeVector.x * chargeSpeed;
      headPos.z += chargeVector.z * chargeSpeed;
      screenShake = 3.8;

      // 地面刮擦火星
      for (let i = 0; i < 4; i++) {
        spawnSparks(
          headPos.x - chargeVector.x * random(10, 30) + random(-10, 10),
          0,
          headPos.z - chargeVector.z * random(10, 30) + random(-10, 10),
          -chargeVector.x * 5
        );
      }

      // 檢測撞擊巨石
      for (let b of scrapBoulders) {
        let d = dist(headPos.x, headPos.z, b.pos.x, b.pos.z);
        if (d < b.size.x * 0.5 + 32) {
          b.hitShake = 24;
          triggerImpact();
          break;
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
      // 直身狀態：嚴格沿著直線緊排
      let straightOffset = (i + 1) * SEGMENT_SPACING;
      let targetX = headPos.x - sin(headAngle) * straightOffset;
      let targetZ = headPos.z - cos(headAngle) * straightOffset;
      seg.pos.x = lerp(seg.pos.x, targetX, 0.65);
      seg.pos.z = lerp(seg.pos.z, targetZ, 0.65);
      seg.angle = headAngle;
    } else {
      // 蛇行狀態：牽引跟隨 + 側向正弦波
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

function triggerStraighten() {
  if (currentState !== STATE_SLITHER) return;
  currentState = STATE_STRAIGHTEN;
  stateTimer = 0;

  // 尋找前方巨石瞄準
  let bestTarget = null;
  let closestDist = 9999;
  for (let b of scrapBoulders) {
    let d = dist(headPos.x, headPos.z, b.pos.x, b.pos.z);
    if (d > 80 && d < 620) {
      let toB = createVector(b.pos.x - headPos.x, 0, b.pos.z - headPos.z).normalize();
      let fwd = createVector(sin(headAngle), 0, cos(headAngle));
      let dot = toB.dot(fwd);
      if (dot > 0.35 && d < closestDist) {
        closestDist = d;
        bestTarget = b;
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
  screenShake = 16.0;

  // 撞擊瞬間：所有垃圾零件受到猛烈撞擊力，向外暴烈震散彈開！
  currentSplit = 1.6;
  targetSplit = userSplitMode ? 1.0 : 0.3;

  for (let i = 0; i < 45; i++) {
    sparks.push({
      pos: createVector(headPos.x, -14, headPos.z),
      vel: createVector(random(-13, 13), random(-15, 2), random(-13, 13)),
      life: 255,
      size: random(3, 8),
      col: random() > 0.35 ? color(240, 150, 40) : color(190, 195, 205)
    });
  }
}

// ----------------------------------------------------
// 繪製垃圾拼裝生物 (支援不規則拆分解構)
// ----------------------------------------------------
function drawScrapCreature() {
  push();

  // 1. 繪製拼裝頭部
  push();
  translate(headPos.x, headPos.y - 12, headPos.z);
  rotateY(headAngle);

  for (let piece of headPieces) {
    push();
    // 依據當前拆分量 (currentSplit) 沿不規則向量向外展開
    let sx = piece.splitDir.x * currentSplit * 24;
    let sy = piece.splitDir.y * currentSplit * 20;
    let sz = piece.splitDir.z * currentSplit * 24;
    translate(piece.offset.x + sx, piece.offset.y + sy, piece.offset.z + sz);

    // 拆分時的零件微幅扭轉
    rotateX(piece.rot.x + piece.splitDir.z * currentSplit * 0.4);
    rotateY(piece.rot.y + piece.splitDir.x * currentSplit * 0.4);
    rotateZ(piece.rot.z + piece.splitDir.y * currentSplit * 0.4);

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
      let sx = piece.splitDir.x * currentSplit * 28;
      let sy = piece.splitDir.y * currentSplit * 24;
      let sz = piece.splitDir.z * currentSplit * 28;
      translate(piece.offset.x + sx, piece.offset.y + sy, piece.offset.z + sz);

      // 拆分時伴隨零件不規則翻轉晃動
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

// 繪製單個垃圾零件基本幾何
function drawJunkShape(piece) {
  noStroke();
  specularMaterial(piece.col[0], piece.col[1], piece.col[2]);
  shininess(14);

  if (piece.type === 'box') {
    box(piece.size.x, piece.size.y, piece.size.z);
  } else if (piece.type === 'cylinder') {
    cylinder(piece.r, piece.h);
  } else if (piece.type === 'cone') {
    cone(piece.r, piece.h);
  }
}

// ----------------------------------------------------
// 環境：廢棄物平原與標靶巨石
// ----------------------------------------------------
function drawGroundWasteland() {
  push();
  translate(0, 1, 0);

  noStroke();
  fill(16, 17, 21);
  push();
  rotateX(HALF_PI);
  plane(2400, 2400);
  pop();

  stroke(32, 35, 45, 90);
  strokeWeight(1);
  for (let z = -1100; z <= 1100; z += 90) {
    line(-1100, 0, z, 1100, 0, z);
  }
  for (let x = -1100; x <= 1100; x += 90) {
    line(x, 0, -1100, x, 0, 1100);
  }

  noFill();
  stroke(45, 50, 65, 60);
  strokeWeight(2);
  push();
  rotateX(HALF_PI);
  circle(0, 0, 1000);
  pop();

  pop();
}

function drawScrapBoulders() {
  for (let b of scrapBoulders) {
    push();
    translate(b.pos.x, b.pos.y, b.pos.z);

    if (b.hitShake > 0) {
      translate(random(-b.hitShake, b.hitShake) * 0.3, random(-b.hitShake, b.hitShake) * 0.2, random(-b.hitShake, b.hitShake) * 0.3);
      b.hitShake = max(0, b.hitShake - 1);
    }

    noStroke();
    specularMaterial(48, 50, 58);
    shininess(8);
    box(b.size.x, b.size.y, b.size.z);

    fill(24, 25, 29);
    push();
    translate(0, 0, b.size.z * 0.52);
    box(b.size.x * 0.85, 12, 6);
    pop();

    pop();
  }
}

// ----------------------------------------------------
// 粒子系統
// ----------------------------------------------------
function spawnDust(x, y, z, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      pos: createVector(x + random(-6, 6), y - 2, z + random(-6, 6)),
      vel: createVector(random(-0.6, 0.6), random(-1.0, -0.2), random(-0.6, 0.6)),
      life: 120,
      size: random(4, 8),
      col: color(65, 70, 80, 110)
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
// 攝影機視角
// ----------------------------------------------------
function applyCamera() {
  let sx = random(-screenShake, screenShake);
  let sy = random(-screenShake, screenShake);
  let sz = random(-screenShake, screenShake);
  screenShake = max(0, screenShake * 0.88);

  if (camMode === 'orbit') {
    orbitControl(1.5, 1.5, 0.05);
    camera(
      0 + sx, -320 + sy, 520 + sz,
      headPos.x * 0.3, -20, headPos.z * 0.3,
      0, 1, 0
    );
  } else if (camMode === 'follow') {
    let camDist = 300;
    let camHeight = 110;
    let cx = headPos.x - sin(headAngle) * camDist + sx;
    let cz = headPos.z - cos(headAngle) * camDist + sz;
    camera(
      cx, -camHeight + sy, cz,
      headPos.x, headPos.y - 15, headPos.z,
      0, 1, 0
    );
  } else if (camMode === 'action') {
    let aheadDist = 180;
    let ax = headPos.x + sin(headAngle) * aheadDist + sx;
    let az = headPos.z + cos(headAngle) * aheadDist + sz;
    camera(
      ax, -40 + sy, az,
      headPos.x, headPos.y - 10, headPos.z,
      0, 1, 0
    );
  }
}

// ----------------------------------------------------
// 介面與事件
// ----------------------------------------------------
function setupUI() {
  document.getElementById('btn-ram').addEventListener('click', () => {
    if (currentState === STATE_SLITHER) {
      triggerStraighten();
    }
  });

  const btnSplit = document.getElementById('btn-split');
  btnSplit.addEventListener('click', () => {
    toggleSplit();
  });

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
  targetSplit = userSplitMode ? 1.0 : 0.25;
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
    phaseBadge.textContent = userSplitMode ? '階段一：不規則拆分散解漫遊中' : '階段一：垃圾拼裝自主蛇行中';
    phaseBadge.style.background = userSplitMode ? '#ebcb8b' : '#81a1c1';
    statusLight.style.background = userSplitMode ? '#ebcb8b' : '#88c0d0';
    statusLight.style.boxShadow = '0 0 8px #88c0d0';
    statusText.textContent = userSplitMode 
      ? '動態階段：【身體不規則拆分中】零散廢鐵零件浮動解構，同時維持 S 型地面波狀漫遊！'
      : '動態階段：廢鐵板、破水管、機械鋼梁拼湊身軀，在廢棄平原上靈活 S 型蛇行巡弋';
  } else if (currentState === STATE_STRAIGHTEN) {
    phaseBadge.textContent = '階段二：磁吸緊咬·直身鎖定中！';
    phaseBadge.style.background = '#d08770';
    statusLight.style.background = '#d08770';
    statusLight.style.boxShadow = '0 0 10px #d08770';
    statusText.textContent = '動態階段：散亂零件瞬間磁吸壓實咬合！鎖死為筆直實心剛性長矛，劇烈機械震顫！';
  } else if (currentState === STATE_CHARGE) {
    phaseBadge.textContent = '階段三：極速衝撞中！！';
    phaseBadge.style.background = '#bf616a';
    statusLight.style.background = '#bf616a';
    statusLight.style.boxShadow = '0 0 14px #bf616a';
    statusText.textContent = '動態階段：7倍極速直矛破城突進，沿地面飛馳猛撞障礙！';
  } else if (currentState === STATE_RECOVER) {
    phaseBadge.textContent = '階段四：撞擊震散與緩衝';
    phaseBadge.style.background = '#b48ead';
    statusLight.style.background = '#b48ead';
    statusLight.style.boxShadow = '0 0 8px #b48ead';
    statusText.textContent = '動態階段：猛烈撞擊巨石！衝擊波將零件向外震散彈開，隨即重新吸附重整...';
  }
}
