const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

// UI Elements
const menuOverlay = document.getElementById('menuOverlay');
const pauseOverlay = document.getElementById('pauseOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const startBtn = document.getElementById('startBtn');
const resumeBtn = document.getElementById('resumeBtn');
const restartBtn = document.getElementById('restartBtn');
const pauseBtn = document.getElementById('pauseBtn');
const finalScoreElement = document.getElementById('finalScore');

// Mobile Control Buttons
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
let dx = 0;
let dy = 0;
let nextDx = 0; // Buffer for next direction to prevent quick-turn suicide
let nextDy = 0;
let gameInterval;

// Initialize
function init() {
    showMenu();
    drawInitialScreen();
}

function showMenu() {
    currentState = STATE_MENU;
    menuOverlay.classList.remove('hidden');
    pauseOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
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
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];
    food = { x: 15, y: 15 };
    dx = 1;
    dy = 0;
    nextDx = 1;
    nextDy = 0;
    generateFood();
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

function gameOver() {
    currentState = STATE_GAMEOVER;
    finalScoreElement.innerText = "Score: " + score;
    gameOverOverlay.classList.remove('hidden');
}

// Input Handling
document.addEventListener('keydown', handleKeyInput);

function handleKeyInput(event) {
    if (currentState === STATE_MENU && event.key === 'Enter') {
        startGame();
        return;
    }

    if (currentState === STATE_GAMEOVER && event.key === 'Enter') {
        startGame();
        return;
    }

    if (event.key === 'p' || event.key === 'P') {
        togglePause();
        return;
    }

    if (currentState !== STATE_PLAYING) return;

    // Prevent default scrolling for arrow keys
    if([37, 38, 39, 40].indexOf(event.keyCode) > -1) {
        event.preventDefault();
    }

    const key = event.keyCode;

    // Up (38)
    if (key === 38) changeDirection(0, -1);
    // Down (40)
    if (key === 40) changeDirection(0, 1);
    // Left (37)
    if (key === 37) changeDirection(-1, 0);
    // Right (39)
    if (key === 39) changeDirection(1, 0);
}

function changeDirection(x, y) {
    // Prevent reversing directly
    if (x !== 0 && dx === -x) return;
    if (y !== 0 && dy === -y) return;

    // Buffer the next direction to apply on next update
    // This prevents the "suicide" bug where two keys are pressed within one frame
    // We update nextDx/nextDy, which will be applied to dx/dy in updateGame
    // Actually, simple way: update dx/dy immediately but check against current velocity?
    // The issue is if I press UP then LEFT quickly.
    // Frame 1: Moving RIGHT. Press UP. dx=0, dy=-1.
    // Still Frame 1: Press LEFT. dx=-1, dy=0.
    // Update: Moves LEFT (reversing RIGHT). Crash.
    // Solution: Only allow one direction change per tick.

    // Check if we already have a pending change that hasn't been executed
    // For simplicity in this version, let's just use the standard buffer approach implicitly
    // by only checking against the *current* velocity state,
    // but the bug exists if we modify dx/dy directly multiple times.
    // Let's use a queue or just accept the last valid input relative to the *last frame's* velocity.
    // But `dx` and `dy` are the current velocity.
    // We need `currentFrameDx` and `currentFrameDy` which are updated only in gameLoop.

    // Let's implement a simple lock.
    if (inputProcessed) return; // Only one input per frame

    if (x === 0 && dy === -y) return; // Prevent reverse vertical
    if (y === 0 && dx === -x) return; // Prevent reverse horizontal

    nextDx = x;
    nextDy = y;
    inputProcessed = true;
}

let inputProcessed = false; // Flag to allow only one turn per frame

// Button Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
resumeBtn.addEventListener('click', resumeGame);
pauseBtn.addEventListener('click', togglePause);

// Mobile Controls
upBtn.addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(0, -1); });
downBtn.addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(0, 1); });
leftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(-1, 0); });
rightBtn.addEventListener('touchstart', (e) => { e.preventDefault(); changeDirection(1, 0); });

// Mouse support for desktop testing of mobile controls
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
    // Prevent default scrolling when touching the game area
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

    // Minimum swipe distance
    if (Math.abs(xDiff) < 30 && Math.abs(yDiff) < 30) return;

    if (Math.abs(xDiff) > Math.abs(yDiff)) {
        // Horizontal
        if (xDiff > 0) changeDirection(1, 0);
        else changeDirection(-1, 0);
    } else {
        // Vertical
        if (yDiff > 0) changeDirection(0, 1);
        else changeDirection(0, -1);
    }
}


