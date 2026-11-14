import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ArrowUpRight, Compass, Globe2, RotateCcw, ScanLine, ZoomIn, ZoomOut } from "lucide-react";
import { sites, type SiteId } from "../lib/sites";

type Props = {
  selected: SiteId;
  onSelect: (id: SiteId) => void;
};

type StageStatus = "initializing" | "ready" | "fallback";

const radius = 2.34;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function earthPosition(latitude: number, longitude: number, distance: number) {
  const lat = latitude * Math.PI / 180;
  const lon = longitude * Math.PI / 180;
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon) * distance,
    Math.sin(lat) * distance,
    -Math.cos(lat) * Math.sin(lon) * distance
  );
}

function sitePosition(id: SiteId, distance: number) {
  const site = sites.find(item => item.id === id) ?? sites[0];
  return earthPosition(site.coordinates[1], site.coordinates[0], distance);
}

export default function EarthGlobe({ selected, onSelect }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const pins = useRef<Record<string, HTMLButtonElement | null>>({});
  const focusSite = useRef<(id: SiteId) => void>(() => {});
  const zoomGlobe = useRef<(direction: number) => void>(() => {});
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  const [status, setStatus] = useState<StageStatus>("initializing");
  const [textureLoaded, setTextureLoaded] = useState(false);
  const [rotationEnabled, setRotationEnabled] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [textureUnavailable, setTextureUnavailable] = useState(false);
  const rotatingRef = useRef(true);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => {
    selectedRef.current = selected;
    focusSite.current(selected);
  }, [selected]);
  useEffect(() => { rotatingRef.current = rotationEnabled; }, [rotationEnabled]);

  useEffect(() => {
    const root = host.current;
    if (!root) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      setStatus("fallback");
      return;
    }

    const width = Math.max(1, root.clientWidth);
    const height = Math.max(1, root.clientHeight);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setClearColor(0x020a11, 0);
    renderer.domElement.className = "earth-canvas";
    renderer.domElement.setAttribute("aria-label", "Draggable textured 3D Earth model showing NASA research locations");
    renderer.domElement.setAttribute("role", "img");
    root.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 90);
    camera.position.set(0, 0, 8.4);
    camera.lookAt(0, 0, 0);

    const world = new THREE.Group();
    scene.add(world);

    const earthMaterial = new THREE.MeshStandardMaterial({
      color: 0xd1e2e8,
      roughness: 1,
      metalness: 0
    });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(radius, 112, 80), earthMaterial);
    world.add(planet);

    let dayTexture: THREE.Texture | null = null;
    let disposed = false;
    const loader = new THREE.TextureLoader();
    loader.load("/earth-day-2048.jpg", texture => {
      if (disposed) {
        texture.dispose();
        return;
      }
      dayTexture = texture;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      earthMaterial.color.setHex(0xffffff);
      earthMaterial.map = texture;
      earthMaterial.needsUpdate = true;
      setTextureLoaded(true);
    }, undefined, () => {
      if (!disposed) { setTextureLoaded(false); setTextureUnavailable(true); }
    });

    scene.add(new THREE.AmbientLight(0x718eaf, 1.23));
    const sunlight = new THREE.DirectionalLight(0xfff6df, 2.45);
    sunlight.position.set(-5.5, 4.1, 7);
    scene.add(sunlight);
    const blueFill = new THREE.DirectionalLight(0x3aa7dd, 0.62);
    blueFill.position.set(5, -3, -1);
    scene.add(blueFill);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.076, 90, 56),
      new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            float f = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 4.1);
            gl_FragColor = vec4(0.13, 0.53, 0.91, f * 0.57);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide
      })
    );
    world.add(atmosphere);

    const geoMaterial = new THREE.LineBasicMaterial({ color: 0x90dbe1, transparent: true, opacity: 0.13, depthWrite: false });
    for (let lat = -60; lat <= 60; lat += 30) {
      const points = [];
      for (let lon = -180; lon <= 180; lon += 4) points.push(earthPosition(lat, lon, radius * 1.007));
      world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), geoMaterial));
    }
    for (let lon = -150; lon <= 180; lon += 30) {
      const points = [];
      for (let lat = -89; lat <= 89; lat += 3) points.push(earthPosition(lat, lon, radius * 1.009));
      world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), geoMaterial));
    }

    const siteObjects = sites.map(site => {
      const position = sitePosition(site.id, radius * 1.045);
      const outer = new THREE.Mesh(
        new THREE.SphereGeometry(0.041, 16, 12),
        new THREE.MeshBasicMaterial({ color: site.id === selectedRef.current ? 0xffdf9f : 0x94f9f0 })
      );
      outer.position.copy(position);
      world.add(outer);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.122, 0.008, 8, 48),
        new THREE.MeshBasicMaterial({ color: 0x8fe6f0, transparent: true, opacity: 0.77, depthWrite: false })
      );
      ring.position.copy(position);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize());
      world.add(ring);
      return { id: site.id, position, outer, ring };
    });

    const starCoords = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      starCoords[i * 3] = (Math.random() - 0.5) * 54;
      starCoords[i * 3 + 1] = (Math.random() - 0.5) * 45;
      starCoords[i * 3 + 2] = -9 - Math.random() * 21;
    }
    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute("position", new THREE.BufferAttribute(starCoords, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0xb9dbe5, size: 0.039, sizeAttenuation: true, transparent: true, opacity: 0.72, depthWrite: false });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    let targetYaw = 0.26;
    let targetPitch = -0.1;
    let cameraDistance = 8.4;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastInteraction = performance.now();
    let animationFrame = 0;
    let animationRunning = true;
    let inViewport = true;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduceMotion = motionQuery.matches;
    const onMotionChange = (event: MediaQueryListEvent) => { reduceMotion = event.matches; };
    motionQuery.addEventListener("change", onMotionChange);
    let widthCurrent = width;
    let heightCurrent = height;

    function lookAtSite(id: SiteId) {
      const position = sitePosition(id, 1);
      let nextYaw = Math.atan2(-position.x, position.z);
      while (nextYaw - targetYaw > Math.PI) nextYaw -= Math.PI * 2;
      while (nextYaw - targetYaw < -Math.PI) nextYaw += Math.PI * 2;
      targetYaw = nextYaw;
      targetPitch = clamp(Math.asin(position.y), -0.72, 0.72);
      cameraDistance = Math.min(cameraDistance, 7.1);
      lastInteraction = performance.now();
    }
    focusSite.current = lookAtSite;
    zoomGlobe.current = direction => {
      cameraDistance = clamp(cameraDistance + direction * 0.85, 5.6, 10);
      lastInteraction = performance.now();
    };

    world.rotation.y = targetYaw;
    world.rotation.x = targetPitch;
    lookAtSite(selectedRef.current);

    function down(event: PointerEvent) {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      renderer.domElement.setPointerCapture(event.pointerId);
      lastInteraction = performance.now();
    }
    function move(event: PointerEvent) {
      if (!dragging) return;
      targetYaw += (event.clientX - lastX) * 0.0048;
      targetPitch = clamp(targetPitch + (event.clientY - lastY) * 0.0037, -0.92, 0.92);
      lastX = event.clientX;
      lastY = event.clientY;
      lastInteraction = performance.now();
    }
    function up() { dragging = false; }
    function wheel(event: WheelEvent) {
      event.preventDefault();
      cameraDistance = clamp(cameraDistance + event.deltaY * 0.006, 5.5, 10.6);
      lastInteraction = performance.now();
    }
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", up);
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });

    const resizeObserver = new ResizeObserver(() => {
      if (!root.isConnected) return;
      widthCurrent = Math.max(1, root.clientWidth);
      heightCurrent = Math.max(1, root.clientHeight);
      camera.aspect = widthCurrent / heightCurrent;
      camera.updateProjectionMatrix();
      renderer.setSize(widthCurrent, heightCurrent);
    });
    resizeObserver.observe(root);

    const coords = new THREE.Vector3();
    function updateVisibility() {
      const shouldRun = !disposed && inViewport && !document.hidden;
      if (shouldRun === animationRunning) return;
      animationRunning = shouldRun;
      if (shouldRun) animationFrame = requestAnimationFrame(frame);
      else cancelAnimationFrame(animationFrame);
    }
    const visibilityObserver = new IntersectionObserver(entries => {
      inViewport = entries[0]?.isIntersecting ?? true;
      updateVisibility();
    });
    visibilityObserver.observe(root);
    document.addEventListener("visibilitychange", updateVisibility);
    function frame(time: number) {
      if (disposed || !animationRunning) return;
      if (!dragging && !reduceMotion && rotatingRef.current && time - lastInteraction > 15000) targetYaw += 0.00035;
      world.rotation.y += (targetYaw - world.rotation.y) * 0.075;
      world.rotation.x += (targetPitch - world.rotation.x) * 0.075;
      camera.position.z += (cameraDistance - camera.position.z) * 0.06;
      siteObjects.forEach((item, index) => {
        const active = selectedRef.current === item.id;
        const pulse = reduceMotion ? 1 : 1 + Math.sin(time * 0.0025 + index) * 0.13;
        item.ring.scale.setScalar(active ? pulse * 1.45 : pulse);
        (item.ring.material as THREE.MeshBasicMaterial).color.setHex(active ? 0xffdf9f : 0x8fe6f0);
        (item.outer.material as THREE.MeshBasicMaterial).color.setHex(active ? 0xffe0a9 : 0x86e3e7);
        const element = pins.current[item.id];
        if (!element) return;
        coords.copy(item.position).applyEuler(world.rotation);
        const visible = coords.z > 0.14;
        coords.project(camera);
        element.style.left = `${((coords.x + 1) / 2) * widthCurrent}px`;
        element.style.top = `${((1 - coords.y) / 2) * heightCurrent}px`;
        element.style.opacity = visible ? "1" : "0";
        element.style.pointerEvents = visible ? "auto" : "none";
        element.style.transform = "translate(-50%, -50%)";
      });
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(frame);
    }
    animationFrame = requestAnimationFrame(frame);
    setStatus("ready");

    return () => {
      disposed = true;
      animationRunning = false;
      cancelAnimationFrame(animationFrame);
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
      motionQuery.removeEventListener("change", onMotionChange);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointercancel", up);
      renderer.domElement.removeEventListener("wheel", wheel);
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });
      dayTexture?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const active = sites.find(site => site.id === selected) ?? sites[0];

  return (
    <div className="earth-stage" role="region" aria-label="Interactive three dimensional Earth research explorer">
      <div className="earth-stage-top">
        <span><ScanLine size={13} /> NASA POWER / MERRA-2</span>
        <span className="earth-stage-utc">BLUE MARBLE / GEOGRAPHIC REFERENCE</span>
      </div>
      <div className="earth-render-host" ref={host}>
        {status === "fallback" && (
          <div className="earth-static-fallback">
            <img src="/world-map.svg" alt="World landmasses and study regions" />
            <span>3D graphics unavailable on this device. Use the location selector below.</span>
          </div>
        )}
        {status !== "fallback" && sites.map(site => (
          <button
            key={site.id}
            className={`earth-site-pin ${selected === site.id ? "earth-pin-active" : ""}`}
            ref={node => { pins.current[site.id] = node; }}
            onClick={() => { focusSite.current(site.id); onSelectRef.current(site.id); }}
            aria-label={`Focus ${site.name}, ${site.country}`}
            type="button"
          >
            <span className="earth-pin-dot" />
            <span className="earth-pin-label">{site.name.toUpperCase()}</span>
          </button>
        ))}
        <div className="earth-crosshair earth-crosshair-top" />
        <div className="earth-crosshair earth-crosshair-bottom" />
        <div className="earth-scanline" aria-hidden="true" />
      </div>
      <div className="earth-left-rail">
        <div className="earth-rail-title"><span className="earth-live-indicator" /> {textureUnavailable ? "EARTH TEXTURE UNAVAILABLE" : textureLoaded ? "BLUE MARBLE REFERENCE READY" : "LOADING EARTH IMAGERY"}</div>
        <div className="earth-rail-selected"><small>SELECTED REGION</small><strong>{active.name}</strong><span>{active.region} / {active.country}</span></div>
        <div className="earth-rail-coordinates">
          <span>{Math.abs(active.coordinates[1]).toFixed(3)}°{active.coordinates[1] >= 0 ? "N" : "S"}</span>
          <span>{Math.abs(active.coordinates[0]).toFixed(3)}°{active.coordinates[0] >= 0 ? "E" : "W"}</span>
        </div>
      </div>
      <div className="earth-right-rail">
        <button type="button" title="Zoom in" aria-label="Zoom globe in" onClick={() => zoomGlobe.current(-1)}><ZoomIn size={17} /></button>
        <button type="button" title="Zoom out" aria-label="Zoom globe out" onClick={() => zoomGlobe.current(1)}><ZoomOut size={17} /></button>
        <button type="button" title="Focus selected site" aria-label="Focus selected site" onClick={() => focusSite.current(selected)}><Compass size={17} /></button>
        <button type="button" title="Toggle auto-rotation" aria-label="Toggle globe auto rotation" aria-pressed={rotationEnabled} onClick={() => setRotationEnabled(value => !value)}><RotateCcw size={16} /></button>
      </div>
      <div className="earth-stage-bottom">
        <span><Globe2 size={14} /> DRAG TO ROTATE / SCROLL TO ZOOM</span>
        <span>{String(sites.length).padStart(2, "0")} RESEARCH LOCATIONS <ArrowUpRight size={13} /></span>
      </div>
      <div className="earth-location-strip" role="group" aria-label="Research study locations">
        {sites.map(site => (
          <button type="button" key={site.id} className={selected === site.id ? "earth-location-active" : ""} onClick={() => { focusSite.current(site.id); onSelectRef.current(site.id); }}>
            <small>{site.index}</small>
            <span>{site.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
