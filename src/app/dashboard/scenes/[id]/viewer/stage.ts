/**
 * Shared Three.js plumbing for both viewer canvases: renderer, camera, orbit
 * controls, resize handling, the render loop, and teardown.
 *
 * Both renderers need identical setup and identical disposal — a WebGL context
 * that outlives its canvas is a real leak, and browsers cap how many are alive
 * at once, so switching outputs a few times without disposing goes black.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type Stage = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  /** Move the camera so `box` fills a comfortable part of the frame. */
  frame: (box: THREE.Box3) => void;
  /** Return to the framing chosen by the last `frame()` call. */
  reset: () => void;
  dispose: () => void;
};

export type StageOptions = {
  /**
   * MSAA. Worth it for mesh edges; Spark explicitly wants it off for splats,
   * where it costs a lot of fill rate and buys nothing.
   */
  antialias?: boolean;
  /**
   * Tone mapping. ACES suits PBR meshes lit by an environment; splat colours
   * are already display-referred, so mapping them again dulls the capture.
   */
  toneMapping?: boolean;
};

/**
 * The stage creates and owns its own <canvas> inside `container` rather than
 * taking one from JSX. Disposal force-loses the GL context, and a force-lost
 * context cannot be re-acquired from the same canvas element — which React
 * StrictMode's mount/unmount/mount would do on every dev render. Owning the
 * element means each stage gets a genuinely fresh context.
 */
export function createStage(
  container: HTMLElement,
  { antialias = true, toneMapping = true }: StageOptions = {},
): Stage {
  const canvas = document.createElement("canvas");
  canvas.className = "block h-full w-full touch-none";
  container.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias,
    alpha: true,
    preserveDrawingBuffer: false,
  });
  // Cap DPR: phones report 3+, and splat fill-rate is the bottleneck there.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = toneMapping
    ? THREE.ACESFilmicToneMapping
    : THREE.NoToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
  camera.position.set(0, 0, 3);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.6;
  controls.panSpeed = 0.6;
  // Touch: one finger orbits, two fingers pan/zoom (OrbitControls defaults).
  controls.screenSpacePanning = true;

  let home: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;

  const frame = (box: THREE.Box3) => {
    if (box.isEmpty()) return;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;

    // Distance that fits `radius` in the vertical FOV, with a little margin.
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const distance = (radius / Math.sin(fov / 2)) * 1.35;

    camera.near = Math.max(distance / 1000, 0.001);
    camera.far = distance * 100;
    camera.updateProjectionMatrix();

    // Slightly above and off-axis reads as "3D" immediately on first paint.
    camera.position.copy(center).add(
      new THREE.Vector3(distance * 0.6, distance * 0.4, distance * 0.7),
    );
    controls.target.copy(center);
    controls.update();

    home = { pos: camera.position.clone(), target: controls.target.clone() };
  };

  const reset = () => {
    if (!home) return;
    camera.position.copy(home.pos);
    controls.target.copy(home.target);
    controls.update();
  };

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();

  const observer = new ResizeObserver(resize);
  observer.observe(container);

  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    controls.update();
    renderer.render(scene, camera);
  };
  tick();

  const dispose = () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
    controls.dispose();
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach(disposeMaterial);
      else if (mat) disposeMaterial(mat);
    });
    scene.clear();
    renderer.dispose();
    // Drop the GL context explicitly; `renderer.dispose()` alone can leave it
    // alive until GC, and the browser's context budget is small. Safe only
    // because the canvas goes with it.
    renderer.forceContextLoss();
    canvas.remove();
  };

  return { renderer, scene, camera, controls, frame, reset, dispose };
}

function disposeMaterial(material: THREE.Material) {
  for (const value of Object.values(material)) {
    if (value && typeof value === "object" && "isTexture" in value) {
      (value as THREE.Texture).dispose();
    }
  }
  material.dispose();
}

/** Bounding box of an object, or an empty box when it has no geometry. */
export function boundsOf(object: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(object);
}
