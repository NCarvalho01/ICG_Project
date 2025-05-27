import { setupScene, create3DGrid, update3DSquare, clearScene, renderScene, getIntersectedSquare, createFlag, createExplosionEffect, initRenderer } from './graphics2D.js';

let difficulty_presets = {
    easy: { rows: 9, cols: 9, mines: 10, name: "Easy", width: 220 },
    intermediate: { rows: 16, cols: 16, mines: 40, name: "Intermediate", width: 375 },
    expert: { rows: 16, cols: 30, mines: 99, name: "Expert", width: 684 }
};

let difficulty = difficulty_presets.easy;
let playing = true;
let firstClick = true;
let grid = []; 
let initialClick = null; 
let timerStart = null;
let timerActive = false;
let animationFrameId = null;
const mode = "2d";



class Square {
    constructor() {
        this.isClicked = false;
        this.isFlagged = false;
        this.isMine = false;
        this.isExplodedMine = false;
        this.numNeighborMines = 0;
        this.isRevealed = false;
        this.cube = null;
    }
}

function registerEventListeners() {
    document.addEventListener("contextmenu", onRightClick);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    document.getElementById("restartButton").addEventListener("click", onRestartClick);
    document.getElementById("difficultySelect").addEventListener("change", onDifficultyChange);
}


function onRightClick(event) {
    event.preventDefault();
    if (!playing) return;
    const intersected = getIntersectedSquare(event);
    if (!intersected) return;
    const square = grid[intersected.x][intersected.y];
    if (square.isRevealed) return;
    square.isFlagged = !square.isFlagged;
    updateMinesLeft();
    if (square.isFlagged) {
        const flag = createFlag();
        flag.name = "flag";
        // Topo
        const flagTop = createFlag();
        flagTop.name = "flag_top";
        flagTop.position.set(0, 0.5, 0);
        square.cube.add(flagTop);

        // Fundo
        const flagBottom = createFlag();
        flagBottom.name = "flag_bottom";
        flagBottom.position.set(0, -0.5, 0);
        flagBottom.rotation.x = Math.PI; // Inverter
        square.cube.add(flagBottom);
    } else {
        ["flag", "flag_top", "flag_bottom"].forEach(name => {
            const existing = square.cube.getObjectByName(name);
            if (existing) square.cube.remove(existing);
        });
    }
}

document.addEventListener("contextmenu", onRightClick);

document.addEventListener("mousedown", onMouseDown);

function onMouseDown(event) {
    if (event.button !== 0) return;
    if (!playing) return;
    const intersectedSquare = getIntersectedSquare(event);
    if (intersectedSquare) {
        initialClick = intersectedSquare;
    }
}

document.addEventListener("mouseup", onMouseUp);

function onMouseUp(event) {
    if (event.button !== 0) return;
    if (!playing || !initialClick) return;
    const intersectedSquare = getIntersectedSquare(event);
    if (intersectedSquare && intersectedSquare.x === initialClick.x && intersectedSquare.y === initialClick.y) {
        clickSquare(intersectedSquare.x, intersectedSquare.y);
    }
    initialClick = null;
}

document.getElementById("restartButton").addEventListener("click", onRestartClick);

function onRestartClick() {
    document.getElementById("restartContainer").style.display = "none";
    restartGame();
}

document.getElementById("difficultySelect").addEventListener("change", onDifficultyChange);

function onDifficultyChange() {
    const selectedDifficulty = document.getElementById("difficultySelect").value;
    difficulty = difficulty_presets[selectedDifficulty];

    document.getElementById("restartContainer").style.display = "none";

    restartGame();
}

export function countAdjacentMines(x, y) {
    let count = 0;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            let nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < difficulty.rows && ny >= 0 && ny < difficulty.cols) {
                if (grid[nx][ny].isMine) {
                    count++;
                }
            }
        }
    }
    return count;
}

