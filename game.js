// JELLY: THE GAME — Simulador do Amigo Recluso
// Estilo pixel art retrô com painel lateral

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = 960, H = 640;

// Layout: game area left, sidebar right
const BORDER = 8;
const HEADER = 40;
const SIDEBAR_W = 200;
const GAME_X = BORDER;
const GAME_Y = HEADER;
const GAME_W = W - SIDEBAR_W - BORDER * 2;
const GAME_H = H - HEADER - BORDER;
const SIDE_X = W - SIDEBAR_W - BORDER;
const SIDE_Y = HEADER;

// Colors
const YELLOW = "#e8c840";
const DARK_BG = "#1a1520";
const ROOM_FLOOR = "#2a2530";
const ROOM_WALL = "#3a3040";
const WALL_TOP = "#282030";

// --- State ---
let gameState = "menu";
let day = 1, gameTime = 8 * 3600, timeSpeed = 60;
let daysWithoutLeaving = 0, csHoursToday = 0, botaGamesWatched = 0;
let totalWorkDays = 0, consecutiveWorkDays = 0, workedToday = false;
let notification = "", notifTimer = 0;
let eventText = "", eventTimer = 0, eventCooldown = 0;
let achievementPopup = null, achievementTimer = 0;
let gameOverReason = "";
let speechBubble = "", speechTimer = 0;
let orangeNotif = "", orangeNotifTimer = 0;

const needs = { hunger: 80, sleep: 90, cs: 30, horniness: 20, money: 50, sanity: 95, hygiene: 15 };
function clampNeeds() { for (let k in needs) needs[k] = Math.max(0, Math.min(100, needs[k])); }

const player = {
    x: 380, y: 380, tx: 380, ty: 380,
    state: "idle", speed: 150, beardLevel: 0,
    animTimer: 0, actionTimer: 0, actionDuration: 0
};

// Furniture positions (relative to game area)
const furniture = {
    pc:     { x: 200, y: 180, w: 140, h: 100, ix: 230, iy: 300 },
    bed:    { x: 580, y: 250, w: 140, h: 130, ix: 520, iy: 350 },
    fridge: { x: 50,  y: 250, w: 70,  h: 90,  ix: 90,  iy: 360 },
    poster: { x: 420, y: 70,  w: 80,  h: 100, ix: 420, iy: 250 },
    poster2:{ x: 560, y: 70,  w: 70,  h: 90,  ix: 560, iy: 250 },
    phone:  { x: 350, y: 420, w: 40,  h: 40,  ix: 350, iy: 380 },
};

const achievements = [
    { name: "Semana Produtiva", desc: "Trabalhou 7 dias seguidos", check: () => consecutiveWorkDays >= 7, unlocked: false },
    { name: "Rato de Ranque", desc: "Jogou CS por 8h seguidas", check: () => csHoursToday >= 8, unlocked: false },
    { name: "Fiel Torcedor", desc: "Assistiu 10 jogos do Botafogo", check: () => botaGamesWatched >= 10, unlocked: false },
    { name: "Lenda do Quarto", desc: "Sobreviveu 30 dias", check: () => day >= 30, unlocked: false },
];

const events = [
    { text: "BOTAFOGO GANHOU!", fx: () => { needs.sanity += 25; } },
    { text: "BOTAFOGO PERDEU...", fx: () => { needs.sanity -= 30; needs.hunger -= 10; } },
    { text: "IFOOD ATRASOU 2H!", fx: () => { needs.sanity -= 15; needs.hunger -= 20; } },
    { text: "PC TRAVOU NO CS!!", fx: () => { needs.sanity -= 25; needs.cs += 30; } },
    { text: "AMIGOS CHAMARAM PRA SAIR", fx: () => { needs.sanity -= 5; } },
    { text: "3H NO PORNHUB...", fx: () => { needs.horniness += 20; needs.sanity -= 10; needs.sleep -= 15; } },
    { text: "VIZINHO RECLAMOU!", fx: () => { needs.sanity -= 5; } },
    { text: "ACHOU R$20 NA CALCA!", fx: () => { needs.money += 15; } },
    { text: "INTERNET CAIU!", fx: () => { needs.sanity -= 20; needs.cs += 25; } },
    { text: "MAE LIGOU...", fx: () => { needs.sanity += 5; } },
];

function seededRand(seed) {
    let s = ((seed % 2147483647) + 2147483647) % 2147483647;
    if (s === 0) s = 1;
    s = s * 16807 % 2147483647;
    return (s - 1) / 2147483646;
}

// --- Pixel-style drawing helpers ---
function px(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }

