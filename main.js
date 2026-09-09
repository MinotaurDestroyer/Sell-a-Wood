let money = 0;
let woodInventory = 0;
const MAX_CAPACITY = 200;
let unlockedItems = { about: false, personal: false, skills: false, cert: false };

const itemImages = {
    about: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80',
    personal: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
    skills: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
    cert: 'https://images.unsplash.com/photo-1589330694653-ded6df03f754?auto=format&fit=crop&w=800&q=80'
};

window.openImageModal = function(itemKey) {
    const modal = document.getElementById('imageModal');
    const img = document.getElementById('modalImage');
    if (modal && img && itemImages[itemKey]) {
        img.src = itemImages[itemKey];
        modal.style.display = 'flex';
    }
};

window.closeImageModal = function() {
    const modal = document.getElementById('imageModal');
    if (modal) modal.style.display = 'none';
};

function loadGameProgress() {
    const savedMoney = localStorage.getItem('lumber_money');
    const savedWood = localStorage.getItem('lumber_wood');
    const savedUnlocked = localStorage.getItem('lumber_unlocked');

    if (savedMoney !== null) {
        money = parseInt(savedMoney, 10);
        document.getElementById('money').innerText = money;
    }

    if (savedWood !== null) {
        woodInventory = parseInt(savedWood, 10);
        document.getElementById('woodCount').innerText = woodInventory;
    }

    if (savedUnlocked !== null) {
        unlockedItems = JSON.parse(savedUnlocked);
        Object.keys(unlockedItems).forEach(item => {
            if (unlockedItems[item]) {
                const btn = document.getElementById(`btn-${item}`);
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = "VIEW";
                    btn.style.backgroundColor = "#2e8b57";
                    btn.onclick = () => window.openImageModal(item);
                }
            }
        });
    }
}

function saveGameProgress() {
    localStorage.setItem('lumber_money', money);
    localStorage.setItem('lumber_wood', woodInventory);
    localStorage.setItem('lumber_unlocked', JSON.stringify(unlockedItems));
}

window.buyItem = function(item, price) {
    if (unlockedItems[item]) {
        window.openImageModal(item);
        return;
    }

    if (money >= price) {
        money -= price;
        document.getElementById('money').innerText = money;
        unlockedItems[item] = true;

        const btn = document.getElementById(`btn-${item}`);
        if (btn) {
            btn.disabled = false;
            btn.innerText = "VIEW";
            btn.style.backgroundColor = "#2e8b57";
            btn.onclick = () => window.openImageModal(item);
        }

        saveGameProgress();
        window.openImageModal(item);
    }
};

window.closeShop = function() {
    document.getElementById('shopModal').style.display = 'none';
};

