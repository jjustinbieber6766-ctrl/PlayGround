(() => {
  const $ = (selector) => document.querySelector(selector);
  const canvas = $('#gameCanvas');
  const ctx = canvas.getContext('2d');
  const modal = $('#modalBackdrop');
  const modalTitle = $('#modalTitle');
  const modalEyebrow = $('#modalEyebrow');
  const modalBody = $('#modalBody');
  const frame = $('.game-frame');
  const state = {
    screen: 'home', name: localStorage.getItem('manu-name') || 'MANU', sound: localStorage.getItem('manu-sound') !== 'off',
    coins: 250, luck: 1, difficulty: 'easy', level: 1, kills: 0, health: 100, maxHealth: 100,
    alive: false, lastTime: 0, lastShot: 0, spawnTimer: 0, hurtTimer: 0, toastTimer: 0,
    player: { x: .2, facing: 1 }, enemies: [], bullets: [], particles: [], keys: {}, pointerFire: false,
    weapon: { name: 'OLD RELIABLE', rarity: 'COMMON', damage: 18, rate: 580, color: '#b9c68a', icon: '✦', odds: '1 / 2' },
    purchaseCounts: [0, 0, 0, 0], audio: null,
  };
  const difficulties = { easy: { max: 100, kills: 4, hp: 1, speed: 1 }, medium: { max: 500, kills: 6, hp: 1.45, speed: 1.16 }, hard: { max: 1000, kills: 8, hp: 1.9, speed: 1.33 } };
  const guns = [
    { name: 'POCKET POPPER', rarity: 'COMMON', damage: 12, rate: 620, weight: 28, color: '#c4cc8e', icon: '✦', odds: '1 / 2' },
    { name: 'OLD RELIABLE', rarity: 'COMMON', damage: 18, rate: 580, weight: 25, color: '#b9c68a', icon: '✦', odds: '1 / 2' },
    { name: 'TWIN FANGS', rarity: 'UNCOMMON', damage: 15, rate: 320, weight: 19, color: '#87d7b4', icon: '⌁', odds: '1 / 5' },
    { name: 'RUSTY REAPER', rarity: 'RARE', damage: 38, rate: 720, weight: 13, color: '#7ac9f0', icon: '✧', odds: '1 / 12' },
    { name: 'THUNDERCLAP', rarity: 'EPIC', damage: 72, rate: 800, weight: 8, color: '#c59af7', icon: 'ϟ', odds: '1 / 40' },
    { name: 'SUNSET SHOTGUN', rarity: 'LEGENDARY', damage: 120, rate: 900, weight: 5, color: '#ffb55e', icon: '✹', odds: '1 / 100' },
    { name: 'AWM-1', rarity: 'MYTHIC', damage: 500, rate: 650, weight: 1, color: '#ff7d69', icon: '★', odds: '1 / 1000' },
  ];
  const shopPacks = [
    { amount: 1, base: 50, label: '+1 LUCK' },
    { amount: 10, base: 500, label: '+10 LUCK' },
    { amount: 50, base: 5000, label: '+50 LUCK' },
    { amount: 100, base: 10000, label: '+100 LUCK' },
  ];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const levelConfig = () => difficulties[state.difficulty];
  const currentLevelKills = () => state.kills % levelConfig().kills;
  const maxLevel = () => levelConfig().max;

  function sound(freq = 440, duration = .08, type = 'sine', volume = .045) {
    if (!state.sound) return;
    try {
      state.audio ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = state.audio.createOscillator(), gain = state.audio.createGain();
      osc.type = type; osc.frequency.value = freq; gain.gain.value = volume;
      gain.gain.exponentialRampToValueAtTime(.001, state.audio.currentTime + duration);
      osc.connect(gain); gain.connect(state.audio.destination); osc.start(); osc.stop(state.audio.currentTime + duration);
    } catch (_) { /* audio is an optional browser capability */ }
  }
  function showToast(message) {
    let toast = $('.toast');
    if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; frame.appendChild(toast); }
    toast.textContent = message; toast.classList.add('show'); clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }
  function updateHUD() {
    $('#playerNameLabel').textContent = state.name.toUpperCase(); $('#survivorName').textContent = state.name.toUpperCase();
    $('#levelNumber').textContent = String(state.level).padStart(2, '0'); $('#difficultyLabel').textContent = state.difficulty.toUpperCase();
    $('#killsCount').textContent = `${currentLevelKills()} / ${levelConfig().kills} KILLS`;
    $('#waveCaption').textContent = `WAVE ${String(Math.floor((state.level - 1) / 10) + 1).padStart(2, '0')}`;
    $('#levelProgress').style.width = `${currentLevelKills() / levelConfig().kills * 100}%`;
    $('#healthBar').style.width = `${state.health / state.maxHealth * 100}%`; $('#healthText').textContent = Math.ceil(state.health);
    $('#coinsText').textContent = state.coins.toLocaleString(); $('#coinBadge').textContent = state.coins.toLocaleString(); $('#luckCount').textContent = state.luck;
    $('#weaponName').textContent = state.weapon.name; $('#weaponRarity').innerHTML = `${state.weapon.rarity} <i></i> ${state.weapon.odds}`;
    $('#weaponRarity').style.color = state.weapon.color; $('#weaponIcon').textContent = state.weapon.icon; $('#weaponIcon').style.color = state.weapon.color;
    $('#weaponDamage').textContent = state.weapon.damage.toLocaleString(); $('#rollButton').disabled = state.luck < 1;
    const tip = state.level >= 100 ? ['TIP: HEAVY ORDNANCE', 'A bazooka boss is waiting at level 100. Keep moving.'] : state.level >= 55 ? ['TIP: THEY SHOOT BACK', 'Gun-wielding zombies join the horde from level 55.'] : ['TIP: STAY SHARP', 'Every 10 levels brings a boss. Save your best roll.'];
    $('#tipTitle').textContent = tip[0]; $('#tipText').textContent = tip[1];
  }
  function switchScreen(screen) {
    state.screen = screen;
    $('#homeScreen').classList.toggle('active', screen === 'home'); $('#gameScreen').classList.toggle('active', screen === 'game');
    if (screen === 'game') { state.alive = true; updateHUD(); resizeCanvas(); }
    else state.alive = false;
  }
  function openModal(type) {
    modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); modalBody.replaceChildren();
    if (type === 'settings') {
      modalEyebrow.textContent = 'SURVIVOR CONTROL'; modalTitle.textContent = 'SETTINGS';
      modalBody.innerHTML = `<div class="setting-row"><div class="setting-label"><b>Game sound</b><small>Little sounds, big atmosphere</small></div><button class="toggle ${state.sound ? 'on' : ''}" id="soundToggle" aria-label="Toggle sound"></button></div><div class="setting-row"><label class="setting-label" for="nameInput"><b>Change name</b><small>Your name in the wasteland</small></label><input class="name-input" id="nameInput" maxlength="12" value="${escapeHTML(state.name)}" placeholder="SURVIVOR"></div><button class="modal-action" id="saveSettings">SAVE SETTINGS</button><p class="setting-note">QUIT DOESN'T DELETE YOUR RUN. Change your call sign, tune the sound, then jump back in.</p>`;
      $('#soundToggle').addEventListener('click', () => { state.sound = !state.sound; localStorage.setItem('manu-sound', state.sound ? 'on' : 'off'); $('#soundToggle').classList.toggle('on', state.sound); sound(600, .1); });
      $('#saveSettings').addEventListener('click', () => { state.name = ($('#nameInput').value.trim() || 'MANU').slice(0, 12); localStorage.setItem('manu-name', state.name); updateHUD(); closeModal(); showToast(`CALL SIGN UPDATED: ${state.name.toUpperCase()}`); sound(520, .1); });
    } else if (type === 'shop') {
      modalEyebrow.textContent = 'SUPPLY DROP'; modalTitle.textContent = 'LUCK SHOP'; renderShop();
    } else if (type === 'updates') {
      modalEyebrow.textContent = 'PATCH 01.04 · LIVE'; modalTitle.textContent = 'FIELD NOTES';
      modalBody.innerHTML = `<div class="update-entry"><time>UPDATE 01.04 — TODAY</time><h3>The Outskirts are open</h3><p>Pick a difficulty and push through a side-scrolling zombie run. Every 5 levels, the horde gets nastier. Every 10, a boss arrives.</p></div><div class="update-entry"><time>NEW GEAR</time><h3>Roll for something legendary</h3><p>Seven weapons added to the dice pool, including the AWM-1 (1 in 1,000) and a very loud level 100 surprise.</p></div><div class="update-entry"><time>QUALITY OF LIFE</time><h3>Your run, your rules</h3><p>Added survivor names, sound controls, a luck shop, mobile movement controls, and three difficulty tracks.</p></div>`;
    } else if (type === 'gameover') {
      modalEyebrow.textContent = 'RUN ENDED'; modalTitle.textContent = 'YOU GOT SWARMED.';
      modalBody.innerHTML = `<p class="difficulty-summary">You reached <b>level ${state.level}</b> on ${state.difficulty.toUpperCase()} and took down ${state.kills} zombies. The wasteland will remember.</p><button class="modal-action" id="restartRun">RUN IT BACK</button><button class="modal-action" id="returnHome" style="background:#313d30;color:#d9e5d2;margin-top:8px">BACK TO MENU</button>`;
      $('#restartRun').addEventListener('click', () => { closeModal(); startGame(state.difficulty); });
      $('#returnHome').addEventListener('click', () => { closeModal(); switchScreen('home'); });
    }
  }
  function renderShop() {
    modalBody.innerHTML = `<div class="shop-balance"><span>AVAILABLE LUCK TOKENS</span><b>● ${state.coins.toLocaleString()}</b></div>${shopPacks.map((pack, i) => { const cost = Math.floor(pack.base * (1 + state.purchaseCounts[i] * .25)); return `<div class="shop-item"><div class="shop-item-info"><b>${pack.label}</b><small>PRICE · ${cost.toLocaleString()} TOKENS${state.purchaseCounts[i] ? ` · OWNED ${state.purchaseCounts[i]}×` : ''}</small></div><button class="buy-button" data-buy="${i}" ${state.coins < cost ? 'disabled' : ''}>BUY · ${cost.toLocaleString()}</button></div>`; }).join('')}<p class="setting-note">Prices rise 25% each time you buy the same pack. Earn more tokens by taking down zombies.</p>`;
    modalBody.querySelectorAll('[data-buy]').forEach(button => button.addEventListener('click', () => {
      const index = Number(button.dataset.buy), pack = shopPacks[index], cost = Math.floor(pack.base * (1 + state.purchaseCounts[index] * .25));
      if (state.coins < cost) return;
      state.coins -= cost; state.luck += pack.amount; state.purchaseCounts[index]++;
      updateHUD(); sound(720, .13, 'triangle'); renderShop(); showToast(`+${pack.amount} LUCK ADDED`);
    }));
  }
  function closeModal() { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
  function escapeHTML(value) { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }

  function startGame(difficulty = state.difficulty) {
    state.difficulty = difficulty; state.level = 1; state.kills = 0; state.health = 100; state.maxHealth = 100;
    state.enemies = []; state.bullets = []; state.particles = []; state.player.x = .19; state.spawnTimer = .7; state.lastTime = performance.now();
    document.querySelectorAll('.difficulty-option').forEach(button => button.classList.toggle('selected', button.dataset.difficulty === difficulty));
    switchScreen('game'); sound(420, .12, 'triangle');
  }
  function chooseGun() {
    if (state.luck < 1) { showToast('NO LUCK LEFT — VISIT THE SHOP'); sound(160, .12, 'square', .025); return; }
    state.luck--; const roll = Math.random(); let gun;
    if (Math.random() < .001) gun = guns[6];
    else {
      const pool = guns.slice(0, 6), total = pool.reduce((sum, item) => sum + item.weight, 0); let ticket = roll * total;
      gun = pool[0]; for (const candidate of pool) { ticket -= candidate.weight; if (ticket <= 0) { gun = candidate; break; } }
    }
    state.weapon = { ...gun }; updateHUD();
    const button = $('#rollButton'); button.classList.add('rolling'); $('#weaponIcon').classList.add('spin');
    setTimeout(() => { button.classList.remove('rolling'); $('#weaponIcon').classList.remove('spin'); }, 500);
    showToast(`${gun.rarity}! ${gun.name} · ${gun.odds}`); sound(gun.rarity === 'MYTHIC' ? 1000 : 680, .2, 'triangle');
  }
  function enemyType(level) {
    if (level >= 100 && level % 10 === 0) return 'bazooka-boss';
    if (level % 10 === 0) return 'boss';
    if (level >= 55 && level % 5 === 0) return 'gunner';
    if (level % 5 === 0) return 'brute';
    return 'walker';
  }
  function spawnEnemy() {
    const type = enemyType(state.level), config = levelConfig(), baseHp = 36 + state.level * 4;
    const multiplier = type === 'bazooka-boss' ? 7 : type === 'boss' ? 4 : type === 'gunner' ? 2.3 : type === 'brute' ? 2.2 : 1;
    state.enemies.push({ x: 1.04 + Math.random() * .12, y: .76 + Math.random() * .06, type, hp: baseHp * multiplier * config.hp, maxHp: baseHp * multiplier * config.hp, speed: (.023 + Math.min(state.level, 100) * .00016) * config.speed * (type === 'boss' ? .53 : type === 'bazooka-boss' ? .4 : type === 'brute' ? .67 : 1), attack: 1 + Math.random(), flash: 0, seed: Math.random() * 10 });
    $('#sceneStatus').textContent = type === 'bazooka-boss' ? 'BAZOOKA BOSS INCOMING' : type === 'boss' ? 'BOSS APPROACHING' : type === 'gunner' ? 'GUNNER DETECTED' : 'INCOMING...';
    if (type.includes('boss') || type === 'gunner') showToast(type === 'bazooka-boss' ? 'BAZOOKA BOSS — LEVEL 100' : type === 'boss' ? 'BOSS WAVE' : 'GUNNER ZOMBIE — WATCH OUT');
  }
  function addParticle(x, y, color, count = 8) { for (let i = 0; i < count; i++) state.particles.push({ x, y, vx: (Math.random() - .5) * .22, vy: (Math.random() - .7) * .2, life: .35 + Math.random() * .35, color, size: 2 + Math.random() * 3 }); }
  function shoot() {
    const now = performance.now(); if (!state.alive || now - state.lastShot < state.weapon.rate) return;
    state.lastShot = now; const target = state.enemies.find(enemy => enemy.x > state.player.x + .05);
    state.bullets.push({ x: state.player.x + .055, y: .72, speed: state.weapon.name === 'AWM-1' ? .94 : .8, damage: state.weapon.damage, color: state.weapon.color, target });
    sound(state.weapon.name.includes('SHOTGUN') ? 160 : 280, .045, 'square', .012);
  }
  function damagePlayer(amount) {
    state.health = Math.max(0, state.health - amount); state.hurtTimer = .2; updateHUD(); sound(100, .15, 'sawtooth', .035);
    $('#damageFlash').classList.add('show'); setTimeout(() => $('#damageFlash').classList.remove('show'), 130);
    if (state.health <= 0) { state.alive = false; setTimeout(() => openModal('gameover'), 300); }
  }
  function killEnemy(enemy) {
    const reward = enemy.type.includes('boss') ? 100 : enemy.type === 'gunner' ? 32 : enemy.type === 'brute' ? 22 : 12;
    state.coins += reward; state.kills++; addParticle(enemy.x, enemy.y, enemy.type.includes('boss') ? '#ffb55e' : '#c8f169', enemy.type.includes('boss') ? 26 : 12);
    state.enemies = state.enemies.filter(item => item !== enemy); sound(180 + Math.random() * 80, .1, 'triangle', .025);
    if (currentLevelKills() === 0) {
      if (state.level < maxLevel()) { state.level++; state.health = Math.min(state.maxHealth, state.health + 7); showToast(`LEVEL ${state.level} — KEEP PUSHING`); }
      else { state.level = maxLevel(); state.health = state.maxHealth; showToast('RUN COMPLETE — YOU SURVIVED!'); state.alive = false; setTimeout(() => { state.alive = true; state.level = 1; state.kills = 0; showToast('ENDLESS MODE — THE HORDE RETURNS'); updateHUD(); }, 2300); }
    }
    updateHUD();
  }
  function update(dt) {
    if (!state.alive) return;
    const move = (state.keys.ArrowRight || state.keys.KeyD || state.keys.right ? 1 : 0) - (state.keys.ArrowLeft || state.keys.KeyA || state.keys.left ? 1 : 0);
    state.player.x = clamp(state.player.x + move * dt * .42, .07, .66); if (move) state.player.facing = move;
    if (state.keys.Space || state.keys.fire || state.pointerFire) shoot();
    state.spawnTimer -= dt;
    const desired = state.level % 10 === 0 ? 1 : Math.min(5, 1 + Math.floor(state.level / 4));
    if (state.spawnTimer <= 0 && state.enemies.length < desired) { spawnEnemy(); state.spawnTimer = Math.max(.85, 2.5 - state.level * .012) * (state.difficulty === 'hard' ? .75 : 1); }
    for (const enemy of [...state.enemies]) {
      enemy.x -= enemy.speed * dt; enemy.flash = Math.max(0, enemy.flash - dt); enemy.attack -= dt;
      if (enemy.x <= state.player.x + .065) {
        if (enemy.attack <= 0) { damagePlayer(enemy.type.includes('boss') ? 17 : enemy.type === 'brute' ? 11 : 7); enemy.attack = enemy.type.includes('boss') ? .8 : 1.15; }
        enemy.x = state.player.x + .065;
      }
      if ((enemy.type === 'gunner' || enemy.type === 'bazooka-boss') && enemy.attack < .2 && enemy.x > state.player.x + .2) { damagePlayer(enemy.type === 'bazooka-boss' ? 12 : 5); enemy.attack = enemy.type === 'bazooka-boss' ? 2.5 : 1.9; }
    }
    for (const bullet of [...state.bullets]) {
      bullet.x += bullet.speed * dt;
      const target = bullet.target && state.enemies.includes(bullet.target) ? bullet.target : state.enemies.find(enemy => Math.abs(enemy.x - bullet.x) < .035);
      if (target && Math.abs(target.x - bullet.x) < .045) { target.hp -= bullet.damage; target.flash = .12; addParticle(bullet.x, bullet.y, bullet.color, 3); state.bullets = state.bullets.filter(item => item !== bullet); if (target.hp <= 0) killEnemy(target); }
      else if (bullet.x > 1.1) state.bullets = state.bullets.filter(item => item !== bullet);
    }
    for (const p of [...state.particles]) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) state.particles.splice(state.particles.indexOf(p), 1); }
    if (state.hurtTimer > 0) state.hurtTimer -= dt;
  }
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function drawMan(x, y, scale = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.fillStyle = '#11180f55'; ctx.beginPath(); ctx.ellipse(0, 0, 31, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#242c27'; ctx.fillRect(-15, -47, 11, 42); ctx.fillRect(4, -47, 12, 42);
    ctx.fillStyle = '#151d18'; ctx.fillRect(-18, -8, 18, 8); ctx.fillRect(4, -8, 19, 8);
    ctx.fillStyle = '#536244'; ctx.fillRect(-20, -94, 40, 51); ctx.fillStyle = '#697653'; ctx.fillRect(-17, -91, 33, 45);
    ctx.fillStyle = '#b98260'; ctx.fillRect(-24, -86, 8, 33); ctx.fillRect(15, -87, 8, 31);
    ctx.fillStyle = '#c98e69'; ctx.fillRect(-14, -121, 28, 29); ctx.fillStyle = '#332d24'; ctx.fillRect(-15, -126, 30, 11); ctx.fillRect(-17, -121, 7, 8);
    ctx.fillStyle = '#262820'; ctx.fillRect(5, -112, 3, 3); ctx.fillStyle = '#b79f64'; ctx.fillRect(-2, -92, 7, 45);
    ctx.fillStyle = '#30362d'; ctx.fillRect(12, -78, 35, 7); ctx.fillRect(39, -76, 15, 3); ctx.fillRect(20, -72, 5, 10);
    ctx.fillStyle = '#151a16'; ctx.fillRect(48, -77, 9, 2); ctx.restore();
  }
  function drawZombie(x, y, type, seed, flash, time, hp, maxHp) {
    const boss = type.includes('boss'), big = type === 'brute' || boss, scale = boss ? (type === 'bazooka-boss' ? 1.72 : 1.47) : big ? 1.2 : .95;
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); const wobble = Math.sin(time * 4 + seed) * 2;
    ctx.fillStyle = '#11180f55'; ctx.beginPath(); ctx.ellipse(0, 0, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash > 0 ? '#f4d0b1' : boss ? '#706d52' : '#617052';
    ctx.fillRect(-10, -43, 9, 38); ctx.fillRect(3, -43, 9, 38); ctx.fillStyle = '#333b2e'; ctx.fillRect(-13, -7, 14, 6); ctx.fillRect(2, -7, 15, 6);
    ctx.fillStyle = flash > 0 ? '#ffe4d1' : boss ? '#776e4a' : '#73845c'; ctx.fillRect(-16, -80, 31, 39); ctx.fillStyle = '#64744e'; ctx.fillRect(-12, -75, 22, 27);
    ctx.fillStyle = flash > 0 ? '#ffe4d1' : '#96a078'; ctx.fillRect(-13, -103, 26, 24); ctx.fillStyle = '#30352a'; ctx.fillRect(-15, -106, 28, 7); ctx.fillRect(-9, -91, 4, 3); ctx.fillRect(5, -90, 4, 3); ctx.fillStyle = '#d8925e'; ctx.fillRect(-8, -94, 3, 2); ctx.fillRect(7, -93, 3, 2);
    ctx.fillStyle = '#657650'; ctx.fillRect(-24, -77 + wobble, 11, 27); ctx.fillRect(13, -78 - wobble, 10, 28);
    if (type === 'gunner') { ctx.fillStyle = '#302e28'; ctx.fillRect(9, -73, 28, 5); ctx.fillRect(31, -71, 8, 2); }
    if (type === 'bazooka-boss') { ctx.fillStyle = '#d4874d'; ctx.fillRect(9, -78, 35, 10); ctx.fillStyle = '#4d4838'; ctx.fillRect(37, -80, 10, 14); ctx.fillStyle = '#e9b360'; ctx.fillRect(14, -81, 6, 3); }
    if (boss) { ctx.fillStyle = '#d99354'; ctx.fillRect(-16, -111, 28, 5); ctx.fillRect(-12, -116, 5, 6); ctx.fillRect(3, -117, 5, 7); }
    if (boss) { ctx.fillStyle = '#171d17a8'; ctx.fillRect(-22, -124, 45, 4); ctx.fillStyle = '#f08964'; ctx.fillRect(-22, -124, 45 * Math.max(0, hp / maxHp), 4); }
    ctx.restore();
  }
  function render(now) {
    const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) { requestAnimationFrame(render); return; }
    const w = rect.width, h = rect.height, t = now / 1000;
    ctx.clearRect(0, 0, w, h);
    const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#9a9a69'); sky.addColorStop(.52, '#c5b579'); sky.addColorStop(.53, '#626c4c'); sky.addColorStop(1, '#353e2e'); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ead194'; ctx.globalAlpha = .55; ctx.beginPath(); ctx.arc(w * .77, h * .2, Math.min(w, h) * .14, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#707957'; ctx.beginPath(); ctx.moveTo(0, h * .58); ctx.lineTo(w * .1, h * .4); ctx.lineTo(w * .24, h * .55); ctx.lineTo(w * .4, h * .34); ctx.lineTo(w * .58, h * .58); ctx.lineTo(w * .72, h * .43); ctx.lineTo(w, h * .61); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
    ctx.fillStyle = '#535e43'; ctx.beginPath(); ctx.moveTo(0, h * .7); ctx.lineTo(w * .19, h * .53); ctx.lineTo(w * .39, h * .69); ctx.lineTo(w * .63, h * .5); ctx.lineTo(w * .83, h * .69); ctx.lineTo(w, h * .57); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
    ctx.fillStyle = '#3a422f'; ctx.fillRect(0, h * .73, w, h * .27);
    ctx.strokeStyle = '#d5ca8a22'; ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) { const y = h * (.76 + i * .045); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + 7); ctx.stroke(); }
    const ground = h * .83;
    for (let i = 0; i < 4; i++) { const x = ((i * .31 + .15 - (t * .025) % .31 + 1) % 1) * w; ctx.fillStyle = i % 2 ? '#555b3a' : '#6b6740'; ctx.fillRect(x, ground - 20 - (i % 2) * 8, 24, 20); ctx.strokeStyle = '#242d24'; ctx.strokeRect(x, ground - 20 - (i % 2) * 8, 24, 20); ctx.beginPath(); ctx.moveTo(x, ground - 20); ctx.lineTo(x + 24, ground); ctx.moveTo(x + 24, ground - 20); ctx.lineTo(x, ground); ctx.stroke(); }
    state.enemies.forEach(enemy => drawZombie(enemy.x * w, enemy.y * h, enemy.type, enemy.seed, enemy.flash, t, enemy.hp, enemy.maxHp));
    drawMan(state.player.x * w, ground + (Math.sin(t * 11) * 1.5), 1.12);
    state.bullets.forEach(bullet => { ctx.fillStyle = bullet.color; ctx.shadowColor = bullet.color; ctx.shadowBlur = 9; ctx.fillRect(bullet.x * w, bullet.y * h, 13, 3); ctx.shadowBlur = 0; });
    state.particles.forEach(p => { ctx.globalAlpha = clamp(p.life * 2, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x * w, p.y * h, p.size, p.size); }); ctx.globalAlpha = 1;
    // Small scene lighting and vignette keep the toy-like battlefield legible.
    const vignette = ctx.createRadialGradient(w / 2, h / 2, h * .17, w / 2, h / 2, w * .72); vignette.addColorStop(0, 'transparent'); vignette.addColorStop(1, '#141a1790'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
    const dt = state.lastTime ? Math.min((now - state.lastTime) / 1000, .05) : 0; state.lastTime = now; update(dt);
    requestAnimationFrame(render);
  }

  $('#playButton').addEventListener('click', () => startGame(state.difficulty));
  $('#quitButton').addEventListener('click', () => { openModal('settings'); showToast('GAME PAUSED — YOUR SETTINGS ARE HERE'); });
  $('#openUpdates').addEventListener('click', () => openModal('updates'));
  $('#shopButton').addEventListener('click', () => openModal('shop'));
  $('#rollButton').addEventListener('click', chooseGun);
  $('#exitGame').addEventListener('click', () => { switchScreen('home'); showToast('RUN PAUSED — COME BACK ANYTIME'); });
  document.querySelectorAll('[data-open="settings"]').forEach(button => button.addEventListener('click', () => openModal('settings')));
  document.querySelectorAll('.difficulty-option').forEach(button => button.addEventListener('click', () => {
    const next = button.dataset.difficulty; if (state.difficulty !== next) { state.difficulty = next; state.level = 1; state.kills = 0; state.enemies = []; state.bullets = []; }
    document.querySelectorAll('.difficulty-option').forEach(item => item.classList.toggle('selected', item === button)); updateHUD(); showToast(`${next.toUpperCase()} RUN SELECTED`); sound(460, .08);
  }));
  $('#modalClose').addEventListener('click', closeModal);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { if (modal.classList.contains('open')) closeModal(); else if (state.screen === 'game') switchScreen('home'); }
    if (['ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    if (event.code === 'Space') state.keys.Space = true; else state.keys[event.code] = true;
  });
  document.addEventListener('keyup', event => { state.keys[event.code] = false; if (event.code === 'Space') state.keys.Space = false; });
  const hold = (element, key) => { element.addEventListener('pointerdown', event => { event.preventDefault(); state.keys[key] = true; element.setPointerCapture?.(event.pointerId); }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(name => element.addEventListener(name, () => { state.keys[key] = false; })); };
  hold($('#moveLeft'), 'left'); hold($('#moveRight'), 'right'); hold($('#fireButton'), 'fire');
  canvas.addEventListener('pointerdown', event => { if (state.screen === 'game') { state.pointerFire = true; canvas.setPointerCapture(event.pointerId); } });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(name => canvas.addEventListener(name, () => { state.pointerFire = false; }));
  window.addEventListener('blur', () => { state.keys = {}; state.pointerFire = false; });
  window.addEventListener('resize', resizeCanvas);
  updateHUD(); requestAnimationFrame(render);
})();
