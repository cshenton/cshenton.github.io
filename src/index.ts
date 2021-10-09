import './index.css';
import * as THREE from 'three';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { initBoids, updateBoids, updateInstances } from './boids';

import WaterTex from './textures/underwater.jpg';

// Programmer art low-poly fish
function fishGeometry(): THREE.BufferGeometry {
    const head = new THREE.ConeGeometry(1, 2, 3);
    const body = new THREE.ConeGeometry(1, 3, 3);
    const tail = new THREE.ConeGeometry(1, 1, 3);
    head.rotateZ(Math.PI);
    head.translate(0, -2.5, 0);
    tail.rotateZ(Math.PI);
    tail.translate(0, 2, 0);

    return mergeBufferGeometries([head, body, tail]);
}

// Start renderer, setup callbacks, and run
function main() {
    const clock = new THREE.Clock();

    const maxFishK = 50;
    const boids = initBoids(maxFishK * 1000);
    updateBoids(boids, maxFishK * 1000, 0.016);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x00041c);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.x = -300;
    camera.position.y = -400;
    camera.position.z = -300;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();

    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.5); // soft white light
    scene.add(ambientLight);

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

    let running = true;
    let kFish = 1;

    const mesh = new THREE.InstancedMesh(fishGeometry(), new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 1.0, side: THREE.DoubleSide }), maxFishK * 1000);
    let color = new THREE.Color();
    for (let i = 0; i < mesh.count; i++) {
        mesh.setColorAt(i, color.setRGB(Math.random(), Math.random(), Math.random()));
    }
    scene.add(mesh);

    new THREE.TextureLoader().load(WaterTex, function (texture) {
        const rt = new THREE.WebGLCubeRenderTarget(texture.image.height);
        rt.fromEquirectangularTexture(renderer, texture);
        scene.background = rt.texture;

        const gen = new THREE.PMREMGenerator(renderer);
        if (mesh) mesh.material.envMap = gen.fromEquirectangular(texture).texture;
    });

    window.addEventListener('resize', function () {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });

    window.addEventListener('keydown', function (event) {
        if (event.code == 'Space') {
            running = !running;
        }
    });

    renderer.setAnimationLoop(function () {
        const deltaTime = clock.getDelta();
        controls.update();
        if (running) updateBoids(boids, kFish * 1000, deltaTime);
        if (mesh) updateInstances(boids, mesh, kFish * 1000);
        renderer.render(scene, camera);
        if (deltaTime < 0.016 && kFish < maxFishK && running) kFish += 1;
    });
}

main();