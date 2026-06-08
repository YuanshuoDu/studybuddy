/**
 * Runtime placeholder for the type-only declarations in `fastify.d.ts`.
 * This file exists so that the side-effect import `import './fastify.d.js'`
 * resolves at runtime. TypeScript strips the original `declare module`
 * blocks (they're types only) but Node still needs a JS file to import.
 */
export {};
