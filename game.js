// O Ermitão — Simulador do Amigo Recluso
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = 960, H = 640;

// --- State ---
let state = "menu"; // menu, playing, gameover
let day = 1, gameTime = 8 * 3600, timeSpeed = 60;
let daysWithoutLeaving = 0, csHoursToday = 0, botaGamesWatched = 0;
let totalWorkDays = 0, consecutiveWorkDays = 0, workedToday = false;
let notification = "", notifTimer = 0;
let eventText = "", eventTimer = 0, eventCooldown = 0;
let achievementPopup = null, achievementTimer = 0;
let gameOverReason = "";
let hoveredFurniture = null;
let actionProgress = 0, actionDuration = 0;

// Needs
const needs = {
    hunger: 80, sleep: 90, cs: 30, horniness: 20,
    money: 50, sanity: 95, hygiene: 15
};

function clampNeeds() {
    for (let k in needs) needs[k] = Math.max(0, Math.min(100, needs[k]));
}

// Character
const char = {
    x: W / 2, y: H / 2, tx: W / 2, ty: W / 2,
    state: "idle", speed: 120, beardLevel: 0,
    animTimer: 0, animFrame: 0, actionTimer: 0, actionDuration: 0
};

// Furniture
const furniture = {
    pc:     { x: 680, y: 120, w: 100, h: 60, ix: 680, iy: 185 },
    bed:    { x: 150, y: 420, w: 120, h: 70, ix: 210, iy: 380 },
    fridge: { x: 100, y: 120, w: 50,  h: 60, ix: 130, iy: 185 },
    trash:  { x: 400, y: 500, w: 50,  h: 40, ix: 400, iy: 460 },
    poster: { x: 400, y: 70,  w: 70,  h: 90, ix: 400, iy: 160 },
    phone:  { x: 550, y: 420, w: 35,  h: 50, ix: 550, iy: 380 },
};

// Achievements
const achievements = [
    { name: "Semana Produtiva", desc: "Trabalhou 7 dias seguidos", check: () => consecutiveWorkDays >= 7, unlocked: false },
    { name: "Rato de Ranque", desc: "Jogou CS por 8h seguidas", check: () => csHoursToday >= 8, unlocked: false },
    { name: "Fiel Torcedor", desc: "Assistiu 10 jogos do Botafogo", check: () => botaGamesWatched >= 10, unlocked: false },
    { name: "Lenda do Quarto", desc: "Sobreviveu 30 dias", check: () => day >= 30, unlocked: false },
];

// Events
const events = [
    { text: "Botafogo GANHOU ontem! Sanidade +25!", fx: () => { needs.sanity += 25; } },
    { text: "Botafogo PERDEU... Sanidade -30!", fx: () => { needs.sanity -= 30; needs.hunger -= 10; } },
    { text: "iFood atrasou 2 horas... Crise existencial!", fx: () => { needs.sanity -= 15; needs.hunger -= 20; } },
    { text: "PC travou no meio do CS!! RAGE!", fx: () => { needs.sanity -= 25; needs.cs += 30; } },
    { text: "Amigos chamaram pra sair... Recusou obvio.", fx: () => { needs.sanity -= 5; } },
    { text: "3h no Pornhub sem achar o video perfeito.", fx: () => { needs.horniness += 20; needs.sanity -= 10; needs.sleep -= 15; } },
    { text: "Vizinho reclamou do barulho as 3 da manha.", fx: () => { needs.sanity -= 5; } },
    { text: "Encontrou R$20 no bolso da calca suja!", fx: () => { needs.money += 15; } },
    { text: "Internet caiu por 30 min. PANICO!", fx: () => { needs.sanity -= 20; needs.cs += 25; } },
    { text: "Mae ligou perguntando se ta vivo.", fx: () => { needs.sanity += 5; } },
];

// --- Seeded random for deterministic visuals ---
function seededRand(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    s = s * 16807 % 2147483647;
    return (s - 1) / 2147483646;
}