function txt(str, x, y, col = "#fff", size = 14, align = "left", bold = false) {
    ctx.fillStyle = col;
    ctx.font = `${bold ? "bold " : ""}${size}px "Courier New", monospace`;
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
    ctx.textAlign = "left";
}

function circle(cx, cy, r, col) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
}

function getTimeStr() {
    const h = ((gameTime / 3600) | 0) % 24;
    const m = (((gameTime % 3600) / 60) | 0);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// --- Draw the room (pixel art style) ---
function drawRoom() {
    const gx = GAME_X, gy = GAME_Y, gw = GAME_W, gh = GAME_H;

    // Room background - dark moody room
    px(gx, gy, gw, gh, "#1e1828");

    // Back wall
    px(gx, gy, gw, gh * 0.38, "#2a2238");

    // Floor - darker with subtle grid
    const floorY = gy + gh * 0.38;
    px(gx, floorY, gw, gh * 0.62, "#1a1620");
    // Floor texture
    for (let fx = 0; fx < gw; fx += 40) {
        for (let fy = 0; fy < gh * 0.62; fy += 40) {
            const shade = ((fx / 40 + fy / 40) % 2 === 0) ? 2 : 0;
            px(gx + fx, floorY + fy, 40, 40, `rgba(255,255,255,${0.01 + shade * 0.005})`);
        }
    }

    // Wall-floor line
    px(gx, floorY - 2, gw, 4, "#141020");

    // --- Window (back wall, with curtains) ---
    const winX = gx + 80, winY = gy + 20, winW = 100, winH = 110;
    px(winX, winY, winW, winH, "#283848"); // window frame
    px(winX + 4, winY + 4, winW - 8, winH - 8, "#384858"); // glass (dim)
    // Curtains
    px(winX - 15, winY, 20, winH + 10, "#4a3050");
    px(winX + winW - 5, winY, 20, winH + 10, "#4a3050");
    // Curtain folds
    for (let i = 0; i < 4; i++) {
        px(winX - 12, winY + i * 28, 14, 2, "#3a2040");
        px(winX + winW - 2, winY + i * 28, 14, 2, "#3a2040");
    }

    // --- PC DESK + MONITOR ---
    const pcX = gx + 120, pcY = gy + 90;
    // Desk
    px(pcX - 20, pcY + 60, 180, 12, "#5a4030"); // desk top
    px(pcX, pcY + 72, 8, 50, "#4a3020"); // desk leg left
    px(pcX + 140, pcY + 72, 8, 50, "#4a3020"); // desk leg right
    // Monitor
    px(pcX + 30, pcY - 10, 90, 65, "#1a1a2a"); // monitor frame
    px(pcX + 34, pcY - 6, 82, 57, "#2a4a2a"); // screen (CS greenish)
    // CS crosshair on screen
    if (player.state === "gaming") {
        px(pcX + 34, pcY - 6, 82, 57, "#1a3a1a");
        // Simple FPS view
        px(pcX + 50, pcY + 25, 48, 25, "#6a5a3a"); // ground
        px(pcX + 50, pcY + 5, 48, 20, "#4a6a8a"); // sky
        // Crosshair
        px(pcX + 73, pcY + 15, 2, 10, "#fff");
        px(pcX + 68, pcY + 19, 12, 2, "#fff");
    } else if (player.state === "working") {
        px(pcX + 34, pcY - 6, 82, 57, "#1a2a3a");
        // Code lines
        for (let i = 0; i < 6; i++) {
            const lw = 20 + seededRand(i * 33) * 40;
            px(pcX + 40, pcY + 2 + i * 8, lw, 3, i % 2 === 0 ? "#4a8aca" : "#6aca6a");
        }
    }
    // Monitor stand
    px(pcX + 65, pcY + 52, 18, 10, "#2a2a2a");
    // Keyboard - RGB
    for (let i = 0; i < 10; i++) {
        const hue = (Date.now() / 30 + i * 36) % 360;
        px(pcX + 30 + i * 10, pcY + 65, 9, 5, `hsl(${hue},100%,50%)`);
    }
    // Mouse
    px(pcX + 140, pcY + 65, 10, 7, "#3a3a3a");
    // iFood box on desk
    px(pcX - 10, pcY + 45, 35, 20, "#e83030");
    txt("iFood", pcX - 5, pcY + 60, "#fff", 8, "left", true);
    // Energy drink cans
    px(pcX + 150, pcY + 50, 8, 14, "#d03030");
    px(pcX + 160, pcY + 53, 8, 14, "#30a030");
    // Chair
    px(pcX + 50, pcY + 100, 50, 10, "#2a2a2a");
    px(pcX + 55, pcY + 80, 40, 22, "#3a3a3a");

    // --- BED (right side) ---
    const bedX = gx + 510, bedY = gy + 160;
    // Bed frame
    px(bedX, bedY, 180, 120, "#4a3828");
    // Headboard
    px(bedX + 150, bedY - 40, 30, 50, "#5a4030");
    // Mattress with Botafogo pattern (black & white polka dot)
    px(bedX + 4, bedY + 4, 172, 112, "#e8e8e8");
    // Black dots pattern
    for (let dx = 0; dx < 8; dx++) {
        for (let dy = 0; dy < 5; dy++) {
            if ((dx + dy) % 2 === 0) {
                circle(bedX + 18 + dx * 22, bedY + 18 + dy * 22, 8, "#1a1a1a");
            }
        }
    }
    // Pillow
    px(bedX + 140, bedY + 10, 30, 40, "#c8c8d8");

    // --- BOTAFOGO POSTER 1 (on back wall) ---
    const p1x = gx + 370, p1y = gy + 10;
    px(p1x, p1y, 90, 120, "#141414");
    px(p1x + 2, p1y + 2, 86, 116, "#1a1a1a");
    // Star logo
    circle(p1x + 45, p1y + 40, 20, "#fff");
    circle(p1x + 45, p1y + 40, 17, "#000");
    // Star shape (simplified)
    ctx.fillStyle = "#fff";
    const starCx = p1x + 45, starCy = p1y + 40;
    for (let i = 0; i < 5; i++) {
        const angle = (i * 72 - 90) * Math.PI / 180;
        const sx = starCx + Math.cos(angle) * 10;
        const sy = starCy + Math.sin(angle) * 10;
        px(sx - 2, sy - 2, 4, 4, "#fff");
    }
    txt("BOTAFOGO", p1x + 45, p1y + 80, "#fff", 10, "center", true);

    // --- BOTAFOGO POSTER 2 (smaller, flag) ---
    const p2x = gx + 500, p2y = gy + 15;
    px(p2x, p2y, 70, 90, "#141414");
    px(p2x + 2, p2y + 2, 66, 86, "#1a1a1a");
    circle(p2x + 35, p2y + 35, 14, "#fff");
    circle(p2x + 35, p2y + 35, 11, "#000");
    circle(p2x + 35, p2y + 35, 6, "#fff");
    txt("BOT", p2x + 35, p2y + 70, "#fff", 9, "center", true);

    // --- FRIDGE / iFood area (left) ---
    const frX = gx + 20, frY = gy + 100;
    // Trash can
    px(frX, frY + 100, 30, 35, "#2a2a2a");
    px(frX - 2, frY + 98, 34, 6, "#3a3a3a");

    // Scattered trash on floor
    const trashItems = Math.min(daysWithoutLeaving, 20);
    for (let i = 0; i < trashItems; i++) {
        const tx = gx + 30 + seededRand(i * 7 + 1) * (gw - 100);
        const ty = floorY + 20 + seededRand(i * 13 + 3) * (gh * 0.5);
        const type = (seededRand(i * 23) * 4) | 0;
        if (type === 0) { // Pizza box
            px(tx, ty, 16, 12, "#c87830");
            px(tx + 2, ty + 2, 12, 8, "#a86020");
        } else if (type === 1) { // Can
            px(tx, ty, 6, 10, "#d03030");
        } else if (type === 2) { // Wrapper
            px(tx, ty, 10, 6, "#e0c020");
        } else { // Tissue
            px(tx, ty, 8, 8, "#d8d0c8");
        }
    }

    // Dirty clothes on floor
    if (daysWithoutLeaving > 3) {
        px(gx + 300, floorY + 80, 25, 12, "#2a3a2a");
        px(gx + 450, floorY + 100, 20, 15, "#3a2a40");
    }

    // --- Green carpet/rug (dirty) ---
    px(gx + 250, floorY + 40, 120, 80, "#2a4a2a");
    px(gx + 252, floorY + 42, 116, 76, "#1a3a1a");
    // Stains
    circle(gx + 300, floorY + 70, 8, "#183018");
    circle(gx + 330, floorY + 80, 5, "#183018");
}

// --- Draw character (larger, pixel art, dark skin, Botafogo shirt) ---
function drawCharacter() {
    const x = (player.x + GAME_X) | 0;
    const y = (player.y + GAME_Y) | 0;
    const bob = player.state === "walking" ? Math.sin(player.animTimer * 10) * 3 : 0;
    const t = player.animTimer;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(x, y + 65, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Legs / Shorts ---
    const legBob = player.state === "walking" ? Math.sin(t * 12) * 4 : 0;
    px(x - 12, y + 35 + bob, 10, 25, "#1a1a1a"); // left leg (shorts)
    px(x + 2, y + 35 + bob, 10, 25, "#1a1a1a");
    // Shoes
    px(x - 14, y + 58 + bob - legBob, 12, 6, "#3a3a3a");
    px(x + 1, y + 58 + bob + legBob, 12, 6, "#3a3a3a");

    // --- Body / Botafogo Shirt ---
    const bodyY = y - 10 + bob;
    // Black shirt base
    px(x - 18, bodyY, 36, 45, "#1a1a1a");
    // Botafogo star emblem (white circle with star)
    circle(x, bodyY + 16, 7, "#e8e8e8");
    circle(x, bodyY + 16, 5, "#1a1a1a");
    // Star
    ctx.fillStyle = "#e8e8e8";
    const scx = x, scy = bodyY + 16;
    for (let i = 0; i < 5; i++) {
        const angle = (i * 72 - 90) * Math.PI / 180;
        px(scx + Math.cos(angle) * 3 - 1, scy + Math.sin(angle) * 3 - 1, 2, 2, "#e8e8e8");
    }

    // Sleeves
    px(x - 24, bodyY + 2, 8, 18, "#1a1a1a");
    px(x + 16, bodyY + 2, 8, 18, "#1a1a1a");

    // --- Arms (dark skin) ---
    const skinColor = "#6a4a30";
    px(x - 26, bodyY + 18, 8, 20, skinColor); // left arm
    px(x + 18, bodyY + 18, 8, 20, skinColor); // right arm
    // Hands
    px(x - 27, bodyY + 36, 10, 6, skinColor);
    px(x + 17, bodyY + 36, 10, 6, skinColor);

    // --- Head ---
    const headY = y - 40 + bob;
    // Head shape (dark skin)
    px(x - 14, headY, 28, 30, skinColor);
    // Hair (black, afro-ish top)
    px(x - 16, headY - 8, 32, 14, "#1a1a1a");
    px(x - 18, headY - 4, 36, 8, "#1a1a1a");
    // Sides of hair
    px(x - 16, headY + 2, 4, 12, "#1a1a1a");
    px(x + 12, headY + 2, 4, 12, "#1a1a1a");

    // Eyes
    if (player.state === "sleeping") {
        px(x - 8, headY + 12, 6, 2, "#000");
        px(x + 2, headY + 12, 6, 2, "#000");
    } else {
        // Whites
        px(x - 9, headY + 10, 7, 5, "#e8e8e8");
        px(x + 2, headY + 10, 7, 5, "#e8e8e8");
        // Pupils
        px(x - 7, headY + 11, 3, 3, "#1a1a1a");
        px(x + 4, headY + 11, 3, 3, "#1a1a1a");
    }

    // Beard
    if (player.beardLevel > 0) {
        const bl = Math.min(player.beardLevel, 12);
        for (let i = 0; i < bl; i++) {
            const bx = x - 10 + (seededRand(i * 42 + 7) * 20) | 0;
            const by = headY + 22 + (seededRand(i * 13 + 3) * bl) | 0;
            px(bx, by, 2, 2, "#1a1a1a");
        }
        // Goatee area
        px(x - 4, headY + 24, 8, Math.min(bl, 6), "#1a1a1a");
    }

    // Mouth (slight line)
    px(x - 3, headY + 20, 6, 2, "#4a2a18");

    // --- Ears ---
    px(x - 16, headY + 10, 4, 8, skinColor);
    px(x + 12, headY + 10, 4, 8, skinColor);
}

// --- Speech Bubble ---
function drawSpeechBubble() {
    if (speechTimer <= 0) return;
    const x = (player.x + GAME_X) | 0;
    const y = (player.y + GAME_Y - 70) | 0;

    ctx.font = 'bold 11px "Courier New", monospace';
    const tw = ctx.measureText(speechBubble).width + 20;
    const bx = x - tw / 2, by = y - 20;

    // Cloud shape
    ctx.fillStyle = "#fff";
    roundRect(bx, by, tw, 30, 8);
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    roundRect(bx, by, tw, 30, 8);
    ctx.stroke();

    // Tail (circles going down)
    circle(x - 5, by + 32, 5, "#fff");
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x - 5, by + 32, 5, 0, Math.PI * 2); ctx.stroke();
    circle(x - 10, by + 40, 3, "#fff");
    ctx.beginPath(); ctx.arc(x - 10, by + 40, 3, 0, Math.PI * 2); ctx.stroke();

    txt(speechBubble, x, by + 20, "#000", 11, "center", true);
}

// --- Orange notification banner ---
function drawOrangeNotif() {
    if (orangeNotifTimer <= 0) return;
    const nx = GAME_X + GAME_W / 2 + 50;
    const ny = GAME_Y + 60;
    const nw = 200, nh = 50;

    // Orange box
    px(nx - nw / 2, ny, nw, nh, "#e88020");
    px(nx - nw / 2 + 2, ny + 2, nw - 4, nh - 4, "#f09030");
    ctx.strokeStyle = "#c06010";
    ctx.lineWidth = 2;
    ctx.strokeRect(nx - nw / 2, ny, nw, nh);

    txt(orangeNotif, nx, ny + 22, "#fff", 12, "center", true);
    // Second line if event
    if (eventTimer > 0) {
        txt(eventText, nx, ny + 38, "#fff", 10, "center");
    }
}

// --- Sidebar UI ---
function drawSidebar() {
    const sx = SIDE_X, sy = SIDE_Y, sw = SIDEBAR_W;

    // Sidebar background
    px(sx, sy, sw, H - HEADER - BORDER, "#141018");

    // Need bars
    const needsDisplay = [
        { label: "Fome",     value: needs.hunger,    col: "#dc8232", colBg: "#4a2a10" },
        { label: "Sono",     value: needs.sleep,      col: "#4060d0", colBg: "#1a2040" },
        { label: "CS",       value: 100 - needs.cs,   col: "#4060d0", colBg: "#1a2040" },
        { label: "Sanidade", value: needs.sanity,     col: "#40b040", colBg: "#103010" },
        { label: "Higiene",  value: needs.hygiene,    col: "#b040b0", colBg: "#301030" },
    ];

    let ny = sy + 20;
    needsDisplay.forEach(n => {
        txt(n.label, sx + 10, ny + 14, "#c8c8c8", 14, "left", true);
        ny += 20;
        // Bar background
        px(sx + 10, ny, sw - 25, 18, n.colBg);
        // Bar fill
        const fillW = ((n.value / 100) * (sw - 25)) | 0;
        px(sx + 10, ny, fillW, 18, n.col);
        // Border
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 10, ny, sw - 25, 18);
        ny += 32;
    });

    // Money
    txt(`R$ ${(needs.money * 10) | 0}`, sx + 10, ny + 14, YELLOW, 14, "left", true);
    ny += 25;

    // Horniness (subtle)
    txt(`Punheta: ${needs.horniness | 0}%`, sx + 10, ny + 14, "#a06080", 11);
    ny += 25;

    // Day counter at bottom
    ny = H - BORDER - 40;
    px(sx + 5, ny, sw - 10, 30, "#282030");
    txt(`Day ${day}`, sx + sw - 15, ny + 20, YELLOW, 16, "right", true);
    txt(getTimeStr(), sx + 10, ny + 20, "#888", 12);
}

