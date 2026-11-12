/**
 * NTHU OOP · M2 物種原型 (Milestone 2: Focus Cine Modes & Multi-Species)
 * 主角 1/2/3 切換與多角度拍攝 (C 鍵視角切換) 系統
 * 
 * 核心交互設計：
 * 1. 【按 1、2、3 切換主角】：
 *    - 按 1：主角設為「單獨移動的生物 (Solo)」，畫面只留下該生物。
 *    - 按 2：主角設為「一起移動的兩隻生物 (Tandem Pair)」，畫面只留下該雙體。
 *    - 按 3：主角設為「會一起旋轉的那兩隻生物 (Center Pair)」，畫面只留下中央旋轉體。
 * 2. 【按 C 改變該主角的拍攝特寫角度】：
 *    - 保持原本 C 鍵循環切換角度機制，即時套用於當前鎖定的主角：
 *      ① 自由軌道視角 (Orbit)：可透過滑鼠左鍵自由圍繞該主角 360 度旋轉與縮放。
 *      ② 身後跟隨特寫 (Follow)：貼緊該主角身後，沿行進方向動態貼地飛馳跟拍。
 *      ③ 正面迎面特寫 (Front / Action)：置於該主角正前方，迎面特寫其前進撞角、破城突刺與面部碎屑細節！
 * 3. 【按 R 全局重置】：
 *    - 主角復原為全體、視角復原為全景軌道、所有垃圾堆重整、風暴繁衍重置。
 */

// --- 狀態定義 ---
const STATE_SLITHER = 0;    // 不規則自主蛇行
const STATE_STRAIGHTEN = 1; // 直身蓄力
const STATE_CHARGE = 2;     // 極速衝撞
const STATE_RECOVER = 3;    // 撞擊反衝與重整

// --- 中央風暴繁衍狀態 ---
const FUSION_IDLE = 0;      // 平靜守護
const FUSION_EXPLODE = 1;   // 身體外殼不規則解構
const FUSION_VORTEX = 2;    // 高速纏繞龍捲風
const FUSION_EXCHANGE = 3;  // 零件互換與凝聚第三隻
const FUSION_COALESCE = 4;  // 風暴平息，零件磁吸咬合
const FUSION_COMPLETE = 5;  // 三體共生完成

let fusionState = FUSION_IDLE;
let fusionTimer = 0;
let fusionVortexAngle = 0;
let fusionVortexSpeed = 0.04;
let vortexParticles = [];
let vortexDebris = [];

// --- 主角目標 (0: 全部, 1: 獨行者, 2: 伴行雙體, 3: 中央旋轉雙體) ---
let currentProtagonist = 0;

// --- 攝影機特寫角度模式 ('orbit', 'follow', 'action') ---
let camMode = 'orbit';

// --- 物種集合 ---
const NUM_SEGMENTS = 8;
const SEGMENT_SPACING = 34;
let creatures = []; // [0]=Solo, [1]=Tandem Lead, [2]=Tandem Follow, [3]=Center A, [4]=Center B, [5]=Newborn
let newbornCreature = null;

// --- 全局控制 ---
let userGlobalSplit = false;
let isPaused = false;
let screenShake = 0;

// --- 環境垃圾堆與特效 ---
let trashPiles = [];
let perimeterTrashHeaps = [];
let staticFloorLitter = [];
let particles = [];
let sparks = [];
let allScatteredTimer = 0;

// ----------------------------------------------------
// 物種物件導向類別：TrashCreature (廢棄物拼裝異生體)
// ----------------------------------------------------
class TrashCreature {
  constructor(id, role, startPos, startAngle) {
    this.id = id;
    this.role = role; // 'solo', 'tandem_lead', 'tandem_follow', 'center_a', 'center_b', 'newborn'
    this.pos = startPos.copy();
    this.angle = startAngle;
    this.speed = 2.65;
    this.segments = [];
    this.headPieces = [];

    this.slitherWave = random(100);
    this.straightenProgress = 0;
    this.wanderNoiseSeed = random(1000) + id * 123;
    this.chargeVector = createVector(0, 0, -1);

    this.currentState = STATE_SLITHER;
    this.stateTimer = 0;
    this.slitherDuration = floor(random(180, 290));

    this.currentSplit = 0.22;
    this.targetSplit = 0.22;

    this.active = true;
    this.visible = true;

    this.buildHeadPieces();
    this.initSegments();
  }

  buildHeadPieces() {
    let tint = this.id % 2 === 0;
    this.headPieces = [
      {
        type: 'box',
        offset: createVector(0, -14, 0),
        size: createVector(40, 22, 38),
        rot: createVector(0, 0, 0),
        col: [46, 48, 54],
        splitDir: createVector(0, -0.8, 0)
      },
      {
        type: 'corrugated',
        offset: createVector(0, -28, -2),
        size: createVector(38, 5, 32),
        rot: createVector(-0.15, 0, 0),
        col: tint ? [175, 85, 45] : [58, 120, 108],
        ridges: 4,
        splitDir: createVector(0, -1.8, -0.3)
      },
      {
        type: 'brick',
        offset: createVector(-25, -10, 6),
        size: createVector(12, 17, 28),
        rot: createVector(0.08, 0.2, -0.1),
        col: [182, 65, 48],
        isCinder: false,
        splitDir: createVector(-1.5, 0.2, 0)
      },
      {
        type: 'hazard_plate',
        offset: createVector(25, -11, 8),
        size: createVector(9, 19, 30),
        rot: createVector(0.05, -0.2, 0.1),
        col: [225, 185, 35],
        splitDir: createVector(1.5, 0.2, 0)
      },
      {
        type: 'glass_shard',
        offset: createVector(0, -12, 36),
        w: 22,
        h: 46,
        d: 14,
        rot: createVector(HALF_PI, 0, 0),
        col: tint ? [35, 190, 115] : [40, 120, 225],
        specCol: [210, 255, 235],
        splitDir: createVector(0, 0, 1.8)
      },
      {
        type: 'glass_shard',
        offset: createVector(-10, -16, 26),
        w: 12,
        h: 26,
        d: 8,
        rot: createVector(1.4, 0.3, -0.2),
        col: [205, 125, 30],
        specCol: [255, 220, 180],
        splitDir: createVector(-0.8, -0.8, 1.2)
      },
      {
        type: 'can',
        offset: createVector(0, -3, 14),
        r: 8.5,
        h: 19,
        rot: createVector(0, HALF_PI, HALF_PI),
        col: tint ? [215, 38, 38] : [38, 95, 215],
        splitDir: createVector(0, 1.2, 0.5)
      },
      {
        type: 'tire_chunk',
        offset: createVector(0, -21, -17),
        size: createVector(34, 9, 15),
        rot: createVector(0.3, 0, 0),
        col: [32, 33, 36],
        splitDir: createVector(0, -1.2, -1.2)
      }
    ];
  }

  initSegments() {
    this.segments = [];
    for (let i = 0; i < NUM_SEGMENTS; i++) {
      let segPieces = this.generateSegmentPieces(i);
      this.segments.push({
        pos: createVector(this.pos.x, 0, this.pos.z + (i + 1) * SEGMENT_SPACING),
        angle: this.angle,
        pieces: segPieces
      });
    }
  }

