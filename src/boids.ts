import { Matrix4, Quaternion, Vector3 } from 'three';

// Numeric parameters driving the boids simulation
interface BoidParams {
    speed: number,
    separationRadius: number,
    alignmentRadius: number,
    cohesionRadius: number,
    separationStrength: number,
    alignmentStrength: number,
    cohesionStrength: number,
}

// Flock of boids, stored as native arrays for better cache coherency
interface BoidFlock {
    count: number,
    positions: Float32Array,
    directions: Float32Array,
    cells: Int32Array,
}

// Spatial grid used for nearest neighbour lookups during boid simulation
interface BoidGrid {
    dims: Vector3,
    lower: Vector3,
    upper: Vector3,
    size: Vector3,
    capacity: number,
    counts: Int8Array,
    values: Uint32Array,
}

// Complete boids simulation state
interface Boids {
    params: BoidParams,
    flock: BoidFlock,
    grid: BoidGrid,
}

// Initialise a flock of count boids randomly between lower and upper 
function initBoidFlock(lower: Vector3, upper: Vector3, count: number): BoidFlock {
    const positions = new Float32Array(3 * count);
    const directions = new Float32Array(3 * count);
    const cells = new Int32Array(3 * count);

    const pos = new Vector3();
    const dir = new Vector3();
    const diff = new Vector3();
    diff.subVectors(upper, lower);

    for (let i = 0; i < count; i++) {
        pos.random().multiply(diff).add(lower);
        dir.random().subScalar(0.5).normalize();
        pos.toArray(positions, 3 * i);
        dir.toArray(directions, 3 * i);
    }

    return {
        count: count,
        positions: positions,
        directions: directions,
        cells: cells,
    };
}

// Initialise a boids grid between lower and upper with size elements per dimension with capacity slots each
function initBoidGrid(lower: Vector3, upper: Vector3, size: Vector3, capacity: number): BoidGrid {
    const dims = new Vector3(
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
}

// Initialise the default set of boid parameters
function initBoidParams(): BoidParams {
    return {
        speed: 60.0,

        separationRadius: 25.0,
        alignmentRadius: 50.0,
        cohesionRadius: 50.0,

        separationStrength: 4.0,
        alignmentStrength: 6.0,
        cohesionStrength: 1.0,
    };
}

// Initialise a flock of boids with sim params and backing grid
function initBoids(count: number): Boids {
    const lower = new Vector3(-0.5, -0.5, -0.5).multiplyScalar(1000.0);
    const upper = new Vector3(0.5, 0.5, 0.5).multiplyScalar(1000.0);
    const size = new Vector3(0.075, 0.075, 0.075).multiplyScalar(1000.0);

    return {
        params: initBoidParams(),
        flock: initBoidFlock(lower, upper, count),
        grid: initBoidGrid(lower, upper, size, 8),
    };
}

// Reset the contents of the nearest neighbour grid
function resetBoidGrid(grid: BoidGrid) {
    for (let i = 0; i < grid.counts.length; i++) {
        grid.counts[i] = 0;
    }
}

// Insert id at position into the nearest neighbour grid
function insertBoidGrid(grid: BoidGrid, position: Vector3, id: number): number {
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
}

// Index the first n boids
function indexBoids(boids: Boids, n: number) {
    resetBoidGrid(boids.grid);

    let pos = new Vector3();
    for (let i = 0; i < n; i += 1) {
        pos.fromArray(boids.flock.positions, 3 * i);
        boids.flock.cells[i] = insertBoidGrid(boids.grid, pos, i);
    }
}

// Update directions by interacting the first n boids
function interactBoids(boids: Boids, n: number) {
    const posI = new Vector3();
    const posJ = new Vector3();
    const dirI = new Vector3();
    const dirJ = new Vector3();

    const dirIJ = new Vector3();
    const vec = new Vector3();

    for (let i = 0; i < n; i++) {
        posI.fromArray(boids.flock.positions, 3 * i);
        dirI.fromArray(boids.flock.directions, 3 * i);

        const cell = boids.flock.cells[i];
        const count = boids.grid.counts[cell];
        const start = cell * boids.grid.capacity;
        const end = cell * boids.grid.capacity + count;

        for (let slot = start; slot < end; slot++) {
            const j = boids.grid.values[slot];
            if (i == j) continue;

            posJ.fromArray(boids.flock.positions, 3 * j);
            dirJ.fromArray(boids.flock.directions, 3 * j);

            dirIJ.subVectors(posI, posJ);
            const dist = dirIJ.length();
            dirIJ.divideScalar(dist);

            const separation = boids.params.separationStrength * Number(dist < boids.params.separationRadius);
            const alignment = boids.params.alignmentStrength * Number(dist < boids.params.alignmentRadius);
            const cohesion = boids.params.cohesionStrength * Number(dist < boids.params.cohesionRadius);

            dirI.add(vec.copy(dirIJ).multiplyScalar(separation));
            dirI.add(vec.copy(dirJ).multiplyScalar(alignment));
            dirI.add(vec.copy(dirIJ).multiplyScalar(-cohesion));
        }
        
        dirI.normalize();
        dirI.toArray(boids.flock.directions, 3 * i);
    }
}

// Move the first n boids by euler integration
function moveBoids(boids: Boids, n: number, deltaTime: number) {
    let pos = new Vector3();
    let dir = new Vector3();

    for (let i = 0; i < n; i++) {
        pos.fromArray(boids.flock.positions, 3 * i);
        dir.fromArray(boids.flock.directions, 3 * i);
        dir.multiplyScalar(boids.params.speed * deltaTime);
        pos.add(dir);

        pos.x += 1000.0 * Number(pos.x < -500.0) - 1000.0 * Number(pos.x > 500.0);
        pos.y += 1000.0 * Number(pos.y < -500.0) - 1000.0 * Number(pos.y > 500.0);
        pos.z += 1000.0 * Number(pos.z < -500.0) - 1000.0 * Number(pos.z > 500.0);

        pos.toArray(boids.flock.positions, 3 * i);
    }
}

// Update the first n boids
function updateBoids(boids: Boids, n: number, deltaTime: number) {
    indexBoids(boids, n);
    interactBoids(boids, n);
    moveBoids(boids, n, deltaTime);
}

// Update transform matrices for the first n instances
function updateInstances(boids: Boids, instances: THREE.InstancedMesh, n: number) {
    let pos = new Vector3();
    let dir = new Vector3();
    let scale = new Vector3(1.25, 1.25, 1.25);
    let quat = new Quaternion();
    let mat = new Matrix4();
    let vFrom = new Vector3(0, -1.0, 0);

    for (let i = 0; i < n; i++) {
        pos.fromArray(boids.flock.positions, 3 * i);
        dir.fromArray(boids.flock.directions, 3 * i);
        quat.setFromUnitVectors(vFrom, dir);

        mat.compose(pos, quat, scale);
        instances.setMatrixAt(i, mat);
    }

    instances.count = n;
    instances.instanceMatrix.needsUpdate = true;
}

export { Boids, initBoids, updateBoids, updateInstances };