// --- Drawing helpers ---
function fillRect(x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
}

function strokeRect(x, y, w, h, col, lw = 1) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.strokeRect(x, y, w, h);
}

function circle(cx, cy, r, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
}

function text(str, x, y, col = "#fff", size = 14, align = "left", bold = false) {
    ctx.fillStyle = col;
    ctx.font = `${bold ? "bold " : ""}${size}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
    ctx.textAlign = "left";
}

function hslColor(h, s, l) {
    return `hsl(${h}, ${s}%, ${l}%)`;
}

// --- Room Drawing ---
function drawRoom() {
    // Floor
    for (let tx = 0; tx < W; tx += 32) {
        for (let ty = 0; ty < H; ty += 32) {
            const shade = ((tx / 32 + ty / 32) % 2 === 0) ? 48 : 45;
            fillRect(tx, ty, 32, 32, `rgb(${shade},${shade - 7},${shade - 13})`);
        }
    }
    // Walls
    fillRect(0, 0, W, 40, "#463c32");
    fillRect(0, 0, 40, H, "#3c3228");
    fillRect(W - 40, 0, 40, H, "#3c3228");

    // Window with curtain
    fillRect(W - 38, 200, 34, 80, "#1e1e32");
    fillRect(W - 36, 202, 30, 76, "#642828");

    // --- PC ---
    const pc = furniture.pc;
    fillRect(pc.x - 50, pc.y - 20, 100, 50, "#503c28"); // desk
    fillRect(pc.x - 25, pc.y - 48, 50, 35, "#1e1e1e"); // monitor
    fillRect(pc.x - 22, pc.y - 45, 44, 29, "#145014"); // screen
    // RGB keyboard
    for (let i = 0; i < 6; i++) {
        const hue = (Date.now() / 50 + i * 50) % 360;
        fillRect(pc.x - 20 + i * 7, pc.y + 5, 6, 3, hslColor(hue, 100, 50));
    }
    // Gaming text on screen when playing
    if (char.state === "gaming") {
        text("CS:GO", pc.x, pc.y - 30, "#0f0", 12, "center", true);
        fillRect(pc.x - 22, pc.y - 45, 44, 29, "rgba(0,255,0,0.08)");
    } else if (char.state === "working") {
        text("CODE", pc.x, pc.y - 30, "#0af", 12, "center", true);
    }
    fillRect(pc.x - 15, pc.y + 30, 30, 25, "#282828"); // chair
    fillRect(pc.x - 18, pc.y + 20, 36, 12, "#323232"); // chair back

    // --- Bed ---
    const bed = furniture.bed;
    fillRect(bed.x - 60, bed.y - 35, 120, 70, "#3c3228");
    fillRect(bed.x - 55, bed.y - 30, 110, 60, "#505078");
    fillRect(bed.x - 55, bed.y - 30, 35, 25, "#64648c"); // pillow
    if (char.state === "sleeping") {
        text("Zzz", bed.x + 20, bed.y - 40, "#aaf", 16, "center", true);
    }

    // --- Fridge ---
    const fr = furniture.fridge;
    fillRect(fr.x - 20, fr.y - 30, 40, 60, "#b4b4be");
    fillRect(fr.x - 18, fr.y - 28, 36, 25, "#a0a0aa");
    circle(fr.x + 15, fr.y - 15, 3, "#787882");

    // --- Poster Botafogo ---
    const po = furniture.poster;
    fillRect(po.x - 30, po.y - 40, 60, 80, "#141414");
    circle(po.x, po.y - 15, 8, "#ffd700");
    circle(po.x, po.y - 15, 6, "#141414");
    circle(po.x, po.y - 15, 4, "#ffd700");
    text("BOTAFOGO", po.x, po.y + 22, "#fff", 10, "center", true);

    // --- Trash ---
    const tr = furniture.trash;
    const trashCount = Math.min(daysWithoutLeaving, 15);
    for (let i = 0; i < trashCount; i++) {
        const tx2 = tr.x - 15 + (seededRand(i * 7) * 30) | 0;
        const ty2 = tr.y - 5 + (seededRand(i * 3) * 20) | 0;
        const cols = ["#b43c3c", "#3cb43c", "#b4b43c", "#966432"];
        fillRect(tx2, ty2, 8 + i % 5, 6 + i % 3, cols[i % 4]);
    }

    // --- Phone ---
    const ph = furniture.phone;
    fillRect(ph.x - 8, ph.y - 15, 16, 30, "#1e1e1e");
    fillRect(ph.x - 6, ph.y - 12, 12, 22, "#3c3c50");
}

// --- Character Drawing ---
function drawChar() {
    const x = char.x | 0, y = char.y | 0;
    const bob = char.state === "walking" ? Math.sin(char.animTimer * 8) * 2 : 0;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(x, y + 22, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const by = y - 8 + bob;

    // Body - Botafogo stripes
    fillRect(x - 10, by, 20, 20, "#000");
    for (let i = 0; i < 4; i++) {
        if (i % 2 === 0) fillRect(x - 10 + i * 5, by, 5, 20, "#fff");
    }
    // Star
    circle(x, by + 6, 2, "#ffd700");

    // Head
    const hy = y - 20 + bob;
    circle(x, hy, 10, "#d2aa82");

    // Hair
    ctx.strokeStyle = "#3c2814";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, hy - 2, 10, Math.PI, 0);
    ctx.stroke();

    // Eyes
    if (char.state === "sleeping") {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 5, hy - 1); ctx.lineTo(x - 1, hy - 1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 1, hy - 1); ctx.lineTo(x + 5, hy - 1); ctx.stroke();
    } else {
        circle(x - 3, hy - 2, 2, "#000");
        circle(x + 3, hy - 2, 2, "#000");
        // Eye highlight
        circle(x - 2, hy - 3, 0.8, "#fff");
        circle(x + 4, hy - 3, 0.8, "#fff");
    }

    // Beard
    if (char.beardLevel > 0) {
        for (let i = 0; i < Math.min(char.beardLevel, 10); i++) {
            const bx = x - 5 + (seededRand(i * 42) * 10) | 0;
            const bby = hy + 5 + (seededRand(i * 13) * Math.min(char.beardLevel, 8)) | 0;
            circle(bx, bby, 1, `rgb(${80 + Math.min(char.beardLevel * 5, 80)},60,30)`);
        }
    }

    // Arms
    ctx.strokeStyle = "#d2aa82";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 10, by + 2); ctx.lineTo(x - 15, by + 15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 10, by + 2); ctx.lineTo(x + 15, by + 15); ctx.stroke();

    // Legs
    fillRect(x - 8, y + 12 + bob, 7, 10, "#32325a");
    fillRect(x + 1, y + 12 + bob, 7, 10, "#32325a");

    // Feet
    fillRect(x - 9, y + 22 + bob, 8, 3, "#3c3c3c");
    fillRect(x + 1, y + 22 + bob, 8, 3, "#3c3c3c");

    // State indicator
    if (char.state === "fapping") {
        text("...", x, y - 35 + bob, "#f0a", 16, "center", true);
    }
}

// --- UI ---
function drawNeedBar(x, y, label, value, color, w = 130) {
    text(label, x, y + 11, "#fff", 12);
    const bx = x + 95;
    fillRect(bx, y, w, 14, "#282828");
    fillRect(bx, y, (value / 100) * w, 14, color);
    strokeRect(bx, y, w, 14, "#555");
    text(`${value | 0}`, bx + w + 5, y + 11, "#fff", 11);
}

function drawUI() {
    // Top bar
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, 0, W, 48);

    text(`Dia ${day}`, 15, 30, "#fff", 20, "left", true);
    text(getTimeStr(), 125, 30, "#ffd700", 20, "left", true);
    text(`Dias sem sair: ${daysWithoutLeaving}`, 255, 28, "#c86464", 13);

    const stateNames = {
        idle: "Parado", walking: "Andando", working: "Trabalhando",
        gaming: "Jogando CS", sleeping: "Dormindo", eating: "Comendo",
        fapping: "... ocupado"
    };
    text(stateNames[char.state] || char.state, 460, 28, "#5c5", 15);
    text(`Vel: ${timeSpeed}x  [+/-]`, W - 160, 28, "#666", 12);

    // Needs panel
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(W - 255, 52, 250, 140);

    const bx = W - 248, by2 = 57;
    drawNeedBar(bx, by2,      "\u{1F355} Fome",    needs.hunger,    "#dc8232");
    drawNeedBar(bx, by2 + 18, "\u{1F634} Sono",    needs.sleep,     "#6464dc");
    drawNeedBar(bx, by2 + 36, "\u{1F4BB} CS",      needs.cs,        "#32c864");
    drawNeedBar(bx, by2 + 54, "\u{1F4F1} Punheta", needs.horniness, "#dc3296");
    drawNeedBar(bx, by2 + 72, "\u{1F4B0} Dinheiro",needs.money,     "#dcca32");
    drawNeedBar(bx, by2 + 90, "\u{1F9E0} Sanidade",needs.sanity,    "#b432dc");
    drawNeedBar(bx, by2 +108, "\u{1F6BF} Higiene", needs.hygiene,   "#32b4c8");

    // Action buttons
    const actions = [
        ["Trabalhar [1]", "work",      "#3264dc"],
        ["Jogar CS [2]",  "play_cs",   "#32c850"],
        ["Dormir [3]",    "sleep",     "#6464dc"],
        ["Comer [4]",     "eat",       "#dc8232"],
        ["Punheta [5]",   "fap",       "#dc3296"],
        ["Bota [6]",      "watch_bota","#c8a000"],
    ];
    const btnW = 140, btnH = 35;
    const startX = (W - actions.length * (btnW + 8)) / 2;
    const btnY = H - 48;

    actionButtons = [];
    const [mx2, my2] = mousePos;
    actions.forEach(([label, action, color], i) => {
        const bx2 = startX + i * (btnW + 8);
        const rect = { x: bx2, y: btnY, w: btnW, h: btnH };
        actionButtons.push({ rect, action });

        const hovered = mx2 >= rect.x && mx2 <= rect.x + rect.w && my2 >= rect.y && my2 <= rect.y + rect.h;
        ctx.fillStyle = hovered ? lighten(color) : color;
        roundRect(bx2, btnY, btnW, btnH, 5);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        roundRect(bx2, btnY, btnW, btnH, 5);
        ctx.stroke();

        text(label, bx2 + btnW / 2, btnY + btnH / 2 + 5, "#fff", 12, "center");
    });

    // Progress bar
    if (char.actionTimer > 0 && char.actionDuration > 0) {
        const prog = 1 - char.actionTimer / char.actionDuration;
        const pw = 200, px = (W - pw) / 2, py = H - 85;
        fillRect(px, py, pw, 14, "#282828");
        fillRect(px, py, pw * prog, 14, "#5c5");
        strokeRect(px, py, pw, 14, "#fff");
    }

    // Notification
    if (notifTimer > 0) {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(0.8, notifTimer * 0.4)})`;
        ctx.fillRect((W - 420) / 2, 52, 420, 35);
        text(notification, W / 2, 75, "#ffd700", 14, "center");
    }

    // Event popup
    if (eventTimer > 0) {
        ctx.fillStyle = "rgba(50,0,0,0.85)";
        ctx.fillRect((W - 520) / 2, H / 2 - 35, 520, 55);
        ctx.strokeStyle = "#e33";
        ctx.lineWidth = 2;
        ctx.strokeRect((W - 520) / 2, H / 2 - 35, 520, 55);
        text(eventText, W / 2, H / 2, "#fff", 15, "center");
    }

    // Achievement popup
    if (achievementPopup && achievementTimer > 0) {
        ctx.fillStyle = "rgba(0,50,0,0.85)";
        ctx.fillRect((W - 370) / 2, 95, 370, 50);
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 2;
        ctx.strokeRect((W - 370) / 2, 95, 370, 50);
        text(`CONQUISTA: ${achievementPopup.name}`, W / 2, 115, "#ffd700", 14, "center", true);
        text(achievementPopup.desc, W / 2, 135, "#fff", 12, "center");
    }

    // Furniture tooltip
    if (hoveredFurniture) {
        const names = { pc: "PC Gamer", bed: "Cama", fridge: "Frigobar", trash: "Lixo", poster: "Poster Botafogo", phone: "Celular" };
        const [tmx, tmy] = mousePos;
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        const n = names[hoveredFurniture] || "";
        ctx.fillRect(tmx + 10, tmy - 22, ctx.measureText(n).width + 14, 22);
        text(n, tmx + 17, tmy - 5, "#fff", 12);
    }
}

