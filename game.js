"use strict";

// ============================================================
//  DOM
// ============================================================
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const waveEl = document.getElementById("wave");
const squadEl = document.getElementById("squad");
const weaponEl = document.getElementById("weapon");
const pipsEl = document.getElementById("pips");
const overlay = document.getElementById("overlay");
const messageEl = document.getElementById("message");
const startBtn = document.getElementById("startBtn");
const upgradeEl = document.getElementById("upgrade");
const upgradeCards = document.getElementById("upgradeCards");
const upgradeHint = document.getElementById("upgradeHint");
const muteBtn = document.getElementById("muteBtn");
const pauseBtn = document.getElementById("pauseBtn");

const W = canvas.width, H = canvas.height;
const horizonY = 150;
const playerY = H - 132;
const coreY = H - 96;

// ============================================================
//  透视
// ============================================================
function scaleAt(y) { const t = Math.max(0, Math.min(1, (y - horizonY) / (H - horizonY))); return 0.55 + t * t * 0.78; }
function roadHalf(y) { const t = Math.max(0, Math.min(1, (y - horizonY) / (H - horizonY))); return (W * 0.12) + t * (W * 0.42); }

// ============================================================
//  音频
// ============================================================
let actx = null, master = null, muted = false, beatTimer = null;
function initAudio() { if (actx) { if (actx.state === "suspended") actx.resume(); return; } try { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = 0.45; master.connect(actx.destination); startBeat(); } catch (e) { actx = null; } }
function tone(freq, dur, type, vol, slideTo) { if (!actx || muted) return; const o = actx.createOscillator(), g = actx.createGain(); o.type = type || "square"; o.frequency.value = freq; if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), actx.currentTime + dur); g.gain.setValueAtTime(vol || 0.18, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur); o.connect(g); g.connect(master); o.start(); o.stop(actx.currentTime + dur); }
function nz(dur, vol) { if (!actx || muted) return; const buf = actx.createBuffer(1, Math.max(1, actx.sampleRate * dur) | 0, actx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); const s = actx.createBufferSource(); s.buffer = buf; const g = actx.createGain(); g.gain.value = vol || 0.15; s.connect(g); g.connect(master); s.start(); }
const sfx = {
  shoot() { tone(900, 0.05, "square", 0.10, 320); },
  hit() { nz(0.025, 0.10); },
  kill() { tone(220, 0.16, "sawtooth", 0.16, 70); },
  upgrade() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.12, "square", 0.16), i * 65)); },
  boss() { tone(98, 0.5, "square", 0.24, 70); setTimeout(() => tone(130, 0.5, "square", 0.2, 92), 130); },
  throw() { nz(0.12, 0.08); },
  hurt() { nz(0.14, 0.2); tone(150, 0.22, "sawtooth", 0.18, 70); },
  clear() { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.13, "square", 0.17), i * 85)); }
};
function startBeat() { if (beatTimer) return; let step = 0; beatTimer = setInterval(() => { if (!actx || muted) return; if (step % 4 === 0) tone(64, 0.13, "sine", 0.28); if (step % 2 === 1) nz(0.03, 0.05); step = (step + 1) % 8; }, 210); }
function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.45; muteBtn.textContent = muted ? "♪̸" : "♪"; muteBtn.classList.toggle("off", muted); }
muteBtn.addEventListener("click", toggleMute);
function syncPauseIcon() { if (pauseBtn) pauseBtn.textContent = (state === "playing") ? "⏸" : "▶"; }
pauseBtn.addEventListener("click", () => { initAudio(); togglePause(); });

// ============================================================
//  武器 / 载具 / 敌人类型
// ============================================================
const WEAPONS = [
  { name: "手枪",   dmg: 1, rate: 0.55, speed: 820, spread: 0.02, count: 1, color: "#ffe86a", size: 3.4, pierce: 0, kind: "bullet" },
  { name: "霰弹枪", dmg: 2, rate: 0.6,  speed: 760, spread: 0.34, count: 7, color: "#ffb14d", size: 3.0, pierce: 0, kind: "pellet" },
  { name: "步枪",   dmg: 3, rate: 0.24, speed: 1000, spread: 0.03, count: 1, color: "#fff0a0", size: 3.2, pierce: 1, kind: "tracer" },
  { name: "冲锋枪", dmg: 2, rate: 0.10, speed: 940, spread: 0.07, count: 1, color: "#9ff7ff", size: 3.0, pierce: 0, kind: "bullet" },
  { name: "机枪",   dmg: 4, rate: 0.08, speed: 1060, spread: 0.05, count: 1, color: "#fff0a0", size: 3.4, pierce: 1, kind: "tracer" },
  { name: "加特林", dmg: 5, rate: 0.045, speed: 1140, spread: 0.08, count: 2, color: "#ff7a3d", size: 3.6, pierce: 1, kind: "tracer" }
];
const VEHICLES = [
  { name: "步行",   speedMul: 1.0, color: null },
  { name: "滑板",   speedMul: 1.25, color: "#c97a2a" },
  { name: "摩托",   speedMul: 1.5, color: "#2a5ad9" },
  { name: "越野吉普", speedMul: 1.38, color: "#6a6a3a" },
  { name: "机甲",   speedMul: 1.72, color: "#9a5ad9" }
];
const TYPES = {
  savage:   { hp: 2, speed: 34, r: 18, reward: 12, skin: "#b07a4a", scale: 1.0,  armor: 0 },
  scout:    { hp: 1, speed: 52, r: 14, reward: 18, skin: "#9a6a3a", scale: 0.82, armor: 0, ranged: true },
  brute:    { hp: 7, speed: 18, r: 26, reward: 30, skin: "#8a5a32", scale: 1.2,  armor: 1, tank: true },
  shielder: { hp: 4, speed: 22, r: 20, reward: 26, skin: "#7a6a4a", scale: 1.05, armor: 0, shield: 6 },
  shaman:   { hp: 5, speed: 16, r: 17, reward: 34, skin: "#4a8a6a", scale: 0.95, armor: 0, healer: true },
  bomber:   { hp: 3, speed: 66, r: 16, reward: 24, skin: "#9a5a2a", scale: 0.9,  armor: 0, explode: true, blast: 88 },
  berserker:{ hp: 8, speed: 24, r: 20, reward: 32, skin: "#a04a2a", scale: 1.05, armor: 1, enrage: true, tank: true },
  boss:     { hp: 130, speed: 13, r: 50, reward: 320, skin: "#7a4a2a", scale: 1.6, armor: 2, ranged: true }
};
const ENEMY_SCALE = 1.0;
const DMG_HIT = 34, DMG_EXPLODE = 55, DMG_SLAM = 46, DMG_BOSS = 60;
const BOSS_NAMES = ["酋长", "巨猿王", "巫毒领主", "丛林巨蛇"];
const MODIFIERS = [
  { id: "frenzy",  name: "加速日", desc: "敌人速度+40% 分数+50%", apply: m => { m.speedMul *= 1.4; m.scoreMul *= 1.5; } },
  { id: "night",   name: "黑夜", desc: "视野缩小 分数+30%", apply: m => { m.dark += 0.5; m.scoreMul *= 1.3; } },
  { id: "elite",   name: "精英潮", desc: "25%敌人变精英 奖励x2", apply: m => { m.eliteChance = 0.25; } },
  { id: "harvest", name: "丰收", desc: "升级四选一", apply: m => { m.choices = 4; } },
  { id: "ironhide",name: "铜墙", desc: "所有敌人自带护盾", apply: m => { m.shieldAll = true; } },
  { id: "rage",    name: "狂暴", desc: "敌人全程暴怒 速度x1.6", apply: m => { m.rage = true; m.speedMul *= 1.15; } },
  { id: "fog",     name: "迷雾", desc: "浓雾遮罩 分数+25%", apply: m => { m.fog += 0.5; m.scoreMul *= 1.25; } },
  { id: "swarm",   name: "蛮群", desc: "刷怪x1.8 敌人血-30%", apply: m => { m.spawnMul *= 1.8; m.hpMul *= 0.7; } }
];
function baseMod() { return { speedMul: 1, hpMul: 1, scoreMul: 1, spawnMul: 1, choices: 3, dark: 0, fog: 0, eliteChance: 0, shieldAll: false, rage: false, name: null, desc: null }; }
let lastModId = null;
function rollMod() { const m = baseMod(); const pool = MODIFIERS.filter(x => x.id !== lastModId); const pk = pool[Math.floor(Math.random() * pool.length)]; lastModId = pk.id; pk.apply(m); m.name = pk.name; m.desc = pk.desc; return m; }
const BIOMES = [
  { name: "丛林", sky: ["#2a78d4", "#6fb4e8", "#cfe8f5"], sun: "#fff8dc", glow: "rgba(255,250,220,0.95)", ground: "#2c5a22", dirt: ["#6a4a26", "#4a3219"], palm: "#3f7a2a", canopy1: "#3a6a4a", canopy2: "#2a5a32", canopy3: "#2f6a26", ambient: "leaves", haze: "rgba(200,230,200,0.45)", dark: 0 },
  { name: "沼泽", sky: ["#3a4a3a", "#5a6a4a", "#8a9a6a"], sun: "#c0c8a0", glow: "rgba(200,210,170,0.6)", ground: "#283a26", dirt: ["#3a3220", "#241e10"], palm: "#3a5a2a", canopy1: "#2a4a3a", canopy2: "#1a3a2a", canopy3: "#1f4a2a", ambient: "rain", haze: "rgba(150,170,130,0.55)", dark: 0.2 },
  { name: "古遗迹", sky: ["#3a2a5a", "#8a5a3a", "#ffb86a"], sun: "#ffd070", glow: "rgba(255,200,110,0.8)", ground: "#4a4030", dirt: ["#6a5a3a", "#42332a"], palm: "#5a4a2a", canopy1: "#5a4a3a", canopy2: "#4a3a2a", canopy3: "#4a3a2a", ambient: "embers", haze: "rgba(220,180,120,0.4)", dark: 0.1 },
  { name: "火山夜", sky: ["#1a0a14", "#3a1010", "#6a1a14"], sun: "#ff5a2a", glow: "rgba(255,90,40,0.8)", ground: "#2a1612", dirt: ["#3a1a14", "#1a0a08"], palm: "#3a1a14", canopy1: "#2a1612", canopy2: "#1a0a08", canopy3: "#1f0a0a", ambient: "embers", haze: "rgba(120,30,20,0.5)", dark: 0.35 }
];
function biomeIdx() { return Math.floor(upgradesDone / 3) % BIOMES.length; }
let curBiome = 0;
function applyBiome() { const nb = biomeIdx(); if (nb !== curBiome) { curBiome = nb; buildGround(); } }
let waveMod = baseMod();