  generateSegmentPieces(segIndex) {
    let pieces = [];
    let baseScale = map(segIndex, 0, NUM_SEGMENTS - 1, 1.0, 0.5);
    let seed = this.id * 531 + segIndex * 197 + 13;
    randomSeed(seed);

    // 1. 中央金屬骨架
    pieces.push({
      type: 'box',
      offset: createVector(random(-2, 2), -12 * baseScale, random(-2, 2)),
      size: createVector(34 * baseScale, 16 * baseScale, 26 * baseScale),
      rot: createVector(random(-0.08, 0.08), random(-0.08, 0.08), random(-0.08, 0.08)),
      col: (segIndex % 2 === 0) ? [46, 48, 54] : [62, 45, 36],
      splitDir: createVector(0, -0.5, 0)
    });

    // 2. 瓦楞板
    let corrColors = [[175, 85, 45], [58, 120, 108], [148, 108, 68]];
    let cCol = corrColors[(segIndex + this.id) % corrColors.length];
    let sideSign = (segIndex % 2 === 0) ? -1 : 1;
    pieces.push({
      type: 'corrugated',
      offset: createVector((20 + random(2, 5)) * sideSign * baseScale, -12 * baseScale, random(-4, 4)),
      size: createVector(random(14, 19) * baseScale, random(4, 6) * baseScale, random(24, 32) * baseScale),
      rot: createVector(random(-0.2, 0.2), random(-0.2, 0.2), sideSign * 0.3),
      col: cCol,
      ridges: 3,
      splitDir: createVector(sideSign * 1.4, random(-0.4, 0.4), random(-0.4, 0.4))
    });

    // 3. 磚頭 / 水泥塊
    let isCinder = (segIndex % 3 === 1);
    let brickCol = isCinder ? [125, 128, 134] : [182, 68, 50];
    pieces.push({
      type: 'brick',
      offset: createVector((-22 - random(2, 5)) * sideSign * baseScale, -10 * baseScale, random(-4, 4)),
      size: createVector(random(12, 16) * baseScale, random(10, 14) * baseScale, random(20, 26) * baseScale),
      rot: createVector(random(-0.15, 0.15), random(-0.2, 0.2), -sideSign * 0.25),
      col: brickCol,
      isCinder: isCinder,
      splitDir: createVector(-sideSign * 1.5, random(-0.4, 0.4), random(-0.4, 0.4))
    });

    // 4. 尖銳背脊玻璃晶體
    let glassColors = [
      { col: [35, 185, 120], spec: [210, 255, 235] },
      { col: [40, 115, 225], spec: [200, 230, 255] },
      { col: [205, 125, 30], spec: [255, 225, 190] },
      { col: [110, 215, 230], spec: [230, 255, 255] }
    ];
    let gInfo = glassColors[(segIndex + this.id) % glassColors.length];
    pieces.push({
      type: 'glass_shard',
      offset: createVector(random(-5, 5) * baseScale, (-22 - random(4, 8)) * baseScale, random(-5, 5)),
      w: random(10, 15) * baseScale,
      h: random(24, 36) * baseScale,
      d: random(8, 12) * baseScale,
      rot: createVector(-0.35 + random(-0.2, 0.2), random(-0.3, 0.3), random(-0.2, 0.2)),
      col: gInfo.col,
      specCol: gInfo.spec,
      splitDir: createVector(random(-0.5, 0.5), -1.8, random(-0.5, 0.5))
    });

    // 5. 壓扁鋁罐
    let canColors = [[210, 40, 40], [35, 95, 215], [225, 180, 30], [40, 175, 75]];
    pieces.push({
      type: 'can',
      offset: createVector(random(-10, 10) * baseScale, -4 * baseScale, (10 + random(2, 5)) * baseScale),
      r: random(6, 9) * baseScale,
      h: random(14, 20) * baseScale,
      rot: createVector(random(-0.5, 0.5), random(-1, 1), HALF_PI),
      col: canColors[(segIndex * 2 + this.id) % canColors.length],
      splitDir: createVector(random(-0.7, 0.7), 0.8, 1.2)
    });

    // 6. 輪胎橡膠皮或廢電路板
    if (segIndex % 2 === 0) {
      pieces.push({
        type: 'tire_chunk',
        offset: createVector(random(-12, 12) * baseScale, -17 * baseScale, random(-7, 7)),
        size: createVector(random(16, 24) * baseScale, 6 * baseScale, random(14, 20) * baseScale),
        rot: createVector(random(-0.3, 0.3), random(-0.3, 0.3), random(-0.2, 0.2)),
        col: [32, 33, 36],
        splitDir: createVector(random(-0.8, 0.8), -1.2, random(-0.8, 0.8))
      });
    } else {
      pieces.push({
        type: 'pcb',
        offset: createVector(random(-12, 12) * baseScale, -16 * baseScale, random(-7, 7)),
        size: createVector(random(17, 23) * baseScale, 4 * baseScale, random(17, 23) * baseScale),
        rot: createVector(random(-0.2, 0.2), random(-0.4, 0.4), random(-0.2, 0.2)),
        col: [24, 88, 48],
        splitDir: createVector(random(-0.8, 0.8), -1.1, random(-0.8, 0.8))
      });
    }

    if (segIndex === NUM_SEGMENTS - 1) {
      pieces.push({
        type: 'glass_shard',
        offset: createVector(0, -6, 30),
        w: 15,
        h: 44,
        d: 11,
        rot: createVector(-1.8, 0, 0),
        col: [35, 190, 115],
        specCol: [200, 255, 230],
        splitDir: createVector(0, 0.6, 2.2)
      });
    }

    return pieces;
  }

  update() {
    if (!this.active) return;
    this.stateTimer++;

    this.currentSplit = lerp(this.currentSplit, this.targetSplit, 0.12);

    if (this.role === 'solo') {
      this.updateSoloAI();
    } else if (this.role === 'tandem_lead') {
      this.updateTandemLeadAI();
    } else if (this.role === 'tandem_follow') {
      this.updateTandemFollowAI();
    } else if (this.role === 'center_a' || this.role === 'center_b' || this.role === 'newborn') {
      this.updateCenterAI();
    }

    this.updateSegmentIK();
  }

  // 1. 獨行者 AI
  updateSoloAI() {
    switch (this.currentState) {
      case STATE_SLITHER:
        this.slitherWave += 0.088;
        this.straightenProgress = lerp(this.straightenProgress, 0, 0.08);

        if (!userGlobalSplit) {
          this.targetSplit = 0.22 + sin(this.slitherWave * 0.5) * 0.1;
        }

        this.wanderNoiseSeed += 0.0075;
        let turnRate = map(noise(this.wanderNoiseSeed), 0, 1, -0.055, 0.055);

        let distCenter = this.pos.mag();
        if (distCenter > 520) {
          let returnAngle = atan2(-this.pos.x, -this.pos.z);
          let diff = returnAngle - this.angle;
          while (diff < -PI) diff += TWO_PI;
          while (diff > PI) diff -= TWO_PI;
          turnRate += diff * 0.045;
        }

        if (distCenter < 180) {
          let pushAngle = atan2(this.pos.x, this.pos.z);
          let diff = pushAngle - this.angle;
          while (diff < -PI) diff += TWO_PI;
          while (diff > PI) diff -= TWO_PI;
          turnRate += diff * 0.05;
        }

        this.angle += turnRate;
        this.speed = 2.75;
        this.pos.x += sin(this.angle) * this.speed;
        this.pos.z += cos(this.angle) * this.speed;

        if (frameCount % 6 === 0) {
          spawnDust(this.pos.x + random(-12, 12), 0, this.pos.z + random(-12, 12), 1);
        }

        if (this.stateTimer >= this.slitherDuration) {
          this.triggerStraighten();
        }
        break;

      case STATE_STRAIGHTEN:
        this.straightenProgress = min(1.0, this.straightenProgress + 0.05);
        this.targetSplit = 0.0;
        this.pos.x -= sin(this.angle) * 0.16;
        this.pos.z -= cos(this.angle) * 0.16;
        screenShake = max(screenShake, 1.2);

        if (this.stateTimer > 40) {
          this.triggerCharge();
        }
        break;

      case STATE_CHARGE:
        this.straightenProgress = 1.0;
        this.targetSplit = 0.0;
        let chargeSpeed = 18.0;
        this.pos.x += this.chargeVector.x * chargeSpeed;
        this.pos.z += this.chargeVector.z * chargeSpeed;
        screenShake = max(screenShake, 3.2);

        spawnSparks(this.pos.x + random(-10, 10), 0, this.pos.z + random(-10, 10), -this.chargeVector.x * 4);
        this.checkTrashPileCollisions(chargeSpeed);

        if (this.stateTimer > 42) {
          this.triggerImpact();
        }
        break;

      case STATE_RECOVER:
        this.straightenProgress = lerp(this.straightenProgress, 0.25, 0.05);
        if (this.stateTimer > 48) {
          this.currentState = STATE_SLITHER;
          this.stateTimer = 0;
          this.slitherDuration = floor(random(160, 300));
          this.targetSplit = userGlobalSplit ? 1.0 : 0.22;
        }
        break;
    }
  }

  // 2. 伴行領頭者 AI
  updateTandemLeadAI() {
    switch (this.currentState) {
      case STATE_SLITHER:
        this.slitherWave += 0.088;
        this.straightenProgress = lerp(this.straightenProgress, 0, 0.08);

        if (!userGlobalSplit) {
          this.targetSplit = 0.22 + sin(this.slitherWave * 0.5) * 0.1;
        }

        this.wanderNoiseSeed += 0.007;
        let turnRate = map(noise(this.wanderNoiseSeed), 0, 1, -0.045, 0.045);

        let distCenter = this.pos.mag();
        if (distCenter > 500) {
          let returnAngle = atan2(-this.pos.x, -this.pos.z);
          let diff = returnAngle - this.angle;
          while (diff < -PI) diff += TWO_PI;
          while (diff > PI) diff -= TWO_PI;
          turnRate += diff * 0.045;
        }
        if (distCenter < 190) {
          let pushAngle = atan2(this.pos.x, this.pos.z);
          let diff = pushAngle - this.angle;
          while (diff < -PI) diff += TWO_PI;
          while (diff > PI) diff -= TWO_PI;
          turnRate += diff * 0.05;
        }

        this.angle += turnRate;
        this.speed = 2.6;
        this.pos.x += sin(this.angle) * this.speed;
        this.pos.z += cos(this.angle) * this.speed;

        if (frameCount % 6 === 0) {
          spawnDust(this.pos.x + random(-12, 12), 0, this.pos.z + random(-12, 12), 1);
        }

        if (this.stateTimer >= this.slitherDuration) {
          this.triggerStraighten();
          if (creatures[2]) creatures[2].triggerStraighten();
        }
        break;

      case STATE_STRAIGHTEN:
        this.straightenProgress = min(1.0, this.straightenProgress + 0.05);
        this.targetSplit = 0.0;
        this.pos.x -= sin(this.angle) * 0.16;
        this.pos.z -= cos(this.angle) * 0.16;

        if (this.stateTimer > 40) {
          this.triggerCharge();
          if (creatures[2]) creatures[2].triggerCharge();
        }
        break;

      case STATE_CHARGE:
        this.straightenProgress = 1.0;
        this.targetSplit = 0.0;
        let chargeSpeed = 17.5;
        this.pos.x += this.chargeVector.x * chargeSpeed;
        this.pos.z += this.chargeVector.z * chargeSpeed;

        this.checkTrashPileCollisions(chargeSpeed);

        if (this.stateTimer > 42) {
          this.triggerImpact();
        }
        break;

      case STATE_RECOVER:
        this.straightenProgress = lerp(this.straightenProgress, 0.25, 0.05);
        if (this.stateTimer > 48) {
          this.currentState = STATE_SLITHER;
          this.stateTimer = 0;
          this.slitherDuration = floor(random(180, 320));
          this.targetSplit = userGlobalSplit ? 1.0 : 0.22;
        }
        break;
    }
  }