export function clickSquare(x, y) {
    if (!playing) return;
    const square = grid[x][y];
    if (firstClick) {
        placeMinesExcluding(x, y);
        updateAllNeighborMineCounts();
        startTimer();
        firstClick = false;
    }
    if (square.isFlagged) return;
    if (square.isRevealed && square.numNeighborMines > 0) {
        let flaggedCount = 0;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const nx = x + dx, ny = y + dy;
                if (nx >= 0 && nx < difficulty.rows && ny >= 0 && ny < difficulty.cols) {
                    if (grid[nx][ny].isFlagged) flaggedCount++;
                }
            }
        }
        if (flaggedCount === square.numNeighborMines) {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx >= 0 && nx < difficulty.rows && ny >= 0 && ny < difficulty.cols) {
                        const neighbor = grid[nx][ny];
                        if (!neighbor.isRevealed && !neighbor.isFlagged) {
                            clickSquare(nx, ny);
                        }
                    }
                }
            }
        }
        return;
    }
    if (square.isRevealed) return;
    if (square.isMine) {
        square.isRevealed = true;
        square.wasClicked = true;
        update3DSquare(square, x, y);
        revealAllMines();
        const restartMessage = document.getElementById("restartMessage");
        const restartButton = document.getElementById("restartButton");
        restartMessage.textContent = "💥 Mine Exploded!";
        restartMessage.style.color = "#FF4444";
        restartButton.style.backgroundColor = "#cc0000";
        restartButton.style.color = "#ffffff";
        document.getElementById("restartContainer").style.display = "block";
        playing = false;
        stopTimer();
        return;
    }
    if (square.numNeighborMines === 0) {
        revealAdjacentSquares(x, y);
    } else {
        square.isRevealed = true;
        update3DSquare(square, x, y);
    }
    checkWinCondition();
}

function revealAdjacentSquares(startX, startY) {
    const queue = [{ x: startX, y: startY }];
    const visited = new Set();
    while (queue.length > 0) {
        const { x, y } = queue.shift();
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        visited.add(key);
        const square = grid[x][y];
        if (square.isRevealed) continue;
        square.isRevealed = true;
        update3DSquare(square, x, y);
        if (square.isFlagged) {
            square.isFlagged = false;
            
            ["flag", "flag_top", "flag_bottom"].forEach(name => {
                const mesh = square.cube.getObjectByName(name);
                if (mesh) square.cube.remove(mesh);
            });

            updateMinesLeft();
        }

        if (square.numNeighborMines > 0) continue;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const nx = x + dx, ny = y + dy;
                const neighborKey = `${nx},${ny}`;
                if (nx >= 0 && nx < difficulty.rows && ny >= 0 && ny < difficulty.cols && !visited.has(neighborKey) && !grid[nx][ny].isMine) {
                    queue.push({ x: nx, y: ny });
                }
            }
        }
    }
}

function checkWinCondition() {
    let safeSquares = 0;
    let revealedSquares = 0;
    for (let i = 0; i < difficulty.rows; i++) {
        for (let j = 0; j < difficulty.cols; j++) {
            if (!grid[i][j].isMine) safeSquares++;
            if (grid[i][j].isRevealed) revealedSquares++;
        }
    }
    const restartMessage = document.getElementById("restartMessage");
    const restartButton = document.getElementById("restartButton");
    if (safeSquares === revealedSquares) {
        restartMessage.textContent = "🎉 Congratulations! You won!";
        restartMessage.style.color = "#00FF00";
        restartButton.style.backgroundColor = "#00cc00";
        restartButton.style.color = "#ffffff";
        document.getElementById("restartContainer").style.display = "block";
        playing = false;
        if (timerStart) {
            const currentTime = (performance.now() - timerStart) / 1000;
            updateHighScoreIfNeeded(currentTime);
        }
        stopTimer();
    }
}

function startGame() {
    restartGame();
}