// ============================================================
//  RPG Buff 定义
// ============================================================
const STATS = {
  rate:   { name: "射速", icon: "⚡", max: 8, desc: "降低攻击间隔" },
  dmg:    { name: "伤害", icon: "💥", max: 6, desc: "提升子弹伤害" },
  multi:  { name: "多发", icon: "🎯", max: 4, desc: "每次射击多1颗子弹" },
  pierce: { name: "穿透", icon: "➹", max: 4, desc: "子弹多穿透1个敌人" },
  bspeed: { name: "弹速", icon: "»", max: 5, desc: "子弹飞行更快" },
  mspeed: { name: "移速", icon: "👟", max: 5, desc: "移动更快" },
  crit:   { name: "暴击", icon: "✦", max: 5, desc: "暴击率+8%(2倍伤害)" },
  range:  { name: "射程", icon: "⌖", max: 3, desc: "子弹更大更远" }
};
const MODLIST = [
  ["explosive", "爆裂弹", "🔥", "命中产生范围爆炸"],
  ["burn", "燃烧弹", "🌋", "命中点燃，持续灼烧"],
  ["homing", "追踪弹", "🧭", "子弹轻微追踪敌人"],
  ["chain", "雷链", "⚡", "命中串击附近敌人"],
  ["lifesteal", "吸血", "🩸", "击杀概率恢复1人"],
  ["shield", "护盾", "🛡", "自动回复的吸收盾"],
  ["ricochet", "跳弹", "↺", "命中后弹向另一敌人"]
];
const SPECS = [
  { name: "快拔", desc: "手枪射速+50%", apply: () => { WEAPONS[0].rate *= 0.5; } },
  { name: "独头弹", desc: "霰弹更聚、伤害+1", apply: () => { WEAPONS[1].dmg += 1; WEAPONS[1].spread *= 0.45; WEAPONS[1].count = Math.max(3, WEAPONS[1].count - 2); } },
  { name: "穿甲", desc: "步枪穿透+2", apply: () => { WEAPONS[2].pierce += 2; } },
  { name: "双持", desc: "冲锋枪+1弹道", apply: () => { WEAPONS[3].count += 1; } },
  { name: "压制", desc: "机枪命中减速敌人", apply: () => { player.mods.slow = true; } },
  { name: "弹幕", desc: "加特林+1弹道、散布加大", apply: () => { WEAPONS[5].count += 1; WEAPONS[5].spread = 0.2; } }
];
function pickRarity() { const r = Math.random(); return r < 0.1 ? "epic" : r < 0.4 ? "rare" : "common"; }
const RARITY = { common: { c: 1, label: "普通" }, rare: { c: 2, label: "稀有" }, epic: { c: 3, label: "史诗" } };

// ============================================================
//  状态
// ============================================================
let state = "menu";
let lastTime = 0;
const player = {
  x: W / 2, y: playerY, speed: 380, life: 1, maxLife: 1, hp: 100, maxHp: 100, weaponLevel: 0, vehicleLevel: 0,
  fireTimer: 0, animTime: 0, moving: false, inv: 0, vx: 0, recoil: 0,
  buffs: { rate: 0, dmg: 0, multi: 0, pierce: 0, bspeed: 0, mspeed: 0, crit: 0, range: 0 },
  mods: { explosive: false, burn: false, homing: false, chain: false, lifesteal: false, shield: false, ricochet: false, slow: false },
  revive: 0, drones: 0, specs: {}, shieldT: 0, droneTimer: 0
};
const enemies = [], bullets = [], enemyBullets = [], particles = [], floatTexts = [], decals = [], hazards = [], telegraphs = [], bolts = [], shocks = [], ambient = [];
let score = 0, wave = 1, kills = 0, killTarget = 12, upgradesDone = 0, bossesDefeated = 0;
const upgradePerBoss = 3;
let bossPending = false, bossActive = false, spawnTimer = 0, screenShake = 0;
let pointerActive = false, muzzle = 0;
let freezeTimer = 0;
let combo = 0, comboTimer = 0; const COMBO_WIN = 2.6;
let bannerText = "", bannerTime = 0, bannerTotal = 1, bannerColor = "#ffe14a";
const keys = new Set();
let pointerTarget = { x: W / 2, y: playerY };

// ============================================================
//  流程
// ============================================================
function resetGame() {
  enemies.length = 0; bullets.length = 0; enemyBullets.length = 0; particles.length = 0; floatTexts.length = 0; decals.length = 0; hazards.length = 0; telegraphs.length = 0; bolts.length = 0; shocks.length = 0;
  player.x = W / 2; player.y = playerY; player.weaponLevel = 0; player.vehicleLevel = 0;
  player.life = 1; player.maxLife = 1; player.hp = 100; player.maxHp = 100; player.fireTimer = 0; player.animTime = 0; player.inv = 3; player.vx = 0; player.recoil = 0;
  player.buffs = { rate: 0, dmg: 0, multi: 0, pierce: 0, bspeed: 0, mspeed: 0, crit: 0, range: 0 };
  player.mods = { explosive: false, burn: false, homing: false, chain: false, lifesteal: false, shield: false, ricochet: false, slow: false };
  player.revive = 0; player.drones = 0; player.specs = {}; player.shieldT = 0; player.droneTimer = 0;
  // 重置武器数值（专精可能改过）
  WEAPONS[0].rate = 0.55; WEAPONS[1].dmg = 2; WEAPONS[1].spread = 0.34; WEAPONS[1].count = 7;
  WEAPONS[2].pierce = 1; WEAPONS[3].count = 1; WEAPONS[5].count = 2; WEAPONS[5].spread = 0.08;
  score = 0; wave = 1; kills = 0; killTarget = 10; upgradesDone = 0; bossesDefeated = 0;
  bossPending = false; bossActive = false; spawnTimer = 2.0; screenShake = 0; freezeTimer = 0;
  combo = 0; comboTimer = 0; bannerTime = 0;
  waveMod = baseMod(); lastModId = null; ambient.length = 0; curBiome = biomeIdx(); buildGround();
  updateHud();
}
function startGame() { resetGame(); state = "playing"; overlay.classList.add("hidden"); lastTime = performance.now(); banner("WAVE 1", 1.4); initAudio(); syncPauseIcon(); }
function gameOver() { state = "gameover"; messageEl.innerHTML = `阵地失守！<br>最终得分 <b style="color:#ffe14a">${score}</b>　撑到第 ${wave} 波`; startBtn.textContent = "继续战斗"; overlay.classList.remove("hidden"); }
const weapon = () => WEAPONS[player.weaponLevel];
const vehicle = () => VEHICLES[player.vehicleLevel];
function effWeapon() {
  const w = WEAPONS[player.weaponLevel], b = player.buffs;
  return { dmg: w.dmg + b.dmg, rate: w.rate * Math.pow(0.92, b.rate), count: w.count + b.multi, pierce: w.pierce + b.pierce, speed: w.speed * Math.pow(1.12, b.bspeed), spread: w.spread, color: w.color, size: w.size * (1 + b.range * 0.15), kind: w.kind };
}
function moveMul() { return vehicle().speedMul * Math.pow(1.1, player.buffs.mspeed); }

function updateHud() {
  scoreEl.textContent = score; waveEl.textContent = wave; squadEl.textContent = player.life; weaponEl.textContent = weapon().name;
  let h = ""; for (let i = 0; i < player.maxLife; i++) h += `<div class="pip${i < player.life ? "" : " off"}"></div>`;
  pipsEl.innerHTML = h;
}

// ============================================================
//  升级（RPG 大池）
// ============================================================
function buildChoices() {
  const pool = [];
  if (player.weaponLevel < WEAPONS.length - 1) { const nw = WEAPONS[player.weaponLevel + 1]; pool.push({ tag: "武器", icon: "🔫", cls: "common", name: nw.name, desc: "换更强武器，提升伤害与射速。", apply: () => { player.weaponLevel += 1; } }); }
  if (player.vehicleLevel < VEHICLES.length - 1) { const nv = VEHICLES[player.vehicleLevel + 1]; pool.push({ tag: "载具", icon: "🛻", cls: "common", name: nv.name, desc: "换更快载具，移动更灵活。", apply: () => { player.vehicleLevel += 1; } }); }
  if (player.life < 8) pool.push({ tag: "扩编", icon: "🧑‍🤝‍🧑", cls: "common", name: "扩编 +1人", desc: "生命+1，多一名并肩枪手。", apply: () => { player.maxLife += 1; player.life += 1; } });
  // 属性
  for (const id in STATS) {
    if (player.buffs[id] < STATS[id].max) {
      const rar = pickRarity(); const gain = Math.min(STATS[id].max - player.buffs[id], RARITY[rar].c);
      const S = STATS[id];
      pool.push({ tag: "属性·" + RARITY[rar].label, icon: S.icon, cls: rar, name: `${S.name} +${gain}`, desc: `${S.desc}（Lv${player.buffs[id]}→${player.buffs[id] + gain}）`, apply: (() => { const k = id, g = gain; return () => { player.buffs[k] = Math.min(STATS[k].max, player.buffs[k] + g); }; })() });
    }
  }
  // 机制
  for (const [id, nm, ic, ds] of MODLIST) { if (!player.mods[id]) pool.push({ tag: "机制·史诗", icon: ic, cls: "epic", name: nm, desc: ds, apply: () => { player.mods[id] = true; } }); }
  // 复活
  if (player.revive < 2) { const rar = pickRarity(); pool.push({ tag: "保命·" + RARITY[rar].label, icon: "✟", cls: rar, name: `复活 +1`, desc: "死亡时自动复活（叠充能，当前" + player.revive + "）", apply: () => { player.revive = Math.min(2, player.revive + 1); } }); }
  // 无人机
  if (player.drones < 3) pool.push({ tag: "召唤·史诗", icon: "🛸", cls: "epic", name: `无人机 +1`, desc: "召唤一架环绕自动射击的无人机（当前" + player.drones + "）", apply: () => { player.drones += 1; } });
  // 武器专精
  const lvl = player.weaponLevel;
  if (SPECS[lvl] && !player.specs[lvl]) pool.push({ tag: "专精·史诗", icon: "★", cls: "epic", name: SPECS[lvl].name, desc: SPECS[lvl].desc, apply: () => { SPECS[lvl].apply(); player.specs[lvl] = true; } });

  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, waveMod.choices);
}
function openUpgrade() {
  state = "upgrade"; sfx.upgrade();
  const c = buildChoices(); upgradeCards.innerHTML = "";
  c.forEach(o => { const el = document.createElement("div"); el.className = "up-card " + o.cls; el.innerHTML = `<div class="up-icon">${o.icon}</div><div class="up-name">${o.name}</div><div class="up-tag">${o.tag}</div><div class="up-desc">${o.desc}</div>`; el.addEventListener("click", () => applyChoice(o)); upgradeCards.appendChild(el); });
  const next = upgradesDone + 1; const rem = upgradePerBoss - (next % upgradePerBoss);
  upgradeHint.textContent = `已强化 ${next - 1} 次 · 再 ${rem % upgradePerBoss || upgradePerBoss} 次将出现酋长`;
  upgradeEl.classList.remove("hidden");
}
function applyChoice(o) {
  o.apply(); upgradesDone += 1; kills = 0; killTarget = Math.round(killTarget * 1.25) + 4;
  if (upgradesDone % upgradePerBoss === 0) bossPending = true;
  if (player.life > player.maxLife) player.life = player.maxLife;
  waveMod = rollMod(); applyBiome();
  banner("词缀: " + waveMod.name, 1.4, "#b08aff");
  upgradeEl.classList.add("hidden"); updateHud(); state = "playing"; lastTime = performance.now();
  burst(player.x, player.y - 30, "#7afa55", 26);
}