  // 3. 伴行跟隨僚機 AI
  updateTandemFollowAI() {
    let lead = creatures[1];
    if (!lead) return;

    if (this.currentState === STATE_SLITHER) {
      this.slitherWave = lead.slitherWave + 0.3;
      this.straightenProgress = lerp(this.straightenProgress, 0, 0.08);
      this.targetSplit = userGlobalSplit ? 1.0 : lead.targetSplit;

      let rightVec = createVector(cos(lead.angle), 0, -sin(lead.angle));
      let backVec = createVector(-sin(lead.angle), 0, -cos(lead.angle));
      let targetPos = p5.Vector.add(lead.pos, p5.Vector.mult(rightVec, 52)).add(p5.Vector.mult(backVec, 18));

      this.pos.x = lerp(this.pos.x, targetPos.x, 0.09);
      this.pos.z = lerp(this.pos.z, targetPos.z, 0.09);
      this.angle = lerp(this.angle, lead.angle, 0.09);

    } else if (this.currentState === STATE_STRAIGHTEN) {
      this.straightenProgress = min(1.0, this.straightenProgress + 0.05);
      this.targetSplit = 0.0;
      this.angle = lead.angle;
      this.chargeVector = lead.chargeVector.copy();

    } else if (this.currentState === STATE_CHARGE) {
      this.straightenProgress = 1.0;
      this.targetSplit = 0.0;
      let chargeSpeed = 17.5;
      this.pos.x += this.chargeVector.x * chargeSpeed;
      this.pos.z += this.chargeVector.z * chargeSpeed;

      this.checkTrashPileCollisions(chargeSpeed);

      if (this.stateTimer > 42) {
        this.triggerImpact();
      }

    } else if (this.currentState === STATE_RECOVER) {
      this.straightenProgress = lerp(this.straightenProgress, 0.25, 0.05);
      if (this.stateTimer > 48) {
        this.currentState = STATE_SLITHER;
        this.stateTimer = 0;
        this.targetSplit = userGlobalSplit ? 1.0 : 0.22;
      }
    }
  }

  // 4. 中央守護體 AI
  updateCenterAI() {
    this.slitherWave += 0.085;

    if (fusionState === FUSION_IDLE) {
      this.targetSplit = userGlobalSplit ? 1.0 : 0.22;
      let sign = (this.role === 'center_a') ? 1 : -1;
      let orbitAngle = frameCount * 0.016 * sign + (this.role === 'center_a' ? 0 : PI);
      let targetX = cos(orbitAngle) * 72;
      let targetZ = sin(orbitAngle) * 72;

      this.pos.x = lerp(this.pos.x, targetX, 0.06);
      this.pos.z = lerp(this.pos.z, targetZ, 0.06);
      this.angle = orbitAngle + HALF_PI * sign;

    } else if (fusionState === FUSION_EXPLODE) {
      this.targetSplit = 1.7;
      let sign = (this.role === 'center_a') ? 1 : -1;
      let orbitAngle = frameCount * 0.02 * sign + (this.role === 'center_a' ? 0 : PI);
      let targetX = cos(orbitAngle) * 80;
      let targetZ = sin(orbitAngle) * 80;

      this.pos.x = lerp(this.pos.x, targetX, 0.08);
      this.pos.z = lerp(this.pos.z, targetZ, 0.08);
      this.angle = orbitAngle + HALF_PI * sign;

      if (frameCount % 2 === 0) {
        spawnSparks(this.pos.x + random(-15, 15), -10, this.pos.z + random(-15, 15), random(-2, 2));
      }

    } else if (fusionState === FUSION_VORTEX) {
      this.targetSplit = 1.85;

      let baseOffset = (this.role === 'center_a') ? 0 : PI;
      let currentAngle = fusionVortexAngle + baseOffset;
      let vortexRadius = map(sin(frameCount * 0.1), -1, 1, 42, 60);

      this.pos.x = cos(currentAngle) * vortexRadius;
      this.pos.z = sin(currentAngle) * vortexRadius;
      this.pos.y = sin(currentAngle * 2) * 18 - 8;
      this.angle = currentAngle + HALF_PI + 0.35;

      screenShake = max(screenShake, 3.5);
      spawnSparks(this.pos.x, this.pos.y - 12, this.pos.z, cos(currentAngle) * 4);

    } else if (fusionState === FUSION_EXCHANGE) {
      this.targetSplit = 1.9;
      let baseOffset = (this.role === 'center_a') ? 0 : PI;
      let currentAngle = fusionVortexAngle + baseOffset;
      let vortexRadius = 55;

      this.pos.x = cos(currentAngle) * vortexRadius;
      this.pos.z = sin(currentAngle) * vortexRadius;
      this.pos.y = sin(currentAngle * 2) * 12 - 5;
      this.angle = currentAngle + HALF_PI;

    } else if (fusionState === FUSION_COALESCE || fusionState === FUSION_COMPLETE) {
      this.targetSplit = 0.05;

      let indexOffset = 0;
      if (this.role === 'center_a') indexOffset = 0;
      else if (this.role === 'center_b') indexOffset = (TWO_PI / 3);
      else if (this.role === 'newborn') indexOffset = (TWO_PI / 3) * 2;

      let triadAngle = frameCount * 0.018 + indexOffset;
      let triadRadius = 88;

      let targetX = cos(triadAngle) * triadRadius;
      let targetZ = sin(triadAngle) * triadRadius;

      this.pos.x = lerp(this.pos.x, targetX, 0.07);
      this.pos.z = lerp(this.pos.z, targetZ, 0.07);
      this.pos.y = lerp(this.pos.y, 0, 0.1);
      this.angle = triadAngle + HALF_PI;
    }
  }

  updateSegmentIK() {
    let leaderPos = this.pos.copy();

    for (let i = 0; i < NUM_SEGMENTS; i++) {
      let seg = this.segments[i];

      if (this.straightenProgress >= 0.98) {
        let straightOffset = (i + 1) * SEGMENT_SPACING;
        let targetX = this.pos.x - sin(this.angle) * straightOffset;
        let targetZ = this.pos.z - cos(this.angle) * straightOffset;
        seg.pos.x = lerp(seg.pos.x, targetX, 0.68);
        seg.pos.z = lerp(seg.pos.z, targetZ, 0.68);
        seg.angle = this.angle;
      } else {
        let toLeader = p5.Vector.sub(leaderPos, seg.pos);
        toLeader.normalize();

        let waveOffset = sin(this.slitherWave - i * 0.52) * (34 - i * 1.8) * (1 - this.straightenProgress);
        let normalVec = createVector(-toLeader.z, 0, toLeader.x).mult(waveOffset * 0.22);

        let targetPos = p5.Vector.sub(leaderPos, p5.Vector.mult(toLeader, SEGMENT_SPACING)).add(normalVec);
        seg.pos.x = lerp(seg.pos.x, targetPos.x, 0.56);
        seg.pos.y = lerp(seg.pos.y, this.pos.y, 0.56);
        seg.pos.z = lerp(seg.pos.z, targetPos.z, 0.56);

        seg.angle = atan2(leaderPos.x - seg.pos.x, leaderPos.z - seg.pos.z);
      }

      leaderPos = seg.pos.copy();
    }
  }

