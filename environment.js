class EnvironmentManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.trees = [];
        this.clouds = [];
        this.npcMesh = null;
        this.portfolioNPCMesh = null;

        this.barkTexture = this.createBarkTexture();
        this.leavesTexture = this.createLeavesTexture();

        this.createGround();
        this.createGrassField();
        this.createClouds();
        this.createShopAndNPC();
        this.createPortfolioShopAndNPC();
        this.createOuterBuildings();
    }

    createBarkTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#5c4033'; ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#3d281c';
        for (let i = 0; i < 20; i++) {
            ctx.fillRect(Math.random() * 128, 0, 3 + Math.random() * 3, 128);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 2);
        return texture;
    }

    createLeavesTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1e5631'; ctx.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 300; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#143d22' : '#2d7a46';
            ctx.fillRect(Math.random() * 128, Math.random() * 128, 6, 6);
        }
        return new THREE.CanvasTexture(canvas);
    }

    createGroundTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Base soil-green tone with soft mottling for a natural, uneven field
        ctx.fillStyle = '#3a7a45';
        ctx.fillRect(0, 0, 512, 512);

        // Broad soft patches (dry/lush variation)
        for (let i = 0; i < 90; i++) {
            const r = 20 + Math.random() * 60;
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const shade = Math.random() > 0.5
                ? `rgba(74, 141, 74, ${0.10 + Math.random() * 0.12})`
                : `rgba(58, 100, 45, ${0.10 + Math.random() * 0.15})`;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, shade);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }

        // Fine grain / dirt speckle for close-up texture detail
        for (let i = 0; i < 4000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const v = Math.random();
            ctx.fillStyle = v > 0.5
                ? `rgba(20, 50, 20, ${0.05 + Math.random() * 0.1})`
                : `rgba(120, 150, 90, ${0.05 + Math.random() * 0.08})`;
            ctx.fillRect(x, y, 1.5, 1.5);
        }

        // Occasional worn dirt patches near paths
        for (let i = 0; i < 14; i++) {
            const r = 8 + Math.random() * 18;
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, 'rgba(107, 84, 53, 0.35)');
            grad.addColorStop(1, 'rgba(107, 84, 53, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(40, 40);
        texture.anisotropy = 4;
        return texture;
    }

    createGround() {
        const groundTexture = this.createGroundTexture();
        const groundMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(260, 260),
            new THREE.MeshLambertMaterial({ map: groundTexture, color: 0xffffff })
        );
        groundMesh.rotation.x = -Math.PI / 2;
        groundMesh.receiveShadow = true;
        this.scene.add(groundMesh);

        const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.world.addBody(groundBody);
    }

    createGrassField() {
        const clusterCount = 16000;

        // Slightly tapered blade (narrower tip) with a subtle curl for a more organic look
        const baseBladeGeo = new THREE.PlaneGeometry(0.16, 0.9, 1, 3);
        baseBladeGeo.translate(0, 0.45, 0);

        const pos = baseBladeGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i);
            const t = y / 0.9;
            const bend = Math.pow(t, 2.2) * 0.22;
            pos.setZ(i, pos.getZ(i) - bend);
            // taper width toward the tip
            const x = pos.getX(i);
            pos.setX(i, x * (1.0 - t * 0.65));
        }

        const g1 = baseBladeGeo.clone();
        const g2 = baseBladeGeo.clone();
        g2.rotateY(Math.PI / 3);
        const g3 = baseBladeGeo.clone();
        g3.rotateY(-Math.PI / 3);

        const tuftGeo = THREE.BufferGeometryUtils
            ? THREE.BufferGeometryUtils.mergeBufferGeometries([g1, g2, g3])
            : g1;

        tuftGeo.computeVertexNormals();

        this.grassMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uBaseColor: { value: new THREE.Color(0x143a1c) },
                uTipColor: { value: new THREE.Color(0x5bc45f) },
                uDryColor: { value: new THREE.Color(0x9caa3e) },
                uSunDirection: { value: new THREE.Vector3(0.3, 1.0, 0.2) },
                uSunColor: { value: new THREE.Color(0xfff2d0) },
                uAmbient: { value: 0.55 },
                uSunIntensity: { value: 1.0 }
            },
            vertexShader: `
                uniform float uTime;
                varying vec2 vUv;
                varying float vY;
                varying float vPatch;
                varying vec3 vNormal;

                // cheap hash noise for natural patch variation
                float hash(vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
                }

                void main() {
                    vUv = uv;
                    vY = position.y;

                    vec3 pos = position;
                    vec4 instancePosition = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);

                    // smooth patch value from world position (dry/lush variation)
                    vPatch = hash(floor(instancePosition.xz * 0.15));

                    // layered wind: slow broad gust + faster flutter
                    float gust = sin(uTime * 1.1 + instancePosition.x * 0.08 + instancePosition.z * 0.08) * 0.5 + 0.5;
                    float wave = sin(uTime * 3.2 + instancePosition.x * 0.4 + instancePosition.z * 0.4) * (0.10 + gust * 0.16);
                    float flutter = sin(uTime * 7.0 + instancePosition.x * 1.3) * 0.03;

                    float t = clamp(vY / 0.9, 0.0, 1.0);
                    float sway = pow(t, 2.0) * (wave + flutter);

                    pos.x += sway;
                    pos.z += sway * 0.6;

                    vec4 worldNormal4 = instanceMatrix * vec4(normal, 0.0);
                    vNormal = normalize(worldNormal4.xyz);

                    vec4 mvPosition = viewMatrix * instanceMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 uBaseColor;
                uniform vec3 uTipColor;
                uniform vec3 uDryColor;
                uniform vec3 uSunDirection;
                uniform vec3 uSunColor;
                uniform float uAmbient;
                uniform float uSunIntensity;
                varying float vY;
                varying float vPatch;
                varying vec3 vNormal;

                void main() {
                    float t = clamp(vY / 0.9, 0.0, 1.0);
                    vec3 lush = mix(uBaseColor, uTipColor, t);
                    vec3 baseTone = mix(lush, uDryColor, vPatch * 0.4);

                    vec3 N = normalize(vNormal);
                    vec3 L = normalize(uSunDirection);

                    // wrap lighting so blades stay softly lit even when edge-on to the sun
                    float wrap = 0.5;
                    float diffuse = clamp((dot(N, L) + wrap) / (1.0 + wrap), 0.0, 1.0);

                    // translucency glow: light passing through thin blades from behind
                    float backlight = clamp(dot(-N, L), 0.0, 1.0);

                    vec3 lit = baseTone * (uAmbient + diffuse * uSunIntensity * 0.75) * uSunColor / vec3(1.0, 0.95, 0.85);
                    lit += uSunColor * backlight * t * 0.35 * uSunIntensity;

                    gl_FragColor = vec4(lit, 1.0);
                }
            `,
            side: THREE.DoubleSide
        });

        this.instancedGrass = new THREE.InstancedMesh(tuftGeo, this.grassMaterial, clusterCount);

        const dummy = new THREE.Object3D();
        for (let i = 0; i < clusterCount; i++) {
            const x = (Math.random() - 0.5) * 130;
            const z = (Math.random() - 0.5) * 130;

            if (Math.abs(x) < 8 && z > -12 && z < -6) continue;

            dummy.position.set(x, 0, z);
            dummy.rotation.y = Math.random() * Math.PI;

            const scaleFactor = 0.85 + Math.random() * 0.6;
            dummy.scale.set(scaleFactor, scaleFactor * (0.9 + Math.random() * 0.3), scaleFactor);
            dummy.updateMatrix();

            this.instancedGrass.setMatrixAt(i, dummy.matrix);
        }

        this.instancedGrass.instanceMatrix.needsUpdate = true;
        this.scene.add(this.instancedGrass);
    }

    updateGrass(deltaTime, sunDirection, sunColor, ambient, sunIntensity) {
        if (this.grassMaterial) {
            this.grassMaterial.uniforms.uTime.value += deltaTime;
            if (sunDirection) this.grassMaterial.uniforms.uSunDirection.value.copy(sunDirection);
            if (sunColor) this.grassMaterial.uniforms.uSunColor.value.copy(sunColor);
            if (ambient !== undefined) this.grassMaterial.uniforms.uAmbient.value = ambient;
            if (sunIntensity !== undefined) this.grassMaterial.uniforms.uSunIntensity.value = sunIntensity;
        }
    }

    createOuterBuildings() {
        const buildingGroup = new THREE.Group();
        const count = 60;
        const minRadius = 85;
        const maxRadius = 110;

        const buildingColors = [
            0x2c3e50, 0x34495e, 0x7f8c8d, 0x95a5a6, 
            0x1a252f, 0x415b76, 0x22313f, 0x59627a
        ];

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + (Math.random() * 0.05);
            const distance = minRadius + Math.random() * (maxRadius - minRadius);

            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;

            const width = 6 + Math.random() * 8;
            const depth = 6 + Math.random() * 8;
            const height = 12 + Math.random() * 28;

            const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
            const bmat = new THREE.MeshLambertMaterial({ color: color });

            const bgeo = new THREE.BoxGeometry(width, height, depth);
            const buildingMesh = new THREE.Mesh(bgeo, bmat);
            buildingMesh.position.set(x, height / 2, z);
            buildingMesh.castShadow = true;
            buildingMesh.receiveShadow = true;

            if (Math.random() > 0.4) {
                const roofGeo = new THREE.BoxGeometry(width * 0.4, 1.5, depth * 0.4);
                const roofMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
                const roofMesh = new THREE.Mesh(roofGeo, roofMat);
                roofMesh.position.set(0, height / 2 + 0.75, 0);
                buildingMesh.add(roofMesh);
            }

            const bBody = new CANNON.Body({ mass: 0 });
            bBody.addShape(new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)));
            bBody.position.set(x, height / 2, z);
            this.world.addBody(bBody);

            buildingGroup.add(buildingMesh);
        }

        this.scene.add(buildingGroup);
    }

    createClouds() {
        const cloudCount = 18;

        for (let i = 0; i < cloudCount; i++) {
            const cloudGroup = new THREE.Group();
            const puffCount = 3 + Math.floor(Math.random() * 3);
            const cloudMat = new THREE.MeshLambertMaterial({ 
                color: 0xffffff, 
                transparent: true, 
                opacity: 0.85 
            });

            for (let j = 0; j < puffCount; j++) {
                const puffGeo = new THREE.DodecahedronGeometry(2 + Math.random() * 2, 1);
                const puff = new THREE.Mesh(puffGeo, cloudMat);
                puff.position.set(
                    (j - puffCount / 2) * 2.2,
                    (Math.random() - 0.5) * 1.2,
                    (Math.random() - 0.5) * 1.2
                );
                cloudGroup.add(puff);
            }

            const x = (Math.random() - 0.5) * 180;
            const y = 25 + Math.random() * 15;
            const z = (Math.random() - 0.5) * 180;

            cloudGroup.position.set(x, y, z);
            this.scene.add(cloudGroup);

            this.clouds.push({
                mesh: cloudGroup,
                speed: 0.005 + Math.random() * 0.005
            });
        }
    }

    updateClouds() {
        if (!this.clouds) return;

        this.clouds.forEach(cloud => {
            cloud.mesh.position.x += cloud.speed;

            if (cloud.mesh.position.x > 100) {
                cloud.mesh.position.x = -100;
                cloud.mesh.position.z = (Math.random() - 0.5) * 180;
            }
        });
    }

    createShopAndNPC() {
        const shopGroup = new THREE.Group();
        const shopPosX = -4;
        const shopPosZ = -10;

        const baseMesh = new THREE.Mesh(
            new THREE.BoxGeometry(4.5, 0.2, 4),
            new THREE.MeshLambertMaterial({ color: 0xc28d53 })
        );
        baseMesh.position.set(0, 0.1, 0);
        shopGroup.add(baseMesh);

        const baseBody = new CANNON.Body({ mass: 0 });
        baseBody.addShape(new CANNON.Box(new CANNON.Vec3(2.25, 0.1, 2)));
        baseBody.position.set(shopPosX, 0.1, shopPosZ);
        this.world.addBody(baseBody);

        const wallMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
        
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.5, 0.2), wallMat);
        backWall.position.set(0, 1.35, -1.2);
        shopGroup.add(backWall);

        const backWallBody = new CANNON.Body({ mass: 0 });
        backWallBody.addShape(new CANNON.Box(new CANNON.Vec3(1.75, 1.25, 0.1)));
        backWallBody.position.set(shopPosX, 1.35, shopPosZ - 1.2);
        this.world.addBody(backWallBody);

        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.5, 2.4), wallMat);
        leftWall.position.set(-1.65, 1.35, 0);
        shopGroup.add(leftWall);

        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.5, 2.4), wallMat);
        rightWall.position.set(1.65, 1.35, 0);
        shopGroup.add(rightWall);

        const counter = new THREE.Mesh(
            new THREE.BoxGeometry(3.5, 0.9, 0.6),
            new THREE.MeshLambertMaterial({ color: 0x4a3227 })
        );
        counter.position.set(0, 0.65, 0.9);
        shopGroup.add(counter);

        const counterBody = new CANNON.Body({ mass: 0 });
        counterBody.addShape(new CANNON.Box(new CANNON.Vec3(1.75, 0.45, 0.3)));
        counterBody.position.set(shopPosX, 0.65, shopPosZ + 0.9);
        this.world.addBody(counterBody);

        const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.8, 8);
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x3d281c });
        
        const leftPole = new THREE.Mesh(poleGeo, poleMat);
        leftPole.position.set(-1.6, 1.5, 0.9);
        shopGroup.add(leftPole);

        const rightPole = new THREE.Mesh(poleGeo, poleMat);
        rightPole.position.set(1.6, 1.5, 0.9);
        shopGroup.add(rightPole);

        const roofGroup = new THREE.Group();
        const stripeWidth = 0.4;
        for (let i = 0; i < 10; i++) {
            const stripeMesh = new THREE.Mesh(
                new THREE.BoxGeometry(stripeWidth, 0.2, 2.8),
                new THREE.MeshLambertMaterial({ color: i % 2 === 0 ? 0x2e8b57 : 0xffffff })
            );
            stripeMesh.position.set(-1.8 + (i * stripeWidth) + (stripeWidth / 2), 0, 0);
            roofGroup.add(stripeMesh);
        }
        roofGroup.position.set(0, 2.9, 0.1);
        shopGroup.add(roofGroup);

        const npcGroup = new THREE.Group();
        const bodyMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.9, 0.4),
            new THREE.MeshLambertMaterial({ color: 0xdaa520 })
        );
        bodyMesh.position.y = 1.05;
        npcGroup.add(bodyMesh);

        const headMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.5, 0.5),
            new THREE.MeshLambertMaterial({ color: 0xffdbac })
        );
        headMesh.position.y = 1.7;
        npcGroup.add(headMesh);

        const hatBrim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.55, 0.55, 0.05, 12),
            new THREE.MeshLambertMaterial({ color: 0xc2a649 })
        );
        hatBrim.position.y = 1.98;
        npcGroup.add(hatBrim);

        const hatTop = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35, 0.4, 0.25, 12),
            new THREE.MeshLambertMaterial({ color: 0xc2a649 })
        );
        hatTop.position.y = 2.12;
        npcGroup.add(hatTop);

        npcGroup.position.set(0, 0, 0.1);
        shopGroup.add(npcGroup);

        this.npcMesh = npcGroup;
        shopGroup.position.set(shopPosX, 0, shopPosZ);
        this.scene.add(shopGroup);
    }

    createPortfolioShopAndNPC() {
        const shopGroup = new THREE.Group();
        const shopPosX = 4;
        const shopPosZ = -10;

        const baseMesh = new THREE.Mesh(
            new THREE.BoxGeometry(4.5, 0.2, 4),
            new THREE.MeshLambertMaterial({ color: 0x8b5a2b })
        );
        baseMesh.position.set(0, 0.1, 0);
        shopGroup.add(baseMesh);

        const wallMat = new THREE.MeshLambertMaterial({ color: 0x3d281c });
        
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.5, 0.2), wallMat);
        backWall.position.set(0, 1.35, -1.2);
        shopGroup.add(backWall);

        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.5, 2.4), wallMat);
        leftWall.position.set(-1.65, 1.35, 0);
        shopGroup.add(leftWall);
        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.5, 2.4), wallMat);
        rightWall.position.set(1.65, 1.35, 0);
        shopGroup.add(rightWall);

        const counter = new THREE.Mesh(
            new THREE.BoxGeometry(3.5, 0.9, 0.6),
            new THREE.MeshLambertMaterial({ color: 0x2c1d11 })
        );
        counter.position.set(0, 0.65, 0.9);
        shopGroup.add(counter);

        const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.8, 8);
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x1a100a });
        
        const leftPole = new THREE.Mesh(poleGeo, poleMat);
        leftPole.position.set(-1.6, 1.5, 0.9);
        shopGroup.add(leftPole);

        const rightPole = new THREE.Mesh(poleGeo, poleMat);
        rightPole.position.set(1.6, 1.5, 0.9);
        shopGroup.add(rightPole);

        const roofGroup = new THREE.Group();
        const stripeWidth = 0.4;
        for (let i = 0; i < 10; i++) {
            const stripeMesh = new THREE.Mesh(
                new THREE.BoxGeometry(stripeWidth, 0.2, 2.8),
                new THREE.MeshLambertMaterial({ color: i % 2 === 0 ? 0x1e90ff : 0xffffff })
            );
            stripeMesh.position.set(-1.8 + (i * stripeWidth) + (stripeWidth / 2), 0, 0);
            roofGroup.add(stripeMesh);
        }
        roofGroup.position.set(0, 2.9, 0.1);
        shopGroup.add(roofGroup);

        const npcGroup = new THREE.Group();
        const bodyMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.9, 0.4),
            new THREE.MeshLambertMaterial({ color: 0x8b0000 })
        );
        bodyMesh.position.y = 1.05;
        npcGroup.add(bodyMesh);

        const headMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.5, 0.5),
            new THREE.MeshLambertMaterial({ color: 0xffdbac })
        );
        headMesh.position.y = 1.7;
        npcGroup.add(headMesh);

        npcGroup.position.set(0, 0, 0.1);
        shopGroup.add(npcGroup);

        this.portfolioNPCMesh = npcGroup;
        shopGroup.position.set(shopPosX, 0, shopPosZ);
        this.scene.add(shopGroup);
    }

    spawnTrees(count) {
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * 110;
            const z = (Math.random() - 0.5) * 110 - 5;
            if (Math.abs(x) > 10 || Math.abs(z) > 10) {
                this.createTree(x, z);
            }
        }
    }

    createTree(x, z) {
        const group = new THREE.Group();
        const treeScale = 0.85 + Math.random() * 0.35;

        const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 5, 12);
        const trunkMat = new THREE.MeshLambertMaterial({ map: this.barkTexture });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 2.5;
        trunk.castShadow = true;
        group.add(trunk);

        const rootGeo = new THREE.CylinderGeometry(0.55, 0.85, 0.8, 12);
        const rootMesh = new THREE.Mesh(rootGeo, trunkMat);
        rootMesh.position.y = 0.4;
        group.add(rootMesh);

        const leafTiers = 3;
        const baseColor = new THREE.Color(0x1e5631);
        const greenShade = baseColor.clone().addScalar((Math.random() - 0.5) * 0.08);

        for (let i = 0; i < leafTiers; i++) {
            const radius = 2.5 - (i * 0.5);
            const height = 3.2 - (i * 0.4);
            const yPos = 4.2 + (i * 1.6);

            const tierGeo = new THREE.ConeGeometry(radius, height, 8);
            const tierMat = new THREE.MeshLambertMaterial({ 
                map: this.leavesTexture,
                color: greenShade 
            });

            const tierMesh = new THREE.Mesh(tierGeo, tierMat);
            tierMesh.position.y = yPos;
            tierMesh.rotation.y = Math.random() * Math.PI;
            tierMesh.castShadow = true;

            group.add(tierMesh);
        }

        group.position.set(x, 0, z);
        group.scale.set(treeScale, treeScale, treeScale);

        this.scene.add(group);
        this.trees.push({ group, health: 3, x, z });
    }
}
