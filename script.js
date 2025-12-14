const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

// UI Elements
const menuOverlay = document.getElementById('menuOverlay');
const pauseOverlay = document.getElementById('pauseOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const restartBtn = document.getElementById('restartBtn');
const quitBtn = document.getElementById('quitBtn');
const menuBtn = document.getElementById('menuBtn');
const finalScoreElement = document.getElementById('finalScore');
const loadingText = document.getElementById('loadingText');

// Level Selection
const levelBtns = document.querySelectorAll('.level-btn');

// Mobile Controls
const upBtn = document.getElementById('upBtn');
const downBtn = document.getElementById('downBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');

const gridSize = 20;
const tileCount = canvas.width / gridSize;

// Game State
const STATE_MENU = 0;
const STATE_PLAYING = 1;
const STATE_PAUSED = 2;
const STATE_GAMEOVER = 3;

let currentState = STATE_MENU;
let score = 0;
let snake = [];
let food = {};
let walls = [];
let dx = 0;
let dy = 0;
let nextDx = 0;
let nextDy = 0;
let gameInterval;
let inputProcessed = false;
let currentLevelName = 'classic';

// --- Sound Manager ---
const SoundManager = {
    audioCtx: null,

    init() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },

    playTone(frequency, type, duration) {
        if (!this.audioCtx) return;

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);

        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
    },

    playEat() {
        this.playTone(600, 'sine', 0.1);
        setTimeout(() => this.playTone(800, 'sine', 0.1), 50);
    },

    playCrash() {
        this.playTone(100, 'sawtooth', 0.3);
        setTimeout(() => this.playTone(50, 'sawtooth', 0.3), 100);
    },

    playMove() {
        // Subtle click
        // this.playTone(200, 'triangle', 0.05); // Can be annoying if loud
    }
};

// --- Asset Loader ---
const images = {};
const assets = [
    { name: 'head', src: 'assets/head.svg' },
    { name: 'body', src: 'assets/body.svg' },
    { name: 'apple', src: 'assets/apple.svg' },
    { name: 'wall', src: 'assets/wall.svg' }
];

function loadAssets() {
    let loaded = 0;
    return new Promise((resolve, reject) => {
        if (assets.length === 0) resolve();

        assets.forEach(asset => {
            const img = new Image();
            img.onload = () => {
                loaded++;
                images[asset.name] = img;
                if (loaded === assets.length) resolve();
            };
            img.onerror = () => {
                console.error("Failed to load asset: " + asset.src);
                // Continue anyway to avoid blocking
                loaded++;
                if (loaded === assets.length) resolve();
            };
            img.src = asset.src;
        });
    });
}


// --- Levels ---
const Levels = {
    classic: {
        bg: '#2c3e50',
        walls: []
    },
    box: {
        bg: '#34495e',
        walls: [] // Generated dynamically
    },
    maze: {
        bg: '#273746',
        walls: [] // Defined below
    }
};

function generateLevelData(levelName) {
    let levelWalls = [];

    if (levelName === 'box') {
        // Create 4 quadrant obstacles
        // Top Left
        levelWalls.push({x: 5, y: 5}); levelWalls.push({x: 6, y: 5});
        levelWalls.push({x: 5, y: 6}); levelWalls.push({x: 6, y: 6});

        // Top Right
        levelWalls.push({x: 14, y: 5}); levelWalls.push({x: 13, y: 5});
        levelWalls.push({x: 14, y: 6}); levelWalls.push({x: 13, y: 6});

        // Bottom Left
        levelWalls.push({x: 5, y: 14}); levelWalls.push({x: 6, y: 14});
        levelWalls.push({x: 5, y: 13}); levelWalls.push({x: 6, y: 13});

        // Bottom Right
        levelWalls.push({x: 14, y: 14}); levelWalls.push({x: 13, y: 14});
        levelWalls.push({x: 14, y: 13}); levelWalls.push({x: 13, y: 13});

    } else if (levelName === 'maze') {
        // Simple parallel lines
        for(let x = 4; x < 16; x+=4) {
             for(let y = 2; y < 18; y++) {
                 if (y % 4 !== 0) levelWalls.push({x: x, y: y});
             }
        }
    }

    return levelWalls;
}

// --- Game Logic ---

function init() {
    loadingText.style.display = 'block';
    loadAssets().then(() => {
        loadingText.style.display = 'none';
        showMenu();
        drawInitialScreen();
        SoundManager.init(); // Init audio context (needs user interaction usually, handled in click)
    });
}

function showMenu() {
    currentState = STATE_MENU;
    menuOverlay.classList.remove('hidden');
    pauseOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
}