window.addEventListener('DOMContentLoaded', () => {
    let scene, camera, renderer, world;
    let player, environment;
    let logs = [];

    let sunLight, moonLight, ambientLight, hemiLight;
    let sunGroup, moonGroup, sunCore, sunCorona, moonCore, moonCorona;
    let skyMesh, skyMaterial, starsMesh, starsMaterial;
    let dayTime = 0; 
    let lastTime = performance.now();
    
    const CYCLE_DURATION_MS = 480000; 

    const promptUI = document.getElementById('prompt');
    const moneyUI = document.getElementById('money');
    const woodCountUI = document.getElementById('woodCount');

    // ---------- Procedural texture helpers ----------

    function createGlowTexture(innerColor, outerColor) {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, innerColor);
        grad.addColorStop(0.4, innerColor);
        grad.addColorStop(1, outerColor);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }

    function createMoonTexture() {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#dbe6f2';
        ctx.fillRect(0, 0, size, size);

        // Soft global shading (subtle terminator, light from upper-left)
        const shade = ctx.createRadialGradient(size * 0.35, size * 0.32, size * 0.1, size * 0.5, size * 0.5, size * 0.75);
        shade.addColorStop(0, 'rgba(255,255,255,0.35)');
        shade.addColorStop(1, 'rgba(120,140,170,0.35)');
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, size, size);

        // Craters
        for (let i = 0; i < 40; i++) {
            const r = 3 + Math.random() * 14;
            const x = Math.random() * size;
            const y = Math.random() * size;
            const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
            grad.addColorStop(0, 'rgba(150,165,185,0.6)');
            grad.addColorStop(0.7, 'rgba(120,138,160,0.35)');
            grad.addColorStop(1, 'rgba(120,138,160,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Fine maria (dark patches)
        for (let i = 0; i < 6; i++) {
            const r = 20 + Math.random() * 30;
            const x = Math.random() * size;
            const y = Math.random() * size;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, 'rgba(150,160,175,0.25)');
            grad.addColorStop(1, 'rgba(150,160,175,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }

        return new THREE.CanvasTexture(canvas);
    }

    function createSkyDome() {
        const geo = new THREE.SphereGeometry(450, 20, 14);
        skyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTopColor: { value: new THREE.Color(0x2b5fa8) },
                uBottomColor: { value: new THREE.Color(0xbcdcf0) },
                uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
                uSunColor: { value: new THREE.Color(0xfff2d0) },
                uSunVisibility: { value: 1.0 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uTopColor;
                uniform vec3 uBottomColor;
                uniform vec3 uSunDirection;
                uniform vec3 uSunColor;
                uniform float uSunVisibility;
                varying vec3 vWorldPosition;

                void main() {
                    vec3 dir = normalize(vWorldPosition);
                    float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
                    vec3 sky = mix(uBottomColor, uTopColor, pow(h, 0.55));

                    // Warm glow / halo around the sun & horizon haze
                    float sunAmount = clamp(dot(dir, normalize(uSunDirection)), 0.0, 1.0);
                    float glow = pow(sunAmount, 6.0) * 0.6 + pow(sunAmount, 32.0) * 1.4;
                    sky += uSunColor * glow * uSunVisibility;

                    // Ground-level haze near the horizon
                    float haze = smoothstep(0.5, 0.48, h) * (1.0 - h * 1.5);
                    sky = mix(sky, uSunColor, clamp(haze, 0.0, 1.0) * 0.15 * uSunVisibility);

                    gl_FragColor = vec4(sky, 1.0);
                }
            `,
            side: THREE.BackSide,
            depthWrite: false,
            fog: false
        });

        skyMesh = new THREE.Mesh(geo, skyMaterial);
        skyMesh.renderOrder = -1;
        skyMesh.userData.noCollide = true;
        scene.add(skyMesh);
    }

    function createStars() {
        const starCount = 1000;
        const positions = new Float32Array(starCount * 3);
        const seeds = new Float32Array(starCount);

        for (let i = 0; i < starCount; i++) {
            const radius = 420;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(1 - Math.random() * 0.92); // bias toward upper hemisphere-ish, still varied

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = Math.abs(radius * Math.cos(phi)) * 0.85 + radius * 0.05;
            positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
            seeds[i] = Math.random() * 10.0;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));

        const starTex = createGlowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');

        starsMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uOpacity: { value: 0.0 },
                uTexture: { value: starTex }
            },
            vertexShader: `
                attribute float seed;
                uniform float uTime;
                varying float vTwinkle;
                void main() {
                    vTwinkle = 0.6 + 0.4 * sin(uTime * 1.5 + seed * 6.28);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = (1.3 + mod(seed, 2.0)) * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D uTexture;
                uniform float uOpacity;
                varying float vTwinkle;
                void main() {
                    vec4 tex = texture2D(uTexture, gl_PointCoord);
                    gl_FragColor = vec4(vec3(1.0), tex.a * uOpacity * vTwinkle);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false
        });

        starsMesh = new THREE.Points(geo, starsMaterial);
        starsMesh.renderOrder = -1;
        starsMesh.userData.noCollide = true;
        scene.add(starsMesh);
    }

    function init() {
        scene = new THREE.Scene();
        
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.rotation.order = 'YXZ';
        camera.position.set(0, 2, 5);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25;
        document.body.appendChild(renderer.domElement);

        world = new CANNON.World();
        world.gravity.set(0, -15, 0);

        ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
        scene.add(ambientLight);

        hemiLight = new THREE.HemisphereLight(0x8fc4ff, 0x4a6b3a, 0.5);
        scene.add(hemiLight);

        sunLight = new THREE.DirectionalLight(0xfff8e7, 1.6);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 1024;
        sunLight.shadow.mapSize.height = 1024;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 150;
        sunLight.shadow.bias = -0.0015;
        const d = 40;
        sunLight.shadow.camera.left = -d;
        sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d;
        sunLight.shadow.camera.bottom = -d;
        scene.add(sunLight);
        scene.add(sunLight.target);

        // ---- Sky, stars, sun & moon ----
        createSkyDome();
        createStars();

        const sunGlowTex = createGlowTexture('rgba(255,244,214,1)', 'rgba(255,180,80,0)');
        const moonGlowTex = createGlowTexture('rgba(220,235,255,1)', 'rgba(140,180,255,0)');
        const moonTexture = createMoonTexture();

        sunGroup = new THREE.Group();
        sunCore = new THREE.Mesh(
            new THREE.SphereGeometry(4, 32, 32),
            new THREE.MeshBasicMaterial({ color: 0xfff0a8, fog: false })
        );
        sunGroup.add(sunCore);

        const sunGlow = new THREE.Mesh(
            new THREE.SphereGeometry(5.4, 32, 32),
            new THREE.MeshBasicMaterial({
                color: 0xffe066,
                transparent: true,
                opacity: 0.4,
                side: THREE.BackSide,
                blending: THREE.AdditiveBlending,
                fog: false
            })
        );
        sunGroup.add(sunGlow);

        // Soft billboard corona for a realistic hazy, bright sun disc
        sunCorona = new THREE.Sprite(new THREE.SpriteMaterial({
            map: sunGlowTex,
            color: 0xffddaa,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false
        }));
        sunCorona.scale.set(26, 26, 1);
        sunGroup.add(sunCorona);
        sunGroup.userData.noCollide = true;
        scene.add(sunGroup);

        moonLight = new THREE.DirectionalLight(0x88bbff, 0.2);
        scene.add(moonLight);
        scene.add(moonLight.target);

        moonGroup = new THREE.Group();
        moonCore = new THREE.Mesh(
            new THREE.SphereGeometry(3, 32, 32),
            new THREE.MeshBasicMaterial({ map: moonTexture, fog: false })
        );
        moonGroup.add(moonCore);

        const moonGlow = new THREE.Mesh(
            new THREE.SphereGeometry(3.7, 32, 32),
            new THREE.MeshBasicMaterial({
                color: 0x99ccff,
                transparent: true,
                opacity: 0.3,
                side: THREE.BackSide,
                blending: THREE.AdditiveBlending,
                fog: false
            })
        );
        moonGroup.add(moonGlow);

        moonCorona = new THREE.Sprite(new THREE.SpriteMaterial({
            map: moonGlowTex,
            color: 0xaad0ff,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false
        }));
        moonCorona.scale.set(14, 14, 1);
        moonGroup.add(moonCorona);
        moonGroup.userData.noCollide = true;
        scene.add(moonGroup);

        player = new PlayerController(camera, scene);
        environment = new EnvironmentManager(scene, world);
        environment.spawnTrees(35);

        loadGameProgress();
        initInteractions();

        // Responsive window & mobile screen resize handler
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        animate();
    }

    // Reused color helpers for the day/night cycle
    const _skyTopDay = new THREE.Color(0x2b6fc4);
    const _skyBottomDay = new THREE.Color(0xbfe0f5);
    const _skyTopDusk = new THREE.Color(0x1a2652);
    const _skyBottomDusk = new THREE.Color(0xf08a3c);
    const _skyTopNight = new THREE.Color(0x02040f);
    const _skyBottomNight = new THREE.Color(0x0a1030);
    const _fogDay = new THREE.Color(0x9fd0ea);
    const _fogDusk = new THREE.Color(0xe08a4a);
    const _fogNight = new THREE.Color(0x060812);
    const _sunColorHigh = new THREE.Color(0xfff3d4);
    const _sunColorHorizon = new THREE.Color(0xff7a33);
    const _tmpTop = new THREE.Color();
    const _tmpBottom = new THREE.Color();
    const _tmpFog = new THREE.Color();
    const _tmpSunColor = new THREE.Color();
    const _tmpSunDir = new THREE.Vector3();

    function updateDayNightCycle() {
        const currentTime = performance.now();
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;

        dayTime += (deltaTime / CYCLE_DURATION_MS) * (Math.PI * 2);
        if (dayTime > Math.PI * 2) dayTime -= Math.PI * 2;

        const radius = 80;
        const sunX = Math.cos(dayTime) * radius;
        const sunY = Math.sin(dayTime) * radius;

        sunLight.position.set(sunX, sunY, 30);
        sunLight.target.position.set(0, 0, 30);
        sunGroup.position.set(sunX, sunY, 30);

        moonLight.position.set(-sunX, -sunY, -30);
        moonLight.target.position.set(0, 0, -30);
        moonGroup.position.set(-sunX, -sunY, -30);

        const sunHeight = Math.sin(dayTime);
        // how close the sun is to the horizon (1 = right at horizon, 0 = zenith/deep night)
        const horizonFactor = 1.0 - Math.min(1.0, Math.abs(sunHeight) / 0.35);
        const clampedHorizon = Math.max(0, horizonFactor);

        // Sun/moon visual color: warm & large near the horizon, pale & tighter near zenith
        _tmpSunColor.copy(_sunColorHorizon).lerp(_sunColorHigh, 1 - clampedHorizon);
        sunCore.material.color.copy(_tmpSunColor);
        sunCorona.material.color.copy(_tmpSunColor);
        const sunScale = 22 + clampedHorizon * 20;
        sunCorona.scale.set(sunScale, sunScale, 1);
        sunGroup.visible = sunHeight > -0.18;

        moonGroup.visible = sunHeight < 0.18;
        const moonScale = 12 + clampedHorizon * 10;
        moonCorona.scale.set(moonScale, moonScale, 1);

        _tmpSunDir.set(sunX, sunY, 30).normalize();

        if (sunHeight > 0.1) {
            _tmpTop.copy(_skyTopDay);
            _tmpBottom.copy(_skyBottomDay);
            _tmpFog.copy(_fogDay);
            ambientLight.intensity = 0.6;
            hemiLight.intensity = 0.55;
            sunLight.intensity = 1.6;
            moonLight.intensity = 0;
            renderer.toneMappingExposure = 1.2;
            starsMaterial.uniforms.uOpacity.value = 0;
        } else if (sunHeight > -0.1) {
            const t = (sunHeight + 0.1) / 0.2;
            _tmpTop.copy(_skyTopDusk).lerp(_skyTopDay, t);
            _tmpBottom.copy(_skyBottomDusk).lerp(_skyBottomDay, t);
            _tmpFog.copy(_fogDusk).lerp(_fogDay, t);
            ambientLight.intensity = 0.18 + (t * 0.42);
            hemiLight.intensity = 0.2 + t * 0.35;
            sunLight.intensity = t * 1.3;
            moonLight.intensity = (1 - t) * 0.2;
            renderer.toneMappingExposure = 0.65 + (t * 0.55);
            starsMaterial.uniforms.uOpacity.value = (1 - t) * 0.5;
        } else {
            const nightT = Math.min(1, (-sunHeight - 0.1) / 0.3);
            _tmpTop.copy(_skyTopDusk).lerp(_skyTopNight, nightT);
            _tmpBottom.copy(_skyBottomDusk).lerp(_skyBottomNight, nightT);
            _tmpFog.copy(_fogDusk).lerp(_fogNight, nightT);
            ambientLight.intensity = 0.14;
            hemiLight.intensity = 0.12;
            sunLight.intensity = 0;
            moonLight.intensity = 0.35;
            renderer.toneMappingExposure = 0.7;
            starsMaterial.uniforms.uOpacity.value = 0.5 + nightT * 0.5;
        }

        scene.background = _tmpFog.clone();
        scene.fog = new THREE.Fog(_tmpFog.getHex(), 20, 110);

        skyMaterial.uniforms.uTopColor.value.copy(_tmpTop);
        skyMaterial.uniforms.uBottomColor.value.copy(_tmpBottom);
        skyMaterial.uniforms.uSunDirection.value.copy(_tmpSunDir);
        skyMaterial.uniforms.uSunColor.value.copy(_tmpSunColor);
        skyMaterial.uniforms.uSunVisibility.value = Math.max(0, Math.min(1, (sunHeight + 0.3) / 0.5));

        starsMaterial.uniforms.uTime.value += deltaTime * 0.001;
    }

    function executeChopAction() {
        if (document.getElementById('shopModal').style.display === 'flex' || document.getElementById('imageModal').style.display === 'flex') return;

        player.swingAxe();

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const intersects = raycaster.intersectObjects(scene.children, true);

        if (intersects.length > 0 && intersects[0].distance < 6) {
            const hit = intersects[0].object;
            environment.trees.forEach((tree, idx) => {
                if (tree.group.children.includes(hit)) {
                    tree.health--;

                    hit.material.color.setHex(0xff3333);
                    setTimeout(() => { hit.material.color.setHex(0xffffff); }, 120);

                    const cutMesh = new THREE.Mesh(
                        new THREE.BoxGeometry(0.5, 0.1, 0.5),
                        new THREE.MeshBasicMaterial({ color: 0x2b1d0c })
                    );
                    cutMesh.position.set(0, 1.5 + (tree.health * 0.4), 0.3);
                    tree.group.add(cutMesh);

                    if (tree.health <= 0) {
                        const treeX = tree.x;
                        const treeZ = tree.z;

                        const leavesMeshes = tree.group.children.filter(child => child.geometry instanceof THREE.ConeGeometry);

                        scene.remove(tree.group);
                        environment.trees.splice(idx, 1);

                        spawnFallingLeaves(treeX, treeZ, leavesMeshes);
                        spawnLog(treeX, 1.2, treeZ);
                        spawnLog(treeX, 2.4, treeZ);
                    }
                }
            });
        }
    }

    function initInteractions() {
        // Desktop Click Interaction
        document.addEventListener('click', (e) => {
            if (e.target.closest('#touch-controls')) return;
            if (player.isLocked) executeChopAction();
        });

        // Touch Action Button Events
        const btnAction = document.getElementById('btn-touch-action');
        if (btnAction) {
            btnAction.addEventListener('touchstart', (e) => {
                e.preventDefault();
                executeChopAction();
                pickUpLogToInventory();
            });
        }

        const btnInteract = document.getElementById('btn-touch-interact');
        if (btnInteract) {
            btnInteract.addEventListener('touchstart', (e) => {
                e.preventDefault();
                handleShopInteractions();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && (player.isLocked || player.isTouchDevice)) e.preventDefault();
            if (e.code === 'KeyE' && (player.isLocked || player.isTouchDevice)) pickUpLogToInventory();
            if (e.code === 'KeyF' && (player.isLocked || player.isTouchDevice)) handleShopInteractions();
        });
    }

    function spawnFallingLeaves(x, z, leafMeshes) {
        const scatteredLeaves = [];

        leafMeshes.forEach((leafMesh, i) => {
            const leafCopy = leafMesh.clone();
            leafCopy.position.set(x, 4.2 + (i * 1.6), z);
            scene.add(leafCopy);

            const angle = Math.random() * Math.PI * 2;
            const scatterSpeed = 0.05 + Math.random() * 0.08;

            scatteredLeaves.push({
                mesh: leafCopy,
                velY: -0.05 - Math.random() * 0.03,
                velX: Math.cos(angle) * scatterSpeed,
                velZ: Math.sin(angle) * scatterSpeed,
                rotX: (Math.random() - 0.5) * 0.05,
                rotZ: (Math.random() - 0.5) * 0.05,
                opacity: 1.0
            });
        });

        const animateLeaves = () => {
            let activeCount = 0;

            scatteredLeaves.forEach(leaf => {
                if (leaf.mesh.position.y > 0.5) {
                    leaf.mesh.position.y += leaf.velY;
                    leaf.mesh.position.x += leaf.velX;
                    leaf.mesh.position.z += leaf.velZ;

                    leaf.mesh.rotation.x += leaf.rotX;
                    leaf.mesh.rotation.z += leaf.rotZ;
                    activeCount++;
                } else {
                    if (leaf.mesh.material) {
                        leaf.mesh.material.transparent = true;
                        leaf.mesh.material.opacity -= 0.015;

                        if (leaf.mesh.material.opacity > 0) {
                            activeCount++;
                        } else {
                            scene.remove(leaf.mesh);
                        }
                    }
                }
            });

            if (activeCount > 0) {
                requestAnimationFrame(animateLeaves);
            }
        };

        animateLeaves();
    }

    function handleShopInteractions() {
        const woodNPCWorldPos = new THREE.Vector3();
        environment.npcMesh.getWorldPosition(woodNPCWorldPos);

        const portfolioNPCWorldPos = new THREE.Vector3();
        environment.portfolioNPCMesh.getWorldPosition(portfolioNPCWorldPos);

        const distToWoodNPC = camera.position.distanceTo(woodNPCWorldPos);
        const distToPortfolioNPC = camera.position.distanceTo(portfolioNPCWorldPos);

        if (distToWoodNPC < 6) {
            sellAllInventoryToNPC();
        }

        if (distToPortfolioNPC < 6) {
            if (document.pointerLockElement) document.exitPointerLock();
            document.getElementById('shopModal').style.display = 'flex';
        }
    }

    function spawnLog(x, y, z) {
        const logGeo = new THREE.CylinderGeometry(0.3, 0.3, 2, 8);
        const mesh = new THREE.Mesh(
            logGeo,
            new THREE.MeshLambertMaterial({ map: environment.barkTexture })
        );
        mesh.castShadow = true;

        const logEdges = new THREE.EdgesGeometry(logGeo);
        const whiteLine = new THREE.LineSegments(
            logEdges,
            new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 })
        );
        mesh.add(whiteLine);

        const glowGeo = new THREE.CylinderGeometry(0.32, 0.32, 2.02, 8);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.25,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending
        });
        const glowMesh = new THREE.Mesh(glowGeo, glowMat);
        mesh.add(glowMesh);

        scene.add(mesh);

        const shape = new CANNON.Cylinder(0.3, 0.3, 2, 8);
        const body = new CANNON.Body({ 
            mass: 2.5,
            linearDamping: 0.4,
            angularDamping: 0.5
        });

        const qShape = new CANNON.Quaternion();
        qShape.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        body.addShape(shape, new CANNON.Vec3(), qShape);

        body.position.set(x, y + 0.3, z);

        const qBody = new CANNON.Quaternion();
        qBody.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 2);
        body.quaternion.copy(qBody);

        const angle = Math.random() * Math.PI * 2;
        const speed = 1.2 + Math.random() * 0.8;
        body.velocity.set(Math.cos(angle) * speed, 1.0, Math.sin(angle) * speed);
        body.angularVelocity.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);

        world.addBody(body);
        logs.push({ mesh, body });
    }

    function pickUpLogToInventory() {
        if (woodInventory >= MAX_CAPACITY) return;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        const intersects = raycaster.intersectObjects(logs.map(l => l.mesh));

        if (intersects.length > 0 && intersects[0].distance < 6) {
            const hitMesh = intersects[0].object;
            const targetLog = logs.find(l => l.mesh === hitMesh);

            if (targetLog) {
                scene.remove(targetLog.mesh);
                world.remove(targetLog.body);
                const idx = logs.indexOf(targetLog);
                if (idx > -1) logs.splice(idx, 1);

                woodInventory += 1;
                woodCountUI.innerText = woodInventory;
                saveGameProgress();
            }
        }
    }

    function sellAllInventoryToNPC() {
        if (woodInventory > 0) {
            const earnings = woodInventory * 75;
            money += earnings;
            woodInventory = 0;

            moneyUI.innerText = money;
            woodCountUI.innerText = woodInventory;
            saveGameProgress();
        }
    }

    function animate() {
        requestAnimationFrame(animate);

        world.step(1 / 60);

        updateDayNightCycle();

        if (environment) {
            environment.updateClouds();
            const sunDir = sunLight.position.clone().normalize();
            const sunColorForGrass = sunLight.intensity > 0 ? sunCore.material.color : new THREE.Color(0x4a5a8a);
            const grassSunIntensity = Math.max(sunLight.intensity, moonLight.intensity * 0.6, 0.15);
            environment.updateGrass(0.016, sunDir, sunColorForGrass, ambientLight.intensity, grassSunIntensity);
        }

        if (document.getElementById('shopModal').style.display !== 'flex' && document.getElementById('imageModal').style.display !== 'flex') {
            player.update();
        }

        logs.forEach(log => {
            log.mesh.position.copy(log.body.position);
            log.mesh.quaternion.copy(log.body.quaternion);
        });

        if (player.isLocked || player.isTouchDevice) {
            const woodNPCWorldPos = new THREE.Vector3();
            environment.npcMesh.getWorldPosition(woodNPCWorldPos);
            const distToWoodNPC = camera.position.distanceTo(woodNPCWorldPos);

            const portfolioNPCWorldPos = new THREE.Vector3();
            environment.portfolioNPCMesh.getWorldPosition(portfolioNPCWorldPos);
            const distToPortfolioNPC = camera.position.distanceTo(portfolioNPCWorldPos);

            if (distToWoodNPC < 6) {
                promptUI.innerText = woodInventory > 0 
                    ? `Tap or Press [F] to sell all ${woodInventory} logs for $${woodInventory * 75}`
                    : "No logs in inventory to sell!";
                promptUI.style.display = 'block';
            } else if (distToPortfolioNPC < 6) {
                promptUI.innerText = "Tap or Press [F] to open Info & Resume Shop";
                promptUI.style.display = 'block';
            } else {
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
                const intersects = raycaster.intersectObjects(logs.map(l => l.mesh));

                if (intersects.length > 0 && intersects[0].distance < 6) {
                    promptUI.innerText = woodInventory < MAX_CAPACITY 
                        ? "Tap Action or Press [E] to collect log" 
                        : "Inventory Full! (200/200)";
                    promptUI.style.display = 'block';
                } else {
                    promptUI.style.display = 'none';
                }
            }
        }

        renderer.render(scene, camera);
    }

    init();
});
