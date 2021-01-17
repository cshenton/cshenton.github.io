import * as THREE from "./three/build/three.module.js";
import { WEBGL } from './three/examples/jsm/WebGL.js';
import { OrbitControls } from './three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from './three/examples/jsm/loaders/GLTFLoader.js';

function main() {
    if (!WEBGL.isWebGLAvailable()) {
        const warning = WEBGL.getWebGLErrorMessage();
        document.getElementById('container').appendChild(warning);
        return;
    }

    const clock = new THREE.Clock();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x00041c);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 50, 0);
    controls.update();
    controls.enablePan = false;

    const ambient_light = new THREE.AmbientLight( 0xFFFFFF, 0.5 ); // soft white light
    scene.add( ambient_light );

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

    camera.position.z = 100;

    let model, skeleton, mixer;
    const loader = new GLTFLoader();
    loader.load('models/Flair.glb', function (gltf) {
        model = gltf.scene;
        scene.add(model);

        model.traverse(function (object) {
            if (object.isMesh) object.castShadow = true;
        });

        skeleton = new THREE.SkeletonHelper(model);
        skeleton.visible = false;
        scene.add(skeleton);

        mixer = new THREE.AnimationMixer(model);
        const action = mixer.clipAction( gltf.animations[0] );
        action.play();


        const vertices = [];
        for (let i = 0; i < 10000; i++) {
            const x = THREE.MathUtils.randFloatSpread(1000);
            const y = THREE.MathUtils.randFloatSpread(1000);
            const z = THREE.MathUtils.randFloatSpread(1000);
            vertices.push(x, y, z);
        }
    
        const pointgeo = new THREE.BufferGeometry();
        pointgeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    
        const pointmat = new THREE.PointsMaterial({ size: 0.35, color: 0xfff7c7 });
        const points = new THREE.Points(pointgeo, pointmat);
        scene.add(points);

        window.onresize = function reportWindowSize() {
            renderer.setSize(window.innerWidth, window.innerHeight);
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        }
    
        renderer.setAnimationLoop(function () {
            controls.update();
            mixer.update(clock.getDelta() / 2.0);
            for (let i = 0; i < 30000; i++) {
                vertices[i] += THREE.MathUtils.randFloatSpread(1)
            }
            pointgeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            renderer.render(scene, camera);
        });
    });


}

main()