function startLevel(levelName) {
    currentLevelName = levelName;
    walls = generateLevelData(levelName);

    // Attempt to resume AudioContext if suspended
    if (SoundManager.audioCtx && SoundManager.audioCtx.state === 'suspended') {
        SoundManager.audioCtx.resume();
    } else {
        SoundManager.init();
    }

    startGame();
}

function startGame() {
    currentState = STATE_PLAYING;
    menuOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');

    resetGame();
    if (gameInterval) clearTimeout(gameInterval);
    gameLoop();
}

function resetGame() {
    score = 0;
    scoreElement.innerText = "Score: " + score;

    // Find a safe spot for snake
    // Default safe spot
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];

    // Check if snake overlaps with walls
    if (isCollidingWithWall(snake[0])) {
         // Simple fallback: move to 2,2
         snake = [
            { x: 2, y: 2 },
            { x: 1, y: 2 },
            { x: 0, y: 2 }
        ];
    }

    dx = 1;
    dy = 0;
    nextDx = 1;
    nextDy = 0;
    generateFood();
}

function isCollidingWithWall(pos) {
    for(let w of walls) {
        if (w.x === pos.x && w.y === pos.y) return true;
    }
    return false;
}

function pauseGame() {
    if (currentState === STATE_PLAYING) {
        currentState = STATE_PAUSED;
        pauseOverlay.classList.remove('hidden');
    }
}

function resumeGame() {
    if (currentState === STATE_PAUSED) {
        currentState = STATE_PLAYING;
        pauseOverlay.classList.add('hidden');
        gameLoop();
    }
}

function quitGame() {
    currentState = STATE_MENU;
    showMenu();
}

function gameOver() {
    currentState = STATE_GAMEOVER;
    SoundManager.playCrash();
    finalScoreElement.innerText = "Score: " + score;
    gameOverOverlay.classList.remove('hidden');
}

// Input Handling
document.addEventListener('keydown', handleKeyInput);

function handleKeyInput(event) {
    if (currentState === STATE_MENU) return;

    if (currentState === STATE_GAMEOVER && event.key === 'Enter') {
        startGame();
        return;
    }

    if (event.key === 'p' || event.key === 'P') {
        togglePause();
        return;
    }

    if (currentState !== STATE_PLAYING) return;

    if([37, 38, 39, 40].indexOf(event.keyCode) > -1) {
        event.preventDefault();
    }

    const key = event.keyCode;
    if (key === 38) changeDirection(0, -1);
    if (key === 40) changeDirection(0, 1);
    if (key === 37) changeDirection(-1, 0);
    if (key === 39) changeDirection(1, 0);
}

function changeDirection(x, y) {
    if (inputProcessed) return;
    if (x !== 0 && dx === -x) return;
    if (y !== 0 && dy === -y) return;
    if (x === 0 && dy === -y) return;
    if (y === 0 && dx === -x) return;

    nextDx = x;
    nextDy = y;
    inputProcessed = true;
    // SoundManager.playMove();
}

// Event Listeners
levelBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        startLevel(btn.dataset.level);
    });
});

restartBtn.addEventListener('click', startGame);
resumeBtn.addEventListener('click', resumeGame);
pauseBtn.addEventListener('click', togglePause);
quitBtn.addEventListener('click', quitGame);
menuBtn.addEventListener('click', quitGame);

// Mobile Controls
upBtn.addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(0, -1); });
downBtn.addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(0, 1); });
leftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(-1, 0); });
rightBtn.addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(1, 0); });

upBtn.addEventListener('mousedown', (e) => { changeDirection(0, -1); });
downBtn.addEventListener('mousedown', (e) => { changeDirection(0, 1); });
leftBtn.addEventListener('mousedown', (e) => { changeDirection(-1, 0); });
rightBtn.addEventListener('mousedown', (e) => { changeDirection(1, 0); });

function togglePause() {
    if (currentState === STATE_PLAYING) {
        pauseGame();
    } else if (currentState === STATE_PAUSED) {
        resumeGame();
    }
}

// Swipe Support
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', function(evt) {
    touchStartX = evt.touches[0].clientX;
    touchStartY = evt.touches[0].clientY;
}, false);

document.addEventListener('touchmove', function(evt) {
    evt.preventDefault();
}, { passive: false });

document.addEventListener('touchend', function(evt) {
    if (currentState !== STATE_PLAYING) return;
    let touchEndX = evt.changedTouches[0].clientX;
    let touchEndY = evt.changedTouches[0].clientY;
    handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
}, false);

function handleSwipe(x1, y1, x2, y2) {
    let xDiff = x2 - x1;
    let yDiff = y2 - y1;

    if (Math.abs(xDiff) < 30 && Math.abs(yDiff) < 30) return;

    if (Math.abs(xDiff) > Math.abs(yDiff)) {
        if (xDiff > 0) changeDirection(1, 0);
        else changeDirection(-1, 0);
    } else {
        if (yDiff > 0) changeDirection(0, 1);
        else changeDirection(0, -1);
    }
}

