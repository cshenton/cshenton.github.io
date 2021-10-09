import './index.css';
import * as THREE from 'three';

function onWindowResize(camera: THREE.PerspectiveCamera, renderer: THREE.Renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function sceneCanvas() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);

    window.addEventListener('resize', () => onWindowResize(camera, renderer));

    return renderer.domElement;
}

document.body.appendChild(sceneCanvas());
