const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

const gridSize = 20;
const tileCount = canvas.width / gridSize;

let score = 0;
let snake = [
    { x: 10, y: 10 }, // Head
    { x: 9, y: 10 },
    { x: 8, y: 10 }
];
let food = { x: 15, y: 15 };
let dx = 1; // Velocity x
let dy = 0; // Velocity y

// Input handling
document.body.addEventListener('keydown', keyDown);

function keyDown(event) {
    // Up
    if (event.keyCode === 38) {
        if (dy === 1) return; // Prevent reversing
        dx = 0;
        dy = -1;
    }
    // Down
    if (event.keyCode === 40) {
        if (dy === -1) return;
        dx = 0;
        dy = 1;
    }
    // Left
    if (event.keyCode === 37) {
        if (dx === 1) return;
        dx = -1;
        dy = 0;
    }
    // Right
    if (event.keyCode === 39) {
        if (dx === -1) return;
        dx = 1;
        dy = 0;
    }
}

function updateGame() {
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
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

function isGameOver() {
    let gameOver = false;

    // Check walls
    if (snake[0].x < 0 || snake[0].x >= tileCount || snake[0].y < 0 || snake[0].y >= tileCount) {
        gameOver = true;
    }

    // Check self collision (start from 1 because 0 is head)
    for (let i = 1; i < snake.length; i++) {
        if (snake[i].x === snake[0].x && snake[i].y === snake[0].y) {
            gameOver = true;
        }
    }

    if (gameOver) {
        ctx.fillStyle = "white";
        ctx.font = "50px Verdana";
        ctx.fillText("Game Over!", canvas.width / 6.5, canvas.height / 2);
    }

    return gameOver;
}

function clearScreen() {
    // Use the same color as the CSS background for seamless look
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawSnake() {
    for (let i = 0; i < snake.length; i++) {
        const x = snake[i].x * gridSize + gridSize / 2;
        const y = snake[i].y * gridSize + gridSize / 2;

        ctx.fillStyle = i === 0 ? '#4CAF50' : '#8BC34A'; // Head is darker green, body is lighter

        ctx.beginPath();
        ctx.arc(x, y, gridSize / 2 - 1, 0, 2 * Math.PI);
        ctx.fill();

        // Draw eyes on head
        if (i === 0) {
            ctx.fillStyle = 'white';

            // Eye offsets based on direction
            let leftEyeX, leftEyeY, rightEyeX, rightEyeY;
            const eyeOffset = gridSize / 4;
            const eyeSize = 3;

            if (dy === -1) { // Up
                leftEyeX = x - eyeOffset; leftEyeY = y - eyeOffset;
                rightEyeX = x + eyeOffset; rightEyeY = y - eyeOffset;
            } else if (dy === 1) { // Down
                leftEyeX = x - eyeOffset; leftEyeY = y + eyeOffset;
                rightEyeX = x + eyeOffset; rightEyeY = y + eyeOffset;
            } else if (dx === -1) { // Left
                leftEyeX = x - eyeOffset; leftEyeY = y - eyeOffset;
                rightEyeX = x - eyeOffset; rightEyeY = y + eyeOffset;
            } else { // Right (default)
                leftEyeX = x + eyeOffset; leftEyeY = y - eyeOffset;
                rightEyeX = x + eyeOffset; rightEyeY = y + eyeOffset;
            }

            ctx.beginPath();
            ctx.arc(leftEyeX, leftEyeY, eyeSize, 0, 2 * Math.PI);
            ctx.arc(rightEyeX, rightEyeY, eyeSize, 0, 2 * Math.PI);
            ctx.fill();

            // Pupils
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.arc(leftEyeX, leftEyeY, eyeSize / 2, 0, 2 * Math.PI);
            ctx.arc(rightEyeX, rightEyeY, eyeSize / 2, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}

function drawFood() {
    const centerX = food.x * gridSize + gridSize / 2;
    const centerY = food.y * gridSize + gridSize / 2;
    const radius = gridSize / 2 - 2;

    // Apple Body
    ctx.fillStyle = '#FF5252'; // Nice Apple Red
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();

    // Stem
    ctx.strokeStyle = '#795548'; // Brown
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY - radius - 4);
    ctx.stroke();

    // Leaf
    ctx.fillStyle = '#4CAF50'; // Green
    ctx.beginPath();
    ctx.ellipse(centerX + 3, centerY - radius - 2, 4, 2, Math.PI / 4, 0, 2 * Math.PI);
    ctx.fill();
}

function gameLoop() {
    if (isGameOver()) {
         return;
    }

    setTimeout(function onTick() {
        clearScreen();
        updateGame();
        drawFood();
        drawSnake();
        gameLoop();
    }, 100);
}

gameLoop();