function updateGame() {
    if (nextDx !== 0 || nextDy !== 0) {
        dx = nextDx;
        dy = nextDy;
    }
    inputProcessed = false;

    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // Check Walls (Canvas Borders)
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        gameOver();
        return;
    }

    // Check Internal Walls
    if (isCollidingWithWall(head)) {
        gameOver();
        return;
    }

    // Check Self
    for (let i = 0; i < snake.length; i++) {
        if (snake[i].x === head.x && snake[i].y === head.y) {
            gameOver();
            return;
        }
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        score++;
        scoreElement.innerText = "Score: " + score;
        SoundManager.playEat();
        generateFood();
    } else {
        snake.pop();
    }
}

function generateFood() {
    let valid = false;
    while (!valid) {
        food.x = Math.floor(Math.random() * tileCount);
        food.y = Math.floor(Math.random() * tileCount);

        valid = true;
        // Check body
        for (let part of snake) {
            if (part.x === food.x && part.y === food.y) {
                valid = false; break;
            }
        }
        // Check walls
        if (valid) {
            for (let w of walls) {
                if (w.x === food.x && w.y === food.y) {
                    valid = false; break;
                }
            }
        }
    }
}

function clearScreen() {
    ctx.fillStyle = Levels[currentLevelName] ? Levels[currentLevelName].bg : '#2c3e50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawInitialScreen() {
    clearScreen();
    // Static Draw (fake snake)
    snake = [{x:10, y:10}, {x:9, y:10}, {x:8, y:10}];
    drawSnake();
    snake = []; // Clear fake snake
}

function drawSnake() {
    for (let i = 0; i < snake.length; i++) {
        const part = snake[i];
        const x = part.x * gridSize;
        const y = part.y * gridSize;

        if (i === 0) {
            // Head
            drawRotatedImage(images.head, x, y, dx, dy);
        } else {
            // Body - for simplicity just draw the circle/body image
            // To make it look "real" we should rotate body parts based on connection,
            // but simply drawing the body sprite is enough for this level.
            if (images.body) {
                ctx.drawImage(images.body, x, y, gridSize, gridSize);
            } else {
                 ctx.fillStyle = '#8BC34A';
                 ctx.beginPath();
                 ctx.arc(x + gridSize/2, y + gridSize/2, gridSize/2 - 1, 0, 2 * Math.PI);
                 ctx.fill();
            }
        }
    }
}

function drawRotatedImage(image, x, y, dirX, dirY) {
    if (!image) return;

    ctx.save();
    ctx.translate(x + gridSize/2, y + gridSize/2);

    let angle = 0;

    // Map Directions to rotation relative to UP
    if (dirX === 0 && dirY === -1) angle = 0;       // UP
    else if (dirX === 0 && dirY === 1) angle = Math.PI;  // DOWN
    else if (dirX === -1 && dirY === 0) angle = -Math.PI/2; // LEFT
    else if (dirX === 1 && dirY === 0) angle = Math.PI/2;   // RIGHT

    ctx.rotate(angle);
    ctx.drawImage(image, -gridSize/2, -gridSize/2, gridSize, gridSize);
    ctx.restore();
}

function drawFood() {
    if (food.x === undefined) return;
    const x = food.x * gridSize;
    const y = food.y * gridSize;
    if (images.apple) {
        ctx.drawImage(images.apple, x, y, gridSize, gridSize);
    } else {
        ctx.fillStyle = 'red';
        ctx.fillRect(x, y, gridSize, gridSize);
    }
}

function drawWalls() {
    if (!walls || walls.length === 0) return;
    for (let w of walls) {
        if (images.wall) {
             ctx.drawImage(images.wall, w.x * gridSize, w.y * gridSize, gridSize, gridSize);
        } else {
             ctx.fillStyle = '#795548';
             ctx.fillRect(w.x * gridSize, w.y * gridSize, gridSize, gridSize);
        }
    }
}

function gameLoop() {
    if (currentState !== STATE_PLAYING) return;

    clearScreen();
    drawWalls();
    drawFood();
    updateGame();
    // Re-draw after update to show new position (prevents lag visual)
    // Actually updateGame moves snake. We should draw AFTER update.
    // Except if game over happened in updateGame, we shouldn't draw?
    // If gameOver, currentState changes.

    if (currentState === STATE_PLAYING) {
        drawSnake(); // Draw snake at new position
        gameInterval = setTimeout(gameLoop, 100);
    }
}

// Start
init();