// --- Action Buttons (bottom of game area) ---
let actionButtons = [];

function drawActions() {
    const actions = [
        { label: "Trabalhar", key: "1", action: "work",      col: "#3050a0" },
        { label: "Jogar CS",  key: "2", action: "play_cs",   col: "#308030" },
        { label: "Dormir",    key: "3", action: "sleep",     col: "#4040a0" },
        { label: "Comer",     key: "4", action: "eat",       col: "#a06020" },
        { label: "Punheta",   key: "5", action: "fap",       col: "#803060" },
        { label: "Botafogo",  key: "6", action: "watch_bota",col: "#808020" },
    ];

    const btnW = 108, btnH = 28;
    const totalW = actions.length * (btnW + 4);
    const startX = GAME_X + (GAME_W - totalW) / 2;
    const btnY = H - BORDER - 35;

    actionButtons = [];
    const [mx, my] = mousePos;
    actions.forEach((a, i) => {
        const bx = startX + i * (btnW + 4);
        const rect = { x: bx, y: btnY, w: btnW, h: btnH };
        actionButtons.push({ rect, action: a.action });

        const hovered = mx >= bx && mx <= bx + btnW && my >= btnY && my <= btnY + btnH;
        const disabled = player.state !== "idle" && player.state !== "walking";

        px(bx, btnY, btnW, btnH, disabled ? "#2a2a2a" : (hovered ? lighten(a.col) : a.col));
        ctx.strokeStyle = hovered ? YELLOW : "#555";
        ctx.lineWidth = hovered ? 2 : 1;
        ctx.strokeRect(bx, btnY, btnW, btnH);

        txt(`${a.label} [${a.key}]`, bx + btnW / 2, btnY + btnH / 2 + 4, disabled ? "#555" : "#ddd", 10, "center");
    });

    // Progress bar
    if (player.actionTimer > 0 && player.actionDuration > 0) {
        const prog = 1 - player.actionTimer / player.actionDuration;
        const pw = 180, ppx = GAME_X + (GAME_W - pw) / 2, py = btnY - 22;
        px(ppx, py, pw, 12, "#1a1a1a");
        px(ppx, py, (pw * prog) | 0, 12, YELLOW);
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 1;
        ctx.strokeRect(ppx, py, pw, 12);
    }
}