function restartGame() {
    playing = true;
    firstClick = true;
    clearScene();
    stopTimer();
    displayHighScore();
    document.getElementById("timeValue").textContent = "0.0s";
    document.getElementById("minesValue").textContent = difficulty.mines;
    createGrid();
    create3DGrid(grid, difficulty);
    setupScene(grid, difficulty);
    renderScene();
}

function placeMinesExcluding(safeX, safeY) {
    let placed = 0;
    const forbidden = new Set();
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const nx = safeX + dx;
            const ny = safeY + dy;
            if (nx >= 0 && nx < difficulty.rows && ny >= 0 && ny < difficulty.cols) {
                forbidden.add(`${nx},${ny}`);
            }
        }
    }
    while (placed < difficulty.mines) {
        const x = Math.floor(Math.random() * difficulty.rows);
        const y = Math.floor(Math.random() * difficulty.cols);
        if (grid[x][y].isMine || grid[x][y].isFlagged) continue;
        if (forbidden.has(`${x},${y}`)) continue;
        grid[x][y].isMine = true;
        placed++;
    }
}

function updateAllNeighborMineCounts() {
    for (let i = 0; i < difficulty.rows; i++) {
        for (let j = 0; j < difficulty.cols; j++) {
            if (!grid[i][j].isMine) {
                grid[i][j].numNeighborMines = countAdjacentMines(i, j);
            }
        }
    }
}

function createGrid() {
    grid = [];
    for (let i = 0; i < difficulty.rows; i++) {
        grid[i] = [];
        for (let j = 0; j < difficulty.cols; j++) {
            grid[i][j] = new Square();
        }
    }
    create3DGrid(grid, difficulty);
}

function updateMinesLeft() {
    const flaggedCount = grid.flat().filter(sq => sq.isFlagged).length;
    const totalMines = difficulty.mines;
    const remaining = Math.max(0, totalMines - flaggedCount);
    document.getElementById("minesValue").textContent = remaining;
}

function revealAllMines() {
    for (let x = 0; x < difficulty.rows; x++) {
        for (let y = 0; y < difficulty.cols; y++) {
            const square = grid[x][y];
            if (square.isMine && !square.isRevealed && !square.isFlagged) {
                square.isRevealed = true;
                update3DSquare(square, x, y);
            }
        }
    }
}

function animateTimer(timestamp) {
    if (!timerActive) return;
    if (timerStart === null) timerStart = timestamp;
    const elapsed = (timestamp - timerStart) / 1000;
    document.getElementById("timeValue").textContent = `${elapsed.toFixed(1)}s`;
    animationFrameId = requestAnimationFrame(animateTimer);
}

function startTimer() {
    timerStart = null;
    timerActive = true;
    animationFrameId = requestAnimationFrame(animateTimer);
}

function stopTimer() {
    timerActive = false;
}

function getHighScoreKey() {
    return `bestTime_${mode}_${difficulty.name}`;
}


function updateHighScoreIfNeeded(currentTime) {
    const key = getHighScoreKey();
    const best = parseFloat(sessionStorage.getItem(key));
    if (!best || currentTime < best) {
        sessionStorage.setItem(key, currentTime.toFixed(1));
    }
}

function displayHighScore() {
    const key = getHighScoreKey();
    const best = sessionStorage.getItem(key);
    document.getElementById("bestValue").textContent = best ? `${best}s` : "--";
    document.getElementById("timeValue").textContent = "0.0s";
}

export function cleanup() {
    // Remove listeners
    document.removeEventListener("contextmenu", onRightClick);
    document.removeEventListener("mousedown", onMouseDown);
    document.removeEventListener("mouseup", onMouseUp);
    document.getElementById("restartButton").removeEventListener("click", onRestartClick);
    document.getElementById("difficultySelect").removeEventListener("change", onDifficultyChange);

    // Para o timer
    timerActive = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    // Limpeza mais completa
    clearScene();
}

export function initGame() {
    initRenderer();
    registerEventListeners();
    startGame();
}

