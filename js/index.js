import * as THREE from "./three/build/three.module.js";
import { WEBGL } from './three/examples/jsm/WebGL.js';
import { OrbitControls } from './three/examples/jsm/controls/OrbitControls.js';

function main() {
    if (!WEBGL.isWebGLAvailable()) {
        const warning = WEBGL.getWebGLErrorMessage();
        document.getElementById('container').appendChild(warning);
        return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcce0ff);
    scene.fog = new THREE.Fog(0xcce0ff, 25, 100);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();
    controls.enablePan = false;
    controls.enableDamping = true;

    const geometry = new THREE.DodecahedronGeometry();
    const material = new THREE.MeshPhysicalMaterial({ color: 0x003cff, roughness: 0.1, clearcoat: 1.0 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // const ground = new THREE.Mesh(new THREE.PlaneBufferGeometry(100, 100), new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false }));
    // ground.rotation.x = - Math.PI / 2;
    // ground.position.y = -1.0;
    // ground.receiveShadow = true;
    // scene.add(ground);

    const light = new THREE.DirectionalLight(0xdfebff, 1);
    light.position.set(50, 200, 100);
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

    camera.position.z = 5;

    const vertices = [];
    for (let i = 0; i < 10000; i++) {
        const x = THREE.MathUtils.randFloatSpread(100);
        const y = THREE.MathUtils.randFloatSpread(100);
        const z = THREE.MathUtils.randFloatSpread(100);
        vertices.push(x, y, z);
    }

    const pointgeo = new THREE.BufferGeometry();
    pointgeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    const pointmat = new THREE.PointsMaterial({ size: 0.25, color: 0xfcba03 });
    const points = new THREE.Points(pointgeo, pointmat);
    scene.add(points);

    window.onresize = function reportWindowSize() {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    }

    renderer.setAnimationLoop(function () {
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;
        controls.update();
        renderer.render(scene, camera);
    });
}

main()
