import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'https://unpkg.com/three@0.139.2/examples/jsm/geometries/RoundedBoxGeometry.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';


const scene = new THREE.Scene();
scene.background = new THREE.Color(0x224422);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 20, 0);
camera.lookAt(0, 0, 0);



const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.4;
document.getElementById("WebGL-output").appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

const backLight = new THREE.DirectionalLight(0xffffff, 0.8);
backLight.position.set(-10, 15, -10);
scene.add(backLight);


let gameGrid;
let gameDifficulty;
const animatedFlags = [];


const rgbeLoader = new RGBELoader();
rgbeLoader.load('textures/industrial_sunset_02_puresky_1k.hdr', function(texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
    scene.background = texture;
});


export function clearScene() {
    const objectsToRemove = [...scene.children];
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
}

export function setupScene(grid, difficulty) {
    gameGrid = grid;
    gameDifficulty = difficulty;
    
    const cubeSize = difficulty.size;
    camera.position.set(cubeSize * 1.5, cubeSize * 1.5, cubeSize * 1.5);
    camera.lookAt(0, 0, 0);
    
    controls.target.set(0, 0, 0);
    controls.update();


    const groundSize = 1000;
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 1, 1);

    const textureLoader = new THREE.TextureLoader();

    const colorMap = textureLoader.load('textures/brown_mud_leaves_01_diff_1k.jpg');
    colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
    colorMap.repeat.set(20, 20); 

    const normalMap = textureLoader.load('textures/brown_mud_leaves_01_disp_1k.png');
    normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(20, 20);

    const grassMaterial = new THREE.MeshStandardMaterial({
        map: colorMap,
        normalMap: normalMap,
        color: 0xaaaaaa,     // Cor base escura
        side: THREE.DoubleSide
    });



    const ground = new THREE.Mesh(groundGeometry, grassMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -difficulty.size * 3 - 1;
    ground.userData.isBackground = true;
    ground.receiveShadow = true;
    scene.add(ground);

}

export function renderScene() {
    renderer.render(scene, camera);
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();


export function getIntersectedSquare(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);
    
    for (const hit of intersects) {
        let object = hit.object;

        if (object.userData?.isBackground) continue;

        while (object && !object.userData?.isCube && object.parent) {
            object = object.parent;
        }

        const cube = object;
        const pos = cube.position.clone().add(new THREE.Vector3(
            gameDifficulty.size/2 - 0.5,
            gameDifficulty.size/2 - 0.5,
            gameDifficulty.size/2 - 0.5
        ));
        
        const i = Math.round(pos.x);
        const j = Math.round(pos.y);
        const k = Math.round(pos.z);
        
        if (i >= 0 && i < gameDifficulty.size &&
            j >= 0 && j < gameDifficulty.size &&
            k >= 0 && k < gameDifficulty.size) {
            
            const size = gameDifficulty.size;
            let externalFace = 'unknown';

            const normal = hit.face.normal;
            const epsilon = 0.1;

            if (Math.abs(normal.z - 1) < epsilon && k === size - 1) externalFace = 'front';
            else if (Math.abs(normal.z + 1) < epsilon && k === 0) externalFace = 'back';
            else if (Math.abs(normal.x - 1) < epsilon && i === size - 1) externalFace = 'right';
            else if (Math.abs(normal.x + 1) < epsilon && i === 0) externalFace = 'left';
            else if (Math.abs(normal.y - 1) < epsilon && j === size - 1) externalFace = 'top';
            else if (Math.abs(normal.y + 1) < epsilon && j === 0) externalFace = 'bottom';

            if (externalFace === 'unknown') {
                externalFace = getFaceFromNormal(normal);
            }

            return { 
                i, j, k,
                cube,
                face: externalFace
            };
        }
    }

    return null;
}


function getFaceFromNormal(normal) {
    const epsilon = 0.1;
    if (Math.abs(normal.z - 1) < epsilon) return 'front';
    if (Math.abs(normal.z + 1) < epsilon) return 'back';
    if (Math.abs(normal.x - 1) < epsilon) return 'right';
    if (Math.abs(normal.x + 1) < epsilon) return 'left';
    if (Math.abs(normal.y - 1) < epsilon) return 'top';
    if (Math.abs(normal.y + 1) < epsilon) return 'bottom';
    return 'unknown';
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    for (const flag of animatedFlags) {
        if (flag.tick) {
            flag.tick(performance.now() / 1000);
        }
    }

    renderer.render(scene, camera);
}
animate();

export function create3DGrid(grid, difficulty) {
    const size = difficulty.size;
    const faceMappings = {
        front: (x, y) => [x, y, size-1],
        back: (x, y) => [x, y, 0],
        right: (x, y) => [size-1, y, x],
        left: (x, y) => [0, y, x],
        top: (x, y) => [x, size-1, y],
        bottom: (x, y) => [x, 0, y]
    };

    for (const [face, mapper] of Object.entries(faceMappings)) {
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                const [i, j, k] = mapper(x, y);
                const square = grid[i][j][k];
                
                if (!square.cube) {
                    const geometry = new RoundedBoxGeometry(1, 1, 1, 6, 0.2);
                    const material = new THREE.MeshLambertMaterial({
                        color: 0xaaaaaa,
                        transparent: true,
                        opacity: 1 
                    });
                    const cube = new THREE.Mesh(geometry, material);
                    cube.userData.isCube = true;
                    cube.position.set(i - size/2 + 0.5, j - size/2 + 0.5, k - size/2 + 0.5);
                    scene.add(cube);
                    square.cube = cube;
                }
            }
        }
    }
}

