import { setupScene, create3DGrid, update3DSquare, clearScene, renderScene, getIntersectedSquare, createFlagForFace, createExplosionEffect } from './graphics.js';
import * as THREE from 'three';

let difficulty_presets = {
    easy: { size: 5, mines: 15, name: "Easy" },
    intermediate: { size: 7, mines: 50, name: "Intermediate" },
    expert: { size: 9, mines: 120, name: "Expert" }
};

let difficulty = difficulty_presets.easy;
let playing = true;
let firstClick = true;
let grid3D = [];
let initialClick = null;
let timerStart = null;
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

export function countAdjacentMines(i, j, k) {
    let count = 0;
    for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
            for (let dk = -1; dk <= 1; dk++) {
                if (di === 0 && dj === 0 && dk === 0) continue;
                
                const ni = i + di, nj = j + dj, nk = k + dk;
                if (ni >= 0 && ni < difficulty.size &&
                    nj >= 0 && nj < difficulty.size &&
                    nk >= 0 && nk < difficulty.size) {
                    if (grid3D[ni][nj][nk].isMine) count++;
                }
            }
        }
    }
    return count;
}

function updateAllNeighborMineCounts() {
    for (let i = 0; i < difficulty.size; i++) {
        for (let j = 0; j < difficulty.size; j++) {
            for (let k = 0; k < difficulty.size; k++) {
                if (!grid3D[i][j][k].isMine) {
                    grid3D[i][j][k].numNeighborMines = countAdjacentMines(i, j, k);
                }
            }
        }
    }
}

document.addEventListener("contextmenu", function(event) {
    event.preventDefault();
    if (!playing) return;

    const intersected = getIntersectedSquare(event);
    if (!intersected) return;

    console.log(`🖱️ Clique DIREITO em (${intersected.i}, ${intersected.j}, ${intersected.k})`);


    const square = grid3D[intersected.i][intersected.j][intersected.k];

    if (square.isRevealed) return;

    square.isFlagged = !square.isFlagged;
    console.log(`🚩 Bandeira ${square.isFlagged ? 'colocada' : 'removida'} em (${intersected.i}, ${intersected.j}, ${intersected.k})`);
    updateMinesLeft();

    // Remove todas as bandeiras associadas a esse cubo (em múltiplas faces)
    const toRemove = square.cube.children.filter(child => child.name && child.name.startsWith("flag_"));
    toRemove.forEach(flag => square.cube.remove(flag));


    if (square.isFlagged) {
    const faces = getVisibleFacesForCube(intersected.i, intersected.j, intersected.k);
    for (const face of faces) {
        const flag = createFlagForFace(face);
        flag.name = "flag_" + face;
        square.cube.add(flag);
    }
}


});

function getVisibleFacesForCube(i, j, k) {
    const size = difficulty.size;
    const faces = [];

    if (k === size - 1) faces.push("front");
    if (k === 0) faces.push("back");
    if (i === size - 1) faces.push("right");
    if (i === 0) faces.push("left");
    if (j === size - 1) faces.push("top");
    if (j === 0) faces.push("bottom");

    return faces;
}




document.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    if (!playing) return;
    const intersectedSquare = getIntersectedSquare(event);
    if (intersectedSquare) {
        initialClick = intersectedSquare;
    }
});

document.addEventListener("mouseup", (event) => {
    if (event.button !== 0) return;
    if (!playing || !initialClick) return;

    const intersectedSquare = getIntersectedSquare(event);

    if (intersectedSquare &&
    intersectedSquare.i === initialClick.i &&
    intersectedSquare.j === initialClick.j &&
    intersectedSquare.k === initialClick.k) {

    const square = grid3D[intersectedSquare.i][intersectedSquare.j][intersectedSquare.k];

    if (square.isRevealed && square.numNeighborMines > 0) {
        handleChording(intersectedSquare.i, intersectedSquare.j, intersectedSquare.k);
    } else {
        clickSquare(intersectedSquare.i, intersectedSquare.j, intersectedSquare.k, intersectedSquare.face);
    }
}


    initialClick = null;
});