// --- Frame: yellow border + header ---
function drawFrame() {
    // Full yellow border
    ctx.strokeStyle = YELLOW;
    ctx.lineWidth = BORDER;
    ctx.strokeRect(BORDER / 2, BORDER / 2, W - BORDER, H - BORDER);

    // Inner border for game area
    ctx.strokeStyle = YELLOW;
    ctx.lineWidth = 3;
    ctx.strokeRect(GAME_X, GAME_Y, GAME_W, GAME_H);

    // Header bar
    px(BORDER, BORDER, W - BORDER * 2, HEADER - BORDER, "#141018");
    px(BORDER, HEADER - 2, W - BORDER * 2, 3, YELLOW);

    // Title
    txt("JELLY: THE GAME", BORDER + 15, HEADER - 12, "#fff", 18, "left", true);

    // Window buttons (top right, retro style)
    const btnSize = 16;
    const btnY = BORDER + 6;
    // Minimize
    px(W - BORDER - 70, btnY, btnSize, btnSize, "#3a3a3a");
    ctx.strokeStyle = "#888"; ctx.lineWidth = 1;
    ctx.strokeRect(W - BORDER - 70, btnY, btnSize, btnSize);
    px(W - BORDER - 66, btnY + 10, 8, 2, "#888");
    // Maximize
    px(W - BORDER - 48, btnY, btnSize, btnSize, "#3a3a3a");
    ctx.strokeRect(W - BORDER - 48, btnY, btnSize, btnSize);
    ctx.strokeRect(W - BORDER - 44, btnY + 4, 8, 8);
    // Close
    px(W - BORDER - 26, btnY, btnSize, btnSize, "#3a3a3a");
    ctx.strokeRect(W - BORDER - 26, btnY, btnSize, btnSize);
    txt("X", W - BORDER - 18, btnY + 13, "#888", 11, "center", true);
}

