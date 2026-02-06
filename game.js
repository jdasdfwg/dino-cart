// ============================================
// DINO CART - Western Racing Championship
// Mode 7-style pseudo-3D racing game
// ============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ============================================
// FIREBASE CONFIGURATION
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyC1hRXnxfsZx2Cm8dZU-wgfPCZWDeaNU5M",
    authDomain: "dino-draww.firebaseapp.com",
    projectId: "dino-draww",
    storageBucket: "dino-draww.firebasestorage.app",
    messagingSenderId: "949718341915",
    appId: "1:949718341915:web:50c9c26cc73ab7c653dbbe"
};

let db = null;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
} catch (e) {
    console.log('Firebase initialization error:', e);
}

// ============================================
// GAME CONSTANTS
// ============================================
const ROAD_WIDTH = 2000;
const SEGMENT_LENGTH = 200;
const CAMERA_HEIGHT = 1000;
const CAMERA_DEPTH = 0.84;
const DRAW_DISTANCE = 100;
const FOV = 100;

const COLORS = {
    SKY_TOP_DAY: '#87CEEB',
    SKY_BOTTOM_DAY: '#e8c49a',
    SKY_TOP_SUNSET: '#5d4a6b',
    SKY_BOTTOM_SUNSET: '#ff7744',
    ROAD_LIGHT: '#666666',
    ROAD_DARK: '#555555',
    RUMBLE_LIGHT: '#ff0000',
    RUMBLE_DARK: '#ffffff',
    GRASS_LIGHT_DESERT: '#d4a574',
    GRASS_DARK_DESERT: '#c49464',
    GRASS_LIGHT_MESA: '#c49464',
    GRASS_DARK_MESA: '#a07850',
    LANE_MARKER: '#ffffff'
};

// Item types
const ITEMS = {
    CHILI: { name: 'Chili Pepper', icon: '🌶️', effect: 'speed' },
    BADGE: { name: 'Sheriff Badge', icon: '⭐', effect: 'shield' },
    LASSO: { name: 'Lasso', icon: '🪢', effect: 'projectile' },
    DYNAMITE: { name: 'Dynamite', icon: '🧨', effect: 'bomb' },
    TUMBLEWEED: { name: 'Tumbleweed', icon: '🌀', effect: 'trail' },
    GOLD: { name: 'Gold Nugget', icon: '🪙', effect: 'points' }
};

// ============================================
// TRACK DEFINITIONS
// ============================================
const TRACKS = {
    'desert-canyon': {
        name: 'Desert Canyon',
        laps: 3,
        skyTop: '#87CEEB',
        skyBottom: '#e8c49a',
        grassLight: '#d4a574',
        grassDark: '#c49464',
        segments: generateDesertCanyonTrack(),
        obstacles: ['cactus', 'rock', 'skull'],
        music: 'upbeat'
    },
    'sunset-mesa': {
        name: 'Sunset Mesa',
        laps: 3,
        skyTop: '#5d4a6b',
        skyBottom: '#ff7744',
        grassLight: '#c49464',
        grassDark: '#a07850',
        segments: generateSunsetMesaTrack(),
        obstacles: ['butte', 'tumbleweed', 'wagon'],
        music: 'dramatic'
    }
};

function generateDesertCanyonTrack() {
    const segments = [];
    const length = 200;
    
    for (let i = 0; i < length; i++) {
        let curve = 0;
        let hill = 0;
        
        // Start straight
        if (i < 10) {
            curve = 0;
        }
        // First turn (right)
        else if (i >= 10 && i < 30) {
            curve = 3;
        }
        // Short straight
        else if (i >= 30 && i < 40) {
            curve = 0;
        }
        // S-curve
        else if (i >= 40 && i < 55) {
            curve = -4;
        }
        else if (i >= 55 && i < 70) {
            curve = 4;
        }
        // Hill section
        else if (i >= 70 && i < 85) {
            curve = 1;
            hill = Math.sin((i - 70) / 15 * Math.PI) * 30;
        }
        // Sharp left
        else if (i >= 85 && i < 105) {
            curve = -5;
        }
        // Long right curve
        else if (i >= 105 && i < 140) {
            curve = 2.5;
        }
        // Chicane
        else if (i >= 140 && i < 150) {
            curve = -3;
        }
        else if (i >= 150 && i < 160) {
            curve = 3;
        }
        // Final straight with slight hill
        else if (i >= 160 && i < 180) {
            curve = 0;
            hill = Math.sin((i - 160) / 20 * Math.PI) * 20;
        }
        // Final turn back to start
        else {
            curve = 2;
        }
        
        segments.push({
            curve: curve,
            hill: hill,
            hasItem: Math.random() < 0.03,
            hasObstacle: Math.random() < 0.05 && i > 5
        });
    }
    
    return segments;
}

function generateSunsetMesaTrack() {
    const segments = [];
    const length = 250;
    
    for (let i = 0; i < length; i++) {
        let curve = 0;
        let hill = 0;
        
        // Long starting straight
        if (i < 20) {
            curve = 0;
        }
        // Wide sweeping right
        else if (i >= 20 && i < 60) {
            curve = 2;
        }
        // Straight with hills
        else if (i >= 60 && i < 90) {
            curve = 0;
            hill = Math.sin((i - 60) / 10 * Math.PI) * 25;
        }
        // Wide left
        else if (i >= 90 && i < 130) {
            curve = -2;
        }
        // Fast straight
        else if (i >= 130 && i < 160) {
            curve = 0;
        }
        // Gentle S
        else if (i >= 160 && i < 185) {
            curve = Math.sin((i - 160) / 25 * Math.PI * 2) * 2;
        }
        // Big sweeping right
        else if (i >= 185 && i < 230) {
            curve = 2.5;
            hill = Math.sin((i - 185) / 45 * Math.PI) * 15;
        }
        // Final approach
        else {
            curve = -1;
        }
        
        segments.push({
            curve: curve,
            hill: hill,
            hasItem: Math.random() < 0.025,
            hasObstacle: Math.random() < 0.04 && i > 10
        });
    }
    
    return segments;
}

// ============================================
// GAME STATE
// ============================================
let gameState = 'title'; // title, trackSelect, countdown, racing, paused, results
let currentTrack = null;
let selectedTrackId = 'desert-canyon';

