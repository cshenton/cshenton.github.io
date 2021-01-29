import * as THREE from "./three/build/three.module.js";
import { WEBGL } from './three/examples/jsm/WebGL.js';
import { OrbitControls } from './three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from './three/examples/jsm/loaders/FBXLoader.js';


let Grid = {};

Grid.init = function (lower, upper, size, capacity) {
    const dims = new THREE.Vector3(
        Math.ceil((upper.x - lower.x) / size.x),
        Math.ceil((upper.y - lower.y) / size.y),
        Math.ceil((upper.z - lower.z) / size.z),
    );

    return {
        dims: dims,
        lower: lower,
        upper: upper,
        size: size,
        capacity: capacity,

        counts: new Int8Array(dims.x * dims.y * dims.z),
        values: new Uint32Array(dims.x * dims.y * dims.z * capacity),
    };
};

Grid.reset = function (grid) {
    for (let i = 0; i < grid.counts.length; i++) {
        grid.counts[i] = 0;
    }
};

Grid.insert = function (grid, position, id) {
    const x = Math.ceil((position.x - grid.lower.x) / grid.size.x);
    const y = Math.ceil((position.y - grid.lower.y) / grid.size.y);
    const z = Math.ceil((position.z - grid.lower.z) / grid.size.z);

    const cell = x * grid.dims.y * grid.dims.z + y * grid.dims.z + z;
    const count = grid.counts[cell];

    if (count < grid.capacity) {
        grid.values[cell * grid.capacity + count] = id;
        grid.counts[cell] += 1;
    }

    return cell;
};


let Flock = {};

Flock.initBirds = function (length) {
    const positions = new Float32Array(3 * length);
    const directions = new Float32Array(3 * length);
    const cells = new Int32Array(3 * length);

    let pos = new THREE.Vector3();
    let dir = new THREE.Vector3();

    for (let i = 0; i < length; i++) {
        pos.random().subScalar(0.5).multiplyScalar(1000.0);
        dir.random().subScalar(0.5).normalize();
        pos.toArray(positions, 3 * i);
        dir.toArray(directions, 3 * i);
    }

    return {
        length: length,
        positions: positions,
        directions: directions,
        cells: cells,
    };
};

Flock.initGrid = function () {
    const lower = new THREE.Vector3(-0.5, -0.5, -0.5).multiplyScalar(1000.0);
    const upper = new THREE.Vector3(0.5, 0.5, 0.5).multiplyScalar(1000.0);
    const size = new THREE.Vector3(0.1, 0.1, 0.1).multiplyScalar(1000.0);
    return Grid.init(lower, upper, size, 8);
}

Flock.initParams = function () {
    return {
        speed: 3.0,

        separationRadius: 50.0,
        alignmentRadius: 100.0,
        cohesionRadius: 100.0,

        separationStrength: 2.0,
        alignmentStrength: 1.0,
        cohesionStrength: 1.0,
    };
}

Flock.index = function (grid, birds) {
    Grid.reset(grid);

    let pos = new THREE.Vector3();
    for (let i = 0; i < birds.length; i += 1) {
        pos.fromArray(birds.positions, 3 * i);
        birds.cells[i] = Grid.insert(grid, pos, i);
    }
};

Flock.interact = function (grid, birds, params) {
    let pos_i = new THREE.Vector3();
    let pos_j = new THREE.Vector3();
    let dir_i = new THREE.Vector3();
    let dir_j = new THREE.Vector3();

    let dir_ij = new THREE.Vector3();
    let vec = new THREE.Vector3();

    for (let i = 0; i < birds.length; i++) {
        pos_i.fromArray(birds.positions, 3 * i);
        dir_i.fromArray(birds.directions, 3 * i);

        const cell = birds.cells[i];
        const count = grid.counts[cell];
        const start = cell * grid.capacity;
        const end = cell * grid.capacity + count;

        for (let slot = start; slot < end; slot++) {
            const j = grid.values[slot];
            if (i == j) continue;

            pos_j.fromArray(birds.positions, 3 * j);
            dir_j.fromArray(birds.directions, 3 * j);

            dir_ij.subVectors(pos_i, pos_j);
            const dist = dir_ij.length();
            dir_ij.divideScalar(dist);

            const separation = params.separationStrength * (dist < params.separationRadius);
            const alignment = params.alignmentStrength * (dist < params.alignmentRadius);
            const cohesion = params.cohesionStrength * (dist < params.cohesionRadius);

            dir_i.add(vec.copy(dir_ij).multiplyScalar(separation));
            dir_i.add(vec.copy(dir_j).multiplyScalar(alignment));
            dir_i.add(vec.copy(dir_ij).multiplyScalar(-cohesion));
        }

        dir_i.normalize();
        dir_i.toArray(birds.directions, 3 * i);
    }
};

