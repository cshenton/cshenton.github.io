import * as THREE from "./three/build/three.module.js";
import { WEBGL } from './three/examples/jsm/WebGL.js';
import { OrbitControls } from './three/examples/jsm/controls/OrbitControls.js';
// import { GLTFLoader } from './three/examples/jsm/loaders/GLTFLoader.js';

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
        values: new Int32Array(dims.x * dims.y * dims.z * capacity),
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
};


let Flock = {};

Flock.initBirds = function (length) {
    const positions = new Float32Array(3 * length);
    const directions = new Float32Array(3 * length);

    let pos = new THREE.Vector3();
    let dir = new THREE.Vector3();

    for (let i = 0; i < length; i++) {
        pos.random().subScalar(0.5);
        dir.random().subScalar(0.5).normalize();
        pos.toArray(positions, 3 * i);
        dir.toArray(directions, 3 * i);
    }

    return {
        length: length,
        positions: positions,
        directions: directions,
    };
};

Flock.initGrid = function () {
    const lower = new THREE.Vector3(-0.5, -0.5, -0.5);
    const upper = new THREE.Vector3(0.5, 0.5, 0.5);
    const size = new THREE.Vector3(0.1, 0.1, 0.1);
    return Grid.init(lower, upper, size, 10);
}

Flock.initParams = function () {
    return {
        speed: 0.003,

        separationRadius: 0.05,
        alignmentRadius: 0.1,
        cohesionRadius: 0.1,

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
        Grid.insert(grid, pos, i);
    }
};

Flock.interact = function (grid, birds, params) {
    let pos_i = new THREE.Vector3();
    let pos_j = new THREE.Vector3();
    let dir_i = new THREE.Vector3();
    let dir_j = new THREE.Vector3();

    let vec = new THREE.Vector3();

    for (let i = 0; i < birds.length; i++) {
        pos_i.fromArray(birds.positions, 3 * i);
        dir_i.fromArray(birds.directions, 3 * i);

        const x = Math.ceil((pos_i.x - grid.lower.x) / grid.size.x);
        const y = Math.ceil((pos_i.y - grid.lower.y) / grid.size.y);
        const z = Math.ceil((pos_i.z - grid.lower.z) / grid.size.z);

        const cell = x * grid.dims.y * grid.dims.z + y * grid.dims.z + z;
        const count = grid.counts[cell];
        const start = cell * grid.capacity;
        const end = cell * grid.capacity + count;

        for (let slot = start; slot < end; slot++) {
            const j = grid.values[slot];
            if (i == j) continue;

            pos_j.fromArray(birds.positions, 3 * j);
            dir_j.fromArray(birds.directions, 3 * j);

            const dist = pos_i.distanceTo(pos_j);

            // Separation
            if (dist < params.separationRadius) {
                vec.subVectors(pos_i, pos_j).normalize();
                dir_i.add(vec.multiplyScalar(params.separationStrength));
            }

            // Alignment
            if (dist < params.alignmentRadius) {
                vec.copy(dir_j);
                dir_i.add(vec.multiplyScalar(params.alignmentStrength));
            }

            // Cohesion
            if (dist < params.cohesionRadius) {
                vec.subVectors(pos_j, pos_i).normalize();
                dir_i.add(vec.multiplyScalar(params.cohesionStrength))
            }
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

        if (pos.x > 0.5) pos.x -= 1.0;
        if (pos.y > 0.5) pos.y -= 1.0;
        if (pos.z > 0.5) pos.z -= 1.0;
        if (pos.x < -0.5) pos.x += 1.0;
        if (pos.y < -0.5) pos.y += 1.0;
        if (pos.z < -0.5) pos.z += 1.0;

        pos.toArray(birds.positions, 3 * i);
    }
};



Flock.init = function () {
    return {
        grid: Flock.initGrid(),
        birds: Flock.initBirds(30000),
        params: Flock.initParams(),
    };
};

Flock.update = function (flock) {
    Flock.index(flock.grid, flock.birds);
    Flock.interact(flock.grid, flock.birds, flock.params);
    Flock.move(flock.birds, flock.params);
}


// const updateInstances = function (flock, instances) {
//     let pos = new THREE.Vector3();
//     let mat = new THREE.Matrix4();

//     for (let i = 0; i < flock.length; i++) {
//         instances.getMatrixAt(i, mat);
//         pos.fromArray(flock.positions, 3 * i);
//         mat.setPosition(pos);
//         // set rotation using direction
//         instances.setMatrixAt(i, mat);
//     }
// }

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

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

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

    camera.position.z = 1;

    const pointgeo = new THREE.BufferGeometry();
    pointgeo.setAttribute('position', new THREE.Float32BufferAttribute(flock.birds.positions, 3));

    const pointmat = new THREE.PointsMaterial({ size: 0.001, color: 0xfff7c7 });
    const points = new THREE.Points(pointgeo, pointmat);
    scene.add(points);

    window.addEventListener('resize', function () {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });

    renderer.setAnimationLoop(function () {
        controls.update();
        Flock.update(flock);
        pointgeo.setAttribute('position', new THREE.Float32BufferAttribute(flock.birds.positions, 3));
        renderer.render(scene, camera);
    });
};

main()