function handleChording(i, j, k) {
    const square = grid3D[i][j][k];
    const size = difficulty.size;

    let flaggedCount = 0;

    // Conta bandeiras ao redor
    for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
            for (let dk = -1; dk <= 1; dk++) {
                if (di === 0 && dj === 0 && dk === 0) continue;
                const ni = i + di, nj = j + dj, nk = k + dk;
                if (ni >= 0 && ni < size && nj >= 0 && nj < size && nk >= 0 && nk < size) {
                    if (grid3D[ni][nj][nk].isFlagged) flaggedCount++;
                }
            }
        }
    }

    // Se não houver bandeiras suficientes, não faz nada
    if (flaggedCount !== square.numNeighborMines) return;

    // Revela vizinhos e verifica se houve erro
    let exploded = false;

    for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
            for (let dk = -1; dk <= 1; dk++) {
                if (di === 0 && dj === 0 && dk === 0) continue;
                const ni = i + di, nj = j + dj, nk = k + dk;
                if (ni >= 0 && ni < size && nj >= 0 && nj < size && nk >= 0 && nk < size) {
                    const neighbor = grid3D[ni][nj][nk];
                    if (!neighbor.isRevealed && !neighbor.isFlagged) {
                        if (neighbor.isMine) {
                            neighbor.wasClicked = true;
                            neighbor.isRevealed = true;
                            update3DSquare(neighbor, ni, nj, nk);
                            if (neighbor.cube) {
                                const pos = neighbor.cube.getWorldPosition(new THREE.Vector3());
                                createExplosionEffect(pos);
                            }
                            exploded = true;
                        } else {
                            clickSquare(ni, nj, nk);
                        }
                    }
                }
            }
        }
    }

    if (exploded) {
        revealAllMines();
        document.getElementById("restartMessage").textContent = "💥 Explosão por chording!";
        document.getElementById("restartContainer").style.display = "block";
        playing = false;
        stopTimer();
    }
}


export function clickSquare(i, j, k, face = 'front') {
    if (!playing) return;

    console.log(`🖱️ Clique ESQUERDO em (${i}, ${j}, ${k})`);

    const square = grid3D[i][j][k];
    
    if (firstClick) {
        placeMinesExcluding(i, j, k);
        updateAllNeighborMineCounts();
        startTimer();grid3D
        firstClick = false;
    }

    if (square.isRevealed || square.isFlagged) return;

    if (square.isMine) {
        console.log(`💥 Clicou numa mina em (${i}, ${j}, ${k})`);
        square.isRevealed = true;
        square.wasClicked = true;
        update3DSquare(grid3D[i][j][k], i, j, k, face);
        
        if (square.cube) {
            const pos = square.cube.getWorldPosition(new THREE.Vector3());
            createExplosionEffect(pos);
        }

        
        revealAllMines();
        
        document.getElementById("restartMessage").textContent = "💥 Mine Exploded!";
        document.getElementById("restartContainer").style.display = "block";
        
        playing = false;
        stopTimer();
        return;
    }
    
    square.isRevealed = true;
    update3DSquare(grid3D[i][j][k], i, j, k);

    if (square.numNeighborMines === 0) {
        revealAdjacentSquares(i, j, k);
    }

    checkWinCondition();
}