// Player state
const player = {
    x: 0,
    z: 0,
    speed: 0,
    maxSpeed: 300,
    accel: 0,
    steering: 0,
    segment: 0,
    lap: 1,
    position: 1,
    item: null,
    shield: false,
    shieldTimer: 0,
    boostTimer: 0,
    drifting: false,
    driftCharge: 0,
    driftDirection: 0
};

// Timing
let raceStartTime = 0;
let lapStartTime = 0;
let lapTimes = [];
let totalTime = 0;
let bestLapTime = Infinity;

// AI Racers
const AI_COLORS = [
    { body: '#6b8fa3', hat: '#4a6b7a', name: 'Blue' },   // Dusty blue
    { body: '#a07850', hat: '#6b5344', name: 'Brown' },  // Brown
    { body: '#8b5a8b', hat: '#5a3a5a', name: 'Purple' }  // Purple
];

let aiRacers = [];

// Items on track
let trackItems = [];
let projectiles = [];

// Input state
const keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    drift: false,
    item: false
};

// Audio
let audioCtx = null;
let isMuted = false;

// ============================================
// AUDIO SYSTEM
// ============================================
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(frequency, duration, type = 'square', volume = 0.2) {
    if (isMuted || !audioCtx) return;
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
}

function playEngineSound(speed) {
    if (isMuted || !audioCtx) return;
    const freq = 80 + (speed / player.maxSpeed) * 120;
    playTone(freq, 0.05, 'sawtooth', 0.05);
}

function playBoostSound() {
    playTone(400, 0.1, 'sawtooth', 0.3);
    setTimeout(() => playTone(600, 0.15, 'sawtooth', 0.2), 50);
}

function playItemPickup() {
    playTone(880, 0.1, 'sine', 0.2);
    setTimeout(() => playTone(1100, 0.1, 'sine', 0.15), 80);
}

function playLapComplete() {
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.15, 'square', 0.2), i * 100);
    });
}

function playCountdown(final = false) {
    if (final) {
        playTone(880, 0.3, 'square', 0.3);
    } else {
        playTone(440, 0.2, 'square', 0.25);
    }
}

function playVictory() {
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 0.2, 'square', 0.25), i * 150);
    });
}

// ============================================
// RENDERING - MODE 7 STYLE
// ============================================
function project(point, cameraX, cameraY, cameraZ, cameraDepth) {
    const transX = point.x - cameraX;
    const transY = point.y - cameraY;
    const transZ = point.z - cameraZ;
    
    const scale = cameraDepth / transZ;
    const projX = canvas.width / 2 + scale * transX * canvas.width / 2;
    const projY = canvas.height / 2 - scale * transY * canvas.height / 2;
    const projW = scale * ROAD_WIDTH * canvas.width / 2;
    
    return { x: projX, y: projY, w: projW, scale: scale };
}

function drawSky() {
    const track = TRACKS[selectedTrackId];
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height / 2);
    gradient.addColorStop(0, track.skyTop);
    gradient.addColorStop(1, track.skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
    
    // Sun
    const sunX = canvas.width * 0.75;
    const sunY = canvas.height * 0.2;
    const sunRadius = selectedTrackId === 'sunset-mesa' ? 40 : 30;
    
    // Glow
    const glowGradient = ctx.createRadialGradient(sunX, sunY, sunRadius * 0.5, sunX, sunY, sunRadius * 2);
    glowGradient.addColorStop(0, 'rgba(255, 200, 100, 0.4)');
    glowGradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
    
    // Sun disc
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fillStyle = selectedTrackId === 'sunset-mesa' ? '#ff6633' : '#ffdd44';
    ctx.fill();
}

function drawGround() {
    const track = TRACKS[selectedTrackId];
    ctx.fillStyle = track.grassLight;
    ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);
}

function renderRoad() {
    const track = TRACKS[selectedTrackId];
    const segments = track.segments;
    const baseSegment = Math.floor(player.z / SEGMENT_LENGTH) % segments.length;
    
    let maxy = canvas.height;
    let x = 0;
    let dx = 0;
    
    // Calculate camera position based on player
    const cameraZ = player.z - CAMERA_HEIGHT;
    
    // Draw segments from far to near
    const drawnSegments = [];
    
    for (let n = 0; n < DRAW_DISTANCE; n++) {
        const segmentIndex = (baseSegment + n) % segments.length;
        const segment = segments[segmentIndex];
        
        const z1 = (n * SEGMENT_LENGTH);
        const z2 = ((n + 1) * SEGMENT_LENGTH);
        
        const p1 = project({ x: x, y: segment.hill || 0, z: z1 + 1 }, player.x, CAMERA_HEIGHT, 0, CAMERA_DEPTH);
        const p2 = project({ x: x + dx, y: (segments[(segmentIndex + 1) % segments.length].hill || 0), z: z2 + 1 }, player.x, CAMERA_HEIGHT, 0, CAMERA_DEPTH);
        
        x += dx;
        dx += segment.curve;
        
        if (p1.y >= maxy) continue;
        if (p2.y >= p1.y) continue;
        
        const color = (Math.floor(segmentIndex / 2) % 2) === 0;
        
        drawnSegments.push({
            index: segmentIndex,
            p1, p2, color,
            segment,
            worldZ: player.z + n * SEGMENT_LENGTH
        });
        
        maxy = p2.y;
    }
    
    // Draw from far to near
    for (let i = drawnSegments.length - 1; i >= 0; i--) {
        const { p1, p2, color, segment, index, worldZ } = drawnSegments[i];
        
        // Grass
        ctx.fillStyle = color ? track.grassLight : track.grassDark;
        ctx.fillRect(0, p2.y, canvas.width, p1.y - p2.y);
        
        // Road
        const roadColor = color ? COLORS.ROAD_LIGHT : COLORS.ROAD_DARK;
        drawTrapezoid(p1.x, p1.y, p1.w, p2.x, p2.y, p2.w, roadColor);
        
        // Rumble strips
        const rumbleW1 = p1.w * 1.15;
        const rumbleW2 = p2.w * 1.15;
        const rumbleColor = color ? COLORS.RUMBLE_LIGHT : COLORS.RUMBLE_DARK;
        
        // Left rumble
        drawTrapezoid(p1.x - p1.w, p1.y, rumbleW1 - p1.w, p2.x - p2.w, p2.y, rumbleW2 - p2.w, rumbleColor);
        // Right rumble
        drawTrapezoid(p1.x + p1.w, p1.y, rumbleW1 - p1.w, p2.x + p2.w, p2.y, rumbleW2 - p2.w, rumbleColor);
        
        // Lane markers (on light segments only for dashed effect)
        if (color) {
            const laneW = p1.w * 0.02;
            ctx.fillStyle = COLORS.LANE_MARKER;
            ctx.fillRect(p1.x - laneW / 2, p2.y, laneW, p1.y - p2.y);
        }
        
        // Start/finish line
        if (index === 0) {
            ctx.fillStyle = '#ffffff';
            drawTrapezoid(p1.x, p1.y, p1.w * 0.9, p2.x, p2.y, p2.w * 0.9, '#ffffff');
            // Checkerboard pattern
            const checks = 8;
            const checkW = (p1.w * 2) / checks;
            for (let c = 0; c < checks; c++) {
                if (c % 2 === 0) {
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(p1.x - p1.w + c * checkW, p2.y, checkW, (p1.y - p2.y) / 2);
                    ctx.fillRect(p1.x - p1.w + c * checkW, p2.y + (p1.y - p2.y) / 2, checkW, (p1.y - p2.y) / 2);
                }
            }
        }
        
        // Draw items
        if (segment.hasItem && i < 40) {
            drawItemBox(p1, p2, worldZ);
        }
        
        // Draw obstacles
        if (segment.hasObstacle && i < 40) {
            drawObstacle(p1, p2, track.obstacles, index);
        }
    }
    
    return drawnSegments;
}

