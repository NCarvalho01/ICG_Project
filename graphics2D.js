import * as THREE from 'three';
import { countAdjacentMines, clickSquare } from './game2D.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'https://unpkg.com/three@0.139.2/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { TextureLoader } from 'three';

let scene, camera, renderer, controls;
let textureLoader = new TextureLoader();
export function initRenderer() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x224422);
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 20, 0);
    camera.lookAt(0, 0, 0);

    const rgbeLoader = new RGBELoader();

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.4;
    document.getElementById("WebGL-output").appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);


    rgbeLoader.load('textures/industrial_sunset_02_puresky_1k.hdr', function(texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
    scene.background = texture;
    });
}

function setupGround() {
    const groundSize = 1000;
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);

    const colorMap = textureLoader.load('textures/brown_mud_leaves_01_diff_1k.jpg');
    colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.repeat.set(20, 20);

    const normalMap = textureLoader.load('textures/brown_mud_leaves_01_disp_1k.png');
    normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(20, 20);

    const grassMaterial = new THREE.MeshStandardMaterial({
        map: colorMap,
        normalMap: normalMap,
        color: 0xaaaaaa,     
        side: THREE.DoubleSide,
    });

    const ground = new THREE.Mesh(groundGeometry, grassMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -30;
    scene.add(ground);
}

let gameGrid; 
let gameDifficulty; 
let startSquare = null; 

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
    gameGrid = grid;
    gameDifficulty = difficulty;

    setupGround();

    camera.position.set(
        difficulty.rows / 2, 
        15, 
        difficulty.cols + 10 
    );
    camera.lookAt(difficulty.rows / 2, 0, difficulty.cols / 2);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    animate();
}

export function renderScene() {
    renderer.clear(); 
    renderer.render(scene, camera);
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

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
 }

export function update3DSquare(square, x, y) {

    if (!square.cube) return;

    if (square.isMine) {
        const isExplodedMine = square.wasClicked;
        const mine = createMineMesh(isExplodedMine);
        mine.name = "mineModel"; 
    
        const mineTop = createMineMesh(square.wasClicked);
        mineTop.name = "mineModel_top";
        mineTop.position.set(0, 0.8, 0);
        square.cube.add(mineTop);

        const mineBottom = createMineMesh(square.wasClicked);
        mineBottom.name = "mineModel_bottom";
        mineBottom.position.set(0, -0.8, 0);
        mineBottom.rotation.x = Math.PI;
        square.cube.add(mineBottom);
        square.cube.material.color.set(0xff0000);
        return;

    } else if (square.numNeighborMines === 0) {
        square.cube.material.color.set(0x00ff00); 
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

    const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = 0.4;

    const geometry = new THREE.BufferGeometry();

    const vertices = new Float32Array([
        0, 0.8, 0,   
        0, 0.4, 0,  
        0.45, 0.6, 0 
    ]);

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex([0, 1, 2]);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        side: THREE.DoubleSide
    });

    const flag = new THREE.Mesh(geometry, material);

    const basePositions = new Float32Array(vertices);

    flag.tick = (time) => {
        const positions = geometry.attributes.position;
        const amplitude = 0.03;
        const velocidade = 5;

        const i = 2;
        const x = basePositions[i * 3];
        const y = basePositions[i * 3 + 1];
        const zBase = basePositions[i * 3 + 2];

        const deslocamento = Math.sin(time * velocidade) * amplitude;

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

    const body = new THREE.SphereGeometry(0.2, 16, 16);
    const material = new THREE.MeshStandardMaterial({
        color: isExploded ? 0x880000 : 0x111111,
        emissive: isExploded ? 0xff4444 : 0x000000,
        emissiveIntensity: 0.6
    });
    const sphere = new THREE.Mesh(body, material);
    group.add(sphere);

    const spikeMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const spikeGeometry = new THREE.CylinderGeometry(0.02, 0.01, 0.1);

    const spikeCount = 12;
    for (let i = 0; i < spikeCount; i++) {
        const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);

        const theta = Math.acos(1 - 2 * (i + 0.5) / spikeCount); 
        const phi = Math.PI * (1 + Math.sqrt(5)) * i;            

        const dx = Math.sin(theta) * Math.cos(phi);
        const dy = Math.cos(theta);
        const dz = Math.sin(theta) * Math.sin(phi);

        const dir = new THREE.Vector3(dx, dy, dz);
        const axis = new THREE.Vector3(0, 1, 0); 
        const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, dir.clone().normalize());
        spike.quaternion.copy(quaternion);

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

    const duration = 500; // ms
    const start = performance.now();

    function animateExplosion(time) {
        const t = (time - start) / duration;

        if (t >= 1) {
            scene.remove(explosion);
            return;
        }

        const scale = 1 + t * 3; 
        explosion.scale.set(scale, scale, scale);
        explosion.material.opacity = 0.8 * (1 - t); 

        requestAnimationFrame(animateExplosion);
    }

    requestAnimationFrame(animateExplosion);
}