  triggerStraighten() {
    if (this.currentState !== STATE_SLITHER) return;
    this.currentState = STATE_STRAIGHTEN;
    this.stateTimer = 0;

    let bestTarget = null;
    let closestDist = 9999;
    for (let pile of trashPiles) {
      let d = dist(this.pos.x, this.pos.z, pile.pos.x, pile.pos.z);
      if (d > 70 && d < 650) {
        let toP = createVector(pile.pos.x - this.pos.x, 0, pile.pos.z - this.pos.z).normalize();
        let fwd = createVector(sin(this.angle), 0, cos(this.angle));
        let dot = toP.dot(fwd);
        let weight = pile.scattered ? 0.35 : 1.0;
        if (dot > 0.25 && (d / weight) < closestDist) {
          closestDist = d / weight;
          bestTarget = pile;
        }
      }
    }

    if (bestTarget) {
      this.angle = atan2(bestTarget.pos.x - this.pos.x, bestTarget.pos.z - this.pos.z);
    }
    this.chargeVector = createVector(sin(this.angle), 0, cos(this.angle)).normalize();
  }

  triggerCharge() {
    this.currentState = STATE_CHARGE;
    this.stateTimer = 0;
  }

  triggerImpact() {
    this.currentState = STATE_RECOVER;
    this.stateTimer = 0;
    screenShake = max(screenShake, 16.0);

    this.currentSplit = 1.6;
    this.targetSplit = userGlobalSplit ? 1.0 : 0.25;

    for (let i = 0; i < 40; i++) {
      sparks.push({
        pos: createVector(this.pos.x, -14, this.pos.z),
        vel: createVector(random(-13, 13), random(-15, 2), random(-13, 13)),
        life: 255,
        size: random(3, 8),
        col: random() > 0.35 ? color(245, 150, 40) : color(210, 215, 225)
      });
    }
  }

  checkTrashPileCollisions(chargeSpeed) {
    for (let pile of trashPiles) {
      let d = dist(this.pos.x, this.pos.z, pile.pos.x, pile.pos.z);
      if (d < pile.radius + 36) {
        if (!pile.scattered) {
          scatterTrashPile(pile, this.chargeVector, chargeSpeed);
          this.triggerImpact();
          break;
        } else {
          for (let item of pile.items) {
            let idist = dist(this.pos.x, this.pos.z, item.pos.x, item.pos.z);
            if (idist < 44 && item.isResting) {
              item.isResting = false;
              item.vel.x = this.chargeVector.x * random(8, 16) + random(-4, 4);
              item.vel.z = this.chargeVector.z * random(8, 16) + random(-4, 4);
              item.vel.y = -random(5, 11);
              item.rotVel = createVector(random(-0.3, 0.3), random(-0.3, 0.3), random(-0.3, 0.3));
            }
          }
        }
      }
    }
  }

  draw() {
    if (!this.visible) return;
    push();

    // 1. 繪製頭部
    push();
    translate(this.pos.x, this.pos.y - 12, this.pos.z);
    rotateY(this.angle);

    for (let piece of this.headPieces) {
      push();
      let sx = piece.splitDir.x * this.currentSplit * 26;
      let sy = piece.splitDir.y * this.currentSplit * 22;
      let sz = piece.splitDir.z * this.currentSplit * 26;
      translate(piece.offset.x + sx, piece.offset.y + sy, piece.offset.z + sz);

      rotateX(piece.rot.x + piece.splitDir.z * this.currentSplit * 0.45);
      rotateY(piece.rot.y + piece.splitDir.x * this.currentSplit * 0.45);
      rotateZ(piece.rot.z + piece.splitDir.y * this.currentSplit * 0.45);

      drawJunkShape(piece);
      pop();
    }
    pop();

    // 2. 繪製節點
    for (let i = 0; i < NUM_SEGMENTS; i++) {
      let seg = this.segments[i];
      push();
      translate(seg.pos.x, seg.pos.y, seg.pos.z);
      rotateY(seg.angle);

      let roll = sin(this.slitherWave - i * 0.5) * 0.08 * (1 - this.straightenProgress);
      rotateZ(roll);

      for (let piece of seg.pieces) {
        push();
        let sx = piece.splitDir.x * this.currentSplit * 28;
        let sy = piece.splitDir.y * this.currentSplit * 24;
        let sz = piece.splitDir.z * this.currentSplit * 28;
        translate(piece.offset.x + sx, piece.offset.y + sy, piece.offset.z + sz);

        rotateX(piece.rot.x + piece.splitDir.z * this.currentSplit * 0.5);
        rotateY(piece.rot.y + piece.splitDir.x * this.currentSplit * 0.5);
        rotateZ(piece.rot.z + piece.splitDir.y * this.currentSplit * 0.5);

        drawJunkShape(piece);
        pop();
      }
      pop();
    }

    pop();
  }
}