function drawTrapezoid(x1, y1, w1, x2, y2, w2, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1 - w1, y1);
    ctx.lineTo(x1 + w1, y1);
    ctx.lineTo(x2 + w2, y2);
    ctx.lineTo(x2 - w2, y2);
    ctx.closePath();
    ctx.fill();
}

function drawItemBox(p1, p2, worldZ) {
    const size = p1.scale * 800;
    if (size < 5) return;
    
    const x = p1.x + (Math.sin(worldZ * 0.01) * p1.w * 0.3);
    const y = p1.y - size * 1.5;
    
    // Rotating question box
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Date.now() * 0.003);
    
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 2;
    ctx.strokeRect(-size / 2, -size / 2, size, size);
    
    ctx.fillStyle = '#8b6914';
    ctx.font = `bold ${size * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, 0);
    
    ctx.restore();
}

function drawObstacle(p1, p2, obstacleTypes, seed) {
    const size = p1.scale * 1000;
    if (size < 10) return;
    
    const side = (seed % 2 === 0) ? -1 : 1;
    const x = p1.x + side * p1.w * 0.7;
    const y = p1.y;
    
    const type = obstacleTypes[seed % obstacleTypes.length];
    
    ctx.save();
    
    if (type === 'cactus') {
        // Draw cactus
        ctx.fillStyle = '#5a8f5a';
        ctx.fillRect(x - size * 0.1, y - size, size * 0.2, size);
        ctx.fillRect(x - size * 0.3, y - size * 0.7, size * 0.2, size * 0.1);
        ctx.fillRect(x - size * 0.3, y - size * 0.7, size * 0.1, size * 0.3);
        ctx.fillRect(x + size * 0.1, y - size * 0.5, size * 0.2, size * 0.1);
        ctx.fillRect(x + size * 0.2, y - size * 0.5, size * 0.1, size * 0.25);
    } else if (type === 'rock') {
        ctx.fillStyle = '#8b7355';
        ctx.beginPath();
        ctx.moveTo(x - size * 0.3, y);
        ctx.lineTo(x - size * 0.2, y - size * 0.5);
        ctx.lineTo(x + size * 0.1, y - size * 0.6);
        ctx.lineTo(x + size * 0.3, y - size * 0.3);
        ctx.lineTo(x + size * 0.25, y);
        ctx.closePath();
        ctx.fill();
    } else if (type === 'skull') {
        ctx.fillStyle = '#f0e6d2';
        ctx.beginPath();
        ctx.arc(x, y - size * 0.3, size * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(x - size * 0.08, y - size * 0.35, size * 0.05, 0, Math.PI * 2);
        ctx.arc(x + size * 0.08, y - size * 0.35, size * 0.05, 0, Math.PI * 2);
        ctx.fill();
    } else if (type === 'butte') {
        ctx.fillStyle = '#a07850';
        ctx.beginPath();
        ctx.moveTo(x - size * 0.5, y);
        ctx.lineTo(x - size * 0.3, y - size * 1.5);
        ctx.lineTo(x + size * 0.3, y - size * 1.5);
        ctx.lineTo(x + size * 0.5, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(x - size * 0.28, y - size * 1.5, size * 0.56, size * 0.1);
    } else if (type === 'tumbleweed') {
        ctx.fillStyle = '#c9a86c';
        ctx.beginPath();
        const tw = size * 0.3;
        ctx.arc(x + Math.sin(Date.now() * 0.005 + seed) * 20, y - tw, tw, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#8b7355';
        ctx.lineWidth = 2;
        ctx.stroke();
    } else if (type === 'wagon') {
        // Broken wagon
        ctx.fillStyle = '#6b5344';
        ctx.fillRect(x - size * 0.3, y - size * 0.3, size * 0.5, size * 0.2);
        ctx.beginPath();
        ctx.arc(x - size * 0.2, y - size * 0.05, size * 0.15, 0, Math.PI * 2);
        ctx.strokeStyle = '#4a3628';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    
    ctx.restore();
}

// ============================================
// WAGON RENDERING
// ============================================
function drawWagon(x, y, scale, color, hatColor, steering = 0, boost = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(steering * 0.1);
    
    const wagonWidth = 60;
    const wagonHeight = 40;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.ellipse(0, 5, wagonWidth * 0.6, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Back wheels (larger)
    ctx.fillStyle = '#4a3628';
    ctx.beginPath();
    ctx.arc(-wagonWidth * 0.35, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Spokes
    for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(-wagonWidth * 0.35, 0);
        const angle = (i / 6) * Math.PI * 2 + Date.now() * 0.01;
        ctx.lineTo(-wagonWidth * 0.35 + Math.cos(angle) * 15, Math.sin(angle) * 15);
        ctx.stroke();
    }
    
    // Front wheels (smaller)
    ctx.beginPath();
    ctx.arc(wagonWidth * 0.3, 0, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#4a3628';
    ctx.fill();
    ctx.stroke();
    
    // Wagon body
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(-wagonWidth * 0.4, -wagonHeight * 0.6, wagonWidth * 0.7, wagonHeight * 0.5);
    
    // Wood planks
    ctx.strokeStyle = '#6b5344';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-wagonWidth * 0.4, -wagonHeight * 0.6 + i * 5);
        ctx.lineTo(wagonWidth * 0.3, -wagonHeight * 0.6 + i * 5);
        ctx.stroke();
    }
    
    // BIG ENGINE on back
    ctx.fillStyle = '#444';
    ctx.fillRect(-wagonWidth * 0.55, -wagonHeight * 0.8, wagonWidth * 0.25, wagonHeight * 0.7);
    
    // Engine details
    ctx.fillStyle = '#666';
    ctx.fillRect(-wagonWidth * 0.52, -wagonHeight * 0.75, wagonWidth * 0.08, wagonHeight * 0.15);
    ctx.fillRect(-wagonWidth * 0.52, -wagonHeight * 0.55, wagonWidth * 0.08, wagonHeight * 0.15);
    
    // Exhaust pipes
    ctx.fillStyle = '#888';
    ctx.fillRect(-wagonWidth * 0.6, -wagonHeight * 1.1, 8, wagonHeight * 0.4);
    ctx.fillRect(-wagonWidth * 0.5, -wagonHeight * 1.0, 8, wagonHeight * 0.3);
    
    // Exhaust flames when boosting
    if (boost) {
        ctx.fillStyle = '#ff4400';
        ctx.beginPath();
        ctx.moveTo(-wagonWidth * 0.6, -wagonHeight * 1.1);
        ctx.lineTo(-wagonWidth * 0.56, -wagonHeight * 1.4 - Math.random() * 10);
        ctx.lineTo(-wagonWidth * 0.52, -wagonHeight * 1.1);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(-wagonWidth * 0.5, -wagonHeight * 1.0);
        ctx.lineTo(-wagonWidth * 0.46, -wagonHeight * 1.25 - Math.random() * 8);
        ctx.lineTo(-wagonWidth * 0.42, -wagonHeight * 1.0);
        ctx.fill();
        
        // Inner flame
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.moveTo(-wagonWidth * 0.58, -wagonHeight * 1.1);
        ctx.lineTo(-wagonWidth * 0.56, -wagonHeight * 1.25);
        ctx.lineTo(-wagonWidth * 0.54, -wagonHeight * 1.1);
        ctx.fill();
    }
    
    // Dino driver
    const dinoX = 0;
    const dinoY = -wagonHeight * 0.5;
    
    // Body
    ctx.fillStyle = color;
    ctx.fillRect(dinoX - 12, dinoY - 25, 24, 30);
    
    // Head
    ctx.fillRect(dinoX - 5, dinoY - 40, 20, 18);
    
    // Eye
    ctx.fillStyle = '#fff';
    ctx.fillRect(dinoX + 8, dinoY - 36, 4, 4);
    
    // Cowboy hat
    ctx.fillStyle = hatColor;
    // Crown
    ctx.beginPath();
    ctx.moveTo(dinoX - 8, dinoY - 42);
    ctx.lineTo(dinoX - 6, dinoY - 52);
    ctx.quadraticCurveTo(dinoX + 5, dinoY - 56, dinoX + 12, dinoY - 50);
    ctx.lineTo(dinoX + 14, dinoY - 42);
    ctx.closePath();
    ctx.fill();
    
    // Brim
    ctx.beginPath();
    ctx.moveTo(dinoX - 15, dinoY - 40);
    ctx.quadraticCurveTo(dinoX - 12, dinoY - 46, dinoX - 8, dinoY - 42);
    ctx.lineTo(dinoX + 14, dinoY - 42);
    ctx.quadraticCurveTo(dinoX + 18, dinoY - 46, dinoX + 22, dinoY - 40);
    ctx.lineTo(dinoX + 20, dinoY - 38);
    ctx.lineTo(dinoX - 13, dinoY - 38);
    ctx.closePath();
    ctx.fill();
    
    // Hat band
    ctx.fillStyle = '#c9a86c';
    ctx.fillRect(dinoX - 6, dinoY - 44, 18, 3);
    
    // Arms on steering
    ctx.fillStyle = color;
    ctx.fillRect(dinoX + 10, dinoY - 20, 15, 6);
    
    // Steering wheel
    ctx.strokeStyle = '#4a3628';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(dinoX + 25, dinoY - 15, 8, 0, Math.PI * 2);
    ctx.stroke();
    
    // Lanterns
    ctx.fillStyle = '#ffcc00';
    ctx.globalAlpha = 0.8 + Math.sin(Date.now() * 0.01) * 0.2;
    ctx.beginPath();
    ctx.arc(-wagonWidth * 0.35, -wagonHeight * 0.3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(wagonWidth * 0.25, -wagonHeight * 0.3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    
    ctx.restore();
}

function drawPlayerWagon() {
    const steer = player.steering * 0.5;
    const bobY = Math.sin(Date.now() * 0.02) * 2;
    const boost = player.boostTimer > 0;
    
    drawWagon(
        canvas.width / 2 + steer * 50,
        canvas.height - 80 + bobY,
        1.2,
        '#7fbc8c',
        '#6b5344',
        steer,
        boost
    );
    
    // Shield effect
    if (player.shield) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.02) * 0.3;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height - 80, 50, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

// ============================================
// AI RACERS
// ============================================
function initAIRacers() {
    aiRacers = AI_COLORS.map((colors, i) => ({
        x: (i - 1) * 300,
        z: -500 - i * 200,
        speed: 200 + Math.random() * 50,
        segment: 0,
        lap: 1,
        color: colors.body,
        hat: colors.hat,
        name: colors.name,
        targetX: 0
    }));
}

function updateAIRacers(dt) {
    const track = TRACKS[selectedTrackId];
    const segments = track.segments;
    
    aiRacers.forEach(ai => {
        // Move forward
        ai.z += ai.speed * dt;
        
        // Follow track curves
        const segIndex = Math.floor((ai.z + player.z) / SEGMENT_LENGTH) % segments.length;
        if (segIndex >= 0 && segIndex < segments.length) {
            const seg = segments[segIndex];
            ai.targetX = -seg.curve * 100;
        }
        
        // Smooth steering toward target
        ai.x += (ai.targetX - ai.x) * 0.02;
        
        // Add some randomness
        ai.x += (Math.random() - 0.5) * 5;
        
        // Clamp to road
        ai.x = Math.max(-ROAD_WIDTH * 0.4, Math.min(ROAD_WIDTH * 0.4, ai.x));
        
        // Lap tracking
        const prevSeg = ai.segment;
        ai.segment = segIndex;
        if (prevSeg > segments.length - 5 && ai.segment < 5) {
            ai.lap++;
        }
        
        // Vary speed
        ai.speed = 200 + Math.sin(Date.now() * 0.001 + aiRacers.indexOf(ai)) * 30;
    });
}

function drawAIRacers(drawnSegments) {
    aiRacers.forEach(ai => {
        const relZ = ai.z;
        
        if (relZ < 0 || relZ > DRAW_DISTANCE * SEGMENT_LENGTH) return;
        
        const segIndex = Math.floor(relZ / SEGMENT_LENGTH);
        if (segIndex >= drawnSegments.length) return;
        
        const seg = drawnSegments.find(s => Math.abs(s.worldZ - player.z - relZ) < SEGMENT_LENGTH);
        if (!seg) return;
        
        const scale = seg.p1.scale * 0.8;
        if (scale < 0.05) return;
        
        const screenX = seg.p1.x + (ai.x / ROAD_WIDTH) * seg.p1.w * 2;
        const screenY = seg.p1.y;
        
        drawWagon(screenX, screenY, scale, ai.color, ai.hat, 0, false);
    });
}

// ============================================
// ITEMS SYSTEM
// ============================================
function pickupItem() {
    if (player.item) return;
    
    const itemTypes = Object.values(ITEMS);
    player.item = itemTypes[Math.floor(Math.random() * itemTypes.length)];
    playItemPickup();
    
    // Show item spinning animation
    const itemBox = document.getElementById('item-box');
    const itemIcon = document.getElementById('item-icon');
    itemBox.classList.remove('hidden');
    itemBox.classList.add('spinning');
    
    setTimeout(() => {
        itemBox.classList.remove('spinning');
        itemIcon.textContent = player.item.icon;
    }, 500);
}

function useItem() {
    if (!player.item) return;
    
    const item = player.item;
    player.item = null;
    document.getElementById('item-icon').textContent = '';
    document.getElementById('item-box').classList.add('hidden');
    
    switch (item.effect) {
        case 'speed':
            player.boostTimer = 120;
            player.maxSpeed = 400;
            playBoostSound();
            break;
            
        case 'shield':
            player.shield = true;
            player.shieldTimer = 300;
            playTone(660, 0.2, 'sine', 0.2);
            break;
            
        case 'projectile':
            projectiles.push({
                x: player.x,
                z: player.z + 100,
                speed: 500,
                type: 'lasso'
            });
            playTone(300, 0.1, 'square', 0.2);
            break;
            
        case 'bomb':
            projectiles.push({
                x: player.x,
                z: player.z + 50,
                speed: 200,
                type: 'dynamite',
                timer: 120
            });
            playTone(200, 0.15, 'square', 0.25);
            break;
            
        case 'trail':
            // Drop tumbleweeds behind
            for (let i = 0; i < 3; i++) {
                projectiles.push({
                    x: player.x + (Math.random() - 0.5) * 200,
                    z: player.z - 100 - i * 100,
                    speed: -50,
                    type: 'tumbleweed',
                    timer: 300
                });
            }
            playTone(250, 0.1, 'sawtooth', 0.15);
            break;
            
        case 'points':
            // Instant points bonus
            // (Could add score system later)
            playTone(880, 0.1, 'sine', 0.2);
            playTone(1100, 0.1, 'sine', 0.2);
            break;
    }
}

function updateProjectiles(dt) {
    projectiles = projectiles.filter(p => {
        p.z += p.speed * dt;
        
        if (p.timer !== undefined) {
            p.timer--;
            if (p.timer <= 0) {
                if (p.type === 'dynamite') {
                    // Explosion effect could go here
                    playTone(100, 0.3, 'sawtooth', 0.3);
                }
                return false;
            }
        }
        
        // Check collision with AI
        aiRacers.forEach(ai => {
            const dx = Math.abs(ai.x - p.x);
            const dz = Math.abs((ai.z + player.z) - p.z);
            if (dx < 100 && dz < 50) {
                ai.speed *= 0.5; // Slow them down
                ai.z -= 200; // Push back
                p.timer = 0;
            }
        });
        
        return p.z < player.z + 2000 && p.z > player.z - 500;
    });
}

// ============================================
// GAME LOGIC
// ============================================
function updatePlayer(dt) {
    const track = TRACKS[selectedTrackId];
    const segments = track.segments;
    
    // Steering
    let steerAmount = 0;
    if (keys.left) steerAmount -= 1;
    if (keys.right) steerAmount += 1;
    
    // Drifting
    if (keys.drift && Math.abs(steerAmount) > 0 && player.speed > 100) {
        if (!player.drifting) {
            player.drifting = true;
            player.driftDirection = steerAmount;
        }
        player.driftCharge = Math.min(player.driftCharge + dt * 60, 100);
        steerAmount *= 1.5;
    } else if (player.drifting) {
        // Release drift boost
        if (player.driftCharge > 30) {
            player.boostTimer = Math.floor(player.driftCharge);
            player.maxSpeed = 350;
            playBoostSound();
        }
        player.drifting = false;
        player.driftCharge = 0;
    }
    
    player.steering += (steerAmount - player.steering) * 0.1;
    
    // Apply steering to position
    player.x += player.steering * player.speed * dt * 0.5;
    
    // Track curve influence
    const segIndex = Math.floor(player.z / SEGMENT_LENGTH) % segments.length;
    const segment = segments[segIndex];
    player.x -= segment.curve * player.speed * dt * 0.1;
    
    // Acceleration
    let targetSpeed = 0;
    if (keys.up) {
        targetSpeed = player.maxSpeed;
    } else if (keys.down) {
        targetSpeed = -player.maxSpeed * 0.3;
    }
    
    // Apply boost
    if (player.boostTimer > 0) {
        player.boostTimer--;
        targetSpeed = player.maxSpeed;
        if (player.boostTimer === 0) {
            player.maxSpeed = 300;
        }
    }
    
    // Shield timer
    if (player.shieldTimer > 0) {
        player.shieldTimer--;
        if (player.shieldTimer === 0) {
            player.shield = false;
        }
    }
    
    // Accelerate/decelerate
    if (player.speed < targetSpeed) {
        player.speed = Math.min(player.speed + 200 * dt, targetSpeed);
    } else {
        player.speed = Math.max(player.speed - 300 * dt, targetSpeed);
    }
    
    // Off-road slowdown
    if (Math.abs(player.x) > ROAD_WIDTH * 0.45) {
        player.speed *= 0.98;
        player.x = Math.sign(player.x) * ROAD_WIDTH * 0.5;
    }
    
    // Update position
    player.z += player.speed * dt;
    
    // Lap detection
    const prevSegment = player.segment;
    player.segment = segIndex;
    
    if (prevSegment > segments.length - 5 && player.segment < 5 && player.speed > 0) {
        completeLap();
    }
    
    // Check item pickup
    if (segment.hasItem && !player.item) {
        const itemZ = segIndex * SEGMENT_LENGTH;
        if (Math.abs(player.z - itemZ) < 100) {
            segment.hasItem = false;
            pickupItem();
        }
    }
    
    // Engine sound
    if (Math.random() < 0.1) {
        playEngineSound(player.speed);
    }
}

function completeLap() {
    const now = performance.now();
    const lapTime = now - lapStartTime;
    lapTimes.push(lapTime);
    
    if (lapTime < bestLapTime) {
        bestLapTime = lapTime;
    }
    
    playLapComplete();
    
    player.lap++;
    lapStartTime = now;
    
    if (player.lap > TRACKS[selectedTrackId].laps) {
        finishRace();
    }
}

function finishRace() {
    totalTime = performance.now() - raceStartTime;
    gameState = 'results';
    
    // Calculate position
    const playerLaps = player.lap;
    let position = 1;
    aiRacers.forEach(ai => {
        if (ai.lap > playerLaps || (ai.lap === playerLaps && ai.z > player.z)) {
            position++;
        }
    });
    player.position = position;
    
    playVictory();
    showResults();
}

function calculatePositions() {
    const allRacers = [
        { name: 'Player', lap: player.lap, z: player.z, segment: player.segment },
        ...aiRacers.map(ai => ({ name: ai.name, lap: ai.lap, z: ai.z + player.z, segment: ai.segment }))
    ];
    
    allRacers.sort((a, b) => {
        if (a.lap !== b.lap) return b.lap - a.lap;
        return b.z - a.z;
    });
    
    const playerIndex = allRacers.findIndex(r => r.name === 'Player');
    player.position = playerIndex + 1;
}

// ============================================
// UI UPDATES
// ============================================
function updateHUD() {
    // Position
    const positionEl = document.getElementById('position-display');
    const suffix = ['st', 'nd', 'rd', 'th'][Math.min(player.position - 1, 3)];
    positionEl.textContent = player.position + suffix;
    
    // Lap
    const lapEl = document.getElementById('lap-display');
    lapEl.textContent = `LAP ${Math.min(player.lap, TRACKS[selectedTrackId].laps)}/${TRACKS[selectedTrackId].laps}`;
    
    // Speed
    const speedNeedle = document.getElementById('speed-needle');
    const speedValue = document.getElementById('speed-value');
    const speedPercent = player.speed / 400;
    const angle = -45 + speedPercent * 90;
    speedNeedle.style.transform = `translateX(-50%) rotate(${angle}deg)`;
    speedValue.textContent = Math.floor(player.speed);
    
    // Timer
    const now = performance.now();
    const currentLapTime = now - lapStartTime;
    const totalElapsed = now - raceStartTime;
    
    document.getElementById('current-lap-time').textContent = formatTime(currentLapTime);
    document.getElementById('total-time').textContent = formatTime(totalElapsed);
}

function formatTime(ms) {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const centis = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
}

// ============================================
// GAME SCREENS
// ============================================
function showTitleScreen() {
    gameState = 'title';
    document.getElementById('title-screen').classList.remove('hidden');
    document.getElementById('track-select-screen').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('results-screen').classList.add('hidden');
    drawTitleWagon();
}

function showTrackSelect() {
    gameState = 'trackSelect';
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('track-select-screen').classList.remove('hidden');
    
    // Load best times
    loadBestTimes();
    
    // Draw track previews
    drawTrackPreview('preview-canyon', 'desert-canyon');
    drawTrackPreview('preview-mesa', 'sunset-mesa');
}

function drawTrackPreview(canvasId, trackId) {
    const previewCanvas = document.getElementById(canvasId);
    const pctx = previewCanvas.getContext('2d');
    const track = TRACKS[trackId];
    
    // Sky gradient
    const gradient = pctx.createLinearGradient(0, 0, 0, previewCanvas.height * 0.5);
    gradient.addColorStop(0, track.skyTop);
    gradient.addColorStop(1, track.skyBottom);
    pctx.fillStyle = gradient;
    pctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height * 0.5);
    
    // Ground
    pctx.fillStyle = track.grassLight;
    pctx.fillRect(0, previewCanvas.height * 0.5, previewCanvas.width, previewCanvas.height * 0.5);
    
    // Road
    pctx.fillStyle = '#666';
    pctx.beginPath();
    pctx.moveTo(previewCanvas.width * 0.3, previewCanvas.height);
    pctx.lineTo(previewCanvas.width * 0.7, previewCanvas.height);
    pctx.lineTo(previewCanvas.width * 0.55, previewCanvas.height * 0.5);
    pctx.lineTo(previewCanvas.width * 0.45, previewCanvas.height * 0.5);
    pctx.closePath();
    pctx.fill();
    
    // Mini wagon
    pctx.fillStyle = '#7fbc8c';
    pctx.fillRect(previewCanvas.width * 0.45, previewCanvas.height * 0.7, 20, 15);
    pctx.fillStyle = '#8b6914';
    pctx.fillRect(previewCanvas.width * 0.43, previewCanvas.height * 0.72, 25, 10);
}

function selectTrack(trackId) {
    selectedTrackId = trackId;
    document.querySelectorAll('.track-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.track === trackId);
    });
    startCountdown();
}

function startCountdown() {
    document.getElementById('track-select-screen').classList.add('hidden');
    document.getElementById('countdown-overlay').classList.remove('hidden');
    document.getElementById('hud').classList.remove('hidden');
    
    initAudio();
    resetRace();
    
    let count = 3;
    const countdownText = document.getElementById('countdown-text');
    
    const countdownInterval = setInterval(() => {
        if (count > 0) {
            countdownText.textContent = count;
            countdownText.style.animation = 'none';
            void countdownText.offsetWidth;
            countdownText.style.animation = 'countdown-pulse 0.5s ease-out';
            playCountdown(false);
            count--;
        } else {
            countdownText.textContent = 'GO!';
            countdownText.style.color = '#00ff00';
            playCountdown(true);
            
            setTimeout(() => {
                document.getElementById('countdown-overlay').classList.add('hidden');
                countdownText.style.color = '#ffd700';
                gameState = 'racing';
                raceStartTime = performance.now();
                lapStartTime = raceStartTime;
            }, 500);
            
            clearInterval(countdownInterval);
        }
    }, 1000);
}

function resetRace() {
    player.x = 0;
    player.z = 0;
    player.speed = 0;
    player.steering = 0;
    player.segment = 0;
    player.lap = 1;
    player.position = 4;
    player.item = null;
    player.shield = false;
    player.shieldTimer = 0;
    player.boostTimer = 0;
    player.maxSpeed = 300;
    player.drifting = false;
    player.driftCharge = 0;
    
    lapTimes = [];
    bestLapTime = Infinity;
    totalTime = 0;
    projectiles = [];
    
    // Reset track items
    const track = TRACKS[selectedTrackId];
    track.segments.forEach((seg, i) => {
        seg.hasItem = Math.random() < 0.03 && i > 5;
    });
    
    document.getElementById('item-box').classList.add('hidden');
    document.getElementById('item-icon').textContent = '';
    
    initAIRacers();
}

function showResults() {
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('results-screen').classList.remove('hidden');
    
    const suffix = ['st', 'nd', 'rd', 'th'][Math.min(player.position - 1, 3)];
    document.getElementById('result-position').textContent = player.position + suffix;
    document.getElementById('result-total-time').textContent = formatTime(totalTime);
    document.getElementById('result-best-lap').textContent = formatTime(bestLapTime);
    
    // Update title based on position
    const title = document.getElementById('results-title');
    if (player.position === 1) {
        title.textContent = 'VICTORY!';
        title.style.color = '#ffd700';
    } else {
        title.textContent = 'RACE COMPLETE';
        title.style.color = '#fff';
    }
    
    // Reset name entry
    const nameEntry = document.getElementById('name-entry');
    const savedName = localStorage.getItem('dinoCartPlayerName') || '';
    nameEntry.innerHTML = `
        <p>Enter your initials:</p>
        <input type="text" id="name-input" class="name-input" maxlength="3" placeholder="AAA" autocomplete="off" autocapitalize="characters" value="${savedName}">
        <button id="btn-submit-score" class="btn-submit">SUBMIT</button>
    `;
    
    document.getElementById('btn-submit-score').addEventListener('click', submitScore);
    
    // Load leaderboard
    displayLeaderboard('today');
}

// ============================================
// LEADERBOARD
// ============================================
function getTodayString() {
    const now = new Date();
    const pstDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const year = pstDate.getFullYear();
    const month = String(pstDate.getMonth() + 1).padStart(2, '0');
    const day = String(pstDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function submitScore() {
    const nameInput = document.getElementById('name-input');
    const name = nameInput.value.trim().toUpperCase();
    
    if (name.length < 1) {
        nameInput.focus();
        return;
    }
    
    localStorage.setItem('dinoCartPlayerName', name);
    
    const btn = document.getElementById('btn-submit-score');
    btn.disabled = true;
    btn.textContent = '...';
    
    if (db) {
        try {
            await db.collection('dino-cart-scores').add({
                name: name.substring(0, 3),
                track: selectedTrackId,
                totalTime: totalTime,
                bestLap: bestLapTime,
                position: player.position,
                date: getTodayString(),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) {
            console.error('Error submitting score:', e);
        }
    }
    
    document.getElementById('name-entry').innerHTML = `<p class="submitted-msg">Submitted as ${name}</p>`;
    displayLeaderboard('today');
}

async function displayLeaderboard(type) {
    const listEl = document.getElementById('leaderboard-list');
    listEl.innerHTML = '<div class="loading">Loading...</div>';
    
    if (!db) {
        listEl.innerHTML = '<div class="no-scores">Leaderboard unavailable</div>';
        return;
    }
    
    try {
        let query = db.collection('dino-cart-scores')
            .where('track', '==', selectedTrackId)
            .orderBy('totalTime', 'asc')
            .limit(50);
        
        const snapshot = await query.get();
        let scores = [];
        snapshot.forEach(doc => scores.push(doc.data()));
        
        if (type === 'today') {
            const today = getTodayString();
            scores = scores.filter(s => s.date === today);
        }
        
        scores = scores.slice(0, 10);
        
        if (scores.length === 0) {
            listEl.innerHTML = '<div class="no-scores">No scores yet!</div>';
            return;
        }
        
        const savedName = localStorage.getItem('dinoCartPlayerName') || '';
        
        listEl.innerHTML = scores.map((s, i) => {
            const isPlayer = s.name === savedName.toUpperCase().substring(0, 3) && Math.abs(s.totalTime - totalTime) < 100;
            return `
                <div class="leaderboard-entry ${isPlayer ? 'highlight' : ''}">
                    <span class="leaderboard-rank">${i + 1}.</span>
                    <span class="leaderboard-name">${s.name}</span>
                    <span class="leaderboard-time">${formatTime(s.totalTime)}</span>
                </div>
            `;
        }).join('');
        
    } catch (e) {
        console.error('Error loading leaderboard:', e);
        listEl.innerHTML = '<div class="no-scores">Error loading scores</div>';
    }
}

async function loadBestTimes() {
    if (!db) return;
    
    const savedName = localStorage.getItem('dinoCartPlayerName');
    if (!savedName) return;
    
    for (const trackId of ['desert-canyon', 'sunset-mesa']) {
        try {
            const snapshot = await db.collection('dino-cart-scores')
                .where('track', '==', trackId)
                .where('name', '==', savedName.toUpperCase().substring(0, 3))
                .orderBy('totalTime', 'asc')
                .limit(1)
                .get();
            
            if (!snapshot.empty) {
                const best = snapshot.docs[0].data();
                const elId = trackId === 'desert-canyon' ? 'best-canyon' : 'best-mesa';
                document.getElementById(elId).textContent = formatTime(best.totalTime);
            }
        } catch (e) {
            // Ignore errors
        }
    }
}

// ============================================
// TITLE WAGON
// ============================================
function drawTitleWagon() {
    const titleCanvas = document.getElementById('titleWagon');
    if (!titleCanvas) return;
    
    const tctx = titleCanvas.getContext('2d');
    tctx.clearRect(0, 0, titleCanvas.width, titleCanvas.height);
    
    tctx.save();
    tctx.translate(60, 55);
    tctx.scale(0.7, 0.7);
    
    // Wagon body
    tctx.fillStyle = '#8b6914';
    tctx.fillRect(-25, -15, 45, 25);
    
    // Engine
    tctx.fillStyle = '#444';
    tctx.fillRect(-35, -25, 15, 30);
    
    // Exhaust
    tctx.fillStyle = '#888';
    tctx.fillRect(-38, -40, 6, 20);
    tctx.fillRect(-30, -35, 6, 15);
    
    // Flames
    tctx.fillStyle = '#ff4400';
    tctx.beginPath();
    tctx.moveTo(-38, -40);
    tctx.lineTo(-35, -55);
    tctx.lineTo(-32, -40);
    tctx.fill();
    
    // Wheels
    tctx.fillStyle = '#4a3628';
    tctx.beginPath();
    tctx.arc(-15, 15, 12, 0, Math.PI * 2);
    tctx.fill();
    tctx.beginPath();
    tctx.arc(15, 15, 8, 0, Math.PI * 2);
    tctx.fill();
    
    // Dino
    tctx.fillStyle = '#7fbc8c';
    tctx.fillRect(0, -25, 15, 20);
    tctx.fillRect(5, -40, 12, 12);
    
    // Hat
    tctx.fillStyle = '#6b5344';
    tctx.fillRect(2, -48, 18, 10);
    tctx.fillRect(0, -42, 22, 5);
    
    // Eye
    tctx.fillStyle = '#fff';
    tctx.fillRect(12, -36, 3, 3);
    
    tctx.restore();
}

// ============================================
// MAIN GAME LOOP
// ============================================
let lastTime = 0;

function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'racing') {
        updatePlayer(dt);
        updateAIRacers(dt);
        updateProjectiles(dt);
        calculatePositions();
        
        drawSky();
        drawGround();
        const drawnSegments = renderRoad();
        drawAIRacers(drawnSegments);
        drawPlayerWagon();
        
        // Drift indicator
        if (player.drifting) {
            ctx.fillStyle = `rgba(255, ${255 - player.driftCharge * 2}, 0, 0.8)`;
            ctx.fillRect(canvas.width / 2 - 50, canvas.height - 20, player.driftCharge, 10);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(canvas.width / 2 - 50, canvas.height - 20, 100, 10);
        }
        
        updateHUD();
    } else if (gameState === 'title' || gameState === 'trackSelect') {
        // Animate title background
        drawSky();
        drawGround();
    } else if (gameState === 'paused') {
        drawSky();
        drawGround();
        renderRoad();
        drawPlayerWagon();
    }
    
    requestAnimationFrame(gameLoop);
}

// ============================================
// INPUT HANDLING
// ============================================
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    
    switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
            keys.left = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keys.right = true;
            break;
        case 'ArrowUp':
        case 'KeyW':
            keys.up = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            keys.down = true;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            keys.drift = true;
            break;
        case 'Space':
            e.preventDefault();
            if (gameState === 'racing') {
                useItem();
            }
            break;
        case 'Escape':
        case 'KeyP':
            if (gameState === 'racing') {
                gameState = 'paused';
                document.getElementById('pause-screen').classList.remove('hidden');
            } else if (gameState === 'paused') {
                gameState = 'racing';
                document.getElementById('pause-screen').classList.add('hidden');
            }
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
            keys.left = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keys.right = false;
            break;
        case 'ArrowUp':
        case 'KeyW':
            keys.up = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            keys.down = false;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            keys.drift = false;
            break;
    }
});

// Touch controls
function initTouchControls() {
    const btnLeft = document.getElementById('btn-touch-left');
    const btnRight = document.getElementById('btn-touch-right');
    const btnItem = document.getElementById('btn-touch-item');
    
    if (btnLeft) {
        btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys.left = true; keys.up = true; });
        btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys.left = false; });
    }
    
    if (btnRight) {
        btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys.right = true; keys.up = true; });
        btnRight.addEventListener('touchend', (e) => { e.preventDefault(); keys.right = false; });
    }
    
    if (btnItem) {
        btnItem.addEventListener('touchstart', (e) => { e.preventDefault(); useItem(); });
    }
}

// ============================================
// EVENT LISTENERS
// ============================================
document.getElementById('btn-play').addEventListener('click', () => {
    initAudio();
    showTrackSelect();
});

document.querySelectorAll('.track-card').forEach(card => {
    card.addEventListener('click', () => {
        selectTrack(card.dataset.track);
    });
});

document.getElementById('btn-back-title').addEventListener('click', showTitleScreen);

document.getElementById('btn-resume').addEventListener('click', () => {
    gameState = 'racing';
    document.getElementById('pause-screen').classList.add('hidden');
});

document.getElementById('btn-quit').addEventListener('click', () => {
    document.getElementById('pause-screen').classList.add('hidden');
    showTitleScreen();
});

document.getElementById('btn-race-again').addEventListener('click', () => {
    document.getElementById('results-screen').classList.add('hidden');
    startCountdown();
});

document.getElementById('btn-change-track').addEventListener('click', () => {
    document.getElementById('results-screen').classList.add('hidden');
    showTrackSelect();
});

document.getElementById('tab-today').addEventListener('click', () => {
    document.getElementById('tab-today').classList.add('active');
    document.getElementById('tab-alltime').classList.remove('active');
    displayLeaderboard('today');
});

document.getElementById('tab-alltime').addEventListener('click', () => {
    document.getElementById('tab-alltime').classList.add('active');
    document.getElementById('tab-today').classList.remove('active');
    displayLeaderboard('alltime');
});

// ============================================
// INITIALIZATION
// ============================================
function init() {
    initTouchControls();
    drawTitleWagon();
    showTitleScreen();
    requestAnimationFrame(gameLoop);
}

init();