function updateGame() {
    // Apply buffered direction
    if (nextDx !== 0 || nextDy !== 0) {
        // Verify again to be safe (e.g. if nextDx reverses dx)
        // But we checked in changeDirection.
        // Wait, if we use nextDx/nextDy, we need to ensure we don't reverse the *current* snake direction.
        // We did that check against `dx/dy` in `changeDirection`.
        // So we can just apply it.

        // Actually, the check in changeDirection should be against the *current actual movement*,
        // not the potentially projected movement.
        // Here we just apply the intent.

        dx = nextDx;
        dy = nextDy;
    }

    inputProcessed = false; // Reset input lock for next frame

    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // Check collision with walls
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        gameOver();
        return;
    }

    // Check collision with self
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
        generateFood();
    } else {
        snake.pop();
    }
}

function generateFood() {
    food.x = Math.floor(Math.random() * tileCount);
    food.y = Math.floor(Math.random() * tileCount);

    // Check if food spawns on snake body
    for (let part of snake) {
        if (part.x === food.x && part.y === food.y) {
            generateFood();
            break;
        }
    }
}

function clearScreen() {
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawInitialScreen() {
    clearScreen();
    // Maybe draw a static snake or logo?
    drawSnake(); // Draws the initial static snake
}

function drawSnake() {
    for (let i = 0; i < snake.length; i++) {
        const x = snake[i].x * gridSize + gridSize / 2;
        const y = snake[i].y * gridSize + gridSize / 2;

        ctx.fillStyle = i === 0 ? '#4CAF50' : '#8BC34A';

        ctx.beginPath();
        ctx.arc(x, y, gridSize / 2 - 1, 0, 2 * Math.PI);
        ctx.fill();

        // Draw eyes on head
        if (i === 0) {
            ctx.fillStyle = 'white';

            let leftEyeX, leftEyeY, rightEyeX, rightEyeY;
            const eyeOffset = gridSize / 4;
            const eyeSize = 3;

            // Use current dx/dy to determine eye position
            // Default to right if stationary (initial state)
            let currentDx = dx;
            let currentDy = dy;
            if (currentDx === 0 && currentDy === 0) currentDx = 1;

            if (currentDy === -1) { // Up
                leftEyeX = x - eyeOffset; leftEyeY = y - eyeOffset;
                rightEyeX = x + eyeOffset; rightEyeY = y - eyeOffset;
            } else if (currentDy === 1) { // Down
                leftEyeX = x - eyeOffset; leftEyeY = y + eyeOffset;
                rightEyeX = x + eyeOffset; rightEyeY = y + eyeOffset;
            } else if (currentDx === -1) { // Left
                leftEyeX = x - eyeOffset; leftEyeY = y - eyeOffset;
                rightEyeX = x - eyeOffset; rightEyeY = y + eyeOffset;
            } else { // Right
                leftEyeX = x + eyeOffset; leftEyeY = y - eyeOffset;
                rightEyeX = x + eyeOffset; rightEyeY = y + eyeOffset;
            }

            ctx.beginPath();
            ctx.arc(leftEyeX, leftEyeY, eyeSize, 0, 2 * Math.PI);
            ctx.arc(rightEyeX, rightEyeY, eyeSize, 0, 2 * Math.PI);
            ctx.fill();

            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.arc(leftEyeX, leftEyeY, eyeSize / 2, 0, 2 * Math.PI);
            ctx.arc(rightEyeX, rightEyeY, eyeSize / 2, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}

function drawFood() {
    // Only draw food if it exists (might not be set in init)
    if (food.x === undefined) return;

    const centerX = food.x * gridSize + gridSize / 2;
    const centerY = food.y * gridSize + gridSize / 2;
    const radius = gridSize / 2 - 2;

    ctx.fillStyle = '#FF5252';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();

    ctx.strokeStyle = '#795548';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY - radius - 4);
    ctx.stroke();

    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.ellipse(centerX + 3, centerY - radius - 2, 4, 2, Math.PI / 4, 0, 2 * Math.PI);
    ctx.fill();
}

function gameLoop() {
    if (currentState !== STATE_PLAYING) {
         return;
    }

    clearScreen();
    updateGame();
    drawFood();
    drawSnake();

    if (currentState === STATE_PLAYING) {
        gameInterval = setTimeout(gameLoop, 100);
    }
}

// Start
init();