function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
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
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + 50);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + 50);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + 50);
    return `rgb(${r},${g},${b})`;
}

// --- Actions ---
function doAction(action) {
    if (player.state !== "idle" && player.state !== "walking") return;

    const speeches = {
        work: "codigo vai, dinheiro vem...",
        play_cs: "clutch or kick!",
        sleep: "so mais 5 min...",
        eat: "bora de iFood!",
        fap: "...",
        watch_bota: "FOGAO!"
    };
    speechBubble = speeches[action] || "";
    speechTimer = 3;

    if (action === "work") {
        movePlayerTo(furniture.pc);
        startAction("working", 5);
        needs.money += 15; needs.cs += 10; needs.sleep -= 5;
        workedToday = true; consecutiveWorkDays++; totalWorkDays++;
        gameTime += 2 * 3600;
        showOrangeNotif("TRABALHANDO...");
    } else if (action === "play_cs") {
        movePlayerTo(furniture.pc);
        startAction("gaming", 6);
        needs.cs -= 40; needs.horniness += 5; needs.sleep -= 10; needs.hunger -= 8;
        csHoursToday += 3; gameTime += 3 * 3600;
        showOrangeNotif("JOGANDO CS!");
    } else if (action === "sleep") {
        movePlayerTo(furniture.bed);
        startAction("sleeping", 8);
        needs.sleep += 70; needs.hunger -= 15;
        gameTime += 8 * 3600;
        if (gameTime >= 24 * 3600) { gameTime -= 24 * 3600; advanceDay(); }
        showOrangeNotif("ZZZ...");
    } else if (action === "eat") {
        movePlayerTo(furniture.fridge);
        startAction("eating", 3);
        if (needs.money >= 10) {
            needs.hunger += 40; needs.money -= 10;
            showOrangeNotif("IFOOD CHEGANDO!");
        } else {
            needs.hunger += 10;
            showOrangeNotif("MIOJO VELHO...");
        }
    } else if (action === "fap") {
        movePlayerTo(furniture.phone);
        startAction("fapping", 4);
        needs.horniness -= 50; needs.sanity -= 8; needs.sleep -= 5;
        gameTime += 1 * 3600;
        showOrangeNotif("...");
    } else if (action === "watch_bota") {
        movePlayerTo(furniture.poster);
        startAction("idle", 5);
        botaGamesWatched++;
        if (Math.random() > 0.5) {
            needs.sanity += 25;
            showOrangeNotif("BOTAFOGO GANHOU!!");
            speechBubble = "GLORIA ETERNA!!";
        } else {
            needs.sanity -= 20;
            showOrangeNotif("BOTAFOGO PERDEU...");
            speechBubble = "sofrimento...";
        }
        gameTime += 2 * 3600;
    }
    clampNeeds();
}

