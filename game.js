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
    x: 350, y: 400, tx: 350, ty: 400,
    state: "idle", speed: 150, beardLevel: 0,
    animTimer: 0, actionTimer: 0, actionDuration: 0
};

// Room layout: side-view. Wall top ~40%, floor bottom ~60%
// All Y coords relative to game area. Floor starts at y=220
const FLOOR_Y = 220;

// Furniture positions (relative to game area) - side view
const furniture = {
    pc:     { x: 160, y: 200, w: 160, h: 160, ix: 200, iy: 420 },
    bed:    { x: 560, y: 220, w: 160, h: 140, ix: 500, iy: 420 },
    fridge: { x: 30,  y: 180, w: 60,  h: 120, ix: 60,  iy: 420 },
    poster: { x: 380, y: 40,  w: 90,  h: 120, ix: 380, iy: 420 },
    poster2:{ x: 530, y: 40,  w: 70,  h: 100, ix: 530, iy: 420 },
    phone:  { x: 340, y: 440, w: 40,  h: 30,  ix: 340, iy: 420 },
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

// --- Draw the room (side-view, consistent 2D) ---
function drawRoom() {
    const gx = GAME_X, gy = GAME_Y, gw = GAME_W, gh = GAME_H;
    const floorAbs = gy + FLOOR_Y; // absolute floor line

    // === BACK WALL ===
    px(gx, gy, gw, FLOOR_Y, "#2a2238");
    // Wall texture - subtle brick lines
    for (let wy = 0; wy < FLOOR_Y; wy += 30) {
        px(gx, gy + wy, gw, 1, "rgba(0,0,0,0.15)");
    }
    // Baseboard
    px(gx, floorAbs - 8, gw, 8, "#3a2830");

    // === FLOOR ===
    px(gx, floorAbs, gw, gh - FLOOR_Y, "#1a1620");
    // Floor planks
    for (let fy = 0; fy < gh - FLOOR_Y; fy += 20) {
        px(gx, floorAbs + fy, gw, 1, "rgba(255,255,255,0.03)");
    }

    // === WINDOW (on wall, left side) ===
    const winX = gx + 55, winY = gy + 20;
    px(winX, winY, 110, 140, "#3a3848"); // frame
    px(winX + 5, winY + 5, 100, 130, "#2a3848"); // glass
    px(winX + 5, winY + 5, 48, 130, "#283040"); // left pane
    px(winX + 57, winY + 5, 48, 130, "#283040"); // right pane
    // Window cross
    px(winX + 53, winY + 5, 4, 130, "#4a4858");
    px(winX + 5, winY + 68, 100, 4, "#4a4858");
    // Curtains (hanging from top)
    // Left curtain
    for (let cy = 0; cy < 170; cy += 4) {
        const cw = 28 + Math.sin(cy * 0.08) * 4;
        px(winX - 22, winY - 10 + cy, cw, 4, cy % 8 < 4 ? "#5a3858" : "#4a2848");
    }
    // Right curtain
    for (let cy = 0; cy < 170; cy += 4) {
        const cw = 28 + Math.sin(cy * 0.08 + 1) * 4;
        px(winX + 105 - cw + 22, winY - 10 + cy, cw, 4, cy % 8 < 4 ? "#5a3858" : "#4a2848");
    }
    // Curtain rod
    px(winX - 30, winY - 14, 170, 4, "#5a5060");
    circle(winX - 30, winY - 12, 4, "#6a6070");
    circle(winX + 140, winY - 12, 4, "#6a6070");

    // === PC DESK + MONITOR (left area, against wall) ===
    const deskX = gx + 100, deskY = floorAbs;
    // Desk legs
    px(deskX, deskY, 6, 80, "#5a4030");
    px(deskX + 164, deskY, 6, 80, "#5a4030");
    // Desk surface (sits on wall line)
    px(deskX - 5, deskY - 4, 180, 8, "#6a5038");
    px(deskX - 5, deskY - 6, 180, 4, "#7a6048");
    // Shelf above desk
    px(deskX + 10, deskY - 80, 140, 5, "#5a4030");

    // Monitor (on desk)
    const monX = deskX + 40, monY = deskY - 80;
    px(monX, monY, 100, 72, "#1a1a2a"); // bezel
    px(monX + 4, monY + 4, 92, 60, "#0a1a0a"); // screen default
    // Monitor stand
    px(monX + 40, monY + 72, 20, 8, "#2a2a2a");
    px(monX + 35, monY + 78, 30, 4, "#3a3a3a");
    // Screen content
    if (player.state === "gaming") {
        // CS view
        px(monX + 4, monY + 4, 92, 30, "#3a5a7a"); // sky
        px(monX + 4, monY + 34, 92, 30, "#6a5a3a"); // ground
        // Crosshair
        px(monX + 48, monY + 22, 2, 16, "#0f0");
        px(monX + 40, monY + 29, 18, 2, "#0f0");
        // Gun
        px(monX + 55, monY + 45, 30, 12, "#4a4a4a");
        txt("CS:GO", monX + 50, monY + 16, "#0f0", 8, "center", true);
    } else if (player.state === "working") {
        px(monX + 4, monY + 4, 92, 60, "#0a1520");
        for (let i = 0; i < 7; i++) {
            const lw = 15 + seededRand(i * 33) * 50;
            const lc = ["#4a8aca", "#6aca6a", "#caca4a", "#ca6a8a"][i % 4];
            px(monX + 10, monY + 10 + i * 8, lw, 4, lc);
        }
    } else {
        // Idle screen - desktop
        px(monX + 4, monY + 4, 92, 60, "#0a2010");
        txt(">_", monX + 14, monY + 30, "#0f0", 12, "left");
    }
    // Monitor glow
    if (player.state === "gaming" || player.state === "working") {
        ctx.fillStyle = "rgba(0,255,0,0.03)";
        ctx.fillRect(monX - 20, monY - 10, 140, 100);
    }

    // RGB Keyboard
    for (let i = 0; i < 12; i++) {
        const hue = (Date.now() / 30 + i * 30) % 360;
        px(deskX + 20 + i * 12, deskY - 14, 10, 6, `hsl(${hue},100%,50%)`);
    }
    // Keyboard frame
    ctx.strokeStyle = "#2a2a2a"; ctx.lineWidth = 1;
    ctx.strokeRect(deskX + 18, deskY - 16, 148, 10);
    // Mouse
    px(deskX + 148, deskY - 16, 14, 10, "#2a2a2a");
    circle(deskX + 155, deskY - 12, 2, "#4a4a4a");

    // iFood box on desk
    px(deskX - 2, deskY - 28, 38, 22, "#e83030");
    px(deskX, deskY - 26, 34, 18, "#d02020");
    txt("iFood", deskX + 5, deskY - 13, "#fff", 9, "left", true);
    // Smiley on box
    circle(deskX + 30, deskY - 22, 4, "#fff");

    // Energy drink cans on desk
    px(deskX + 135, deskY - 24, 8, 18, "#d03030");
    px(deskX + 145, deskY - 20, 8, 14, "#30a030");
    px(deskX + 155, deskY - 22, 8, 16, "#e0c020");

    // Chair (in front of desk)
    px(deskX + 50, deskY + 40, 60, 8, "#2a2a2a"); // seat
    px(deskX + 55, deskY + 10, 50, 32, "#3a3a3a"); // back
    px(deskX + 52, deskY + 48, 6, 30, "#222"); // leg
    px(deskX + 102, deskY + 48, 6, 30, "#222"); // leg
    // Chair wheels
    circle(deskX + 55, deskY + 80, 3, "#333");
    circle(deskX + 78, deskY + 80, 3, "#333");
    circle(deskX + 105, deskY + 80, 3, "#333");

    // === BOTAFOGO POSTER 1 (on wall center) ===
    const p1x = gx + 370, p1y = gy + 15;
    // Frame
    px(p1x - 2, p1y - 2, 94, 134, "#3a3030");
    px(p1x, p1y, 90, 130, "#141414");
    // White border inside
    px(p1x + 3, p1y + 3, 84, 124, "#1a1a1a");
    // Botafogo star emblem
    circle(p1x + 45, p1y + 45, 28, "#fff");
    circle(p1x + 45, p1y + 45, 24, "#000");
    // Star
    drawStar(p1x + 45, p1y + 45, 15, 7, 5, "#fff");
    txt("BOTAFOGO", p1x + 45, p1y + 90, "#fff", 11, "center", true);
    txt("DE FUTEBOL E REGATAS", p1x + 45, p1y + 105, "#888", 6, "center");

    // === BOTAFOGO POSTER 2 (flag/banner) ===
    const p2x = gx + 510, p2y = gy + 20;
    px(p2x - 2, p2y - 2, 84, 114, "#3a3030");
    px(p2x, p2y, 80, 110, "#141414");
    px(p2x + 2, p2y + 2, 76, 106, "#1a1a1a");
    // Horizontal stripes
    px(p2x + 5, p2y + 30, 70, 12, "#fff");
    px(p2x + 5, p2y + 55, 70, 12, "#fff");
    // Star
    drawStar(p2x + 40, p2y + 45, 10, 5, 5, "#fff");
    txt("GLORIOSO", p2x + 40, p2y + 90, "#fff", 8, "center", true);

    // === BED (right side, side-view) ===
    const bedX = gx + 520, bedY = floorAbs;
    // Headboard (against wall)
    px(bedX + 140, bedY - 90, 24, 90, "#5a4030");
    px(bedX + 142, bedY - 86, 20, 82, "#6a5040");
    // Bed frame side
    px(bedX, bedY - 10, 164, 14, "#5a4030");
    px(bedX, bedY + 4, 164, 6, "#4a3020");
    // Legs
    px(bedX + 2, bedY + 10, 8, 70, "#4a3020");
    px(bedX + 154, bedY + 10, 8, 70, "#4a3020");
    // Mattress (side view - shows as thick rectangle)
    px(bedX + 4, bedY - 30, 156, 22, "#e0e0e0");
    // Botafogo bedsheet pattern (B&W stripes)
    for (let si = 0; si < 8; si++) {
        if (si % 2 === 0) {
            px(bedX + 4 + si * 20, bedY - 30, 18, 22, "#1a1a1a");
        }
    }
    // Pillow
    px(bedX + 120, bedY - 42, 36, 16, "#c8c8d8");
    px(bedX + 122, bedY - 40, 32, 12, "#d8d8e8");
    // Blanket hanging
    px(bedX + 4, bedY - 10, 100, 4, "#c0c0c0");

    // === TRASH CAN (near desk) ===
    px(gx + 20, floorAbs + 20, 34, 50, "#2a2a2a");
    px(gx + 18, floorAbs + 16, 38, 8, "#3a3a3a");
    // Trash sticking out
    if (daysWithoutLeaving > 2) {
        px(gx + 22, floorAbs + 10, 12, 10, "#c87830");
        px(gx + 36, floorAbs + 8, 8, 12, "#d03030");
    }

    // === GREEN CARPET (on floor, center) ===
    px(gx + 260, floorAbs + 100, 140, 50, "#2a4a2a");
    px(gx + 262, floorAbs + 102, 136, 46, "#1e3a1e");
    // Stains on carpet
    circle(gx + 310, floorAbs + 120, 6, "#183018");
    circle(gx + 340, floorAbs + 130, 4, "#183018");

    // === SCATTERED TRASH ON FLOOR ===
    const trashItems = Math.min(daysWithoutLeaving, 20);
    for (let i = 0; i < trashItems; i++) {
        const tx = gx + 40 + seededRand(i * 7 + 1) * (gw - 120);
        const ty = floorAbs + 30 + seededRand(i * 13 + 3) * (gh - FLOOR_Y - 100);
        const type = (seededRand(i * 23) * 5) | 0;
        if (type === 0) { // Pizza box flat
            px(tx, ty, 18, 6, "#c87830");
            px(tx + 1, ty + 1, 16, 4, "#a86020");
        } else if (type === 1) { // Soda can
            px(tx, ty, 8, 12, "#d03030");
            px(tx + 1, ty, 6, 2, "#e04040");
        } else if (type === 2) { // Wrapper
            px(tx, ty, 12, 4, "#e0c020");
        } else if (type === 3) { // Cup
            px(tx, ty, 10, 14, "#e8e0d8");
        } else { // Tissue
            px(tx, ty, 10, 8, "#d8d0c8");
        }
    }

    // Dirty clothes
    if (daysWithoutLeaving > 3) {
        px(gx + 300, floorAbs + 150, 28, 10, "#2a3a2a");
        px(gx + 450, floorAbs + 140, 22, 12, "#3a2a40");
    }

    // Phone on floor
    px(gx + 335, floorAbs + 110, 14, 24, "#1a1a1a");
    px(gx + 337, floorAbs + 112, 10, 18, "#2a2a40");
    // Phone screen glow
    px(gx + 338, floorAbs + 114, 8, 14, "#1a2030");
}

// Draw a 5-pointed star
function drawStar(cx, cy, outerR, innerR, points, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI / points) - Math.PI / 2;
        const sx = cx + Math.cos(angle) * r;
        const sy = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
}