export function update3DSquare(square, i, j, k, clickedFace = null) {
    if (!square.cube) return;

    const oldMines = square.cube.children.filter(child => child.name && child.name.startsWith("mineModel_"));
    oldMines.forEach(mine => square.cube.remove(mine));
    
    const oldNumbers = square.cube.children.filter(child => child.name && child.name.startsWith("numberModel_"));
    oldNumbers.forEach(number => square.cube.remove(number));


    if (square.isRevealed) {
        if (square.isMine) {
            square.cube.material.color.set(0xff0000); // Cor de mina revelada
            
            const size = gameDifficulty.size; 
            const visibleFaces = [];
            if (k === size - 1) visibleFaces.push("front");
            if (k === 0) visibleFaces.push("back");
            if (i === size - 1) visibleFaces.push("right");
            if (i === 0) visibleFaces.push("left");
            if (j === size - 1) visibleFaces.push("top");
            if (j === 0) visibleFaces.push("bottom");

            for (const face of visibleFaces) {
                const mine = createMineMesh(square.wasClicked); 
                mine.name = `mineModel_${face}`;
                positionObjectOverFace(mine, face);
                square.cube.add(mine);
            }

        } else if (square.numNeighborMines > 0) {
            square.cube.material.color.set(0x000000); // preto
            const numberTexture = createNumberTexture(square.numNeighborMines);
            const numberMaterial = new THREE.MeshBasicMaterial({ 
                map: numberTexture,
                transparent: true
            });
            const numberGeometry = new THREE.PlaneGeometry(0.8, 0.8);
            
            const faces = [
                { name: 'front', position: [0, 0, 0.51], rotation: [0, 0, 0] },
                { name: 'back', position: [0, 0, -0.51], rotation: [0, Math.PI, 0] },
                { name: 'right', position: [0.51, 0, 0], rotation: [0, Math.PI / 2, 0] },
                { name: 'left', position: [-0.51, 0, 0], rotation: [0, -Math.PI / 2, 0] },
                { name: 'top', position: [0, 0.51, 0], rotation: [-Math.PI / 2, 0, 0] },
                { name: 'bottom', position: [0, -0.51, 0], rotation: [Math.PI / 2, 0, 0] },
            ];

            for (const face of faces) {
                const number = new THREE.Mesh(numberGeometry, numberMaterial.clone());
                number.name = `numberModel_${face.name}`;
                number.position.set(...face.position);
                number.rotation.set(...face.rotation); 
                square.cube.add(number);
            }

        } else {
            square.cube.material.color.set(0x00aa00); 
        }
    }
}

function positionObjectOverFace(object, face) {
    const offset = 0.8; 

    switch (face) {
        case 'front': // Z+
            object.position.set(0, 0, offset);
            break;
        case 'back': // Z-
            object.position.set(0, 0, -offset);
            break;
        case 'right': // X+
            object.position.set(offset, 0, 0);
            break;
        case 'left': // X-
            object.position.set(-offset, 0, 0);
            break;
        case 'top': // Y+
            object.position.set(0, offset, 0);
            break;
        case 'bottom': // Y-
            object.position.set(0, -offset, 0);
            break;
        default:
            object.position.set(0, 0, offset); 
            break;
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
    const vertices = new Float32Array([0, 0.8, 0, 0, 0.4, 0, 0.45, 0.6, 0]);
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
        const zBase = basePositions[i * 3 + 2];
        positions.array[i * 3 + 2] = zBase + Math.sin(time * velocidade) * amplitude;
        positions.needsUpdate = true;
    };

    group.add(pole);
    group.add(flag);
    animatedFlags.push(flag);

    return group;
}

export function createFlagForFace(face) {
    const flag = createFlag(); 
    const offset = 0.51;

    switch (face) {
        case 'front': // Z+
            flag.position.set(0, 0, offset);
            flag.rotation.set(Math.PI/2, 0, 0);
            break;

        case 'back': // Z-
            flag.position.set(0, 0, -offset);
            flag.rotation.set(-Math.PI/2, 0, 0);
            break;

        case 'right': // X+
            flag.position.set(offset, 0, 0);
            flag.rotation.set(0, 0, -Math.PI/2);
            break;

        case 'left': // X-
            flag.position.set(-offset, 0, 0);
            flag.rotation.set(0, 0, Math.PI/2);
            break;

        case 'top': // Y+
            flag.position.set(0, offset, 0);
            flag.rotation.set(0, 0, 0);
            break;

        case 'bottom': // Y-
            flag.position.set(0, -offset, 0);
            flag.rotation.set(Math.PI, 0, 0);
            break;


        default:
            flag.position.set(0, offset, 0);
            flag.rotation.set(0, 0, 0);
            break;
    }

    flag.name = "flag";
    return flag;
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

    for (let i = 0; i < 12; i++) {
        const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
        const theta = Math.acos(1 - 2 * (i + 0.5) / 12);
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

    const duration = 500;
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