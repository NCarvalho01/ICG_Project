import * as THREE from 'three';
import { countAdjacentMines, clickSquare } from './game.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'https://unpkg.com/three@0.139.2/examples/jsm/geometries/RoundedBoxGeometry.js';

// Configuração da cena, câmera e renderizador
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x224422);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 0);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("WebGL-output").appendChild(renderer.domElement);

// Controles da câmera
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Luzes
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

let gameGrid; 
let gameDifficulty; 
let startSquare = null; // Armazena o primeiro quadrado clicado

const animatedFlags = [];

export function clearScene() {
    console.log("🧹 Limpando cena...");

    if (!scene) return;

    let objectsToRemove = [...scene.children];

    objectsToRemove.forEach((object) => {
        if (object.isMesh) {
            if (object.geometry) object.geometry.dispose();

            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(mat => mat.dispose());
                } else {
                    object.material.dispose();
                }
            }

            scene.remove(object);
        }
    });

    animatedFlags.length = 0;


    console.log("✅ Cena limpa.");
}

export function setupScene(grid, difficulty) {
    console.log("🔄 Atualizando cena com nova dificuldade:", difficulty.name);

    gameGrid = grid;
    gameDifficulty = difficulty;
    camera.position.set(difficulty.rows / 2, 20, difficulty.cols / 2);
    camera.lookAt(difficulty.rows / 2, 0, difficulty.cols / 2);
    
    animate();
}

export function renderScene() {
    renderer.clear(); 
    renderer.render(scene, camera);
}

// Criar raycaster e vetor do mouse
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Obtém o quadrado clicado na cena
export function getIntersectedSquare(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    if (!gameGrid || !gameGrid.flat) return null;
    const intersects = raycaster.intersectObjects(gameGrid.flat().map(square => square.cube), true);
    if (intersects.length > 0) {
        const clickedCube = intersects[0].object;
        for (let i = 0; i < gameDifficulty.rows; i++) {
            for (let j = 0; j < gameDifficulty.cols; j++) {
                if (gameGrid[i][j].cube === clickedCube) {
                    return { x: i, y: j };
                }
            }
        }
    }
    return null;
} 

function animate(time) {
    requestAnimationFrame(animate);
    controls.update();

    // Anima todas as bandeiras (caso existam)
    for (const flag of animatedFlags) {
        if (flag.tick) {
            flag.tick(time / 1000);
        }
    }
    

    renderer.render(scene, camera);
}

export function create3DGrid(grid, difficulty) {
    let count = 0; 
    for (let i = 0; i < difficulty.rows; i++) {
        for (let j = 0; j < difficulty.cols; j++) {
            const square = grid[i][j];
            const radius = 0.2;
            const geometry = new RoundedBoxGeometry(1, 1, 1, 6, radius);
            const material = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
            const cube = new THREE.Mesh(geometry, material);

            const offsetX = (difficulty.rows - 1) / 2;
            const offsetZ = (difficulty.cols - 1) / 2;
            cube.position.set(i - offsetX, 0, j - offsetZ);

            square.cube = cube;
            scene.add(cube);
            count++;
        }
    }
    console.log("Cubos recriados:", count);
}

export function update3DSquare(square, x, y) {
    console.log(`🟩 Atualizando quadrado (${x}, ${y}) - Minas vizinhas: ${square.numNeighborMines}`);

    if (!square.cube) return;

    if (square.isMine) {
        const isExplodedMine = square.wasClicked;
        const mine = createMineMesh(isExplodedMine);
        mine.name = "mineModel"; // útil se quiseres remover mais tarde
    
        mine.position.set(0, 0.75, 0); // ligeiramente acima do cubo (altura = 1)
        square.cube.add(mine); // adiciona como filho do cubo
        square.cube.material.color.set(0xff0000);
        return;

    } else if (square.numNeighborMines === 0) {
        square.cube.material.color.set(0x00ff00); // 🔥 Verde para blocos vazios
    } else {
        let mineCount = square.numNeighborMines;
        const numberTexture = createNumberTexture(mineCount);

        const numberedMaterial = new THREE.MeshBasicMaterial({ map: numberTexture });

        const materials = [
            numberedMaterial, numberedMaterial, numberedMaterial,
            numberedMaterial, numberedMaterial, numberedMaterial
        ];

        square.cube.material = materials;
        square.cube.material.needsUpdate = true;
    }
}