// ============================================================
//  生成 / 射击 / 投掷
// ============================================================
function makeEnemy(type, x, y) {
  const t = TYPES[type];
  const w = wave, late = Math.max(0, w - 1), w1 = w - 1;
  const pressure = Math.max(0, player.life * (WEAPONS[player.weaponLevel].dmg + player.buffs.dmg) - 3);
  let base;
  if (type === "boss") base = t.hp + w * 52 + upgradesDone * 28 + pressure * 8;
  else if (t.tank) base = t.hp + w1 * 1.5 + pressure * 0.6;
  else if (type === "shielder") base = t.hp + w1 * 0.9 + pressure * 0.4;
  else if (type === "shaman") base = t.hp + w1 * 0.8 + pressure * 0.4;
  else base = t.hp + w1 * 0.55 + pressure * 0.3;
  const hp = Math.max(1, Math.round(base * (1 + w1 * 0.05 + w1 * w1 * 0.0035) * waveMod.hpMul));
  const e = { type, x, y, hp, maxHp: hp, speed: (t.speed + w * 1.4) * waveMod.speedMul, r: t.r, skin: t.skin, baseScale: t.scale, reward: t.reward, anim: Math.random() * 10, hitFlash: 0, wob: Math.random() * 6, wind: 0, armor: (t.armor || 0) + Math.floor(w / 3), burn: null, slowT: 0 };
  if (t.ranged) { e.ranged = true; e.throwTimer = 1.6 + Math.random() * 2; }
  if (t.shield || waveMod.shieldAll) { e.shieldMax = Math.round((t.shield || 4) + w * 0.7); e.shieldHp = e.shieldMax; e.shieldDown = 0; }
  if (t.healer) { e.healTimer = 2.4 + Math.random(); e.holdY = horizonY + (H - horizonY) * (0.30 + Math.random() * 0.15); }
  if (t.explode) { e.blast = t.blast; }
  if (t.enrage) { e.enraged = false; }
  if (waveMod.rage && t.enrage) e.enraged = true;
  if (waveMod.eliteChance && Math.random() < waveMod.eliteChance) { e.elite = true; e.hp = Math.round(e.hp * 2.5); e.maxHp = e.hp; e.armor += 2; e.baseScale *= 1.25; e.reward = Math.round(e.reward * 2); }
  if (type === "boss") { e.throwTimer = 2.2; e.phase2 = false; e.summonTimer = 999; e.slamTimer = 999; e.holdY = H * 0.42; e.bossKind = bossesDefeated % 4; }
  return e;
}
function pickType() {
  const pool = ["savage", "savage", "savage", "savage", "savage"];
  if (wave >= 2) pool.push("scout", "scout", "scout");
  if (wave >= 3) pool.push("brute", "brute", "shielder", "shielder");
  if (wave >= 4) pool.push("shaman", "shaman");
  if (wave >= 5) pool.push("bomber", "bomber", "bomber");
  if (wave >= 6) pool.push("berserker", "berserker");
  return pool[(Math.random() * pool.length) | 0];
}
function spawnSavage(forceBoss) {
  if (forceBoss) { const e = makeEnemy("boss", W / 2 + (Math.random() * 80 - 40), horizonY + 8); enemies.push(e); bossActive = true; banner(BOSS_NAMES[e.bossKind] + "!", 1.3, "#ff4a3a"); sfx.boss(); screenShake = 12; return; }
  const type = pickType();
  const y0 = horizonY + (H - horizonY) * 0.16 + Math.random() * 26;
  const margin = W * 0.12;
  enemies.push(makeEnemy(type, margin + Math.random() * (W - margin * 2), y0));
}
function squadSlots() {
  const slots = []; const n = Math.max(1, player.life);
  if (n === 1) slots.push({ x: player.x, y: player.y });
  else for (let i = 0; i < n; i++) slots.push({ x: player.x + (i - (n - 1) / 2) * 48, y: player.y });
  return slots;
}
function fire() {
  const w = effWeapon(); const slots = squadSlots();
  const critChance = 0.08 * player.buffs.crit;
  for (const sl of slots) {
    for (let i = 0; i < w.count; i++) {
      const t = w.count === 1 ? 0 : (i / (w.count - 1) - 0.5);
      const sp = w.spread;
      const ang = -Math.PI / 2 + t * sp + (Math.random() - 0.5) * sp * 0.5;
      const crit = Math.random() < critChance;
      bullets.push({
        x: sl.x + (Math.random() - 0.5) * 4, y: sl.y - 60,
        vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed,
        r: w.size * (crit ? 1.7 : 1), dmg: w.dmg * (crit ? 2 : 1),
        color: crit ? "#ff5a3a" : w.color, pierce: w.pierce, hit: new Set(), kind: w.kind, crit,
        explosive: player.mods.explosive, burn: player.mods.burn, homing: player.mods.homing, chain: player.mods.chain
      });
    }
  }
  muzzle = 0.05; player.recoil = Math.max(player.recoil, 0.2); sfx.shoot();
  if (w.count >= 5) screenShake = Math.max(screenShake, 5);
  else if (w.kind === "tracer") screenShake = Math.max(screenShake, 2.5);
}
function throwAt(e) {
  const tx = player.x, ty = player.y - 30;
  const dx = tx - e.x, dy = ty - (e.y - e.r);
  const base = Math.atan2(dy, dx);
  const fan = (e.type === "boss" && e.phase2) ? [-0.34, -0.17, 0, 0.17, 0.34] : [0];
  const sp = e.type === "boss" ? 470 : 420;
  for (const off of fan) enemyBullets.push({ x: e.x, y: e.y - e.r, vx: Math.cos(base + off) * sp, vy: Math.sin(base + off) * sp, r: 7, life: 4 });
  telegraphs.push({ x1: e.x, y1: e.y - e.r, x2: e.x + Math.cos(base) * 700, y2: e.y + Math.sin(base) * 700, life: 0.32, max: 0.32 });
  sfx.throw();
}
function explode(e) {
  burst(e.x, e.y, "#ff7a2a", 30); burst(e.x, e.y, "#ffd060", 18);
  decals.push({ x: e.x, y: e.y, r: 34, a: 0.5 });
  screenShake = Math.max(screenShake, 9); sfx.kill();
  if (Math.hypot(e.x - player.x, e.y - player.y) < (e.blast || 80) + 18) damagePlayer(DMG_EXPLODE, e.x);
}

// ============================================================
//  粒子 / 飘字 / 横幅
// ============================================================
function burst(x, y, color, count) { for (let i = 0; i < count; i++) { const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 240; particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 1.5 + Math.random() * 3.2, life: 0.3 + Math.random() * 0.45, max: 0.75, color }); } }
function leafBurst(x, y) { burst(x, y, "#5aa83a", 10); for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 120; particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, r: 2 + Math.random() * 2, life: 0.6 + Math.random() * 0.5, max: 1.1, color: Math.random() < 0.5 ? "#7ac84a" : "#3a7a2a" }); } }
function floatText(t, x, y, color, size) { floatTexts.push({ text: t, x, y, color, size: size || 18, life: 1.0, max: 1.0, vy: -52 }); }
function banner(t, time, color) { bannerText = t; bannerTotal = time || 1.2; bannerTime = bannerTotal; bannerColor = color || "#ffe14a"; }

function updateAmbient(dt) {
  const b = BIOMES[curBiome]; const now = performance.now();
  if (b.ambient === "leaves" && Math.random() < 0.15) { ambient.push({ x: Math.random() * W, y: horizonY - 10, vx: 8 + Math.random() * 16, vy: 2 + Math.random() * 4, r: 3 + Math.random() * 3, life: 2 + Math.random(), max: 3, color: Math.random() < 0.5 ? "#5a9a3a" : "#3a7a2a", rot: Math.random() * 6 }); }
  if (b.ambient === "rain" && Math.random() < 0.6) { ambient.push({ x: Math.random() * W, y: -5, vx: -20 + Math.random() * 8, vy: 180 + Math.random() * 80, r: 1, life: 1.2 + Math.random() * 0.6, max: 1.8, color: "rgba(180,200,220,0.5)", rot: 0 }); }
  if (b.ambient === "embers" && Math.random() < 0.3) { const x = Math.random() * W; ambient.push({ x, y: horizonY + (H - horizonY) * (0.2 + Math.random() * 0.6), vx: (Math.random() - 0.5) * 20, vy: -60 - Math.random() * 40, r: 2 + Math.random() * 3, life: 1.0 + Math.random() * 0.8, max: 1.8, color: Math.random() < 0.5 ? "#ff7a3a" : "#ffb040", rot: Math.random() * 6 }); }
  for (let i = ambient.length - 1; i >= 0; i--) { const a = ambient[i]; a.x += a.vx * dt; a.y += a.vy * dt; a.life -= dt; if (a.life <= 0 || a.y > H) ambient.splice(i, 1); }
}