function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function lighten(hex) {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + 40);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + 40);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + 40);
    return `rgb(${r},${g},${b})`;
}

function getTimeStr() {
    const h = ((gameTime / 3600) | 0) % 24;
    const m = (((gameTime % 3600) / 60) | 0);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// --- Actions ---
let actionButtons = [];

function doAction(action) {
    if (char.state !== "idle" && char.state !== "walking") return;

    if (action === "work") {
        moveTo(furniture.pc);
        startAction("working", 5);
        needs.money += 15; needs.cs += 10; needs.sleep -= 5;
        workedToday = true; consecutiveWorkDays++; totalWorkDays++;
        gameTime += 2 * 3600;
        notify("Trabalhando... +R$ | Vontade de CS subindo");
    } else if (action === "play_cs") {
        moveTo(furniture.pc);
        startAction("gaming", 6);
        needs.cs -= 40; needs.horniness += 5; needs.sleep -= 10; needs.hunger -= 8;
        csHoursToday += 3; gameTime += 3 * 3600;
        notify("JOGANDO CS! Ranque subindo... ou nao");
    } else if (action === "sleep") {
        moveTo(furniture.bed);
        startAction("sleeping", 8);
        needs.sleep += 70; needs.hunger -= 15;
        gameTime += 8 * 3600;
        if (gameTime >= 24 * 3600) { gameTime -= 24 * 3600; advanceDay(); }
        notify("Zzz... Dormindo como pedra");
    } else if (action === "eat") {
        moveTo(furniture.fridge);
        startAction("eating", 3);
        if (needs.money >= 10) {
            needs.hunger += 40; needs.money -= 10;
            notify("Pediu iFood! -R$ +Comida");
        } else {
            needs.hunger += 10;
            notify("Sem dinheiro... comeu miojo velho");
        }
    } else if (action === "fap") {
        moveTo(furniture.phone);
        startAction("fapping", 4);
        needs.horniness -= 50; needs.sanity -= 8; needs.sleep -= 5;
        gameTime += 1 * 3600;
        notify("... ... ... Sanidade -8");
    } else if (action === "watch_bota") {
        moveTo(furniture.poster);
        startAction("idle", 5);
        botaGamesWatched++;
        if (Math.random() > 0.5) {
            needs.sanity += 25;
            notify("BOTAFOGO GANHOU!! GLORIA ETERNA!!");
        } else {
            needs.sanity -= 20;
            notify("Botafogo perdeu... dor... sofrimento...");
        }
        gameTime += 2 * 3600;
    }
    clampNeeds();
}

function moveTo(f) {
    char.tx = f.ix; char.ty = f.iy;
    char.state = "walking";
}

function startAction(action, dur) {
    char.state = action;
    char.actionTimer = dur;
    char.actionDuration = dur;
}

function notify(msg) { notification = msg; notifTimer = 3; }

function advanceDay() {
    day++;
    daysWithoutLeaving++;
    char.beardLevel = daysWithoutLeaving;
    csHoursToday = 0;
    if (!workedToday) consecutiveWorkDays = 0;
    workedToday = false;
}

// --- Update ---
function update(dt) {
    if (state !== "playing") return;

    char.animTimer += dt;

    // Movement
    if (char.state === "walking") {
        const dx = char.tx - char.x, dy = char.ty - char.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 3) {
            char.x = char.tx; char.y = char.ty;
            // Don't reset to idle - action was already set
        } else {
            char.x += (dx / dist) * char.speed * dt;
            char.y += (dy / dist) * char.speed * dt;
        }
    }

    // Action timer
    if (char.actionTimer > 0) {
        char.actionTimer -= dt;
        if (char.actionTimer <= 0) {
            char.actionTimer = 0;
            char.state = "idle";
        }
    }

    // Needs decay
    const gameDt = dt * timeSpeed;
    const hour = gameDt / 3600;
    needs.hunger -= 4 * hour;
    needs.sleep -= 3.5 * hour;
    needs.cs += 5 * hour;
    needs.horniness += 2 * hour;
    needs.sanity -= 0.3 * hour;
    clampNeeds();

    // Timers
    if (notifTimer > 0) notifTimer -= dt;
    if (eventTimer > 0) eventTimer -= dt;
    if (achievementTimer > 0) {
        achievementTimer -= dt;
        if (achievementTimer <= 0) achievementPopup = null;
    }

    // Random events
    eventCooldown -= dt;
    if (eventCooldown <= 0 && char.state === "idle" && Math.random() < 0.005) {
        const ev = events[(Math.random() * events.length) | 0];
        eventText = ev.text;
        eventTimer = 4;
        ev.fx();
        clampNeeds();
        eventCooldown = 15;
    }

    // Game over
    if (needs.hunger <= 0 && needs.money <= 0) {
        state = "gameover";
        gameOverReason = "Morreu de fome! Sem dinheiro pra iFood...";
    } else if (needs.sanity <= 0) {
        state = "gameover";
        gameOverReason = "Perdeu a sanidade! Saiu pelado gritando 'RUSH B!'";
    } else if (needs.sleep <= 0) {
        state = "gameover";
        gameOverReason = "Desmaiou no teclado. O corpo nao aguentou.";
    }

    // Achievements
    achievements.forEach(a => {
        if (!a.unlocked && a.check()) {
            a.unlocked = true;
            achievementPopup = a;
            achievementTimer = 4;
        }
    });

    // Hover
    hoveredFurniture = getFurnitureAt(mousePos[0], mousePos[1]);
}