// ----------------------------------------------------
// 主設定 setup()
// ----------------------------------------------------
function setup() {
  const container = document.getElementById('canvas-container');
  const canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  canvas.parent(container);
  canvas.elt.oncontextmenu = () => false;

  // [0] 獨行者 (Solo)
  creatures.push(new TrashCreature(0, 'solo', createVector(-220, 0, 180), -HALF_PI));

  // [1] 伴行領頭 & [2] 伴行僚機
  creatures.push(new TrashCreature(1, 'tandem_lead', createVector(200, 0, -180), HALF_PI));
  creatures.push(new TrashCreature(2, 'tandem_follow', createVector(250, 0, -200), HALF_PI));

  // [3] 中央守護體 A & [4] 中央守護體 B
  creatures.push(new TrashCreature(3, 'center_a', createVector(-65, 0, 0), 0));
  creatures.push(new TrashCreature(4, 'center_b', createVector(65, 0, 0), PI));

  // [5] 預備第三隻新生異生體
  newbornCreature = new TrashCreature(5, 'newborn', createVector(0, -50, 0), 0);
  newbornCreature.active = false;
  newbornCreature.visible = false;
  creatures.push(newbornCreature);

  generateStaticFloorLitter();
  buildTrashPiles();
  initPerimeterTrashHeaps();

  setupUI();
  setProtagonist(0); // 預設顯示全體
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ----------------------------------------------------
// 主繪製迴圈 draw()
// ----------------------------------------------------
function draw() {
  background(12, 11, 14);

  // 攝影機運鏡（依據主角與角度即時計算）
  applyCamera();

  // 光照
  ambientLight(55, 50, 48);
  directionalLight(215, 218, 228, 0.45, 0.85, -0.55);
  directionalLight(160, 95, 55, -0.6, -0.3, 0.6);

  if (currentProtagonist === 3 || fusionState === FUSION_VORTEX || fusionState === FUSION_EXCHANGE) {
    pointLight(255, 180, 80, 0, -60, 0);
    pointLight(80, 220, 255, 0, -120, 0);
  } else if (currentProtagonist === 1) {
    pointLight(200, 210, 230, creatures[0].pos.x, -100, creatures[0].pos.z);
  } else if (currentProtagonist === 2) {
    let midX = (creatures[1].pos.x + creatures[2].pos.x) * 0.5;
    let midZ = (creatures[1].pos.z + creatures[2].pos.z) * 0.5;
    pointLight(200, 210, 230, midX, -100, midZ);
  } else {
    pointLight(180, 185, 195, creatures[0].pos.x, -120, creatures[0].pos.z);
  }

  // 繪製地表與垃圾堆
  drawGroundWasteland();
  drawTrashPiles();

  // 更新邏輯
  if (!isPaused) {
    for (let c of creatures) {
      c.update();
    }
    updateTrashPilesPhysics();
    updateFusionState();
    updateEffects();
  }

  // 繪製異生體（依主角過濾）
  for (let c of creatures) {
    c.draw();
  }

  // 風暴特效
  if (currentProtagonist === 0 || currentProtagonist === 3) {
    drawVortexEffects();
  }
  drawEffects();

  updateHUD();
}

// ----------------------------------------------------
// 核心：主角切換 (1, 2, 3, 0)
// ----------------------------------------------------
function setProtagonist(subjectIndex) {
  currentProtagonist = subjectIndex;

  // 設定畫面生物可見性：僅保留主角在畫面中！
  for (let c of creatures) {
    if (currentProtagonist === 0) {
      c.visible = (c.role !== 'newborn' || c.active);
    } else if (currentProtagonist === 1) {
      c.visible = (c.role === 'solo');
    } else if (currentProtagonist === 2) {
      c.visible = (c.role === 'tandem_lead' || c.role === 'tandem_follow');
    } else if (currentProtagonist === 3) {
      c.visible = (c.role === 'center_a' || c.role === 'center_b' || (c.role === 'newborn' && c.active));
    }
  }

  // 更新 HUD 主角按鈕樣式
  document.querySelectorAll('.p-btn').forEach(btn => btn.classList.remove('active'));
  if (subjectIndex === 1) document.getElementById('pbtn-1')?.classList.add('active');
  else if (subjectIndex === 2) document.getElementById('pbtn-2')?.classList.add('active');
  else if (subjectIndex === 3) document.getElementById('pbtn-3')?.classList.add('active');
  else document.getElementById('pbtn-all')?.classList.add('active');

  updateHUDText();
}

// ----------------------------------------------------
// 核心：特寫視角模式切換 (C 鍵)
// ----------------------------------------------------
function setCamAngle(mode) {
  camMode = mode;

  document.querySelectorAll('.cam-btn').forEach(btn => btn.classList.remove('active'));
  if (mode === 'orbit') document.getElementById('cam-orbit')?.classList.add('active');
  else if (mode === 'follow') document.getElementById('cam-follow')?.classList.add('active');
  else if (mode === 'action') document.getElementById('cam-action')?.classList.add('active');

  updateHUDText();
}

function cycleCameraAngle() {
  if (camMode === 'orbit') {
    setCamAngle('follow');
  } else if (camMode === 'follow') {
    setCamAngle('action');
  } else {
    setCamAngle('orbit');
  }
}

// ----------------------------------------------------
// 攝影機運鏡計算 (主角目標點 + 拍攝角度模式，鏡頭拉遠留出至少 2 個身位流空)
// ----------------------------------------------------
function applyCamera() {
  let sx = random(-screenShake, screenShake);
  let sy = random(-screenShake, screenShake);
  let sz = random(-screenShake, screenShake);
  screenShake = max(0, screenShake * 0.88);

  // 1. 取得當前主角的中心焦點位置 (tx, ty, tz) 與朝向角度 (tAngle)
  let tx = 0, ty = -14, tz = 0;
  let tAngle = 0;

  if (currentProtagonist === 1) {
    let c = creatures[0];
    tx = c.pos.x;
    ty = c.pos.y - 12;
    tz = c.pos.z;
    tAngle = c.angle;
  } else if (currentProtagonist === 2) {
    let c1 = creatures[1];
    let c2 = creatures[2];
    tx = (c1.pos.x + c2.pos.x) * 0.5;
    ty = (c1.pos.y + c2.pos.y) * 0.5 - 14;
    tz = (c1.pos.z + c2.pos.z) * 0.5;
    tAngle = (c1.angle + c2.angle) * 0.5;
  } else if (currentProtagonist === 3) {
    tx = 0;
    ty = -18;
    tz = 0;
    tAngle = fusionVortexAngle;
  } else {
    // 全體
    tx = creatures[0].pos.x * 0.25;
    ty = -18;
    tz = creatures[0].pos.z * 0.25;
    tAngle = creatures[0].angle;
  }

  // 2. 依據 camMode 與主角計算最佳拍攝距離 (拉遠鏡頭，留出至少 2 個身位流空)
  if (camMode === 'orbit') {
    // 【角度 A：自由軌道環繞】
    if (currentProtagonist === 0) {
      orbitControl(1.5, 1.5, 0.05);
      camera(0 + sx, -560 + sy, 840 + sz, 0, -20, 0, 0, 1, 0);
    } else if (currentProtagonist === 1) {
      orbitControl(1.5, 1.5, 0.05);
      camera(tx + sx, ty - 240 + sy, tz + 480 + sz, tx, ty, tz, 0, 1, 0);
    } else if (currentProtagonist === 2) {
      orbitControl(1.5, 1.5, 0.05);
      camera(tx + sx, ty - 280 + sy, tz + 560 + sz, tx, ty, tz, 0, 1, 0);
    } else if (currentProtagonist === 3) {
      orbitControl(1.5, 1.5, 0.05);
      let r = (fusionState === FUSION_VORTEX || fusionState === FUSION_EXCHANGE) ? 460 : 520;
      camera(0 + sx, -260 + sy, r + sz, 0, -20, 0, 0, 1, 0);
    }

  } else if (camMode === 'follow') {
    // 【角度 B：身後緊隨追蹤特寫 (拉遠留空)】
    if (currentProtagonist === 1) {
      let backDist = 480; // 留出 2 個以上身位
      let camHeight = 180;
      let cx = tx - sin(tAngle) * backDist + sx;
      let cz = tz - cos(tAngle) * backDist + sz;
      camera(cx, ty - camHeight + sy, cz, tx, ty, tz, 0, 1, 0);

    } else if (currentProtagonist === 2) {
      let backDist = 560;
      let camHeight = 220;
      let cx = tx - sin(tAngle) * backDist + sx;
      let cz = tz - cos(tAngle) * backDist + sz;
      camera(cx, ty - camHeight + sy, cz, tx, ty, tz, 0, 1, 0);

    } else if (currentProtagonist === 3) {
      let ang = frameCount * 0.018;
      let r = (fusionState === FUSION_VORTEX || fusionState === FUSION_EXCHANGE) ? 450 : 500;
      let h = (fusionState === FUSION_VORTEX || fusionState === FUSION_EXCHANGE) ? 200 : 230;
      camera(cos(ang) * r + sx, ty - h + sy, sin(ang) * r + sz, 0, ty, 0, 0, 1, 0);

    } else {
      let lead = creatures[1];
      camera(
        lead.pos.x - sin(lead.angle) * 580 + sx,
        -230 + sy,
        lead.pos.z - cos(lead.angle) * 580 + sz,
        lead.pos.x, -15, lead.pos.z,
        0, 1, 0
      );
    }

  } else if (camMode === 'action') {
    // 【角度 C：迎面正面特寫 (拉遠留空)】
    if (currentProtagonist === 1) {
      let frontDist = 460;
      let camHeight = 160;
      let cx = tx + sin(tAngle) * frontDist + sx;
      let cz = tz + cos(tAngle) * frontDist + sz;
      camera(cx, ty - camHeight + sy, cz, tx, ty, tz, 0, 1, 0);

    } else if (currentProtagonist === 2) {
      let frontDist = 540;
      let camHeight = 190;
      let cx = tx + sin(tAngle) * frontDist + sx;
      let cz = tz + cos(tAngle) * frontDist + sz;
      camera(cx, ty - camHeight + sy, cz, tx, ty, tz, 0, 1, 0);

    } else if (currentProtagonist === 3) {
      let zoomDist = (fusionState === FUSION_VORTEX || fusionState === FUSION_EXCHANGE) ? 400 : 450;
      let h = 180;
      camera(0 + sx, ty - h + sy, zoomDist + sz, 0, ty - 20, 0, 0, 1, 0);

    } else {
      let c = creatures[0];
      camera(
        c.pos.x + sin(c.angle) * 500 + sx,
        -180 + sy,
        c.pos.z + cos(c.angle) * 500 + sz,
        c.pos.x, -10, c.pos.z,
        0, 1, 0
      );
    }
  }
}

// ----------------------------------------------------
// 中央龍捲風暴與零件交換繁衍狀態機
// ----------------------------------------------------
function triggerFusionRitual() {
  if (fusionState === FUSION_IDLE || fusionState === FUSION_COMPLETE) {
    fusionState = FUSION_EXPLODE;
    fusionTimer = 0;
    fusionVortexAngle = 0;
    fusionVortexSpeed = 0.05;
    screenShake = 6.0;

    vortexParticles = [];
    vortexDebris = [];
    initVortexDebris();
  }
}

function initVortexDebris() {
  vortexDebris = [];
  let debrisTypes = ['glass_shard', 'brick', 'corrugated', 'can', 'tire_chunk'];
  for (let i = 0; i < 24; i++) {
    let t = debrisTypes[i % debrisTypes.length];
    let col = [random(100, 255), random(60, 200), random(40, 180)];
    if (t === 'glass_shard') col = [35, 190, 120];
    else if (t === 'brick') col = [185, 68, 50];
    else if (t === 'corrugated') col = [175, 85, 45];
    else if (t === 'can') col = [210, 40, 40];

    vortexDebris.push({
      type: t,
      angle: random(TWO_PI),
      radius: random(25, 75),
      height: random(-120, 0),
      speed: random(0.12, 0.25),
      rot: createVector(random(TWO_PI), random(TWO_PI), random(TWO_PI)),
      rotVel: createVector(random(-0.3, 0.3), random(-0.3, 0.3), random(-0.3, 0.3)),
      col: col,
      size: createVector(random(12, 20), random(8, 14), random(14, 22))
    });
  }
}

function updateFusionState() {
  fusionTimer++;

  switch (fusionState) {
    case FUSION_EXPLODE:
      screenShake = max(screenShake, 2.0);
      if (fusionTimer > 50) {
        fusionState = FUSION_VORTEX;
        fusionTimer = 0;
      }
      break;

    case FUSION_VORTEX:
      fusionVortexSpeed = lerp(fusionVortexSpeed, 0.22, 0.02);
      fusionVortexAngle += fusionVortexSpeed;
      screenShake = max(screenShake, 4.0);

      for (let k = 0; k < 4; k++) {
        let pAngle = random(TWO_PI);
        let pRad = random(20, 80);
        let pH = random(-130, 0);
        vortexParticles.push({
          pos: createVector(cos(pAngle) * pRad, pH, sin(pAngle) * pRad),
          angle: pAngle,
          rad: pRad,
          speed: random(0.15, 0.3),
          life: random(40, 80),
          maxLife: 80,
          col: random() > 0.4 ? color(245, 160, 50) : color(80, 210, 255)
        });
      }

      for (let d of vortexDebris) {
        d.angle += d.speed;
        d.height += sin(frameCount * 0.1 + d.angle) * 1.5;
        d.rot.add(d.rotVel);
      }

      if (fusionTimer > 180) {
        fusionState = FUSION_EXCHANGE;
        fusionTimer = 0;
        executePartExchangeAndBirth();
      }
      break;

    case FUSION_EXCHANGE:
      fusionVortexAngle += fusionVortexSpeed;
      screenShake = max(screenShake, 18.0);

      if (fusionTimer > 80) {
        fusionState = FUSION_COALESCE;
        fusionTimer = 0;
      }
      break;

    case FUSION_COALESCE:
      fusionVortexSpeed = lerp(fusionVortexSpeed, 0.02, 0.05);
      if (fusionTimer > 70) {
        fusionState = FUSION_COMPLETE;
        fusionTimer = 0;
      }
      break;

    case FUSION_COMPLETE:
      break;
  }

  for (let i = vortexParticles.length - 1; i >= 0; i--) {
    let p = vortexParticles[i];
    p.angle += p.speed;
    p.pos.x = cos(p.angle) * p.rad;
    p.pos.z = sin(p.angle) * p.rad;
    p.pos.y -= 1.2;
    p.life -= 2;
    if (p.life <= 0) vortexParticles.splice(i, 1);
  }
}

function executePartExchangeAndBirth() {
  let parentA = creatures[3];
  let parentB = creatures[4];

  let swapHeadCount = floor(parentA.headPieces.length / 2);
  for (let i = 0; i < swapHeadCount; i++) {
    let temp = parentA.headPieces[i];
    parentA.headPieces[i] = parentB.headPieces[i];
    parentB.headPieces[i] = temp;
  }

  for (let s = 0; s < NUM_SEGMENTS; s++) {
    let piecesA = parentA.segments[s].pieces;
    let piecesB = parentB.segments[s].pieces;
    let swapCount = min(piecesA.length, piecesB.length) / 2;
    for (let k = 0; k < swapCount; k++) {
      let temp = piecesA[k];
      piecesA[k] = piecesB[k];
      piecesB[k] = temp;
    }
  }

  newbornCreature.active = true;
  newbornCreature.visible = (currentProtagonist === 0 || currentProtagonist === 3);
  newbornCreature.pos.set(0, -10, 0);
  newbornCreature.currentSplit = 1.6;
  newbornCreature.targetSplit = 0.05;

  for (let i = 0; i < newbornCreature.headPieces.length; i++) {
    let donor = (i % 2 === 0) ? parentA : parentB;
    if (donor.headPieces[i]) {
      newbornCreature.headPieces[i].col = [...donor.headPieces[i].col];
      newbornCreature.headPieces[i].type = donor.headPieces[i].type;
    }
  }

  for (let i = 0; i < 90; i++) {
    sparks.push({
      pos: createVector(0, -20, 0),
      vel: createVector(random(-18, 18), random(-18, 6), random(-18, 18)),
      life: 255,
      size: random(4, 10),
      col: random() > 0.4 ? color(255, 170, 50) : color(100, 230, 255)
    });
  }
}

function drawVortexEffects() {
  if (fusionState === FUSION_VORTEX || fusionState === FUSION_EXCHANGE) {
    push();
    noStroke();

    for (let p of vortexParticles) {
      push();
      translate(p.pos.x, p.pos.y, p.pos.z);
      fill(red(p.col), green(p.col), blue(p.col), p.life * 2.5);
      sphere(random(2.5, 4.5));
      pop();
    }

    for (let d of vortexDebris) {
      push();
      let dx = cos(d.angle) * d.radius;
      let dz = sin(d.angle) * d.radius;
      translate(dx, d.height, dz);
      rotateX(d.rot.x);
      rotateY(d.rot.y);
      rotateZ(d.rot.z);

      fill(d.col[0], d.col[1], d.col[2]);
      specularMaterial(d.col[0], d.col[1], d.col[2]);
      shininess(30);

      if (d.type === 'glass_shard') {
        drawGlassShardShape(14, 28, 10, d.col, [220, 255, 235]);
      } else if (d.type === 'brick') {
        drawBrickShape(d.size.x, d.size.y, d.size.z, d.col, false);
      } else if (d.type === 'corrugated') {
        drawCorrugatedPlateShape(d.size.x, d.size.y, d.size.z, d.col, 3);
      } else if (d.type === 'can') {
        drawCanShape(8, 18, d.col);
      } else {
        box(d.size.x, d.size.y, d.size.z);
      }
      pop();
    }

    noFill();
    stroke(255, 180, 70, 70);
    strokeWeight(2.5);
    for (let h = -120; h <= 0; h += 25) {
      push();
      translate(0, h, 0);
      rotateX(HALF_PI);
      let r = map(h, -120, 0, 75, 35);
      circle(0, 0, r * 2);
      pop();
    }

    pop();
  }
}

// ----------------------------------------------------
// 垃圾堆物理爆散系統
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

    let itemCount = floor(random(16, 22));
    for (let j = 0; j < itemCount; j++) {
      let rRatio = (j / itemCount);
      let ringRadius = pile.radius * (1 - rRatio * 0.7) * random(0.3, 0.95);
      let ringAngle = random(TWO_PI);
      let lx = cos(ringAngle) * ringRadius;
      let lz = sin(ringAngle) * ringRadius;
      let ly = -map(rRatio, 0, 1, 8, pile.height) + random(-5, 5);

      let itemType;
      let roll = random();
      let col, size, r, h, w, d;
      let isCinder = false;

      if (roll < 0.2) {
        itemType = 'tire';
        col = [34, 35, 38];
        r = random(14, 20);
        h = random(7, 10);
      } else if (roll < 0.4) {
        itemType = 'box';
        col = random() > 0.4 ? [145, 110, 72] : [98, 76, 52];
        size = createVector(random(20, 36), random(14, 24), random(20, 34));
      } else if (roll < 0.6) {
        itemType = 'brick';
        isCinder = random() > 0.6;
        col = isCinder ? [128, 130, 136] : [185, 70, 52];
        size = createVector(random(14, 22), random(10, 16), random(18, 28));
      } else if (roll < 0.78) {
        itemType = 'can';
        let cans = [[210, 42, 42], [38, 92, 215], [225, 185, 32], [42, 175, 78], [195, 198, 205]];
        col = random(cans);
        r = random(8, 13);
        h = random(14, 24);
      } else if (roll < 0.9) {
        itemType = 'glass_shard';
        let gColors = [[35, 185, 118], [205, 125, 32], [45, 110, 225]];
        col = random(gColors);
        w = random(12, 18);
        h = random(22, 34);
        d = random(8, 14);
      } else {
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

function scatterTrashPile(pile, chargeDir, speed) {
  pile.scattered = true;
  pile.hitShake = 30;

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

  for (let item of pile.items) {
    item.isResting = false;
    let away = p5.Vector.sub(item.pos, pile.pos);
    away.y = 0;
    if (away.mag() < 0.1) {
      away = createVector(random(-1, 1), 0, random(-1, 1));
    }
    away.normalize();
    away.add(p5.Vector.mult(chargeDir, 1.8)).normalize();

    let blastForce = random(12, 28);
    item.vel = p5.Vector.mult(away, blastForce);
    item.vel.y = random(-16, -7);
    item.rotVel = createVector(random(-0.35, 0.35), random(-0.35, 0.35), random(-0.35, 0.35));
  }
}

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
      item.vel.y += 0.58;

      let groundY = -item.groundOffset;
      if (item.pos.y >= groundY) {
        item.pos.y = groundY;
        item.vel.y = -item.vel.y * 0.35;
        item.vel.x *= 0.82;
        item.vel.z *= 0.82;
        item.rotVel.mult(0.85);

        if (abs(item.vel.y) < 0.4 && (item.vel.x * item.vel.x + item.vel.z * item.vel.z) < 0.15) {
          item.isResting = true;
          item.vel.set(0, 0, 0);
          item.rotVel.set(0, 0, 0);
        }
      }
    }
  }

  if (allScattered) {
    allScatteredTimer++;
    if (allScatteredTimer > 260) {
      resetAllTrashPiles();
      allScatteredTimer = 0;
    }
  } else {
    allScatteredTimer = 0;
  }
}

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
  for (let p of trashPiles) {
    spawnDust(p.pos.x, 0, p.pos.z, 8);
  }
}

