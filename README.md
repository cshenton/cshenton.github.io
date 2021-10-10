# cshenton.github.io

Source for my github.io site. This is a simple, but quite fast, boids implementation in Typescript.

![Screenshot](img/screenshot.png)

I originally wrote this when learning JS properly for the first time, to see if I could get reasonably good cache
coherency by sticking to native arrays in JS, and being paranoid about heap allocations. This is a typescript 
rewrite of that original code.

## Simulation

Implementation in `src/boids.ts`. This is a fairly basic boids implementation which uses a static grid for nearest
neighbour lookups. Native JS arrays are used instead of objects to improve cache coherency and performance of
the simulation. Grid is implemented a basic raster order 3D array of counts and boid indexes for lookups.

Wrap around at simulation boundaries is used to keep simulation code simple.

## Rendering

Rendering is quite simple, just a programmer art mesh assembled at runtime, which is then rendered for the
full set of fish with an instanced draw call to prevent GPU-CPU driver overhead at this scale. Previous implementations
used a "low poly" fish model, which proved to be a bottleneck on low end devices. In reality I should use model LODs
to improve appearance while maintaining perf, but I wanted to keep the code simple.

## Improvements

Unfortunately, since I sped up this code a bit, the 50k fish count on higher end machines appears to cause the 
alignment behavior to eventually dominate and degenerate the overall look of the simulation. I could add a
"homing" influence to counteract this.