function getFurnitureAt(mx, my) {
    for (let k in furniture) {
        const f = furniture[k];
        if (mx >= f.x - f.w / 2 && mx <= f.x + f.w / 2 && my >= f.y - f.h / 2 && my <= f.y + f.h / 2) return k;
    }
    return null;
}

// --- Screens ---
function drawMenu() {
    ctx.fillStyle = "#0f0c0a";
    ctx.fillRect(0, 0, W, H);

    text("O ERMITAO", W / 2, 130, "#fff", 40, "center", true);
    text("Simulador do Amigo Recluso", W / 2, 170, "#666", 20, "center");

    // Botafogo star
    circle(W / 2, 230, 22, "#ffd700");
    circle(W / 2, 230, 18, "#0f0c0a");
    circle(W / 2, 230, 14, "#ffd700");

    const lines = [
        ["Controles:", "#ffd700"],
        ["1-6  ou  Botoes = Acoes", "#fff"],
        ["+/-  = Velocidade do tempo", "#fff"],
        ["Click nos moveis = Interagir", "#fff"],
        ["", ""],
        ["Sobreviva o maximo de dias sem sair!", "#fff"],
        ["", ""],
        ["Pressione ENTER ou clique para comecar", "#5c5"],
    ];
    lines.forEach(([l, c], i) => { if (l) text(l, W / 2, 290 + i * 28, c, 15, "center"); });
}