function movePlayerTo(f) {
    player.tx = f.ix; player.ty = f.iy;
    player.state = "walking";
}

function startAction(action, dur) {
    player.state = action;
    player.actionTimer = dur;
    player.actionDuration = dur;
}

function showOrangeNotif(msg) { orangeNotif = msg; orangeNotifTimer = 3; }

function advanceDay() {
    day++;
    daysWithoutLeaving++;
    player.beardLevel = daysWithoutLeaving;
    csHoursToday = 0;
    if (!workedToday) consecutiveWorkDays = 0;
    workedToday = false;
}

// --- Update ---
function update(dt) {
    if (gameState !== "playing") return;
    player.animTimer += dt;

    if (player.state === "walking") {
        const dx = player.tx - player.x, dy = player.ty - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 4) {
            player.x = player.tx; player.y = player.ty;
        } else {
            player.x += (dx / dist) * player.speed * dt;
            player.y += (dy / dist) * player.speed * dt;
        }
    }

    if (player.actionTimer > 0) {
        player.actionTimer -= dt;
        if (player.actionTimer <= 0) { player.actionTimer = 0; player.state = "idle"; }
    }

    const gameDt = dt * timeSpeed;
    const hour = gameDt / 3600;
    needs.hunger -= 4 * hour;
    needs.sleep -= 3.5 * hour;
    needs.cs += 5 * hour;
    needs.horniness += 2 * hour;
    needs.sanity -= 0.3 * hour;
    clampNeeds();

    if (speechTimer > 0) speechTimer -= dt;
    if (orangeNotifTimer > 0) orangeNotifTimer -= dt;
    if (eventTimer > 0) eventTimer -= dt;
    if (achievementTimer > 0) {
        achievementTimer -= dt;
        if (achievementTimer <= 0) achievementPopup = null;
    }

    eventCooldown -= dt;
    if (eventCooldown <= 0 && player.state === "idle" && Math.random() < 0.005) {
        const ev = events[(Math.random() * events.length) | 0];
        eventText = ev.text;
        eventTimer = 4;
        ev.fx();
        clampNeeds();
        eventCooldown = 15;
        showOrangeNotif(ev.text);
    }

    if (needs.hunger <= 0 && needs.money <= 0) {
        gameState = "gameover";
        gameOverReason = "Morreu de fome! Sem dinheiro pra iFood...";
    } else if (needs.sanity <= 0) {
        gameState = "gameover";
        gameOverReason = "Saiu pelado gritando RUSH B!";
    } else if (needs.sleep <= 0) {
        gameState = "gameover";
        gameOverReason = "Desmaiou no teclado!";
    }

    achievements.forEach(a => {
        if (!a.unlocked && a.check()) {
            a.unlocked = true;
            achievementPopup = a;
            achievementTimer = 4;
        }
    });
}