// --- Draw character (side-view, consistent 2D pixel art) ---
function drawCharacter() {
    const x = (player.x + GAME_X) | 0;
    const y = (player.y + GAME_Y) | 0;
    const bob = player.state === "walking" ? Math.sin(player.animTimer * 10) * 2 : 0;
    const t = player.animTimer;
    const skinColor = "#6a4a30";
    const skinShadow = "#5a3a22";

    // Shadow on ground
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + 60, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- SHOES ---
    const legOff = player.state === "walking" ? Math.sin(t * 12) * 4 : 0;
    px(x - 14, y + 50 + bob - Math.max(0, legOff), 12, 8, "#2a2a2a"); // left shoe
    px(x + 2, y + 50 + bob + Math.max(0, legOff), 12, 8, "#2a2a2a");   // right shoe
    // Shoe soles
    px(x - 14, y + 56 + bob, 14, 3, "#1a1a1a");
    px(x + 2, y + 56 + bob, 14, 3, "#1a1a1a");

    // --- LEGS (dark shorts) ---
    px(x - 12, y + 30 + bob, 10, 22, "#1a1a1a");
    px(x + 2, y + 30 + bob, 10, 22, "#1a1a1a");
    // Skin showing below shorts
    px(x - 11, y + 42 + bob, 8, 10, skinColor);
    px(x + 3, y + 42 + bob, 8, 10, skinColor);

    // --- BODY / SHIRT (Botafogo black) ---
    const bodyY = y - 12 + bob;
    px(x - 18, bodyY, 36, 42, "#1a1a1a");
    // Collar
    px(x - 6, bodyY, 12, 4, skinColor);
    // Botafogo emblem on chest
    circle(x, bodyY + 18, 8, "#e8e8e8");
    circle(x, bodyY + 18, 6, "#1a1a1a");
    drawStar(x, bodyY + 18, 4, 2, 5, "#e8e8e8");

    // --- ARMS ---
    // Sleeves
    px(x - 24, bodyY + 4, 8, 16, "#1a1a1a");
    px(x + 16, bodyY + 4, 8, 16, "#1a1a1a");
    // Forearms (skin)
    px(x - 24, bodyY + 18, 8, 16, skinColor);
    px(x + 16, bodyY + 18, 8, 16, skinColor);
    // Hands
    px(x - 25, bodyY + 32, 10, 6, skinColor);
    px(x + 15, bodyY + 32, 10, 6, skinColor);

    // --- HEAD ---
    const headY = y - 42 + bob;
    // Neck
    px(x - 4, headY + 26, 8, 6, skinColor);
    // Head
    px(x - 14, headY, 28, 28, skinColor);
    // Hair (afro, rounded top)
    px(x - 16, headY - 10, 32, 16, "#1a1a1a");
    px(x - 18, headY - 6, 36, 10, "#1a1a1a");
    px(x - 17, headY + 2, 4, 10, "#1a1a1a"); // sideburn left
    px(x + 13, headY + 2, 4, 10, "#1a1a1a"); // sideburn right

    // Ears
    px(x - 17, headY + 8, 5, 8, skinColor);
    px(x + 12, headY + 8, 5, 8, skinColor);

    // Eyes
    if (player.state === "sleeping") {
        px(x - 9, headY + 12, 7, 2, "#000");
        px(x + 2, headY + 12, 7, 2, "#000");
    } else {
        px(x - 9, headY + 10, 7, 6, "#e8e8e8"); // white left
        px(x + 2, headY + 10, 7, 6, "#e8e8e8");  // white right
        px(x - 7, headY + 11, 4, 4, "#1a1a1a");  // pupil left
        px(x + 4, headY + 11, 4, 4, "#1a1a1a");   // pupil right
        // Highlight
        px(x - 6, headY + 11, 2, 2, "#fff");
        px(x + 5, headY + 11, 2, 2, "#fff");
    }

    // Nose
    px(x - 2, headY + 16, 4, 3, skinShadow);

    // Mouth
    px(x - 3, headY + 21, 6, 2, "#4a2a18");

    // Beard
    if (player.beardLevel > 0) {
        const bl = Math.min(player.beardLevel, 12);
        // Stubble / beard fill
        for (let i = 0; i < bl * 2; i++) {
            const bx = x - 10 + (seededRand(i * 42 + 7) * 20) | 0;
            const by = headY + 20 + (seededRand(i * 13 + 3) * Math.min(bl, 8)) | 0;
            px(bx, by, 2, 2, "#1a1a1a");
        }
        // Chin beard
        if (bl > 3) {
            px(x - 5, headY + 24, 10, Math.min(bl - 2, 8), "#1a1a1a");
        }
    }
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
    Object.assign(player, { x: 350, y: 400, tx: 350, ty: 400, state: "idle", beardLevel: 0, animTimer: 0, actionTimer: 0, actionDuration: 0 });
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