// ============================================================
//  更新
// ============================================================
function update(dt) {
  screenShake = Math.max(0, screenShake - dt * 22);
  muzzle = Math.max(0, muzzle - dt);
  bannerTime = Math.max(0, bannerTime - dt);
  freezeTimer = Math.max(0, freezeTimer - dt);
  comboTimer -= dt; if (comboTimer <= 0 && combo > 0) { floatText(`COMBO x${combo} 结束`, W / 2, H * 0.18, "#8eff7a", 18); combo = 0; }
  for (let i = telegraphs.length - 1; i >= 0; i--) { telegraphs[i].life -= dt; if (telegraphs[i].life <= 0) telegraphs.splice(i, 1); }
  for (let i = bolts.length - 1; i >= 0; i--) { bolts[i].life -= dt; if (bolts[i].life <= 0) bolts.splice(i, 1); }
  for (let i = shocks.length - 1; i >= 0; i--) { shocks[i].life -= dt; if (shocks[i].life <= 0) shocks.splice(i, 1); }
  updateParticles(dt); updateFloats(dt);
  if (state !== "playing") return;
  player.inv = Math.max(0, player.inv - dt);
  if (player.mods.shield) player.shieldT = Math.max(0, player.shieldT - dt);
  player.recoil = Math.max(0, player.recoil - dt * 8);
  player.animTime += dt;
  updateAmbient(dt);
  if (freezeTimer > 0) return;

  movePlayer(dt);
  updateDrones(dt);
  player.fireTimer -= dt;
  if (player.fireTimer <= 0) { fire(); player.fireTimer = effWeapon().rate; }

  const hasBoss = enemies.some(e => e.type === "boss");
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    if (bossPending && !hasBoss) { spawnSavage(true); bossPending = false; spawnTimer = 2.4; }
    else if (!hasBoss) {
      let extra;
      if (wave <= 2) extra = 1;
      else extra = 2 + Math.min(4, wave - 2);
      if (wave >= 5 && Math.random() < 0.4) extra += 2;
      extra = Math.max(1, Math.round(extra * waveMod.spawnMul));
      for (let i = 0; i < extra; i++) spawnSavage(false);
      spawnTimer = Math.max(0.35, 1.35 - wave * 0.06);
    }
    else spawnTimer = 1.4;
  }

  updateBullets(dt); updateEnemies(dt); updateEnemyBullets(dt); updateHazards(dt); collisions(); updateHud();
}
function movePlayer(dt) {
  const ox = player.x;
  player.moving = false;
  const spd = player.speed * moveMul();
  if (pointerActive) {
    const dx = pointerTarget.x - player.x, dy = pointerTarget.y - player.y, d = Math.hypot(dx, dy);
    if (d > 3) {
      const k = 1 - Math.exp(-20 * moveMul() * dt);  // 平滑跟手；载具/移速buff → 更跟手
      player.x += dx * k; player.y += dy * k; player.moving = true;
    } else if (d > 0.5) {
      player.x = pointerTarget.x; player.y = pointerTarget.y;  // 近距离吸附防抖
    }
  } else {
    let dx = 0, dy = 0;
    if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
    if (keys.has("arrowright") || keys.has("d")) dx += 1;
    if (keys.has("arrowup") || keys.has("w")) dy -= 1;
    if (keys.has("arrowdown") || keys.has("s")) dy += 1;
    if (dx || dy) { const l = Math.hypot(dx, dy); player.x += dx / l * spd * dt; player.y += dy / l * spd * dt; player.moving = true; }
  }
  player.x = Math.max(46, Math.min(W - 46, player.x));
  player.y = Math.max(horizonY + 70, Math.min(H - 80, player.y));
  player.vx = player.vx * 0.6 + (player.x - ox) / Math.max(dt, 0.001) * 0.4;
  if (player.moving && Math.random() < 0.4) particles.push({ x: player.x + (Math.random() - 0.5) * 18, y: player.y + 4, vx: (Math.random() - 0.5) * 24, vy: -12 - Math.random() * 22, r: 1.5 + Math.random() * 1.5, life: 0.3 + Math.random() * 0.2, max: 0.5, color: "rgba(180,160,120,0.5)" });
}
function updateDrones(dt) {
  if (player.drones <= 0) return;
  player.droneTimer -= dt;
  if (player.droneTimer <= 0) {
    player.droneTimer = 0.45;
    const w = effWeapon();
    for (let d = 0; d < player.drones; d++) {
      const ang = performance.now() * 0.001 + d * (Math.PI * 2 / player.drones);
      const dx = player.x + Math.cos(ang) * 46, dy = player.y - 30 + Math.sin(ang) * 30;
      let tgt = null, bd = 1e9; for (const e of enemies) { const dd = Math.hypot(e.x - dx, e.y - dy); if (dd < bd) { bd = dd; tgt = e; } }
      if (tgt && bd < 560) { const a = Math.atan2(tgt.y - dy, tgt.x - dx); bullets.push({ x: dx, y: dy, vx: Math.cos(a) * w.speed * 0.85, vy: Math.sin(a) * w.speed * 0.85, r: Math.max(2.4, w.size * 0.8), dmg: Math.max(1, Math.round(w.dmg * 0.6)), color: "#9affb0", pierce: 0, hit: new Set(), kind: "tracer" }); sfx.shoot(); }
    }
  }
}
function angleDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (b.homing) { let tgt = null, bd = 1e9; for (const e of enemies) { if (b.hit.has(e)) continue; const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < bd) { bd = d; tgt = e; } } if (tgt && bd < 440) { const ta = Math.atan2(tgt.y - b.y, tgt.x - b.x); const ca = Math.atan2(b.vy, b.vx); const sp = Math.hypot(b.vx, b.vy); const na = ca + Math.max(-0.13, Math.min(0.13, angleDiff(ta, ca))); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; } }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < horizonY - 40 || b.x < -40 || b.x > W + 40 || b.y > H + 40) bullets.splice(i, 1);
  }
}
function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.anim += dt * (e.type === "scout" || e.type === "bomber" ? 15 : 9);
    e.wob += dt;
    const margin = W * 0.12;
    let spd = e.speed;
    if (e.enraged) spd *= 2.1;
    if (e.slowT > 0) { spd *= 0.5; e.slowT -= dt; }
    if (e.type === "shaman" && e.y >= e.holdY) spd *= 0.15;
    if (e.type === "boss" && e.holdY !== undefined && e.y >= e.holdY) spd = 0;
    e.y += spd * dt;
    e.x += Math.sin(e.wob * 1.5) * 8 * dt;
    e.x += Math.sign(player.x - e.x) * (e.type === "bomber" ? 28 : 10) * dt;
    e.x = Math.max(margin, Math.min(W - margin, e.x));
    // 燃烧 DoT
    if (e.burn) { e.burn.t -= dt; e.hp -= e.burn.dps * dt; e.hitFlash = Math.max(e.hitFlash, 0.04); if (Math.random() < 0.3) particles.push({ x: e.x + (Math.random() - 0.5) * 16, y: e.y - 20 - Math.random() * 20, vx: 0, vy: -30, r: 1.5, life: 0.3, max: 0.3, color: "#ff7a2a" }); if (e.burn.t <= 0) e.burn = null; }
    // 狂战暴怒
    if (e.enrage !== undefined && !e.enraged && e.hp <= e.maxHp * 0.5) { e.enraged = true; floatText("暴怒!", e.x, e.y - 34, "#ff3a2a", 16); burst(e.x, e.y - 20, "#ff3a2a", 14); }
    // 盾牌再生
    if (e.shieldMax && e.shieldHp <= 0) { e.shieldDown -= dt; if (e.shieldDown <= 0) e.shieldHp = e.shieldMax; }
    // 萨满治疗
    if (e.healer) {
      e.healTimer -= dt;
      if (e.healTimer <= 0) { e.healTimer = 2.6; let n = 0; for (const o of enemies) { if (o === e || o.type === "boss") continue; if (Math.hypot(o.x - e.x, o.y - e.y) < 180 && o.hp < o.maxHp) { o.hp = Math.min(o.maxHp, o.hp + 3 + wave); n++; } } if (n) { floatText("治疗!", e.x, e.y - 34, "#7aff8a", 15); burst(e.x, e.y - 20, "#7aff8a", 12); } }
    }
    // 投掷
    if (e.ranged && e.y > horizonY + 40) {
      e.throwTimer -= dt; e.wind = Math.max(0, e.wind - dt);
      if (e.throwTimer <= 0) { e.wind = 0.45; throwAt(e); e.throwTimer = (e.type === "boss" ? (e.phase2 ? 1.4 : 2.0) : 2.4) + Math.random(); }
    }
    // Boss 二阶段
    if (e.type === "boss" && !e.phase2 && e.hp <= e.maxHp * 0.5) { e.phase2 = true; e.summonTimer = 1.5; e.slamTimer = 2.6; e.speed += 6; banner("BOSS 狂怒!", 1.4); screenShake = 14; sfx.boss(); burst(e.x, e.y - 40, "#ff3a2a", 40); }
    if (e.type === "boss" && e.phase2) {
      e.summonTimer -= dt;
      if (e.summonTimer <= 0) { e.summonTimer = 4.5; for (let k = 0; k < 2; k++) enemies.push(makeEnemy(Math.random() < 0.5 ? "savage" : "scout", e.x + (Math.random() * 80 - 40), e.y + 20)); floatText("召唤!", e.x, e.y - 60, "#ff9a3a", 16); }
      e.slamTimer -= dt;
      if (e.slamTimer <= 0) { e.slamTimer = 4.0; hazards.push({ x: player.x, y: player.y, r: 66, timer: 1.5, max: 1.5 }); tone(300, 0.3, "square", 0.1, 720); }
    }
    // 自爆者接触玩家
    if (e.blast && Math.hypot(e.x - player.x, e.y - player.y) < e.r * ENEMY_SCALE * e.baseScale + 22) { explode(e); e.hp = 0; }
    // 越过防线
    if (e.y - e.r * ENEMY_SCALE * e.baseScale >= coreY) {
      if (e.blast) explode(e); else { damagePlayer(e.type === "boss" ? DMG_BOSS : DMG_HIT, e.x); leafBurst(e.x, coreY); }
      if (e.type === "boss") bossActive = false;
      e.hp = 0;
    }
  }
  updateHazards(dt);
}
function updateHazards(dt) {
  for (let i = hazards.length - 1; i >= 0; i--) { const h = hazards[i]; h.timer -= dt; if (h.timer <= 0) { burst(h.x, h.y, "#ff5a2a", 26); burst(h.x, h.y, "#ffd060", 14); screenShake = Math.max(screenShake, 8); sfx.kill(); tone(120, 0.2, "sawtooth", 0.2, 50); if (Math.hypot(h.x - player.x, h.y - player.y) < h.r) damagePlayer(DMG_SLAM, h.x); hazards.splice(i, 1); } }
}
function updateEnemyBullets(dt) {
  for (let i = enemyBullets.length - 1; i >= 0; i--) { const b = enemyBullets[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if (b.life <= 0 || b.y > H + 30 || b.x < -40 || b.x > W + 40) { enemyBullets.splice(i, 1); continue; } if (player.inv <= 0 && Math.hypot(b.x - player.x, b.y - player.y) < 22) { enemyBullets.splice(i, 1); damagePlayer(DMG_HIT, b.x); } }
}
function damagePlayer(amount, srcX) {
  if (player.inv > 0) return;
  if (player.mods.shield && player.shieldT <= 0) { player.shieldT = 6; player.inv = 0.8; floatText("护盾!", player.x, player.y - 60, "#8ee0ff", 18); burst(player.x, player.y - 30, "#8ee0ff", 20); return; }
  player.hp -= amount; player.inv = 0.7; screenShake = Math.max(screenShake, 8); sfx.hurt();
  if (srcX !== undefined) { player.x += Math.sign(player.x - srcX) * 26 + (Math.random() - 0.5) * 6; player.x = Math.max(46, Math.min(W - 46, player.x)); }
  floatText(`-${amount}`, player.x, player.y - 60, "#ff5a5a", 20);
  if (player.hp <= 0) {
    player.life -= 1;
    if (player.life <= 0) { tryRevive(); return; }
    player.hp = player.maxHp; player.inv = 1.4;
    floatText("倒下! 下一位上阵", player.x, player.y - 74, "#ffd060", 16);
    burst(player.x, player.y - 30, "#ffd060", 18);
  }
  updateHud();
}
function tryRevive() {
  if (player.revive > 0) {
    player.revive -= 1; player.life = 1; player.hp = player.maxHp; player.inv = 3; banner("复活!", 1.4); sfx.clear(); screenShake = 12;
    for (const e of enemies) if (Math.hypot(e.x - player.x, e.y - player.y) < 200) e.hp = 0;
    burst(player.x, player.y - 30, "#ffe14a", 40); floatText("复活!", player.x, player.y - 80, "#ffe14a", 24); updateHud();
  } else gameOver();
}

// ============================================================
//  击杀 / 伤害
// ============================================================
function killEnemy(e) {
  combo += 1; comboTimer = COMBO_WIN;
  const mult = (1 + Math.min(combo, 30) * 0.1) * waveMod.scoreMul;
  const gained = Math.round(e.reward * mult);
  score += gained;
  if (e.blast) explode(e); else { leafBurst(e.x, e.y); sfx.kill(); }
  floatText(`+${gained}`, e.x, e.y, combo >= 3 ? "#ffe14a" : "#bdf24a", e.type === "boss" ? 28 : 17);
  if (combo >= 3) floatText(`x${combo}`, e.x + 26, e.y - 18, "#ff9a3a", 18);
  freezeTimer = e.type === "boss" ? 0.14 : 0.045;
  if (player.mods.lifesteal && Math.random() < 0.25 && player.hp < player.maxHp) { player.hp = Math.min(player.maxHp, player.hp + 18); floatText("+血", player.x, player.y - 74, "#7aff8a", 14); }
  if (e.type === "boss") { bossActive = false; bossesDefeated += 1; wave += 1; screenShake = 14; banner("WAVE " + wave, 1.4, "#8eff7a"); sfx.clear(); }
  else kills += 1;
}
function splashDamage(cx, cy, radius, dmg) {
  for (const o of enemies) { if (o === cx) continue; const d = Math.hypot(o.x - cx, o.y - cy); if (d < radius) { const dd = Math.max(1, Math.round(dmg * 0.6) - (o.armor || 0)); o.hp -= dd; o.hitFlash = 0.09; } }
  burst(cx, cy, "#ff7a2a", 16);
  shocks.push({ x: cx.x, y: cx.y - 20, r: radius, life: 0.32, max: 0.32 });
}
function makeBolt(x1, y1, x2, y2) {
  const pts = [{ x: x1, y: y1 }]; const segs = 7; const dx = x2 - x1, dy = y2 - y1; const len = Math.hypot(dx, dy) || 1; const nx = -dy / len, ny = dx / len; const jit = Math.min(18, len * 0.18);
  for (let i = 1; i < segs; i++) { const t = i / segs; const mx = x1 + dx * t, my = y1 + dy * t; const off = (Math.random() - 0.5) * jit; pts.push({ x: mx + nx * off, y: my + ny * off }); }
  pts.push({ x: x2, y: y2 }); return pts;
}
function chainDamage(srcE, dmg) {
  let tgt = null, bd = 160; for (const o of enemies) { if (o === srcE || o.hp <= 0) continue; const d = Math.hypot(o.x - srcE.x, o.y - srcE.y); if (d < bd) { bd = d; tgt = o; } }
  if (tgt) {
    const dd = Math.max(1, Math.round(dmg * 0.7) - (tgt.armor || 0)); tgt.hp -= dd; tgt.hitFlash = 0.09; burst(tgt.x, tgt.y, "#bff", 6);
    bolts.push({ pts: makeBolt(srcE.x, srcE.y - 20, tgt.x, tgt.y - 20), life: 0.2, max: 0.2 });
  }
}
function collisions() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; let used = false;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (b.hit.has(e) || e.hp <= 0) continue;
      const sc = ENEMY_SCALE * e.baseScale; const rad = e.r * sc;
      if (Math.hypot(b.x - e.x, b.y - e.y) < rad + b.r) {
        b.hit.add(e);
        // 盾牌格挡
        if (e.shieldMax && e.shieldHp > 0) {
          e.shieldHp -= b.dmg; e.hitFlash = 0.09; burst(b.x, b.y, "#8ee0ff", 5); sfx.hit();
          floatText("格挡", b.x, b.y - 8, "#8ee0ff", 11);
          if (e.shieldHp <= 0) { e.shieldDown = 1.6; floatText("破盾!", e.x, e.y - rad * 1.5, "#8ee0ff", 16); burst(e.x, e.y - rad, "#8ee0ff", 12); }
          used = true; break;
        }
        const armor = e.armor || 0;
        const dmg = Math.max(1, b.dmg - armor);
        e.hp -= dmg; e.hitFlash = 0.09;
        burst(b.x, b.y, b.crit ? "#ff5a3a" : "#ffd060", b.crit ? 7 : 4); sfx.hit();
        floatText(b.crit ? `暴击 ${dmg}!` : (armor > 0 ? `${dmg}(减${armor})` : `${dmg}`), b.x, b.y - 8, b.crit ? "#ff5a3a" : "#fff", b.crit ? 15 : 13);
        if (b.burn) e.burn = { t: 2.5, dps: 2 + player.buffs.dmg };
        if (player.mods.slow) e.slowT = 1.2;
        if (b.explosive) splashDamage(e, e, 70, b.dmg);
        if (b.chain) chainDamage(e, b.dmg);
        if (b.pierce > 0) b.pierce -= 1; else used = true;
        if (used) break;
      }
    }
    if (used) bullets.splice(i, 1);
  }
  // 自爆者撞击玩家
  for (let j = enemies.length - 1; j >= 0; j--) {
    const e = enemies[j]; if (e.hp <= 0) continue; const rad = e.r * ENEMY_SCALE * e.baseScale;
    if (Math.hypot(e.x - player.x, e.y - player.y) < rad + 20) {
      if (e.blast) { explode(e); e.hp = 0; continue; }
      leafBurst(e.x, e.y); e.hp = 0;
      if (e.type === "boss") bossActive = false;
      damagePlayer(DMG_HIT, e.x);
    }
  }
  // 清理死亡敌人
  for (let j = enemies.length - 1; j >= 0; j--) { if (enemies[j].hp <= 0) { killEnemy(enemies[j]); enemies.splice(j, 1); } }
  if (state === "playing" && kills >= killTarget && !bossPending && !bossActive) openUpgrade();
}
function updateParticles(dt) { for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; p.vy = p.vy * 0.985 + 30 * dt; p.life -= dt; if (p.life <= 0) particles.splice(i, 1); } }
function updateFloats(dt) { for (let i = floatTexts.length - 1; i >= 0; i--) { const f = floatTexts[i]; f.y += f.vy * dt; f.life -= dt; if (f.life <= 0) floatTexts.splice(i, 1); } }

