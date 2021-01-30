import * as THREE from "./three/build/three.module.js";
import { WEBGL } from "./three/examples/jsm/WebGL.js";
import { OrbitControls } from "./three/examples/jsm/controls/OrbitControls.js";
import { FBXLoader } from "./three/examples/jsm/loaders/FBXLoader.js";


const maxFishK = 50;


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

Flock.initFish = function (length) {
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
    const size = new THREE.Vector3(0.075, 0.075, 0.075).multiplyScalar(1000.0);
    return Grid.init(lower, upper, size, 8);
}

Flock.initParams = function () {
    return {
        speed: 1.0,

        separationRadius: 25.0,
        alignmentRadius: 50.0,
        cohesionRadius: 50.0,

        separationStrength: 4.0,
        alignmentStrength: 6.0,
        cohesionStrength: 1.0,
    };
}

Flock.index = function (grid, fish, n) {
    Grid.reset(grid);

    let pos = new THREE.Vector3();
    for (let i = 0; i < n; i += 1) {
        pos.fromArray(fish.positions, 3 * i);
        fish.cells[i] = Grid.insert(grid, pos, i);
    }
};

Flock.interact = function (grid, fish, params, n) {
    let pos_i = new THREE.Vector3();
    let pos_j = new THREE.Vector3();
    let dir_i = new THREE.Vector3();
    let dir_j = new THREE.Vector3();

    let dir_ij = new THREE.Vector3();
    let vec = new THREE.Vector3();

    for (let i = 0; i < n; i++) {
        pos_i.fromArray(fish.positions, 3 * i);
        dir_i.fromArray(fish.directions, 3 * i);

        const cell = fish.cells[i];
        const count = grid.counts[cell];
        const start = cell * grid.capacity;
        const end = cell * grid.capacity + count;

        for (let slot = start; slot < end; slot++) {
            const j = grid.values[slot];
            if (i == j) continue;

            pos_j.fromArray(fish.positions, 3 * j);
            dir_j.fromArray(fish.directions, 3 * j);

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
        dir_i.toArray(fish.directions, 3 * i);
    }
};

Flock.move = function (fish, params, n) {
    let pos = new THREE.Vector3();
    let dir = new THREE.Vector3();

    for (let i = 0; i < n; i++) {
        pos.fromArray(fish.positions, 3 * i);
        dir.fromArray(fish.directions, 3 * i);
        dir.multiplyScalar(params.speed);
        pos.add(dir);

        pos.x += 1000.0 * (pos.x < -500.0) - 1000.0 * (pos.x > 500.0);
        pos.y += 1000.0 * (pos.y < -500.0) - 1000.0 * (pos.y > 500.0);
        pos.z += 1000.0 * (pos.z < -500.0) - 1000.0 * (pos.z > 500.0);

        pos.toArray(fish.positions, 3 * i);
    }
};

Flock.init = function () {
    return {
        grid: Flock.initGrid(),
        fish: Flock.initFish(maxFishK * 1000),
        params: Flock.initParams(),
    };
};

Flock.update = function (flock, n) {
    Flock.index(flock.grid, flock.fish, n);
    Flock.interact(flock.grid, flock.fish, flock.params, n);
    Flock.move(flock.fish, flock.params, n);
};


const updateInstances = function (flock, instances, n) {
    let pos = new THREE.Vector3();
    let dir = new THREE.Vector3();
    let scale = new THREE.Vector3(1.25, 1.25, 1.25);
    let quat = new THREE.Quaternion();
    let mat = new THREE.Matrix4();
    let vFrom = new THREE.Vector3(0, -1.0, 0);
    
    for (let i = 0; i < n; i++) {
        pos.fromArray(flock.fish.positions, 3 * i);
        dir.fromArray(flock.fish.directions, 3 * i);
        quat.setFromUnitVectors(vFrom, dir);
        
        mat.compose(pos, quat, scale);
        instances.setMatrixAt(i, mat);
    }
    
    instances.count = n;
    instances.instanceMatrix.needsUpdate = true;
}


const main = function () {
    if (!WEBGL.isWebGLAvailable()) {
        const warning = WEBGL.getWebGLErrorMessage();
        document.getElementById("container").appendChild(warning);
        return;
    }

    const clock = new THREE.Clock();


    const fishStats = new Stats();
    fishStats.showPanel(3);
    fishStats.domElement.style.cssText = "position:absolute;top:0px;left:0px;";
    const fishPanel = fishStats.addPanel(new Stats.Panel("k fish", "#ff8", "#221"));
    document.body.appendChild(fishStats.dom);

    const fpsStats = new Stats();
    fpsStats.showPanel(0);
    fpsStats.domElement.style.cssText = "position:absolute;top:0px;left:80px;";
    document.body.appendChild(fpsStats.dom);

    const msStats = new Stats();
    msStats.showPanel(1);
    msStats.domElement.style.cssText = "position:absolute;top:0px;left:160px;";
    document.body.appendChild(msStats.dom);

    const memStats = new Stats();
    memStats.showPanel(2);
    memStats.domElement.style.cssText = "position:absolute;top:0px;left:240px;";
    document.body.appendChild(memStats.dom);


    const flock = Flock.init();
    Flock.update(flock);

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

    const d = 500;
    light.shadow.camera.left = - d;
    light.shadow.camera.right = d;
    light.shadow.camera.top = d;
    light.shadow.camera.bottom = - d;
    light.shadow.camera.far = 1000;
    scene.add(light);

    camera.position.x = -300;
    camera.position.y = -400;
    camera.position.z = -300;

    let mesh;
    let running = true;
    let kFish = 1;

    const fbx_loader = new FBXLoader();
    fbx_loader.load("models/Koi_Tri.fbx", function (fbx) {
        const geometry = fbx.children[0].geometry;
        mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.1 }), maxFishK * 1000);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        let color = new THREE.Vector3();
        for (let i = 0; i < mesh.count; i++) {
            mesh.setColorAt(i, color.random());
        }
        scene.add(mesh);
    });

    const env_loader = new THREE.TextureLoader();
    env_loader.load("textures/underwater.jpg", function (texture) {
        const rt = new THREE.WebGLCubeRenderTarget(texture.image.height);
        rt.fromEquirectangularTexture(renderer, texture);
        scene.background = rt;

        const gen = new THREE.PMREMGenerator(renderer);
        if (mesh) mesh.material.envMap = gen.fromEquirectangular(texture).texture;
    });

    window.addEventListener("resize", function () {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });

    window.addEventListener("keydown", function (event) {
        if (event.code == "Space") {
            running = !running;
        }
    });

    renderer.setAnimationLoop(function () {
        fpsStats.begin();
        msStats.begin();
        memStats.begin();
        fishStats.begin();

        controls.update();
        if (running) Flock.update(flock, kFish * 1000);
        if (mesh) updateInstances(flock, mesh, kFish * 1000);
        renderer.render(scene, camera);

        fpsStats.end();
        msStats.end();
        memStats.end();
        fishStats.end();

        fishPanel.update(kFish, maxFishK);
        if (clock.getDelta() < 0.016 && kFish < maxFishK && running) kFish += 1;
    });
};

main()