Flock.move = function (birds, params) {
    let pos = new THREE.Vector3();
    let dir = new THREE.Vector3();

    for (let i = 0; i < birds.length; i++) {
        pos.fromArray(birds.positions, 3 * i);
        dir.fromArray(birds.directions, 3 * i);
        dir.multiplyScalar(params.speed);
        pos.add(dir);

        pos.x += 1000.0 * (pos.x < -500.0) - 1000.0 * (pos.x > 500.0);
        pos.y += 1000.0 * (pos.y < -500.0) - 1000.0 * (pos.y > 500.0);
        pos.z += 1000.0 * (pos.z < -500.0) - 1000.0 * (pos.z > 500.0);

        pos.toArray(birds.positions, 3 * i);
    }
};

Flock.init = function () {
    return {
        grid: Flock.initGrid(),
        birds: Flock.initBirds(50000),
        params: Flock.initParams(),
    };
};

Flock.update = function (flock) {
    Flock.index(flock.grid, flock.birds);
    Flock.interact(flock.grid, flock.birds, flock.params);
    Flock.move(flock.birds, flock.params);
};


const updateInstances = function (flock, instances) {
    let pos = new THREE.Vector3();
    let dir = new THREE.Vector3();
    let scale = new THREE.Vector3(1, 1, 1);
    let quat = new THREE.Quaternion();
    let mat = new THREE.Matrix4();

    for (let i = 0; i < flock.birds.length; i++) {
        pos.fromArray(flock.birds.positions, 3 * i);
        dir.fromArray(flock.birds.directions, 3 * i);
        quat.setFromAxisAngle(dir, Math.PI);

        mat.compose(pos, quat, scale);
        instances.setMatrixAt(i, mat);
    }

    instances.instanceMatrix.needsUpdate = true;
}


const main = function () {
    if (!WEBGL.isWebGLAvailable()) {
        const warning = WEBGL.getWebGLErrorMessage();
        document.getElementById('container').appendChild(warning);
        return;
    }

    const flock = Flock.init();
    Flock.update(flock);

    const clock = new THREE.Clock();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x00041c);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();
    controls.enablePan = false;

    const ambient_light = new THREE.AmbientLight(0xFFFFFF, 0.5); // soft white light
    scene.add(ambient_light);

    const light = new THREE.DirectionalLight(0xdfebff, 3.0);
    light.position.set(-500, 2000, 1000);
    light.position.multiplyScalar(1.3);
    light.castShadow = true;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;

    const d = 300;
    light.shadow.camera.left = - d;
    light.shadow.camera.right = d;
    light.shadow.camera.top = d;
    light.shadow.camera.bottom = - d;
    light.shadow.camera.far = 1000;
    scene.add(light);

    camera.position.z = 1000;

    const loader = new FBXLoader();

    let mesh;
    loader.load("models/Koi_Tri.fbx", function (fbx) {
        console.log(fbx);
        const geometry = fbx.children[0].geometry;
        mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: 0xffff00 }), 50000);
        scene.add(mesh);
    });

    window.addEventListener('resize', function () {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });

    renderer.setAnimationLoop(function () {
        controls.update();
        Flock.update(flock);
        if (mesh) updateInstances(flock, mesh);
        renderer.render(scene, camera);
    });
};

main()
