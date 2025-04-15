import { setupScene, create3DGrid, update3DSquare, clearScene, renderScene, getIntersectedSquare, createFlag, createExplosionEffect } from './graphics.js';

let difficulty_presets = {
    easy: { rows: 9, cols: 9, mines: 10, name: "Easy", width: 220 },
    intermediate: { rows: 16, cols: 16, mines: 40, name: "Intermediate", width: 375 },
    expert: { rows: 16, cols: 30, mines: 99, name: "Expert", width: 684 }
};

let difficulty = difficulty_presets.easy;
let playing = true;
let firstClick = true;
let unlucky = false;
let grid = []; 
let initialClick = null; 
/* let timerInterval = null;
let elapsedTime = 0;
 */let timerStart = null;
let timerActive = false;



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

document.addEventListener("contextmenu", function(event) {
    event.preventDefault(); // Evita o menu do botão direito
    if (!playing) return;

    const intersected = getIntersectedSquare(event);
    if (!intersected) return;

    const square = grid[intersected.x][intersected.y];

    // Se já foi revelado, não pode ser marcado
    if (square.isRevealed) return;

    // Alternar estado da bandeira
    square.isFlagged = !square.isFlagged;
    updateMinesLeft();


    // Atualizar cor do cubo

    if (square.isFlagged) {
        const flag = createFlag();
        flag.name = "flag"; // para identificar depois
        flag.position.set(0, 0.5, 0); // posição relativa ao cubo
        square.cube.add(flag);

    } else {
        // Remove a bandeira se ela existir
        const existingFlag = square.cube.getObjectByName("flag");
        if (existingFlag) {
            square.cube.remove(existingFlag);
        }
    }

});

document.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return; // ⬅️ só botão esquerdo
    if (!playing) return;
    const intersectedSquare = getIntersectedSquare(event);
    if (intersectedSquare) {
        initialClick = intersectedSquare; // Armazena o primeiro clique
    }
});

document.addEventListener("mouseup", (event) => {
    if (event.button !== 0) return; // ⬅️ só botão esquerdo
    if (!playing || !initialClick) return;

    const intersectedSquare = getIntersectedSquare(event);

    if (intersectedSquare && 
        intersectedSquare.x === initialClick.x && 
        intersectedSquare.y === initialClick.y) {
        clickSquare(intersectedSquare.x, intersectedSquare.y);
    }

    initialClick = null; // Reseta a variável após o clique
});

export function clickSquare(x, y) {
    if (!playing) return;

    const square = grid[x][y];
    // Inicia o cronómetro no primeiro clique real
    if (firstClick) {
        placeMinesExcluding(x, y);        // ← Gera minas com zona segura
        updateAllNeighborMineCounts();    // ← Atualiza os números à volta
        startTimer();
        firstClick = false;
    }
    


    // 🔒 Não permite clicar em quadrados marcados
    if (square.isFlagged) return;

    // ✅ CHORDING: se já está revelado e é um número
    if (square.isRevealed && square.numNeighborMines > 0) {
        let flaggedCount = 0;

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const nx = x + dx, ny = y + dy;
                if (
                    nx >= 0 && nx < difficulty.rows &&
                    ny >= 0 && ny < difficulty.cols
                ) {
                    if (grid[nx][ny].isFlagged) flaggedCount++;
                }
            }
        }

        if (flaggedCount === square.numNeighborMines) {
            // Revela os vizinhos não marcados
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const nx = x + dx, ny = y + dy;
                    if (
                        nx >= 0 && nx < difficulty.rows &&
                        ny >= 0 && ny < difficulty.cols
                    ) {
                        const neighbor = grid[nx][ny];
                        if (!neighbor.isRevealed && !neighbor.isFlagged) {
                            clickSquare(nx, ny); // chamada recursiva
                        }
                    }
                }
            }
        }

        return;
    }

    // Se já está revelado (e não era chording válido), ignora
    if (square.isRevealed) return;

    if (square.isMine) {
        square.isRevealed = true;
        square.wasClicked = true;
        update3DSquare(square, x, y);
    
       /*  const pos = square.cube.getWorldPosition(new THREE.Vector3());
        createExplosionEffect(pos); */
    
        revealAllMines(); // 👈 mostra todas as outras minas
    
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
    
    // ⚡ Se não há minas ao redor, inicia o flood fill
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

        console.log(`🔍 Revelando quadrado: (${x}, ${y})`);

        const square = grid[x][y];

        if (square.isRevealed) continue;
        square.isRevealed = true;
        update3DSquare(square, x, y);

        // Se estava com bandeira, remove
        if (square.isFlagged) {
            square.isFlagged = false;

            const flagMesh = square.cube.getObjectByName("flag");
            if (flagMesh) {
                square.cube.remove(flagMesh);
            }

            updateMinesLeft();
        }


        // Se há minas vizinhas, pare o flood fill para este quadrado
        if (square.numNeighborMines > 0) continue;

        // Expande para os vizinhos que ainda não foram processados
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const nx = x + dx, ny = y + dy;
                const neighborKey = `${nx},${ny}`;

                if (
                    nx >= 0 && nx < difficulty.rows &&
                    ny >= 0 && ny < difficulty.cols &&
                    !visited.has(neighborKey) &&
                    !grid[nx][ny].isMine // ⚠️ Não adiciona minas na propagação
                ) {
                    queue.push({ x: nx, y: ny });
                }
            }
        }
    }
}

