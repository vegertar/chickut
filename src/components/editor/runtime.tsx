const frame =
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : setImmediate;

export default class Runtime {}