function getFurnitureAt(mx, my) {
    const rx = mx - GAME_X, ry = my - GAME_Y;
    for (let k in furniture) {
        const f = furniture[k];
        if (rx >= f.x - f.w / 2 && rx <= f.x + f.w / 2 && ry >= f.y - f.h / 2 && ry <= f.y + f.h / 2) return k;
    }
    return null;
}

// --- Screens ---
function drawMenu() {
    px(0, 0, W, H, "#0a0810");

    // Yellow border
    ctx.strokeStyle = YELLOW;
    ctx.lineWidth = BORDER;
    ctx.strokeRect(BORDER / 2, BORDER / 2, W - BORDER, H - BORDER);

    txt("JELLY: THE GAME", W / 2, 140, YELLOW, 40, "center", true);
    txt("Simulador do Amigo Recluso", W / 2, 180, "#666", 16, "center");

    // Botafogo emblem
    circle(W / 2, 240, 30, "#fff");
    circle(W / 2, 240, 26, "#0a0810");
    circle(W / 2, 240, 20, "#fff");
    circle(W / 2, 240, 16, "#0a0810");
    // Star points
    for (let i = 0; i < 5; i++) {
        const a = (i * 72 - 90) * Math.PI / 180;
        px(W / 2 + Math.cos(a) * 12 - 2, 240 + Math.sin(a) * 12 - 2, 5, 5, "#fff");
    }

    const lines = [
        ["[1-6] Acoes    [+/-] Velocidade", "#888"],
        ["Click nos moveis pra interagir", "#888"],
        ["", ""],
        ["Sobreviva sem sair de casa!", "#c8c8c8"],
        ["", ""],
        ["[ ENTER / CLICK PARA JOGAR ]", YELLOW],
    ];
    lines.forEach(([l, c], i) => { if (l) txt(l, W / 2, 310 + i * 30, c, 14, "center"); });
}

