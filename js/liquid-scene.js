import * as THREE from 'three';

// Geometria e riflessi calcolati nel browser. Le reference non sono asset della scena.
const hero = document.getElementById('home');
const canvas = document.getElementById('webgl-hero');
if (hero && canvas) {
  try { createLiquidRoom(); }
  catch (error) {
    hero.classList.add('no-webgl');
    console.error('Hero WebGL:', error);
  }
}

function createLiquidRoom() {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 700px)').matches;
  const smooth = (a, b, t) => THREE.MathUtils.smoothstep(t, a, b);
  const mix = THREE.MathUtils.lerp;
  const hash = (x, y) => {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    let u = x - ix, v = y - iy;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    return mix(mix(hash(ix, iy), hash(ix + 1, iy), u),
      mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v);
  };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(0xffffff, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  // Posizione e orientamento della camera non cambiano durante la sequenza.
  const frameHeight = 16 * Math.tan(Math.PI / 8);
  const roomHeight = frameHeight * 0.53, doorHeight = frameHeight * 0.38;
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 35);
  camera.position.set(0, frameHeight * 0.21, 8);
  camera.lookAt(0, camera.position.y, 0);
  let roomWidth = 10, doorWidth = 1.1;
  const exposure = { value: 2.4 }, halfWidth = { value: 5 };

  function roomMaterial(kind) {
    return new THREE.ShaderMaterial({
      side: THREE.DoubleSide, toneMapped: false,
      uniforms: { uExposure: exposure, uHalfWidth: halfWidth,
        uHeight: { value: roomHeight }, uKind: { value: kind } },
      vertexShader: `
        varying vec3 vRoom;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vRoom = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: `
        varying vec3 vRoom;
        uniform float uExposure, uHalfWidth, uHeight, uKind;
        void main() {
          float edge = pow(clamp(abs(vRoom.x) / uHalfWidth, 0.0, 1.0), 8.0);
          float ceilingContact = exp(-max(0.0, uHeight - vRoom.y) * 3.6);
          float shade = 0.72 - 0.20 * ceilingContact - 0.075 * edge
                       - 0.028 * exp(-max(vRoom.y, 0.0) * 5.0);
          if (uKind == 1.0) shade = 0.91 - 0.17 * exp(-vRoom.z * 1.8);
          if (uKind == 2.0) shade = 0.65 - 0.10 * ceilingContact + 0.13 * min(vRoom.z / 5.0, 1.0);
          if (uKind == 3.0) shade = 0.91 + 0.09 * (1.0 - exp(-vRoom.z * 2.0));
          if (uKind == 4.0) shade = 0.83 - 0.05 * ceilingContact;
          if (uKind == 5.0) shade = 0.56;
          gl_FragColor = vec4(vec3(min(1.0, shade * uExposure)), 1.0);
          #include <colorspace_fragment>
        }`,
    });
  }
  function plane(material) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    scene.add(mesh);
    return mesh;
  }
  const back = plane(roomMaterial(0));
  back.position.set(0, roomHeight / 2, 0);
  const floor = plane(roomMaterial(1));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 5;
  const ceiling = plane(roomMaterial(3));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, roomHeight, 5);
  const sides = [-1, 1].map(sign => {
    const mesh = plane(roomMaterial(2));
    mesh.rotation.y = sign * Math.PI / 2;
    mesh.scale.set(10, roomHeight, 1);
    mesh.position.set(sign * roomWidth / 2, roomHeight / 2, 5);
    return mesh;
  });
  const door = plane(new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false }));
  door.position.set(0, doorHeight / 2, 0.012);
  const leaf = plane(roomMaterial(4)), leafEdge = plane(roomMaterial(5));

  // Soffitto luminoso tridimensionale: PMREM viene generato in memoria.
  const environmentScene = new THREE.Scene();
  environmentScene.background = new THREE.Color(0x888888);
  const lightPanel = new THREE.Mesh(new THREE.PlaneGeometry(7, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.6, 2.6), side: THREE.DoubleSide }));
  lightPanel.rotation.x = Math.PI / 2;
  lightPanel.position.set(0, 4, 0.4);
  environmentScene.add(lightPanel);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let reflection;
  function updateEnvironment() {
    reflection?.dispose();
    reflection = pmrem.fromScene(environmentScene, 0.12, 0.1, 30);
    scene.environment = reflection.texture;
  }
  updateEnvironment();
  const detailTime = { value: 0 }, detailStrength = { value: 0.008 };
  const liquid = new THREE.MeshPhysicalMaterial({
    color: 0x000000, metalness: 0, roughness: 0.22, clearcoat: 0.4,
    clearcoatRoughness: 0.15, envMapIntensity: 1, transmission: 0, transparent: false,
  });
  // Normali fini oltre alle deformazioni geometriche. Il bianco proviene
  // esclusivamente dalla riflessione: nessuna maschera o trasparenza del liquido.
  liquid.onBeforeCompile = shader => {
    shader.uniforms.uLiquidTime = detailTime;
    shader.uniforms.uLiquidDetail = detailStrength;
    shader.vertexShader = 'varying vec3 vLiquidPoint;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvLiquidPoint = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = `
      varying vec3 vLiquidPoint;
      uniform float uLiquidTime, uLiquidDetail;
      float hashLiquid(vec2 p) {
        vec3 q = fract(vec3(p.xyx) * 0.1031);
        q += dot(q, q.yzx + 33.33);
        return fract((q.x + q.y) * q.z);
      }
      float noiseLiquid(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hashLiquid(i), hashLiquid(i + vec2(1.0, 0.0)), f.x),
                   mix(hashLiquid(i + vec2(0.0, 1.0)), hashLiquid(i + 1.0), f.x), f.y);
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      vec2 fluidUV = vec2(vLiquidPoint.x + vLiquidPoint.y * 0.43,
                         vLiquidPoint.z + vLiquidPoint.y * 0.77);
      vec2 advection = vec2(0.19, -0.43) * uLiquidTime;
      float folds = noiseLiquid(fluidUV * 14.0 + advection)
                  + 0.44 * noiseLiquid(fluidUV * 31.0 - advection * 0.7)
                  + 0.18 * noiseLiquid(fluidUV * 67.0 + advection * 1.3);
      float heightDetail = folds * uLiquidDetail;
      vec3 sigmaX = dFdx(-vViewPosition), sigmaY = dFdy(-vViewPosition);
      vec3 r1 = cross(sigmaY, normal), r2 = cross(normal, sigmaX);
      float determinant = dot(sigmaX, r1);
      vec3 gradient = sign(determinant) * (dFdx(heightDetail) * r1 + dFdy(heightDetail) * r2);
      normal = normalize(abs(determinant) * normal - gradient);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <clearcoat_normal_fragment_maps>',
      '#include <clearcoat_normal_fragment_maps>\n#ifdef USE_CLEARCOAT\nclearcoatNormal = normal;\n#endif');
  };
  const dropMaterial = liquid.clone();

  function closedSurface(columns, rows, sheet = false) {
    const count = (columns + 1) * (rows + 1);
    const positions = new Float32Array(count * 6), indices = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i, b = a + 1, c = a + columns + 1, d = c + 1;
      indices.push(a, c, b, b, c, d, a + count, b + count, c + count, b + count, d + count, c + count);
    }
    const edge = [];
    for (let i = 0; i <= columns; i++) edge.push(i);
    for (let j = 1; j <= rows; j++) edge.push(j * (columns + 1) + columns);
    for (let i = columns - 1; i >= 0; i--) edge.push(rows * (columns + 1) + i);
    for (let j = rows - 1; j > 0; j--) edge.push(j * (columns + 1));
    edge.forEach((a, i) => {
      const b = edge[(i + 1) % edge.length];
      indices.push(a, b, a + count, b, b + count, a + count);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, liquid);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const point = [0, 0, 0];
    return { mesh, update(sample) {
      for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
        sample(i / columns, j / rows, point);
        const n = j * (columns + 1) + i, a = n * 3, b = (n + count) * 3;
        positions[a] = positions[b] = point[0];
        positions[a + 1] = point[1];
        positions[b + 1] = sheet ? point[1] : 0.003;
        positions[a + 2] = point[2];
        positions[b + 2] = sheet ? point[2] - 0.025 : point[2];
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
    }};
  }
  const pool = closedSurface(mobile ? 64 : 104, mobile ? 60 : 94);

  // Sezioni orizzontali di un volume chiuso, con nucleo verticale e base svasata.
  function createStream() {
    const columns = mobile ? 48 : 80, rows = mobile ? 50 : 76;
    const count = (columns + 1) * (rows + 1);
    const positions = new Float32Array((count + 2) * 3), indices = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < columns; i++) {
        const a = j * (columns + 1) + i, c = a + columns + 1;
        indices.push(a, c, a + 1, a + 1, c, c + 1);
      }
      const a = j * (columns + 1), b = a + columns, c = a + columns + 1, d = c + columns;
      indices.push(a, b, c, b, d, c);
    }
    for (let i = 0; i < columns; i++) {
      indices.push(count, i, i + 1);
      const a = rows * (columns + 1) + i;
      indices.push(count + 1, a + 1, a);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, liquid);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { update({ height, base, top, depth, activity, time, bias }) {
      for (let j = 0; j <= rows; j++) {
        const v = j / rows;
        const width = mix(top, base, Math.pow(1 - v, 2.2 + activity * 0.8));
        const thickness = mix(0.045 + activity * 0.22, depth, Math.pow(1 - v, 2.5));
        for (let i = 0; i <= columns; i++) {
          const angle = i / columns * Math.PI;
          const flow = v * 10 + time * 0.75;
          const folds = noise(angle * 3.5, flow) - 0.5
                      + 0.42 * (noise(angle * 8.3 + 9, flow * 2.1) - 0.5)
                      + 0.2 * (noise(angle * 17.1, flow * 4.3 + 5) - 0.5);
          const crumple = (0.045 + activity * 0.27) * folds * Math.sin(Math.PI * v * 0.9)
                        * Math.min(1, camera.aspect / 1.1);
          const cap = activity * Math.pow(v, 7) * 0.17 * (noise(angle * 5.4, time * 0.5) - 0.5);
          const n = (j * (columns + 1) + i) * 3;
          positions[n] = bias - activity * 0.17 * doorWidth * v * v + Math.max(0.006, width + crumple) * Math.cos(angle);
          positions[n + 1] = 0.07 + height * v + cap;
          positions[n + 2] = 0.035 + Math.max(0.018, thickness + crumple * 1.1) * Math.sin(angle);
        }
      }
      positions.set([bias, 0.005, 0.035], count * 3);
      positions.set([bias - activity * 0.17 * doorWidth, height + 0.045, 0.06], (count + 1) * 3);
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
    }};
  }
  const stream = createStream();
  const crowns = [-1, 1, 1].map(() => closedSurface(mobile ? 36 : 60, mobile ? 14 : 20, true));
  // Filamenti sottili collegati alle corone: archi di liquido con sezione tonda.
  // Condividono un'unica geometria, senza generare oggetti a ogni fotogramma.
  const strandCount = 7, strandSegments = 18, strandSides = 6;
  const strandPositions = new Float32Array(strandCount * (strandSegments + 1) * (strandSides + 1) * 3);
  const strandIndices = [];
  for (let k = 0; k < strandCount; k++) for (let j = 0; j < strandSegments; j++) {
    for (let i = 0; i < strandSides; i++) {
      const a = (k * (strandSegments + 1) + j) * (strandSides + 1) + i;
      const b = a + strandSides + 1;
      strandIndices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const strandGeometry = new THREE.BufferGeometry();
  strandGeometry.setAttribute('position', new THREE.BufferAttribute(strandPositions, 3).setUsage(THREE.DynamicDrawUsage));
  strandGeometry.setIndex(strandIndices);
  const strands = new THREE.Mesh(strandGeometry, liquid);
  strands.frustumCulled = false;
  scene.add(strands);
  let seed = 31871;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const dropStates = Array.from({ length: mobile ? 160 : 300 }, (_, i) => ({
    side: random() < 0.53 ? -1 : 1,
    born: i < 12 ? 2.6 + random() * 1.2 : 3.7 + random() * 4.2,
    along: random(), origin: random(), outward: 0.15 + random() * 0.95,
    speed: 0.7 + random() * 1.65, forward: random() * 0.7,
    radius: 0.008 + Math.pow(random(), 2.8) * 0.035,
    foreground: i > (mobile ? 153 : 293),
  }));
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 10), dropMaterial, dropStates.length);
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  drops.frustumCulled = false;
  scene.add(drops);
  const dummy = new THREE.Object3D();

  function render(time) {
    if (time < 0.8) {
      hero.dataset.scene = 'white';
      renderer.clear();
      return;
    }
    const settled = smooth(8, 12.5, time);
    const lateralScale = Math.min(1, camera.aspect / 1.1);
    const activity = smooth(2.8, 5.8, time) * (1 - smooth(7.7, 10.3, time));
    const build = smooth(1.4, 5.8, time);
    const liquidTime = time <= 8 ? time * 0.72
      : time < 12.5 ? 5.76 + 0.72 * (time - 8) - (0.64 / 9) * (time - 8) ** 2
      : 7.56 + (time - 12.5) * 0.08;
    detailTime.value = liquidTime;
    detailStrength.value = mix(0.003 + activity * 0.004, 0.0025, settled);
    exposure.value = mix(2.4, 1, smooth(4.4, 6.6, time));
    liquid.envMapIntensity = mix(0.45, 0.5, settled);
    liquid.roughness = mix(0.22, 0.25, settled);
    dropMaterial.envMapIntensity = liquid.envMapIntensity;
    hero.dataset.scene = time < 2 ? 'opening' : time < 3.5 ? 'spreading'
      : time < 5.8 ? 'growing' : time < 8 ? 'surge' : time < 10 ? 'collapse'
      : time < 12.5 ? 'settling' : 'settled';

    // Il bordo sinistro dell'apertura rimane fermo, come nelle tre reference.
    const opening = mix(0.05 / 0.095, 1, smooth(1.8, 3.5, time));
    door.scale.set(doorWidth * opening, doorHeight, 1);
    door.position.x = -doorWidth * (1 - opening) / 2;
    const leafWidth = doorWidth * mix(0.05, 0.82, smooth(2.8, 4.8, time));
    leaf.scale.set(leafWidth, doorHeight, 1);
    leaf.position.set(doorWidth * 0.5 + leafWidth / 2, doorHeight / 2, 0.025);
    leafEdge.scale.set(doorWidth * 0.015, doorHeight, 1);
    leafEdge.position.set(doorWidth * 0.5 + leafWidth, doorHeight / 2, 0.028);

    const filling = smooth(7.2, 10.2, time);
    const left = mix(doorWidth * 0.4, roomWidth * 0.34, smooth(1.0, 6.4, time));
    const right = mix(doorWidth * 0.24, roomWidth * 0.3, smooth(2.0, 7.0, time));
    const depth = mix(0.2, 3.7, smooth(1.1, 7.1, time)) + filling * 4.9;
    pool.update((u, v, p) => {
      const across = u * 2 - 1, oval = Math.sqrt(Math.max(0, 1 - across * across));
      const lobes = 0.16 * (noise(u * 12.7, liquidTime * 0.24) - 0.5)
                  + 0.045 * (noise(u * 39.1, liquidTime * 0.17) - 0.5);
      const outline = mix(0.22 + oval * 0.78 + lobes * oval, 1, filling);
      const waist = mix(Math.pow(Math.sin(Math.PI * (0.07 + v * 0.86)), 0.6), 1, filling);
      const x = mix(-mix(left, roomWidth * 0.55, filling), mix(right, roomWidth * 0.55, filling), u) * waist;
      const z = 0.025 + v * depth * outline;
      const warp = noise(x * 1.7, z * 1.3 + liquidTime * 0.23) * 3;
      const waves = (noise(x * 7.4 + warp, z * 8.7 - liquidTime * 0.5) - 0.5)
                  + 0.45 * (noise(x * 15.1, z * 16.7 + liquidTime * 0.4) - 0.5)
                  + 0.2 * (noise(x * 30.2 + 7, z * 32.4 - liquidTime * 0.24) - 0.5);
      const rings = Math.sin(Math.hypot(x + 0.13, z) * 14 - liquidTime * 1.7 + warp)
                  * Math.exp(-Math.hypot(x, z) * 0.6);
      const edge = Math.pow(Math.max(0, Math.sin(Math.PI * u) * Math.sin(Math.PI * v)), 0.24);
      const amplitude = mix(0.04 + activity * 0.05, 0.065, settled);
      p[0] = x + door.position.x * (1 - build);
      p[1] = 0.01 + edge * (0.09 + amplitude * (waves + rings * 0.15));
      p[2] = z;
    });
    const baseWidth = mix(doorWidth * 0.24, frameHeight * camera.aspect * 0.07, build) + activity * doorWidth * 0.52;
    stream.update({
      height: mix(0.012, frameHeight * 0.27, build) + activity * frameHeight * 0.108,
      base: baseWidth,
      top: doorWidth * mix(0.10, 0.46, activity),
      depth: mix(0.12, 0.64, build) + activity * 0.65,
      activity, time: liquidTime, bias: mix(door.position.x, -doorWidth * 0.14, build),
    });
    crowns.forEach((crown, i) => {
      const foreground = i === 2;
      const amount = foreground ? smooth(6.8, 7.5, time) * (1 - smooth(8, 9.2, time))
        : smooth(3.3 + i * 0.25, 5.9 + i * 0.16, time) * (1 - smooth(7.8, 9.5, time));
      crown.mesh.visible = amount > 0.002;
      if (!crown.mesh.visible) return;
      crown.update((u, v, p) => {
        const angle = Math.PI * ((i === 0 ? 0.55 : 0.05) + u * 0.4);
        const teeth = 0.15 + 0.95 * Math.pow(noise(u * 13.1 + i * 3, liquidTime * 0.45), 2)
                    + 0.45 * Math.pow(noise(u * 31, liquidTime * 0.7), 3);
        const fan = Math.pow(Math.sin(Math.PI * u), 0.4);
        const radius = baseWidth * 0.77 + v * 0.85 * lateralScale * amount;
        p[0] = foreground ? roomWidth * 0.18 + ((u - 0.5) * 0.85 + v * 0.18) * lateralScale * amount
          : Math.cos(angle) * radius - doorWidth * 0.14;
        p[1] = 0.065 + amount * Math.sin(v * 2.45) * fan * teeth * (foreground ? 1.45 : 0.65);
        p[2] = foreground ? 2.25 + v * 0.65 * amount
          : 0.08 + Math.sin(angle) * radius * 0.75 + v * v * 0.16 * amount;
      });
    });
    strands.visible = time > 4.2 && time < 9.5;
    if (strands.visible) {
      for (let k = 0; k < strandCount; k++) {
        const side = k % 2 ? 1 : -1;
        const amount = smooth(4.2 + k * 0.24, 5.4 + k * 0.24, time) * (1 - smooth(7.6 + k * 0.08, 9.4, time));
        const x0 = side * baseWidth * (0.54 + (k % 3) * 0.12) - doorWidth * 0.14;
        const y0 = 0.12 + (k % 3) * 0.04;
        const z0 = 0.45 + (k % 3) * 0.26;
        const reach = side * (0.16 + noise(k, liquidTime * 0.3) * 0.4) * amount * lateralScale;
        const lift = amount * (0.3 + (k % 3) * 0.2);
        for (let j = 0; j <= strandSegments; j++) {
          const u = j / strandSegments;
          const x = x0 + reach * u + amount * u * 0.035 * lateralScale * (noise(u * 7 + k, liquidTime * 0.6) - 0.5);
          const y = y0 + lift * (2.8 * u * (1 - u) + u * (0.2 + (k % 2) * 0.3));
          const z = z0 + amount * u * (0.35 + k * 0.035);
          const tangentX = reach, tangentY = lift * (2.8 * (1 - 2 * u) + 0.2 + (k % 2) * 0.3);
          const length = Math.hypot(tangentX, tangentY) || 1;
          const radius = amount * (0.013 - u * 0.011) * lateralScale;
          for (let i = 0; i <= strandSides; i++) {
            const angle = i / strandSides * Math.PI * 2;
            const n = ((k * (strandSegments + 1) + j) * (strandSides + 1) + i) * 3;
            strandPositions[n] = x - tangentY / length * Math.cos(angle) * radius;
            strandPositions[n + 1] = y + tangentX / length * Math.cos(angle) * radius;
            strandPositions[n + 2] = z + Math.sin(angle) * radius;
          }
        }
      }
      strandGeometry.attributes.position.needsUpdate = true;
      strandGeometry.computeVertexNormals();
    }
    drops.visible = time > 2.6 && time < 10.6;
    if (drops.visible) {
      dropStates.forEach((d, i) => {
        const birth = d.foreground ? 7.2 + d.along * 0.7 : d.born;
        const age = time - birth;
        const drag = age >= 0 ? (1 - Math.exp(-age * 0.35)) / 0.35 : 0;
        const sourceHeight = d.foreground ? 0.9 : 0.15 + smooth(2.8, 5.8, birth) * (0.55 + d.along * 0.65);
        const y = sourceHeight + d.speed * age - 2.3 * age * age;
        const radius = d.radius * (d.foreground ? 2 : 1) * lateralScale;
        const alive = age >= 0 && age < 2.5 && y > 0.1 + radius;
        const x = d.foreground ? roomWidth * 0.18 + d.outward * drag * 0.4 * lateralScale
          : d.side * (doorWidth * (0.42 + d.origin * 0.62) + d.outward * drag * lateralScale);
        const z = d.foreground ? 2.6 + drag * 0.55 : 0.55 + d.along * 0.65 + d.forward * drag;
        dummy.position.set(x, y, z);
        dummy.scale.setScalar(alive ? radius : 0);
        dummy.updateMatrix();
        drops.setMatrixAt(i, dummy.matrix);
      });
      drops.instanceMatrix.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }

  let raf = 0, started = 0, elapsed = 0;
  let visible = false, running = false, contextLost = false;
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    raf = 0; started = 0; elapsed = 0;
    hero.dataset.scene = 'white';
    if (!contextLost) renderer.clear();
  }
  function frame() {
    if (!running) return;
    elapsed = (performance.now() - started) / 1000;
    render(elapsed);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (!visible || document.hidden || running || contextLost) return;
    if (motion.matches) {
      elapsed = 12.5;
      render(elapsed);
      return;
    }
    running = true;
    started = performance.now();
    render(0);
    raf = requestAnimationFrame(frame);
  }
  function resize() {
    const width = hero.clientWidth, height = hero.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, width <= 700 ? 1.25 : 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    roomWidth = frameHeight * camera.aspect * 0.88;
    doorWidth = frameHeight * camera.aspect * 0.095;
    halfWidth.value = roomWidth / 2;
    back.scale.set(roomWidth, roomHeight, 1);
    floor.scale.set(roomWidth, 10, 1);
    ceiling.scale.set(roomWidth, 10, 1);
    sides.forEach((mesh, i) => { mesh.position.x = (i === 0 ? -1 : 1) * roomWidth / 2; });
    if (!contextLost) render(visible ? elapsed : 0);
  }
  resize();
  renderer.compile(scene, camera);
  new ResizeObserver(resize).observe(hero);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && entry.intersectionRect.height > 0;
    if (visible) start(); else stop();
  }, { threshold: [0, 0.001] }).observe(hero);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', () => {
    stop();
    const bounds = hero.getBoundingClientRect();
    visible = bounds.bottom > 0 && bounds.top < innerHeight;
    start();
  });
  motion.addEventListener('change', () => { stop(); start(); });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); contextLost = true; stop();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false; updateEnvironment(); resize(); start();
  });
}