function drawGameOver() {
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(0, 0, W, H);

    text("GAME OVER", W / 2, H / 2 - 70, "#e33", 38, "center", true);
    text(gameOverReason, W / 2, H / 2 - 15, "#fff", 16, "center");

    const stats = [
        `Dias sobrevividos: ${day}`,
        `Dias sem sair: ${daysWithoutLeaving}`,
        `Dias trabalhados: ${totalWorkDays}`,
    ];
    stats.forEach((s, i) => text(s, W / 2, H / 2 + 35 + i * 25, "#888", 15, "center"));

    const unlocked = achievements.filter(a => a.unlocked);
    if (unlocked.length) {
        text("Conquistas:", W / 2, H / 2 + 120, "#ffd700", 16, "center", true);
        unlocked.forEach((a, i) => text(`★ ${a.name}`, W / 2, H / 2 + 145 + i * 20, "#ffd700", 13, "center"));
    }

    text("Pressione R para recomecar", W / 2, H - 50, "#5c5", 16, "center");
}

// --- Input ---
let mousePos = [0, 0];

canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    mousePos = [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
});

canvas.addEventListener("click", e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width, scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX, my = (e.clientY - rect.top) * scaleY;

    if (state === "menu") { resetGame(); state = "playing"; return; }
    if (state === "gameover") return;

    // Check buttons
    for (const { rect: r, action } of actionButtons) {
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
            doAction(action); return;
        }
    }

    // Check furniture
    const f = getFurnitureAt(mx, my);
    if (f === "pc") doAction(needs.cs < 50 ? "work" : "play_cs");
    else if (f === "bed") doAction("sleep");
    else if (f === "fridge") doAction("eat");
    else if (f === "phone") doAction("fap");
    else if (f === "poster") doAction("watch_bota");
});