function drawGameOver() {
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, W, H);

    txt("GAME OVER", W / 2, H / 2 - 80, "#e83030", 36, "center", true);
    txt(gameOverReason, W / 2, H / 2 - 30, "#c8c8c8", 16, "center");

    txt(`Dias: ${day}  |  Sem sair: ${daysWithoutLeaving}  |  Trabalhou: ${totalWorkDays}`, W / 2, H / 2 + 20, "#888", 13, "center");

    const unlocked = achievements.filter(a => a.unlocked);
    if (unlocked.length) {
        txt("Conquistas:", W / 2, H / 2 + 60, YELLOW, 14, "center", true);
        unlocked.forEach((a, i) => txt(`* ${a.name}`, W / 2, H / 2 + 82 + i * 20, YELLOW, 12, "center"));
    }

    txt("[ R ] Recomecar", W / 2, H - 60, "#5c5", 16, "center");
}

// Achievement popup
function drawAchievementPopup() {
    if (!achievementPopup || achievementTimer <= 0) return;
    const ax = GAME_X + GAME_W / 2, ay = GAME_Y + 30;
    px(ax - 160, ay, 320, 45, "#1a3a1a");
    ctx.strokeStyle = YELLOW; ctx.lineWidth = 2;
    ctx.strokeRect(ax - 160, ay, 320, 45);
    txt(`CONQUISTA: ${achievementPopup.name}`, ax, ay + 18, YELLOW, 12, "center", true);
    txt(achievementPopup.desc, ax, ay + 35, "#c8c8c8", 10, "center");
}

// --- Input ---
let mousePos = [0, 0];

canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    mousePos = [(e.clientX - rect.left) * (W / rect.width), (e.clientY - rect.top) * (H / rect.height)];
});

canvas.addEventListener("click", e => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    const my = (e.clientY - rect.top) * (H / rect.height);

    if (gameState === "menu") { resetGame(); gameState = "playing"; return; }
    if (gameState === "gameover") return;

    for (const { rect: r, action } of actionButtons) {
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) { doAction(action); return; }
    }

    const f = getFurnitureAt(mx, my);
    if (f === "pc") doAction(needs.cs < 50 ? "work" : "play_cs");
    else if (f === "bed") doAction("sleep");
    else if (f === "fridge") doAction("eat");
    else if (f === "phone") doAction("fap");
    else if (f === "poster" || f === "poster2") doAction("watch_bota");
});

document.addEventListener("keydown", e => {
    if (gameState === "menu") {
        if (e.key === "Enter") { resetGame(); gameState = "playing"; }
        return;
    }
    if (gameState === "gameover") {
        if (e.key === "r" || e.key === "R") { resetGame(); gameState = "playing"; }
        return;
    }
    const keyMap = { "1": "work", "2": "play_cs", "3": "sleep", "4": "eat", "5": "fap", "6": "watch_bota" };
    if (keyMap[e.key]) doAction(keyMap[e.key]);
    else if (e.key === "+" || e.key === "=") timeSpeed = Math.min(300, timeSpeed + 30);
    else if (e.key === "-") timeSpeed = Math.max(10, timeSpeed - 30);
});

function resetGame() {
    Object.assign(needs, { hunger: 80, sleep: 90, cs: 30, horniness: 20, money: 50, sanity: 95, hygiene: 15 });
    Object.assign(player, { x: 380, y: 380, tx: 380, ty: 380, state: "idle", beardLevel: 0, animTimer: 0, actionTimer: 0, actionDuration: 0 });
    day = 1; gameTime = 8 * 3600; timeSpeed = 60;
    daysWithoutLeaving = 0; csHoursToday = 0; botaGamesWatched = 0;
    totalWorkDays = 0; consecutiveWorkDays = 0; workedToday = false;
    speechBubble = ""; speechTimer = 0; orangeNotif = ""; orangeNotifTimer = 0;
    eventText = ""; eventTimer = 0; eventCooldown = 0;
    achievementPopup = null; achievementTimer = 0; gameOverReason = "";
    achievements.forEach(a => a.unlocked = false);
}

// --- Game Loop ---
let lastTime = performance.now();
function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    update(dt);

    px(0, 0, W, H, "#0a0810");

    if (gameState === "menu") {
        drawMenu();
    } else {
        drawRoom();
        drawCharacter();
        drawSpeechBubble();
        drawOrangeNotif();
        drawSidebar();
        drawActions();
        drawFrame();
        drawAchievementPopup();
        if (gameState === "gameover") drawGameOver();
    }

    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
