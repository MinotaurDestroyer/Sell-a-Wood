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

    let sunLight, moonLight, ambientLight;
    let sunGroup, moonGroup;
    let dayTime = 0; 
    let lastTime = performance.now();
    
    const CYCLE_DURATION_MS = 480000; 

    const promptUI = document.getElementById('prompt');
    const moneyUI = document.getElementById('money');
    const woodCountUI = document.getElementById('woodCount');

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

        ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
        scene.add(ambientLight);

        sunLight = new THREE.DirectionalLight(0xfff8e7, 1.6);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 1024;
        sunLight.shadow.mapSize.height = 1024;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 150;
        const d = 40;
        sunLight.shadow.camera.left = -d;
        sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d;
        sunLight.shadow.camera.bottom = -d;
        scene.add(sunLight);

        sunGroup = new THREE.Group();
        const sunCore = new THREE.Mesh(
            new THREE.SphereGeometry(4, 32, 32),
            new THREE.MeshBasicMaterial({ color: 0xfff0a8 })
        );
        const sunGlow = new THREE.Mesh(
            new THREE.SphereGeometry(5.2, 32, 32),
            new THREE.MeshBasicMaterial({
                color: 0xffe066,
                transparent: true,
                opacity: 0.45,
                side: THREE.BackSide,
                blending: THREE.AdditiveBlending
            })
        );
        sunGroup.add(sunCore);
        sunGroup.add(sunGlow);
        scene.add(sunGroup);

        moonLight = new THREE.DirectionalLight(0x88bbff, 0.2);
        scene.add(moonLight);

        moonGroup = new THREE.Group();
        const moonCore = new THREE.Mesh(
            new THREE.SphereGeometry(3, 32, 32),
            new THREE.MeshBasicMaterial({ color: 0xe6f2ff })
        );
        const moonGlow = new THREE.Mesh(
            new THREE.SphereGeometry(3.9, 32, 32),
            new THREE.MeshBasicMaterial({
                color: 0x99ccff,
                transparent: true,
                opacity: 0.35,
                side: THREE.BackSide,
                blending: THREE.AdditiveBlending
            })
        );
        moonGroup.add(moonCore);
        moonGroup.add(moonGlow);
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
        sunGroup.position.set(sunX, sunY, 30);

        moonLight.position.set(-sunX, -sunY, -30);
        moonGroup.position.set(-sunX, -sunY, -30);

        const sunHeight = Math.sin(dayTime);

        if (sunHeight > 0.1) {
            scene.background = new THREE.Color(0x7ec0ee); 
            scene.fog = new THREE.Fog(0x7ec0ee, 20, 110);
            ambientLight.intensity = 0.7;
            sunLight.intensity = 1.6;
            moonLight.intensity = 0;
            renderer.toneMappingExposure = 1.25;
        } else if (sunHeight > -0.1) {
            const t = (sunHeight + 0.1) / 0.2;
            scene.background = new THREE.Color().lerpColors(new THREE.Color(0x0a0a1a), new THREE.Color(0xe67e22), t);
            scene.fog = new THREE.Fog(scene.background, 15, 90);
            ambientLight.intensity = 0.15 + (t * 0.55);
            sunLight.intensity = t * 1.2;
            moonLight.intensity = (1 - t) * 0.2;
            renderer.toneMappingExposure = 0.6 + (t * 0.65);
        } else {
            scene.background = new THREE.Color(0x08081a); 
            scene.fog = new THREE.Fog(0x08081a, 15, 80);
            ambientLight.intensity = 0.12; 
            sunLight.intensity = 0;
            moonLight.intensity = 0.35; 
            renderer.toneMappingExposure = 0.75; 
        }
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
            environment.updateGrass(0.016);
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