function createNumberTexture(number) {
    const canvas = document.createElement("canvas");
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "rgba(255, 255, 255, 0)";
    ctx.fillRect(0, 0, size, size);

    const colorMap = {
        1: "#0000FF", 2: "#008000", 3: "#FF0000", 4: "#000080",
        5: "#800000", 6: "#008080", 7: "#000000", 8: "#808080",
    };

    ctx.fillStyle = colorMap[number] || "#FFFFFF";
    ctx.font = "bold 180px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(number, size / 2, size / 2);

    return new THREE.CanvasTexture(canvas);
}

export function createFlag() {
    const group = new THREE.Group();

    // Haste (poste)
    const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = 0.4;

    // Bandeira (triângulo vermelho com vértices animáveis)
    const geometry = new THREE.BufferGeometry();

    const vertices = new Float32Array([
        0, 0.8, 0,   // A - topo junto ao poste
        0, 0.4, 0,   // B - base junto ao poste
        0.45, 0.6, 0  // C - ponta da bandeira
    ]);

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex([0, 1, 2]);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        side: THREE.DoubleSide
    });

    const flag = new THREE.Mesh(geometry, material);

    // Guardar cópia dos vértices base para animar
    const basePositions = new Float32Array(vertices);

    flag.tick = (time) => {
        const positions = geometry.attributes.position;
        const amplitude = 0.03;
        const velocidade = 5;

        // Só mexemos o vértice da ponta (índice 2)
        const i = 2;
        const x = basePositions[i * 3];
        const y = basePositions[i * 3 + 1];
        const zBase = basePositions[i * 3 + 2];

        const deslocamento = Math.sin(time * velocidade) * amplitude;

        // Atualiza só o eixo Z da ponta
        positions.array[i * 3 + 2] = zBase + deslocamento;
        positions.needsUpdate = true;
    };

    group.add(pole);
    group.add(flag);
    animatedFlags.push(flag);


    return group;
}

function createMineMesh(isExploded = false) {
    const group = new THREE.Group();

    // Corpo da mina (esfera)
    const body = new THREE.SphereGeometry(0.2, 16, 16);
    const material = new THREE.MeshStandardMaterial({
        color: isExploded ? 0x880000 : 0x111111,
        emissive: isExploded ? 0xff4444 : 0x000000,
        emissiveIntensity: 0.6
    });
    const sphere = new THREE.Mesh(body, material);
    group.add(sphere);

    // Material e geometria para picos
    const spikeMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const spikeGeometry = new THREE.CylinderGeometry(0.02, 0.01, 0.1);

    // ⚙️ Gerar múltiplos picos ao redor da esfera
    const spikeCount = 12;
    for (let i = 0; i < spikeCount; i++) {
        const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);

        // Ângulo em volta da esfera
        const theta = Math.acos(1 - 2 * (i + 0.5) / spikeCount); // [0, π]
        const phi = Math.PI * (1 + Math.sqrt(5)) * i;            // [0, 2π]

        // Converter para coordenadas cartesianas (direção do pico)
        const dx = Math.sin(theta) * Math.cos(phi);
        const dy = Math.cos(theta);
        const dz = Math.sin(theta) * Math.sin(phi);

        // Rotar o spike para apontar nessa direção
        const dir = new THREE.Vector3(dx, dy, dz);
        const axis = new THREE.Vector3(0, 1, 0); // cilindro padrão aponta para cima
        const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, dir.clone().normalize());
        spike.quaternion.copy(quaternion);

        // Mover o spike para fora da esfera
        spike.position.copy(dir.clone().multiplyScalar(0.22));

        group.add(spike);
    }

    return group;
}

export function createExplosionEffect(position) {
    const geometry = new THREE.SphereGeometry(0.1, 16, 16);
    const material = new THREE.MeshStandardMaterial({
        color: 0xff2200,
        emissive: 0xff4400,
        emissiveIntensity: 1,
        transparent: true,
        opacity: 0.8
    });

    const explosion = new THREE.Mesh(geometry, material);
    explosion.position.copy(position);
    scene.add(explosion);

    // Animação: cresce e desvanece
    const duration = 500; // ms
    const start = performance.now();

    function animateExplosion(time) {
        const t = (time - start) / duration;

        if (t >= 1) {
            scene.remove(explosion);
            return;
        }

        const scale = 1 + t * 3; // cresce
        explosion.scale.set(scale, scale, scale);
        explosion.material.opacity = 0.8 * (1 - t); // desvanece

        requestAnimationFrame(animateExplosion);
    }

    requestAnimationFrame(animateExplosion);
}