function revealAdjacentSquares(i, j, k) {
    const queue = [{i, j, k}];
    const visited = new Set();
    const size = difficulty.size;

    while (queue.length > 0) {
        const {i, j, k} = queue.shift();
        const key = `${i},${j},${k}`;

        if (visited.has(key)) continue;
        visited.add(key);

        const square = grid3D[i][j][k];

        if (square.isMine || square.isFlagged) continue;

        square.isRevealed = true;
        update3DSquare(grid3D[i][j][k], i, j, k);

        if (square.numNeighborMines > 0) continue;

        for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 1; dj++) {
                for (let dk = -1; dk <= 1; dk++) {
                    if (di === 0 && dj === 0 && dk === 0) continue;
                    
                    const ni = i + di, nj = j + dj, nk = k + dk;
                    if (ni >= 0 && ni < size &&
                        nj >= 0 && nj < size &&
                        nk >= 0 && nk < size) {
                        queue.push({i: ni, j: nj, k: nk});
                    }
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

    for (let i = 0; i < difficulty.size; i++) {
        for (let j = 0; j < difficulty.size; j++) {
            for (let k = 0; k < difficulty.size; k++) {
                if (!grid3D[i][j][k].isMine) safeSquares++;
                if (grid3D[i][j][k].isRevealed) revealedSquares++;
            }
        }
    }

    if (safeSquares === revealedSquares) {
        document.getElementById("restartMessage").textContent = "🎉 Congratulations! You won!";
        document.getElementById("restartMessage").style.color = "#00FF00";
        document.getElementById("restartButton").style.backgroundColor = "#00cc00";
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
    playing = true;
    firstClick = true;

    clearScene();
    stopTimer();
    displayHighScore();
    
    document.getElementById("timeValue").textContent = "0.0s";
    document.getElementById("minesValue").textContent = difficulty.mines;
    
    createGrid();
    create3DGrid(grid3D, difficulty);
    setupScene(grid3D, difficulty);
    renderScene();
}

function placeMinesExcluding(safeI, safeJ, safeK) {
    let placed = 0;
    const safeZone = new Set();

    // Define zona segura em torno do primeiro clique
    for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
            for (let dk = -1; dk <= 1; dk++) {
                const ni = safeI + di, nj = safeJ + dj, nk = safeK + dk;
                if (ni >= 0 && ni < difficulty.size &&
                    nj >= 0 && nj < difficulty.size &&
                    nk >= 0 && nk < difficulty.size) {
                    safeZone.add(`${ni},${nj},${nk}`);
                }
            }
        }
    }

    const size = difficulty.size;

    // Função auxiliar: está na "casca"?
    function isOnOuterShell(i, j, k) {
        return (
            i === 0 || i === size - 1 ||
            j === 0 || j === size - 1 ||
            k === 0 || k === size - 1
        );
    }

    while (placed < difficulty.mines) {
        const i = Math.floor(Math.random() * size);
        const j = Math.floor(Math.random() * size);
        const k = Math.floor(Math.random() * size);

        const square = grid3D[i][j][k];

        if (
            isOnOuterShell(i, j, k) &&        // ✅ está na superfície
            !square.isMine &&                 // ainda não tem mina
            !safeZone.has(`${i},${j},${k}`)   // não é zona segura
        ) {
            square.isMine = true;
            placed++;
        }
    }

    console.log(`Minas colocadas nas faces visíveis (excluindo zona segura em torno de ${safeI},${safeJ},${safeK}):`);
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            for (let k = 0; k < size; k++) {
                if (grid3D[i][j][k].isMine) {
                    console.log(`- Mina em: (${i}, ${j}, ${k})`);
                }
            }
        }
    }
}


function startGame() {
    createGrid();
    restartGame();
    updateMinesLeft();
}

document.getElementById("difficultySelect").addEventListener("change", function() {
    const selectedDifficulty = document.getElementById("difficultySelect").value;
    difficulty = difficulty_presets[selectedDifficulty];
    restartGame();
});

function animateTimer(timestamp) {
    if (!timerActive) return;

    if (timerStart === null) timerStart = timestamp;

    const elapsed = (timestamp - timerStart) / 1000;
    const display = elapsed.toFixed(1);

    document.getElementById("timeValue").textContent = `${display}s`;
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
    return `bestTime_${difficulty.name}`;
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
}

function updateMinesLeft() {
    let flaggedCount = 0;

    for (let i = 0; i < difficulty.size; i++) {
        for (let j = 0; j < difficulty.size; j++) {
            for (let k = 0; k < difficulty.size; k++) {
                if (grid3D[i][j][k].isFlagged) {
                    flaggedCount++;
                }
            }
        }
    }

    document.getElementById("minesValue").textContent = Math.max(0, difficulty.mines - flaggedCount);
}

function createGrid() {
    const size = difficulty.size;
    grid3D = Array(size).fill().map(() => 
        Array(size).fill().map(() => 
            Array(size).fill().map(() => new Square())
        ));
}

function revealAllMines() {
    for (let i = 0; i < difficulty.size; i++) {
        for (let j = 0; j < difficulty.size; j++) {
            for (let k = 0; k < difficulty.size; k++) {
                const square = grid3D[i][j][k];
                if (square.isMine && !square.isRevealed && !square.isFlagged) {
                    square.isRevealed = true;
                    update3DSquare(grid3D[i][j][k], i, j, k);
                }
            }
        }
    }
}

startGame();