// ----------------------------------------------------
// 環境地表繪製
// ----------------------------------------------------
function generateStaticFloorLitter() {
  staticFloorLitter = [];
  randomSeed(777);
  for (let i = 0; i < 90; i++) {
    let r = random(60, 680);
    let a = random(TWO_PI);
    let roll = random();
    let col, size;
    if (roll < 0.35) {
      col = [190, 185, 175];
      size = createVector(random(8, 16), 1, random(8, 16));
    } else if (roll < 0.65) {
      col = [160, 75, 48];
      size = createVector(random(6, 12), 3, random(6, 12));
    } else {
      col = [55, 60, 70];
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
// 周圍垃圾山巒 (取代原先的黑色長方體，作成真實垃圾堆的樣貌)
// ----------------------------------------------------
function initPerimeterTrashHeaps() {
  perimeterTrashHeaps = [];
  randomSeed(654);
  let count = 16;
  for (let i = 0; i < count; i++) {
    let ang = (TWO_PI / count) * i;
    let distR = random(710, 750);
    let heapCenter = createVector(cos(ang) * distR, 0, sin(ang) * distR);
    let items = [];

    // 每個邊界垃圾堆由 10~14 件真實廢料（瓦楞板、廢輪胎、紅磚混凝土、紙箱、鋁罐、碎玻璃）自然層疊而成
    let numItems = floor(random(10, 14));
    for (let j = 0; j < numItems; j++) {
      let roll = random();
      let ox = random(-55, 55);
      let oz = random(-35, 35);
      let oy = -random(8, 50);
      let item = {
        offset: createVector(ox, oy, oz),
        rot: createVector(random(-0.35, 0.35), random(TWO_PI), random(-0.35, 0.35))
      };

      if (roll < 0.25) {
        item.type = 'corrugated';
        item.col = random() > 0.5 ? [175, 85, 45] : [58, 120, 108];
        item.size = createVector(random(35, 60), 5, random(35, 55));
        item.ridges = 3;
      } else if (roll < 0.45) {
        item.type = 'tire';
        item.col = [34, 35, 38];
        item.r = random(18, 26);
        item.h = random(9, 14);
      } else if (roll < 0.65) {
        item.type = 'brick';
        let isCinder = random() > 0.5;
        item.col = isCinder ? [128, 130, 136] : [185, 68, 50];
        item.size = createVector(random(20, 32), random(12, 18), random(24, 36));
        item.isCinder = isCinder;
      } else if (roll < 0.82) {
        item.type = 'box';
        item.col = random() > 0.4 ? [145, 110, 72] : [98, 76, 52];
        item.size = createVector(random(30, 48), random(20, 32), random(30, 48));
      } else {
        if (random() > 0.5) {
          item.type = 'can';
          let cans = [[210, 42, 42], [38, 92, 215], [225, 185, 32], [42, 175, 78]];
          item.col = random(cans);
          item.r = random(10, 14);
          item.h = random(18, 26);
        } else {
          item.type = 'glass_shard';
          item.col = [35, 185, 118];
          item.w = random(14, 20);
          item.h = random(26, 40);
          item.d = random(10, 15);
        }
      }
      items.push(item);
    }

    perimeterTrashHeaps.push({
      pos: heapCenter,
      angle: ang,
      items: items
    });
  }
}

function drawPerimeterTrashHeaps() {
  for (let heap of perimeterTrashHeaps) {
    push();
    translate(heap.pos.x, 0, heap.pos.z);
    rotateY(heap.angle);
    for (let item of heap.items) {
      push();
      translate(item.offset.x, item.offset.y, item.offset.z);
      rotateX(item.rot.x);
      rotateY(item.rot.y);
      rotateZ(item.rot.z);
      drawSingleTrashItem(item);
      pop();
    }
    pop();
  }
}

function drawGroundWasteland() {
  push();
  translate(0, 1, 0);

  noStroke();
  fill(18, 16, 15);
  push();
  rotateX(HALF_PI);
  plane(2600, 2600);
  pop();

  stroke(38, 32, 28, 90);
  strokeWeight(1);
  for (let z = -1200; z <= 1200; z += 90) {
    line(-1200, 0, z, 1200, 0, z);
  }
  for (let x = -1200; x <= 1200; x += 90) {
    line(x, 0, -1200, x, 0, 1200);
  }

  for (let litter of staticFloorLitter) {
    push();
    translate(litter.pos.x, -1, litter.pos.z);
    rotateY(litter.rot);
    fill(litter.col[0], litter.col[1], litter.col[2]);
    box(litter.size.x, litter.size.y, litter.size.z);
    pop();
  }

  // 4. 周圍遠景垃圾山巒邊界 (全面替換黑色長方體為真實堆疊垃圾堆)
  drawPerimeterTrashHeaps();

  noFill();
  stroke(180, 140, 90, 45);
  strokeWeight(2);
  push();
  rotateX(HALF_PI);
  circle(0, 0, 170);
  circle(0, 0, 240);
  pop();

  pop();
}

function drawTrashPiles() {
  for (let pile of trashPiles) {
    push();
    if (pile.hitShake > 0) {
      translate(random(-pile.hitShake, pile.hitShake) * 0.35, 0, random(-pile.hitShake, pile.hitShake) * 0.35);
    }

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

function drawSingleTrashItem(item) {
  noStroke();

  if (item.type === 'tire') {
    fill(item.col[0], item.col[1], item.col[2]);
    specularMaterial(50, 52, 56);
    shininess(4);
    rotateX(HALF_PI);
    torus(item.r, item.h * 0.55);
  } else if (item.type === 'box') {
    fill(item.col[0], item.col[1], item.col[2]);
    specularMaterial(item.col[0] * 0.7, item.col[1] * 0.7, item.col[2] * 0.7);
    shininess(6);
    box(item.size.x, item.size.y, item.size.z);
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
// 各類幾何垃圾零件細緻繪製函式
// ----------------------------------------------------
function drawJunkShape(piece) {
  noStroke();

  if (piece.type === 'corrugated') {
    drawCorrugatedPlateShape(piece.size.x, piece.size.y, piece.size.z, piece.col, piece.ridges || 4);
  } else if (piece.type === 'brick') {
    drawBrickShape(piece.size.x, piece.size.y, piece.size.z, piece.col, piece.isCinder);
  } else if (piece.type === 'glass_shard') {
    drawGlassShardShape(piece.w, piece.h, piece.d, piece.col, piece.specCol);
  } else if (piece.type === 'can') {
    drawCanShape(piece.r, piece.h, piece.col);
  } else if (piece.type === 'tire_chunk') {
    drawTireChunkShape(piece.size.x, piece.size.y, piece.size.z, piece.col);
  } else if (piece.type === 'hazard_plate') {
    drawHazardPlateShape(piece.size.x, piece.size.y, piece.size.z, piece.col);
  } else if (piece.type === 'pcb') {
    drawPCBShape(piece.size.x, piece.size.y, piece.size.z, piece.col);
  } else if (piece.type === 'box') {
    specularMaterial(piece.col[0], piece.col[1], piece.col[2]);
    shininess(10);
    fill(piece.col[0], piece.col[1], piece.col[2]);
    box(piece.size.x, piece.size.y, piece.size.z);
  }
}

function drawCorrugatedPlateShape(w, h, d, col, ridgesCount) {
  fill(col[0], col[1], col[2]);
  specularMaterial(col[0], col[1], col[2]);
  shininess(10);
  box(w, h, d);

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

function drawBrickShape(w, h, d, col, isCinder) {
  fill(col[0], col[1], col[2]);
  specularMaterial(col[0] * 0.6, col[1] * 0.6, col[2] * 0.6);
  shininess(4);
  box(w, h, d);

  if (isCinder) {
    push();
    fill(32, 34, 38);
    translate(-w * 0.22, -h * 0.51, 0);
    box(w * 0.26, 2, d * 0.55);
    translate(w * 0.44, 0, 0);
    box(w * 0.26, 2, d * 0.55);
    pop();
  }
}

function drawGlassShardShape(w, h, d, col, specCol) {
  shininess(90);
  if (specCol) {
    specularMaterial(specCol[0], specCol[1], specCol[2]);
  }
  fill(col[0], col[1], col[2]);

  beginShape(TRIANGLES);
  vertex(0, -h, 0);
  vertex(-w * 0.5, 0, -d * 0.5);
  vertex(w * 0.5, 0, -d * 0.5);
  vertex(0, -h, 0);
  vertex(w * 0.5, 0, -d * 0.5);
  vertex(0, 0, d * 0.5);
  vertex(0, -h, 0);
  vertex(0, 0, d * 0.5);
  vertex(-w * 0.5, 0, -d * 0.5);
  vertex(-w * 0.5, 0, -d * 0.5);
  vertex(w * 0.5, 0, -d * 0.5);
  vertex(0, 0, d * 0.5);
  endShape();
}

function drawCanShape(r, h, col) {
  fill(col[0], col[1], col[2]);
  specularMaterial(col[0], col[1], col[2]);
  shininess(40);
  cylinder(r, h);

  push();
  fill(200, 205, 215);
  specularMaterial(230, 235, 245);
  translate(0, -h * 0.5, 0);
  cylinder(r * 0.9, 1.5);
  translate(0, h, 0);
  cylinder(r * 0.9, 1.5);
  pop();
}

function drawTireChunkShape(w, h, d, col) {
  fill(col[0], col[1], col[2]);
  specularMaterial(45, 46, 50);
  shininess(3);
  box(w, h, d);

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

function drawHazardPlateShape(w, h, d, col) {
  fill(col[0], col[1], col[2]);
  specularMaterial(col[0], col[1], col[2]);
  shininess(14);
  box(w, h, d);

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

function drawPCBShape(w, h, d, col) {
  fill(col[0], col[1], col[2]);
  specularMaterial(col[0], col[1], col[2]);
  shininess(25);
  box(w, h, d);

  push();
  fill(210, 175, 45);
  translate(0, -h * 0.52, 0);
  box(w * 0.4, 1, d * 0.4);
  pop();
}

// ----------------------------------------------------
// 粒子系統
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
// 使用者介面與按鍵控制
// ----------------------------------------------------
function setupUI() {
  // 1/2/3 主角切換按鈕
  document.getElementById('pbtn-1')?.addEventListener('click', () => setProtagonist(1));
  document.getElementById('pbtn-2')?.addEventListener('click', () => setProtagonist(2));
  document.getElementById('pbtn-3')?.addEventListener('click', () => setProtagonist(3));
  document.getElementById('pbtn-all')?.addEventListener('click', () => setProtagonist(0));

  // 攝影機視角按鈕 (C 鍵視角)
  document.getElementById('cam-orbit')?.addEventListener('click', () => setCamAngle('orbit'));
  document.getElementById('cam-follow')?.addEventListener('click', () => setCamAngle('follow'));
  document.getElementById('cam-action')?.addEventListener('click', () => setCamAngle('action'));

  // M 鍵觸發中央風暴
  document.getElementById('btn-fusion')?.addEventListener('click', () => {
    triggerFusionRitual();
  });

  // 空白鍵巡弋衝撞
  document.getElementById('btn-ram')?.addEventListener('click', () => {
    triggerRoamingRam();
  });

  // X 鍵拆分切換
  document.getElementById('btn-split')?.addEventListener('click', () => {
    toggleGlobalSplit();
  });

  // R 鍵全局重置
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    resetAllStates();
  });

  // 暫停按鈕
  document.getElementById('btn-pause')?.addEventListener('click', (e) => {
    isPaused = !isPaused;
    e.target.textContent = isPaused ? '▶ 繼續播放' : '⏸ 暫停 / 播放';
  });
}

function triggerRoamingRam() {
  if (creatures[0].currentState === STATE_SLITHER) {
    creatures[0].triggerStraighten();
  }
  if (creatures[1].currentState === STATE_SLITHER) {
    creatures[1].triggerStraighten();
    if (creatures[2]) creatures[2].triggerStraighten();
  }
}

function toggleGlobalSplit() {
  userGlobalSplit = !userGlobalSplit;
  for (let c of creatures) {
    c.targetSplit = userGlobalSplit ? 1.0 : 0.22;
  }
  const btn = document.getElementById('btn-split');
  if (btn) {
    btn.textContent = userGlobalSplit ? '🧩 緊湊咬合 (X)' : '💥 不規則拆分 (X)';
    btn.classList.toggle('active', userGlobalSplit);
  }
}

// ----------------------------------------------------
// 重置函式 (按 R 觸發：生物不回原點，僅編號3變回兩隻，重整場景垃圾堆)
// ----------------------------------------------------
function resetAllStates() {
  // 1. 重整所有被撞散的垃圾堆回到原位初始樣貌
  resetAllTrashPiles();

  // 2. 重置中央風暴繁衍狀態
  fusionState = FUSION_IDLE;
  fusionTimer = 0;
  vortexParticles = [];
  vortexDebris = [];

  // 3. 只有編號 3 變回兩隻：隱藏並關閉新生體
  if (newbornCreature) {
    newbornCreature.active = false;
    newbornCreature.visible = false;
  }

  // 重置中央雙體的外殼零件配置與拆分度（生物保持當前位置，不回起點）
  creatures[3].targetSplit = 0.22;
  creatures[3].straightenProgress = 0;
  creatures[3].buildHeadPieces();
  creatures[3].initSegments();

  creatures[4].targetSplit = 0.22;
  creatures[4].straightenProgress = 0;
  creatures[4].buildHeadPieces();
  creatures[4].initSegments();

  // 4. 生物 [0] 獨行者、[1] 領頭、[2] 僚機 均不重置初始狀態與位置，維持當前運動！

  // 5. 保持當前主角設定 (不跳轉)，重新同步可見性
  setProtagonist(currentProtagonist);
}

function keyPressed() {
  if (key === '1') {
    setProtagonist(1);
  } else if (key === '2') {
    setProtagonist(2);
  } else if (key === '3') {
    setProtagonist(3);
  } else if (key === '0' || key === 'Escape') {
    setProtagonist(0);
  } else if (key === 'c' || key === 'C') {
    // 核心要求：C 鍵循環切換特寫角度
    cycleCameraAngle();
  } else if (key === 'r' || key === 'R') {
    resetAllStates();
  } else if (key === 'm' || key === 'M') {
    triggerFusionRitual();
  } else if (key === ' ' || keyCode === 32) {
    triggerRoamingRam();
    return false;
  } else if (key === 'x' || key === 'X') {
    toggleGlobalSplit();
  }
}

function updateHUDText() {
  const badgeProtag = document.getElementById('badge-protag');
  const badgeCam = document.getElementById('badge-cam');
  const statusLight = document.getElementById('status-light');
  const statusText = document.getElementById('status-text');

  if (!badgeProtag || !badgeCam || !statusText) return;

  // 主角徽章
  if (currentProtagonist === 1) {
    badgeProtag.textContent = '主角：① 獨行者';
    badgeProtag.style.background = '#5e81ac';
  } else if (currentProtagonist === 2) {
    badgeProtag.textContent = '主角：② 伴行雙體';
    badgeProtag.style.background = '#a3be8c';
  } else if (currentProtagonist === 3) {
    badgeProtag.textContent = '主角：③ 旋轉雙體';
    badgeProtag.style.background = '#b48ead';
  } else {
    badgeProtag.textContent = '主角：全體全景';
    badgeProtag.style.background = '#4c566a';
  }

  // 視角徽章
  if (camMode === 'orbit') {
    badgeCam.textContent = '視角：自由軌道 (Orbit)';
    badgeCam.style.background = '#88c0d0';
    badgeCam.style.color = '#242933';
  } else if (camMode === 'follow') {
    badgeCam.textContent = '視角：身後跟隨 (Follow)';
    badgeCam.style.background = '#d08770';
    badgeCam.style.color = '#fff';
  } else if (camMode === 'action') {
    badgeCam.textContent = '視角：迎面正面特寫 (Front)';
    badgeCam.style.background = '#bf616a';
    badgeCam.style.color = '#fff';
  }

  // 狀態說明
  let protagDesc = '';
  if (currentProtagonist === 1) protagDesc = '【主角 ① 獨行者】畫面僅顯示單獨移動生物。';
  else if (currentProtagonist === 2) protagDesc = '【主角 ② 伴行雙體】畫面僅顯示並肩移動的兩隻生物。';
  else if (currentProtagonist === 3) protagDesc = '【主角 ③ 旋轉雙體】畫面僅顯示中央旋轉生物（按 M 可繁衍第 3 隻）。';
  else protagDesc = '【全體模式】顯示全場 5 隻異生體。按 1/2/3 切換主角。';

  let camDesc = '';
  if (camMode === 'orbit') camDesc = '當前視角：自由軌道環繞（拉遠留空至少 2 身位）。按 C 切換身後跟隨。按 R 重置初始狀態，按 0 切換全體。';
  else if (camMode === 'follow') camDesc = '當前視角：身後緊隨追拍（拉遠留空至少 2 身位）。按 C 切換迎面正面特寫。按 R 重置初始狀態，按 0 切換全體。';
  else if (camMode === 'action') camDesc = '當前視角：迎面正面特寫（拉遠留空至少 2 身位）。按 C 切換自由軌道。按 R 重置初始狀態，按 0 切換全體。';

  statusText.textContent = `${protagDesc} ${camDesc}`;
}

function updateHUD() {
  const badgeFusion = document.getElementById('badge-fusion');
  if (!badgeFusion) return;

  if (fusionState === FUSION_IDLE) {
    badgeFusion.textContent = '中央守護中';
    badgeFusion.style.background = '#b48ead';
  } else if (fusionState === FUSION_EXPLODE) {
    badgeFusion.textContent = '風暴階段一：零件解構！';
    badgeFusion.style.background = '#ebcb8b';
  } else if (fusionState === FUSION_VORTEX) {
    badgeFusion.textContent = '風暴階段二：高速纏繞龍捲風！';
    badgeFusion.style.background = '#d08770';
  } else if (fusionState === FUSION_EXCHANGE) {
    badgeFusion.textContent = '風暴階段三：零件互換·誕生第3隻！';
    badgeFusion.style.background = '#bf616a';
  } else if (fusionState === FUSION_COALESCE) {
    badgeFusion.textContent = '風暴階段四：磁吸咬合壓緊';
    badgeFusion.style.background = '#a3be8c';
  } else if (fusionState === FUSION_COMPLETE) {
    badgeFusion.textContent = '風暴階段五：三體共生完成！';
    badgeFusion.style.background = '#88c0d0';
  }
}