document.addEventListener("keydown", e => {
    if (state === "menu") {
        if (e.key === "Enter") { resetGame(); state = "playing"; }
        return;
    }
    if (state === "gameover") {
        if (e.key === "r" || e.key === "R") { resetGame(); state = "playing"; }
        return;
    }
    if (e.key === "1") doAction("work");
    else if (e.key === "2") doAction("play_cs");
    else if (e.key === "3") doAction("sleep");
    else if (e.key === "4") doAction("eat");
    else if (e.key === "5") doAction("fap");
    else if (e.key === "6") doAction("watch_bota");
    else if (e.key === "+" || e.key === "=") timeSpeed = Math.min(300, timeSpeed + 30);
    else if (e.key === "-") timeSpeed = Math.max(10, timeSpeed - 30);
});

function resetGame() {
    Object.assign(needs, { hunger: 80, sleep: 90, cs: 30, horniness: 20, money: 50, sanity: 95, hygiene: 15 });
    Object.assign(char, { x: W / 2, y: H / 2, tx: W / 2, ty: H / 2, state: "idle", beardLevel: 0, animTimer: 0, actionTimer: 0, actionDuration: 0 });
    day = 1; gameTime = 8 * 3600; timeSpeed = 60;
    daysWithoutLeaving = 0; csHoursToday = 0; botaGamesWatched = 0;
    totalWorkDays = 0; consecutiveWorkDays = 0; workedToday = false;
    notification = ""; notifTimer = 0; eventText = ""; eventTimer = 0; eventCooldown = 0;
    achievementPopup = null; achievementTimer = 0; gameOverReason = "";
    achievements.forEach(a => a.unlocked = false);
}

// --- Game Loop ---
let lastTime = performance.now();

function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    update(dt);

    ctx.clearRect(0, 0, W, H);

    if (state === "menu") {
        drawMenu();
    } else {
        drawRoom();
        drawChar();
        drawUI();
        if (state === "gameover") drawGameOver();
    }

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