// ============================================================
//  静态地面
// ============================================================
const groundCanvas = document.createElement("canvas");
groundCanvas.width = W; groundCanvas.height = H;
const gctx = groundCanvas.getContext("2d");
function rr(g, x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); }
function gShadow(g, x, y, rx, ry) { g.fillStyle = "rgba(0,0,0,0.32)"; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
function drawPalm(g, x, y, sc, leafColor) { gShadow(g, x - 4 * sc, y + 6 * sc, 24 * sc, 10 * sc); g.save(); g.translate(x, y); g.strokeStyle = "#5a3a1e"; g.lineWidth = 7 * sc; g.lineCap = "round"; g.beginPath(); g.moveTo(0, 6 * sc); g.quadraticCurveTo(-6 * sc, -30 * sc, 0, -64 * sc); g.stroke(); g.fillStyle = leafColor || "#3f7a2a"; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.5; g.save(); g.translate(0, -64 * sc); g.rotate(a); g.beginPath(); g.ellipse(28 * sc, 0, 30 * sc, 8 * sc, 0, 0, Math.PI * 2); g.fill(); g.restore(); } g.fillStyle = "#2f5a1e"; g.beginPath(); g.arc(0, -64 * sc, 6 * sc, 0, Math.PI * 2); g.fill(); g.restore(); }
function drawFern(g, x, y, sc) { gShadow(g, x, y + 3 * sc, 16 * sc, 5 * sc); g.save(); g.translate(x, y); g.strokeStyle = "#3a8a2a"; g.lineWidth = 3 * sc; g.lineCap = "round"; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(i * 8 * sc, -16 * sc, i * 16 * sc, -26 * sc); g.stroke(); } g.restore(); }
function drawRock(g, x, y, sc) { gShadow(g, x - 3 * sc, y + 4 * sc, 20 * sc, 7 * sc); g.save(); g.translate(x, y); g.fillStyle = "#6a6a64"; g.beginPath(); g.moveTo(-18 * sc, 2 * sc); g.lineTo(-10 * sc, -12 * sc); g.lineTo(6 * sc, -14 * sc); g.lineTo(18 * sc, -2 * sc); g.lineTo(12 * sc, 4 * sc); g.closePath(); g.fill(); g.fillStyle = "#84847c"; g.beginPath(); g.moveTo(-10 * sc, -12 * sc); g.lineTo(2 * sc, -10 * sc); g.lineTo(6 * sc, -14 * sc); g.closePath(); g.fill(); g.restore(); }
function drawTotem(g, x, y, sc) { gShadow(g, x - 3 * sc, y + 4 * sc, 8 * sc, 4 * sc); g.save(); g.translate(x, y); g.fillStyle = "#4a3220"; g.fillRect(-3 * sc, -44 * sc, 6 * sc, 44 * sc); g.fillStyle = "#e8e6dc"; g.beginPath(); g.arc(0, -48 * sc, 9 * sc, 0, Math.PI * 2); g.fill(); g.fillStyle = "#1a0e08"; g.fillRect(-4 * sc, -50 * sc, 2 * sc, 2 * sc); g.fillRect(2 * sc, -50 * sc, 2 * sc, 2 * sc); g.fillRect(-3 * sc, -45 * sc, 6 * sc, 1.5 * sc); g.fillStyle = "#c0392b"; g.fillRect(-3 * sc, -36 * sc, 6 * sc, 4 * sc); g.restore(); }
function drawBannerProp(g, x, y, sc) { g.save(); g.translate(x, y); g.fillStyle = "#5a3a1e"; g.fillRect(-2 * sc, -50 * sc, 4 * sc, 50 * sc); g.fillStyle = "#c0392b"; g.beginPath(); g.moveTo(2 * sc, -50 * sc); g.lineTo(26 * sc, -42 * sc); g.lineTo(2 * sc, -34 * sc); g.closePath(); g.fill(); g.restore(); }
function drawDeadTree(g, x, y, sc) { g.save(); g.translate(x, y); g.scale(sc, sc); g.strokeStyle = "#3a2a1a"; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -60 + Math.random() * 8 - 4); g.stroke(); g.beginPath(); g.moveTo(0, -35); g.lineTo(-14, -50 + Math.random() * 8); g.stroke(); g.beginPath(); g.moveTo(0, -40); g.lineTo(12, -52 + Math.random() * 8); g.stroke(); g.restore(); }
function drawRuin(g, x, y, sc) { g.save(); g.translate(x, y); g.scale(sc, sc); g.fillStyle = "#5a4a3a"; g.fillRect(-12, -32, 24, 32); g.fillStyle = "#4a3a2a"; g.fillRect(-14, -24, 4, 16); g.fillRect(10, -20, 4, 12); g.restore(); }
function buildGround() {
  const b = BIOMES[curBiome];
  const g = gctx; g.clearRect(0, 0, W, H);
  const gg = g.createLinearGradient(0, horizonY, 0, H); gg.addColorStop(0, b.ground); gg.addColorStop(1, "#1c3a16");
  g.fillStyle = gg; g.fillRect(0, horizonY, W, H - horizonY);
  for (let i = 0; i < 600; i++) { const yy = horizonY + Math.random() * (H - horizonY); g.fillStyle = `rgba(${40 + Math.random() * 40},${90 + Math.random() * 50},${30 + Math.random() * 30},0.4)`; g.fillRect(Math.random() * W, yy, 2, 2); }
  g.save();
  g.beginPath();
  g.moveTo(W / 2 - roadHalf(horizonY), horizonY); g.lineTo(W / 2 + roadHalf(horizonY), horizonY);
  g.lineTo(W / 2 + roadHalf(H), H); g.lineTo(W / 2 - roadHalf(H), H); g.closePath(); g.clip();
  const dg = g.createLinearGradient(0, horizonY, 0, H); dg.addColorStop(0, b.dirt[0]); dg.addColorStop(1, b.dirt[1]);
  g.fillStyle = dg; g.fillRect(0, horizonY, W, H - horizonY);
  for (let i = 0; i < 2200; i++) { const yy = horizonY + Math.random() * (H - horizonY); const sc = scaleAt(yy); const half = roadHalf(yy); const xx = W / 2 + (Math.random() * 2 - 1) * half; const v = 30 + Math.random() * 50; g.fillStyle = `rgba(${v + 30},${v + 10},${v - 10},${0.3 + sc * 0.3})`; g.fillRect(xx, yy, 2 * sc, 2 * sc); }
  for (let i = 0; i < 30; i++) { const yy = horizonY + 30 + (i * 53) % (H - horizonY - 40); const half = roadHalf(yy); const xx = W / 2 + ((i * 97) % (half * 2)) - half; const sc = scaleAt(yy); g.fillStyle = "rgba(60,50,40,0.6)"; g.beginPath(); g.ellipse(xx, yy, 8 * sc, 4 * sc, 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
  g.strokeStyle = "#3a8a2a"; g.lineWidth = 2;
  for (let i = 0; i < 80; i++) { const yy = horizonY + 10 + Math.random() * (H - horizonY - 10); const sc = scaleAt(yy); const off = roadHalf(yy) + 4 + Math.random() * 30; for (const s of [-1, 1]) { const xx = W / 2 + s * off; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + s * 2, yy - 6 * sc); g.stroke(); } }
  const props = [
    { k: "palm", x: W * 0.08, y: H * 0.50 }, { k: "palm", x: W * 0.94, y: H * 0.42 }, { k: "palm", x: W * 0.97, y: H * 0.74 }, { k: "palm", x: W * 0.04, y: H * 0.80 },
    { k: "fern", x: W * 0.22, y: H * 0.55 }, { k: "fern", x: W * 0.78, y: H * 0.68 }, { k: "fern", x: W * 0.30, y: H * 0.82 }, { k: "fern", x: W * 0.70, y: H * 0.50 },
    { k: "rock", x: W * 0.40, y: H * 0.50 }, { k: "rock", x: W * 0.66, y: H * 0.80 }, { k: "rock", x: W * 0.20, y: H * 0.70 },
    { k: "totem", x: W * 0.12, y: H * 0.66 }, { k: "totem", x: W * 0.88, y: H * 0.60 },
    { k: "banner", x: W * 0.84, y: H * 0.86 }, { k: "banner", x: W * 0.16, y: H * 0.62 }
  ];
  if (curBiome === 2 || curBiome === 3) { props.push({ k: "deadTree", x: W * 0.15, y: H * 0.72 }); props.push({ k: "deadTree", x: W * 0.85, y: H * 0.54 }); }
  if (curBiome === 2) { props.push({ k: "ruin", x: W * 0.33, y: H * 0.60 }, { k: "ruin", x: W * 0.67, y: H * 0.76 }); }
  if (curBiome === 0) { props.push({ k: "palm", x: W * 0.50, y: H * 0.78 }); }
  for (const p of props) { const sc = scaleAt(p.y) * 1.0; if (p.k === "palm") drawPalm(g, p.x, p.y, sc, b.palm); else if (p.k === "fern") drawFern(g, p.x, p.y, sc); else if (p.k === "rock") drawRock(g, p.x, p.y, sc); else if (p.k === "totem") drawTotem(g, p.x, p.y, sc); else if (p.k === "banner") drawBannerProp(g, p.x, p.y, sc); else if (p.k === "deadTree") drawDeadTree(g, p.x, p.y, sc); else if (p.k === "ruin") drawRuin(g, p.x, p.y, sc); }
  for (let i = 0; i < 10; i++) { const t = i / 9; const y = horizonY + 50 + Math.pow(t, 1.5) * (H - horizonY - 90); const sc = scaleAt(y) * 1.0 + 0.15; const off = roadHalf(y) + 30 * sc; drawPalm(g, W / 2 - off, y, sc, b.palm); drawPalm(g, W / 2 + off, y, sc, b.palm); }
  g.strokeStyle = "rgba(255,210,80,0.8)"; g.lineWidth = 3; g.setLineDash([18, 12]); g.beginPath(); g.moveTo(0, coreY); g.lineTo(W, coreY); g.stroke(); g.setLineDash([]);
  g.fillStyle = "rgba(255,225,120,0.9)"; g.font = "800 13px Segoe UI"; g.textAlign = "left"; g.fillText("防线", 14, coreY - 8);
}

// ============================================================
//  天空 + 树冠
// ============================================================
const clouds = Array.from({ length: 6 }, () => ({ x: Math.random() * W, y: 20 + Math.random() * 80, s: 0.6 + Math.random() * 0.8 }));
function drawSky() {
  const b = BIOMES[curBiome];
  const g = ctx.createLinearGradient(0, 0, 0, horizonY); g.addColorStop(0, b.sky[0]); g.addColorStop(0.5, b.sky[1]); g.addColorStop(1, b.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, horizonY);
  const sg = ctx.createRadialGradient(W * 0.78, 60, 4, W * 0.78, 60, 120); sg.addColorStop(0, b.glow); sg.addColorStop(1, "rgba(255,250,220,0)");
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, horizonY);
  ctx.fillStyle = b.sun; ctx.beginPath(); ctx.arc(W * 0.78, 60, 24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (const c of clouds) { c.x = (c.x + 0.15) % (W + 120) - 60; ctx.beginPath(); ctx.ellipse(c.x, c.y, 50 * c.s, 16 * c.s, 0, 0, Math.PI * 2); ctx.ellipse(c.x + 30 * c.s, c.y + 4, 36 * c.s, 13 * c.s, 0, 0, Math.PI * 2); ctx.fill(); }
}
function drawCanopy() {
  const b = BIOMES[curBiome];
  const par = (player.x - W / 2);
  ctx.fillStyle = b.canopy1 || "#3a6a4a"; ctx.beginPath(); ctx.moveTo(0, horizonY); for (let x = 0; x <= W; x += 60) ctx.lineTo(x + par * 0.02, horizonY - 30 - Math.sin(x * 0.05) * 18); ctx.lineTo(W, horizonY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = b.canopy2 || "#2a5a32"; for (let i = 0; i < 16; i++) { const x = (i * 60 + par * 0.06) % (W + 80) - 40; ctx.beginPath(); ctx.arc(x, horizonY - 6, 26, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = b.canopy3 || "#2f6a26"; for (let i = 0; i < 8; i++) { const y = horizonY + 30 + i * 120; const sc = scaleAt(y) * 0.9 + 0.2; ctx.save(); ctx.translate(-10 + par * 0.1, y); ctx.beginPath(); ctx.ellipse(30 * sc, 0, 60 * sc, 14 * sc, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore(); ctx.save(); ctx.translate(W + 10 + par * 0.1, y); ctx.beginPath(); ctx.ellipse(-30 * sc, 0, 60 * sc, 14 * sc, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
}
function drawHaze() { const b = BIOMES[curBiome]; const g = ctx.createLinearGradient(0, horizonY, 0, horizonY + (H - horizonY) * 0.55); g.addColorStop(0, b.haze); g.addColorStop(1, "rgba(200,230,200,0)"); ctx.fillStyle = g; ctx.fillRect(0, horizonY, W, (H - horizonY) * 0.55); }

// ============================================================
//  玩家（丛林枪手，背影动态）
// ============================================================
function drawPlayer() {
  // 护盾光环（就绪时）
  if (player.mods.shield && player.shieldT <= 0 && player.inv <= 0) { ctx.save(); ctx.strokeStyle = "rgba(140,230,255,0.7)"; ctx.lineWidth = 2.5; ctx.shadowBlur = 12; ctx.shadowColor = "#8ee0ff"; ctx.beginPath(); ctx.arc(player.x, player.y - 24, 34, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  drawDrones();
  const slots = squadSlots(); for (let i = 0; i < slots.length; i++) drawSurvivor(slots[i].x, slots[i].y, 0.86, i === 0, i);
  // 血条（当前人物的 HP）
  const hr = Math.max(0, player.hp / player.maxHp);
  const bx = player.x - 32, by = player.y - 80, bw = 64, bh = 6;
  ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(bx - 1.5, by - 1.5, bw + 3, bh + 3);
  ctx.fillStyle = "rgba(40,20,20,0.9)"; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = hr > 0.5 ? "#7aff8a" : hr > 0.25 ? "#ffd060" : "#ff5a5a";
  ctx.fillRect(bx, by, bw * hr, bh);
  // 复活标记
  if (player.revive > 0) { ctx.fillStyle = "#ffe14a"; ctx.font = "800 12px Segoe UI"; ctx.textAlign = "center"; ctx.fillText("✟x" + player.revive, player.x, player.y - 86); }
}
function drawDrones() {
  if (player.drones <= 0) return;
  for (let d = 0; d < player.drones; d++) {
    const ang = performance.now() * 0.001 + d * (Math.PI * 2 / player.drones);
    const dx = player.x + Math.cos(ang) * 46, dy = player.y - 30 + Math.sin(ang) * 30;
    ctx.save(); ctx.translate(dx, dy);
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(0, 8, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 10; ctx.shadowColor = "#8eff8a"; ctx.fillStyle = "#9affb0"; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = "#2a4a3a"; ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  }
}
function drawSurvivor(x, y, sc, isLeader, idx) {
  const s = sc;
  if (player.inv > 0 && Math.floor(player.inv * 16) % 2 === 0) { return; }
  ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.ellipse(x, y + 3 * s, 22 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
  if (vehicle().color) drawVehicle(x, y + 4, s, vehicle());
  const shirt = isLeader ? "#9a8a3e" : (idx % 2 ? "#5a8a3a" : "#9a5a2a");
  const t = player.animTime; const moving = player.moving;
  const sw = moving ? Math.sin(t * 14) * 5 * s : Math.sin(t * 3) * 1.0 * s;
  const lean = (isLeader ? Math.max(-1, Math.min(1, (player.vx || 0) / 600)) : 0) * 0.18;
  const bob = moving ? Math.abs(Math.sin(t * 14)) * 2.2 * s : Math.sin(t * 3) * 0.8 * s;
  const kick = (isLeader ? player.recoil : 0) * 16 * s;
  const idleSway = moving ? 0 : Math.sin(t * 2) * 0.04;
  ctx.save(); ctx.translate(x, y); ctx.rotate(lean + idleSway); ctx.translate(kick * 0.3, kick - bob);
  ctx.fillStyle = "#4a3a22";
  rr(ctx, -7 * s, -22 * s + sw, 5.6 * s, 22 * s, 2 * s); ctx.fill();
  rr(ctx, 1.4 * s, -22 * s - sw, 5.6 * s, 22 * s, 2 * s); ctx.fill();
  ctx.fillStyle = "#2a1d10";
  rr(ctx, -8 * s, -3 * s + sw, 7.5 * s, 4 * s, 1.5 * s); ctx.fill();
  rr(ctx, 0.5 * s, -3 * s - sw, 7.5 * s, 4 * s, 1.5 * s); ctx.fill();
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.moveTo(-14 * s, -41 * s); ctx.lineTo(14 * s, -41 * s); ctx.lineTo(11 * s, -19 * s); ctx.lineTo(-11 * s, -19 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.moveTo(-14 * s, -41 * s); ctx.lineTo(-5 * s, -41 * s); ctx.lineTo(-4 * s, -19 * s); ctx.lineTo(-11 * s, -19 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#5a3a22"; rr(ctx, -8.5 * s, -37 * s, 17 * s, 18 * s, 3 * s); ctx.fill();
  ctx.fillStyle = "#3a2412"; ctx.fillRect(-7 * s, -35 * s, 14 * s, 2.5 * s);
  ctx.fillStyle = "#caa05a"; ctx.fillRect(-1 * s, -30 * s, 2 * s, 3 * s);
  ctx.strokeStyle = "#241608"; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(-5 * s, -41 * s); ctx.lineTo(-4 * s, -19 * s); ctx.moveTo(5 * s, -41 * s); ctx.lineTo(4 * s, -19 * s); ctx.stroke();
  ctx.fillStyle = shirt; rr(ctx, -16.5 * s, -41 * s, 6 * s, 10 * s, 2 * s); ctx.fill(); rr(ctx, 10.5 * s, -41 * s, 6 * s, 10 * s, 2 * s); ctx.fill();
  ctx.fillStyle = "#c89868"; ctx.beginPath(); ctx.arc(-4 * s, -46 * s, 3 * s, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(4 * s, -47 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#23232a"; rr(ctx, -2.6 * s, -56 * s, 5.2 * s, 14 * s, 1.5 * s); ctx.fill();
  ctx.fillStyle = "#121217"; ctx.fillRect(-2 * s, -66 * s, 4 * s, 11 * s);
  ctx.fillStyle = "#c89868"; ctx.beginPath(); ctx.arc(0, -49 * s, 7.2 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#5a3e22"; ctx.beginPath(); ctx.arc(0, -51 * s, 8 * s, Math.PI, 0); ctx.fill(); ctx.fillRect(-9 * s, -51 * s, 18 * s, 3 * s);
  ctx.fillStyle = "#3a2814"; ctx.beginPath(); ctx.arc(0, -52 * s, 8 * s, Math.PI * 1.1, Math.PI * 1.9); ctx.fill();
  ctx.strokeStyle = "rgba(255,240,180,0.5)"; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(14 * s, -41 * s); ctx.lineTo(11 * s, -20 * s); ctx.stroke();
  ctx.restore();
}
function drawVehicle(x, y, sc, veh) {
  ctx.save(); ctx.translate(x, y);
  if (veh.name === "滑板") { ctx.fillStyle = veh.color; rr(ctx, -26 * sc, 0, 52 * sc, 7 * sc, 3 * sc); ctx.fill(); ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(-18 * sc, 8 * sc, 4 * sc, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(18 * sc, 8 * sc, 4 * sc, 0, Math.PI * 2); ctx.fill(); }
  else if (veh.name === "摩托") { ctx.fillStyle = veh.color; rr(ctx, -32 * sc, -6 * sc, 64 * sc, 16 * sc, 5 * sc); ctx.fill(); ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(-26 * sc, 12 * sc, 9 * sc, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(26 * sc, 12 * sc, 9 * sc, 0, Math.PI * 2); ctx.fill(); }
  else if (veh.name === "越野吉普") { ctx.fillStyle = veh.color; rr(ctx, -38 * sc, -10 * sc, 76 * sc, 22 * sc, 5 * sc); ctx.fill(); ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(-34 * sc, -4 * sc, 68 * sc, 4 * sc); ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(-28 * sc, 14 * sc, 9 * sc, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(28 * sc, 14 * sc, 9 * sc, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(0, 14 * sc, 9 * sc, 0, Math.PI * 2); ctx.fill(); }
  else if (veh.name === "机甲") { ctx.fillStyle = veh.color; ctx.shadowBlur = 14; ctx.shadowColor = "#c08aff"; rr(ctx, -40 * sc, -14 * sc, 80 * sc, 26 * sc, 6 * sc); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = "#7a3acf"; rr(ctx, -36 * sc, -2 * sc, 72 * sc, 6 * sc, 3 * sc); ctx.fill(); ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(-30 * sc, 16 * sc, 10 * sc, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(30 * sc, 16 * sc, 10 * sc, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// ============================================================
//  野人绘制
// ============================================================
function drawSavage(e) {
  const sc = ENEMY_SCALE * e.baseScale;
  const R = e.r * sc;
  const skin = e.skin;
  // 燃烧染色
  const burning = !!e.burn;
  ctx.fillStyle = "rgba(0,0,0,0.42)"; ctx.beginPath(); ctx.ellipse(e.x, e.y + 3 * sc, R * 1.0, R * 0.34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(e.x, e.y);
  const t = e.anim;
  const sh = Math.sin(t * 0.8) * 2.6 * sc;
  const charging = !(e.wind > 0);
  ctx.fillStyle = "#5a3a1e";
  rr(ctx, -R * 0.42, -R * 0.8 + sh, R * 0.30, R * 0.85, R * 0.1); ctx.fill();
  rr(ctx, R * 0.12, -R * 0.8 - sh, R * 0.30, R * 0.85, R * 0.1); ctx.fill();
  ctx.fillStyle = "#2a1a0a";
  rr(ctx, -R * 0.48, -R * 0.04 + sh, R * 0.40, R * 0.14, R * 0.05); ctx.fill();
  rr(ctx, R * 0.08, -R * 0.04 - sh, R * 0.40, R * 0.14, R * 0.05); ctx.fill();
  ctx.fillStyle = "#6a4a22"; ctx.beginPath(); ctx.moveTo(-R * 0.6, -R * 0.86); ctx.lineTo(R * 0.6, -R * 0.86); ctx.lineTo(R * 0.5, -R * 0.6); ctx.lineTo(-R * 0.5, -R * 0.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#4a3014"; for (let i = -2; i <= 2; i++) ctx.fillRect(i * R * 0.18 - R * 0.05, -R * 0.66, R * 0.06, R * 0.1);
  ctx.fillStyle = burning ? "#c06a2a" : skin; ctx.beginPath(); ctx.moveTo(-R * 0.6, -R * 1.9); ctx.lineTo(R * 0.6, -R * 1.9); ctx.lineTo(R * 0.5, -R * 0.86); ctx.lineTo(-R * 0.5, -R * 0.86); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#c0392b"; ctx.lineWidth = 1.8 * sc; ctx.beginPath(); ctx.moveTo(-R * 0.3, -R * 1.7); ctx.lineTo(R * 0.3, -R * 1.7); ctx.moveTo(0, -R * 1.6); ctx.lineTo(0, -R * 1.1); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1.2 * sc; ctx.beginPath(); ctx.moveTo(-R * 0.25, -R * 1.45); ctx.lineTo(R * 0.25, -R * 1.45); ctx.stroke();
  ctx.fillStyle = "#e8e4d4"; for (let i = -2; i <= 2; i++) ctx.fillRect(i * R * 0.16 - R * 0.05, -R * 1.82, R * 0.08, R * 0.12);
  const armAng = charging ? (0.5 + Math.sin(t * 0.8) * 0.15) : -1.2;
  ctx.fillStyle = skin;
  ctx.save(); ctx.translate(-R * 0.6, -R * 1.78); ctx.rotate(armAng); rr(ctx, -R * 0.15, -R * 0.05, R * 0.3, R * 0.95, R * 0.12); ctx.fill();
  ctx.translate(0, R * 0.9);
  if (e.type === "scout") { ctx.fillStyle = "#7a5a2a"; ctx.fillRect(-R * 0.05, 0, R * 0.1, R * 1.4); ctx.fillStyle = "#aaa"; ctx.beginPath(); ctx.moveTo(-R * 0.18, R * 1.4); ctx.lineTo(R * 0.18, R * 1.4); ctx.lineTo(0, R * 1.7); ctx.fill(); }
  else if (e.type === "brute") { ctx.fillStyle = "#5a3a1a"; rr(ctx, -R * 0.12, 0, R * 0.24, R * 1.0, R * 0.06); ctx.fill(); ctx.fillStyle = "#888"; rr(ctx, -R * 0.35, -R * 0.2, R * 0.7, R * 0.4, R * 0.1); ctx.fill(); }
  else if (e.type === "boss") { ctx.fillStyle = "#6a4a2a"; ctx.fillRect(-R * 0.06, 0, R * 0.12, R * 1.6); ctx.fillStyle = "#caa030"; ctx.beginPath(); ctx.arc(0, R * 1.7, R * 0.22, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.fillStyle = "#5a3a1a"; rr(ctx, -R * 0.1, 0, R * 0.2, R * 1.1, R * 0.05); ctx.fill(); ctx.fillStyle = "#777"; rr(ctx, -R * 0.3, R * 1.0, R * 0.6, R * 0.34, R * 0.1); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = skin; ctx.save(); ctx.translate(R * 0.6, -R * 1.78); ctx.rotate(-armAng - 0.2); rr(ctx, -R * 0.15, -R * 0.05, R * 0.3, R * 0.95, R * 0.12); ctx.fill(); ctx.restore();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -R * 2.06, R * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#160e06"; ctx.beginPath(); ctx.arc(0, -R * 2.12, R * 0.54, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-R * 0.5, -R * 2.12); ctx.lineTo(-R * 0.6, -R * 2.4); ctx.lineTo(-R * 0.3, -R * 2.18); ctx.fill();
  ctx.beginPath(); ctx.moveTo(R * 0.5, -R * 2.12); ctx.lineTo(R * 0.6, -R * 2.4); ctx.lineTo(R * 0.3, -R * 2.18); ctx.fill();
  ctx.fillStyle = "#c0392b"; ctx.fillRect(-R * 0.36, -R * 2.12, R * 0.1, R * 0.18); ctx.fillRect(R * 0.26, -R * 2.12, R * 0.1, R * 0.18);
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(-R * 0.1, -R * 2.2, R * 0.2, R * 0.06);
  ctx.fillStyle = "#1a0a04"; ctx.fillRect(-R * 0.24, -R * 2.0, R * 0.13, R * 0.1); ctx.fillRect(R * 0.1, -R * 2.0, R * 0.13, R * 0.1);
  ctx.fillStyle = "#1a0608"; rr(ctx, -R * 0.16, -R * 1.78, R * 0.32, R * 0.12, R * 0.04); ctx.fill();
  ctx.fillStyle = "#caa0a0"; for (let i = -1; i <= 1; i++) ctx.fillRect(-R * 0.12 + i * R * 0.1, -R * 1.78, R * 0.04, R * 0.05);
  if (e.type === "boss") { ctx.fillStyle = "#3a2418"; ctx.beginPath(); ctx.arc(0, -R * 2.06, R * 0.56, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#c0392b"; ctx.fillRect(-R * 0.2, -R * 2.3, R * 0.4, R * 0.1); ctx.fillStyle = "#ffd040"; ctx.fillRect(-R * 0.24, -R * 2.0, R * 0.13, R * 0.1); ctx.fillRect(R * 0.1, -R * 2.0, R * 0.13, R * 0.1); }
  if (e.type === "shielder") { const sy = -R * 0.7; if (e.shieldHp > 0) { const ratio = e.shieldHp / e.shieldMax; ctx.fillStyle = ratio > 0.5 ? "#9aa0a8" : "#c0884a"; rr(ctx, -R * 0.55, sy - R * 0.5, R * 1.1, R * 1.0, R * 0.15); ctx.fill(); ctx.strokeStyle = "#3a3a40"; ctx.lineWidth = 2; rr(ctx, -R * 0.55, sy - R * 0.5, R * 1.1, R * 1.0, R * 0.15); ctx.stroke(); ctx.fillStyle = "#c0392b"; ctx.beginPath(); ctx.arc(0, sy, R * 0.18, 0, Math.PI * 2); ctx.fill(); } else { ctx.strokeStyle = "rgba(200,160,80,0.5)"; ctx.lineWidth = 2; rr(ctx, -R * 0.55, sy - R * 0.5, R * 1.1, R * 1.0, R * 0.15); ctx.stroke(); } }
  if (e.type === "shaman") { const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.006); ctx.strokeStyle = `rgba(120,255,140,${0.3 + pulse * 0.3})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -R, R * 1.4, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = "#6a4a2a"; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(R * 0.7, -R * 0.2); ctx.lineTo(R * 1.1, -R * 1.8); ctx.stroke(); ctx.fillStyle = "#7aff8a"; ctx.shadowBlur = 10; ctx.shadowColor = "#7aff8a"; ctx.beginPath(); ctx.arc(R * 1.1, -R * 1.9, R * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = "#2a4a3a"; ctx.beginPath(); ctx.arc(0, -R * 2.06, R * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#7aff8a"; ctx.fillRect(-R * 0.24, -R * 2.0, R * 0.13, R * 0.1); ctx.fillRect(R * 0.1, -R * 2.0, R * 0.13, R * 0.1); }
  if (e.type === "bomber") { const close = Math.hypot(e.x - player.x, e.y - player.y) < 160; const flash = close && (Math.floor(performance.now() / 80) % 2 === 0); ctx.fillStyle = flash ? "#ff3a2a" : "#2a1a0a"; ctx.beginPath(); ctx.arc(0, -R * 1.2, R * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#caa030"; ctx.fillRect(-R * 0.06, -R * 1.7, R * 0.12, R * 0.3); ctx.fillStyle = flash ? "#fff" : "#ff8a2a"; ctx.beginPath(); ctx.arc(0, -R * 1.72, R * 0.12, 0, Math.PI * 2); ctx.fill(); }
  if (e.type === "berserker" && e.enraged) { ctx.fillStyle = "rgba(255,40,20,0.25)"; ctx.beginPath(); ctx.arc(0, -R * 1.1, R * 1.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#ff2a1a"; ctx.fillRect(-R * 0.24, -R * 2.0, R * 0.13, R * 0.1); ctx.fillRect(R * 0.1, -R * 2.0, R * 0.13, R * 0.1); }
  if (e.type === "boss" && e.phase2) { ctx.fillStyle = "rgba(255,40,20,0.18)"; ctx.beginPath(); ctx.arc(0, -R * 1.2, R * 1.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  if (e.hitFlash > 0) { ctx.save(); ctx.globalAlpha = Math.min(0.5, e.hitFlash * 5); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(e.x, e.y - R * 1.1, R * 1.1, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  if (e.hp < e.maxHp && e.type !== "boss") { const bw = R * 2; ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(e.x - bw / 2, e.y - R * 2.7, bw, 3.5); ctx.fillStyle = "#ff5a5a"; ctx.fillRect(e.x - bw / 2, e.y - R * 2.7, bw * (e.hp / e.maxHp), 3.5); }
}

// ============================================================
//  子弹 / 投掷物 / 粒子 / 横幅
// ============================================================
function drawBullets() {
  for (const b of bullets) { ctx.save(); ctx.shadowBlur = 10; ctx.shadowColor = b.color; ctx.fillStyle = b.color; if (b.kind === "tracer") { ctx.strokeStyle = b.color; ctx.lineWidth = b.r * 1.6; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.014, b.y - b.vy * 0.014); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
}
function drawEnemyBullets() {
  for (const b of enemyBullets) {
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(b.x, b.y + 12, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    const ang = Math.atan2(b.vy, b.vx);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang);
    ctx.globalCompositeOperation = "lighter";
    const tg = ctx.createLinearGradient(-30, 0, 10, 0); tg.addColorStop(0, "rgba(255,90,30,0)"); tg.addColorStop(1, "rgba(255,140,40,0.85)");
    ctx.strokeStyle = tg; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(10, 0); ctx.stroke();
    ctx.shadowBlur = 14; ctx.shadowColor = "#ff7a2a"; ctx.strokeStyle = "#ff8a3a"; ctx.lineWidth = 3.6; ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(10, 0); ctx.stroke();
    ctx.fillStyle = "#ffe070"; ctx.beginPath(); ctx.moveTo(17, 0); ctx.lineTo(5, -6); ctx.lineTo(5, 6); ctx.fill();
    ctx.globalCompositeOperation = "source-over"; ctx.restore();
  }
}
function drawTelegraphs() { for (const t of telegraphs) { const a = t.life / t.max; ctx.save(); ctx.globalAlpha = a * 0.5; ctx.strokeStyle = "#ff3a2a"; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); } }
function drawBolts() {
  for (const b of bolts) {
    const a = b.life / b.max;
    ctx.save(); ctx.globalAlpha = a;
    ctx.shadowBlur = 14; ctx.shadowColor = "#aef6ff";
    ctx.strokeStyle = "#e8fcff"; ctx.lineWidth = 2.8; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(b.pts[0].x, b.pts[0].y);
    for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i].x, b.pts[i].y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(120,200,255,0.7)"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(b.pts[0].x, b.pts[0].y);
    for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i].x, b.pts[i].y);
    ctx.stroke();
    ctx.restore();
  }
}
function drawShocks() {
  for (const s of shocks) {
    const k = 1 - s.life / s.max;
    ctx.save(); ctx.globalAlpha = (s.life / s.max) * 0.9;
    ctx.strokeStyle = "#ffb14d"; ctx.lineWidth = 3 + 3 * (s.life / s.max); ctx.shadowBlur = 16; ctx.shadowColor = "#ff7a2a";
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (0.3 + k * 0.7), 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}
function drawMuzzle() { if (muzzle <= 0) return; ctx.save(); ctx.globalAlpha = Math.min(1, muzzle * 14); ctx.shadowBlur = 18; ctx.shadowColor = "#ffe14a"; ctx.fillStyle = "#fff8c0"; for (const sl of squadSlots()) { ctx.beginPath(); ctx.arc(sl.x, sl.y - 66, 8 + muzzle * 30, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
function drawParticles() { for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }
function drawFloats() { ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle"; for (const f of floatTexts) { const a = Math.max(0, f.life / f.max); ctx.globalAlpha = a; ctx.font = `900 ${f.size}px Segoe UI, Microsoft YaHei, sans-serif`; ctx.lineWidth = 5; ctx.strokeStyle = "rgba(0,0,0,0.78)"; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); } ctx.globalAlpha = 1; ctx.restore(); }
function drawHazards() {
  for (const h of hazards) {
    const k = 1 - h.timer / h.max; // 0..1 越接近1越要爆
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * (0.015 + k * 0.05));
    ctx.save();
    ctx.strokeStyle = `rgba(255,60,30,${0.5 + 0.4 * pulse})`; ctx.lineWidth = 4 + k * 3;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(255,90,40,${0.08 + k * 0.22 * pulse})`;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,210,90,0.85)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(h.x, h.y, Math.max(2, h.r * (1 - k)), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(255,235,130,${0.6 + 0.4 * pulse})`;
    ctx.font = "900 28px Segoe UI"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("!", h.x, h.y);
    ctx.restore();
  }
}
function drawBossBar() { const boss = enemies.find(e => e.type === "boss"); if (!boss) return; const bw = W * 0.62, bh = 20, bx = (W - bw) / 2, by = horizonY + 24; ctx.save(); ctx.fillStyle = "rgba(0,0,0,0.66)"; rr(ctx, bx - 6, by - 6, bw + 12, bh + 12, 8); ctx.fill(); ctx.fillStyle = "rgba(40,20,8,0.92)"; rr(ctx, bx, by, bw, bh, 6); ctx.fill(); const pct = Math.max(0, boss.hp / boss.maxHp); const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, "#ff3a2a"); g.addColorStop(1, "#ff9a3a"); ctx.fillStyle = g; rr(ctx, bx, by, bw * pct, bh, 6); ctx.fill(); ctx.strokeStyle = "rgba(255,150,80,0.85)"; ctx.lineWidth = 2; rr(ctx, bx, by, bw, bh, 6); ctx.stroke(); ctx.fillStyle = "#fff"; ctx.font = "800 13px Segoe UI"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`CHIEF  ${Math.ceil(boss.hp)} / ${boss.maxHp}`, W / 2, by + bh / 2); ctx.restore(); }
function drawBanner() { if (bannerTime <= 0) return; const p = 1 - bannerTime / bannerTotal; const a = bannerTime > bannerTotal * 0.2 ? 1 : bannerTime / (bannerTotal * 0.2); const scale = 0.6 + Math.min(1, p * 3) * 0.5; ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, H * 0.3); ctx.scale(scale, scale); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "900 64px Segoe UI, Microsoft YaHei, sans-serif"; ctx.lineWidth = 10; ctx.strokeStyle = "rgba(0,0,0,0.85)"; ctx.strokeText(bannerText, 0, 0); ctx.fillStyle = bannerColor; ctx.shadowBlur = 30; ctx.shadowColor = ctx.fillStyle; ctx.fillText(bannerText, 0, 0); ctx.restore(); }
function drawCombo() { if (combo < 2) return; const a = Math.min(1, comboTimer / COMBO_WIN + 0.2); ctx.save(); ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "900 40px Segoe UI, Microsoft YaHei, sans-serif"; ctx.lineWidth = 7; ctx.strokeStyle = "rgba(0,0,0,0.8)"; const t = `COMBO x${combo}`; ctx.strokeText(t, W / 2, 90); ctx.fillStyle = combo >= 6 ? "#ff9a3a" : "#8eff7a"; ctx.shadowBlur = 20; ctx.shadowColor = ctx.fillStyle; ctx.fillText(t, W / 2, 90); ctx.shadowBlur = 0; ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(W / 2 - 80, 116, 160, 6); ctx.fillStyle = "#8eff7a"; ctx.fillRect(W / 2 - 80, 116, 160 * Math.max(0, comboTimer / COMBO_WIN), 6); ctx.restore(); }
const crt = document.createElement("canvas"); crt.width = W; crt.height = H; { const c = crt.getContext("2d"); for (let y = 0; y < H; y += 3) { c.fillStyle = "rgba(0,0,0,0.10)"; c.fillRect(0, y, W, 1); } }
function drawCRT() { ctx.drawImage(crt, 0, 0); }
function drawAmbient() {
  const b = BIOMES[curBiome];
  for (const a of ambient) {
    ctx.globalAlpha = Math.min(1, a.life / a.max * 2) * (a.life < a.max * 0.2 ? a.life / (a.max * 0.2) : 1);
    if (b.ambient === "rain") { ctx.strokeStyle = a.color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + a.vx * 0.05, a.y + a.vy * 0.05); ctx.stroke(); }
    else { ctx.fillStyle = a.color; ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.rot); ctx.beginPath(); ctx.arc(0, 0, a.r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  }
  ctx.globalAlpha = 1;
}
function drawDarkFog() {
  const d = BIOMES[curBiome].dark + waveMod.dark;
  if (d <= 0) return;
  const g = ctx.createRadialGradient(player.x, player.y - 30, W * 0.15, player.x, player.y - 30, W * 0.7);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${Math.min(0.6, d)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function drawModChip() {
  if (!waveMod.name) return;
  ctx.save(); ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.font = "800 14px Segoe UI"; ctx.fillText("词缀: " + waveMod.name, 12, horizonY + 8);
  ctx.fillStyle = "#b08aff"; ctx.fillText("词缀: " + waveMod.name, 12, horizonY + 8);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (screenShake > 0) ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
  drawSky(); drawCanopy(); ctx.drawImage(groundCanvas, 0, 0);
  for (const d of decals) { ctx.fillStyle = `rgba(60,40,20,${d.a})`; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.5, 0, 0, Math.PI * 2); ctx.fill(); }
  const ordered = enemies.slice().sort((a, b) => a.y - b.y);
  for (const e of ordered) drawSavage(e);
  drawHazards(); drawTelegraphs(); drawShocks();
  drawPlayer();
  drawEnemyBullets(); drawBullets(); drawMuzzle();
  drawBolts();
  drawParticles(); drawFloats();
  drawAmbient(); drawDarkFog();
  drawBossBar(); drawCombo(); drawBanner(); drawModChip();
  drawHaze(); drawCRT();
  ctx.restore();
}

// ============================================================
//  主循环 / 输入
// ============================================================
function loop(now) { const dt = Math.min(0.033, (now - lastTime) / 1000 || 0); lastTime = now; update(dt); draw(); requestAnimationFrame(loop); }
function togglePause() {
  if (state === "playing") { state = "menu"; messageEl.innerHTML = "已暂停。点击按钮继续。"; startBtn.textContent = "继续"; overlay.classList.remove("hidden"); }
  else if (state === "menu") { state = "playing"; overlay.classList.add("hidden"); lastTime = performance.now(); }
  syncPauseIcon();
}
startBtn.addEventListener("click", () => { initAudio(); if (state === "menu" && startBtn.textContent === "继续") { state = "playing"; overlay.classList.add("hidden"); lastTime = performance.now(); syncPauseIcon(); } else startGame(); });
window.addEventListener("keydown", (e) => { const k = e.key.toLowerCase(); if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(k)) e.preventDefault(); if (k === "m") { toggleMute(); return; } if (k === " " && (state === "playing" || state === "menu")) { togglePause(); return; } keys.add(k); initAudio(); });
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
function pointerXY(ev) { const r = canvas.getBoundingClientRect(); return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H }; }
canvas.addEventListener("pointerdown", (e) => { pointerActive = true; canvas.setPointerCapture(e.pointerId); const p = pointerXY(e); pointerTarget.x = p.x; pointerTarget.y = p.y; initAudio(); });
canvas.addEventListener("pointermove", (e) => { if (pointerActive) { const p = pointerXY(e); pointerTarget.x = p.x; pointerTarget.y = p.y; } });
canvas.addEventListener("pointerup", () => { pointerActive = false; });
canvas.addEventListener("pointercancel", () => { pointerActive = false; });

buildGround();
updateHud();
requestAnimationFrame(loop);