document.getElementById("restartButton").addEventListener("click", function() {
    document.getElementById("restartContainer").style.display = "none";
    restartGame();
});

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
        restartMessage.style.color = "#00FF00"; // Verde ao ganhar
        restartButton.style.backgroundColor = "#00cc00"; // Verde para o botão ao ganhar
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

function restartGame() {
    console.log("🔄 Reiniciando jogo...");
    playing = true;
    firstClick = true;

    clearScene(); // Limpa a cena antes de reiniciar

    stopTimer();
    displayHighScore();
    const timeSpan = document.getElementById("timeValue");
    if (timeSpan) timeSpan.textContent = "0.0s";

    const minesSpan = document.getElementById("minesValue");
    if (minesSpan) minesSpan.textContent = difficulty.mines;
    
    
    createGrid();
/*     placeMines();
    updateAllNeighborMineCounts();
 */    debugMineCounts();

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

            if (
                nx >= 0 && nx < difficulty.rows &&
                ny >= 0 && ny < difficulty.cols
            ) {
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

    console.log(`Minas colocadas (seguro): ${placed}/${difficulty.mines}`);
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

function debugMineCounts() {
    console.log("📌 Verificando `numNeighborMines`...");
    for (let i = 0; i < difficulty.rows; i++) {
        let row = "";
        for (let j = 0; j < difficulty.cols; j++) {
            row += `${grid[i][j].numNeighborMines} `;
        }
        console.log(row);
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

updateMinesLeft();


function startGame() {
    restartGame();
}

document.getElementById("difficultySelect").addEventListener("change", function() {
    const selectedDifficulty = document.getElementById("difficultySelect").value;
    difficulty = difficulty_presets[selectedDifficulty];

    console.log(`Dificuldade alterada para: ${difficulty.name}`);
    restartGame();
});

function animateTimer(timestamp) {
    if (!timerActive) return;

    if (timerStart === null) timerStart = timestamp;

    const elapsed = (timestamp - timerStart) / 1000;
    const display = elapsed.toFixed(1);

    const timeSpan = document.getElementById("timeValue");
    if (timeSpan) {
        timeSpan.textContent = `${display}s`;
    }

    requestAnimationFrame(animateTimer);
}

function startTimer() {
    timerStart = null;
    timerActive = true;
    requestAnimationFrame(animateTimer);
}

function stopTimer() {
    timerActive = false;
}

function getHighScoreKey() {
    return `bestTime_${difficulty.name}`; // ex: bestTime_Easy
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
    const bestSpan = document.getElementById("bestValue");
    if (bestSpan) {
        bestSpan.textContent = best ? `${best}s` : "--";
    }

    const timeSpan = document.getElementById("timeValue");
    if (timeSpan) {
        timeSpan.textContent = "0.0s";
    }
}

function updateMinesLeft() {
    const flaggedCount = grid.flat().filter(sq => sq.isFlagged).length;
    const totalMines = difficulty.mines;
    const remaining = Math.max(0, totalMines - flaggedCount);

    const minesSpan = document.getElementById("minesValue");
    if (minesSpan) {
        minesSpan.textContent = remaining;
    }
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


startGame();
setupScene(grid, difficulty);
