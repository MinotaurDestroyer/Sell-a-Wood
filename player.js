class PlayerController {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.isLocked = false;
        this.yaw = 0;
        this.pitch = 0;
        this.moveState = { forward: false, backward: false, left: false, right: false };
        
        // Character Speed
        this.speed = 0.08;

        this.velocity = new THREE.Vector3();
        this.canJump = false;
        this.gravity = -0.015;
        this.jumpPower = 0.35;
        this.playerHeight = 2.0;

        // ZOOM POV MECHANICS
        this.defaultFov = 75;
        this.minFov = 30;
        this.maxFov = 95;
        this.targetFov = 75;

        // Touch Control Variables
        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        this.touchLookId = null;
        this.lastTouchX = 0;
        this.lastTouchY = 0;

        this.axeGroup = null;
        this.isSwinging = false;
        this.swingProgress = 0;

        this.initControls();
        this.initTouchControls();
        this.createAxe();
    }

    initControls() {
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('#touch-controls') || e.target.closest('#shopModal') || e.target.closest('#imageModal')) return;

            if (!this.isLocked && !this.isTouchDevice) {
                document.body.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isLocked = (document.pointerLockElement === document.body);
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isLocked) return;
            const sensitivity = 0.002;
            this.yaw -= e.movementX * sensitivity;
            this.pitch -= e.movementY * sensitivity;
            this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));

            this.camera.rotation.x = this.pitch;
            this.camera.rotation.y = this.yaw;
        });

        document.addEventListener('wheel', (e) => {
            if (!this.isLocked && !this.isTouchDevice) return;

            if (e.deltaY < 0) {
                this.targetFov = Math.max(this.minFov, this.targetFov - 5);
            } else if (e.deltaY > 0) {
                this.targetFov = Math.min(this.maxFov, this.targetFov + 5);
            }
        });

        document.addEventListener('keydown', (e) => this.onKey(e.code, true));
        document.addEventListener('keyup', (e) => this.onKey(e.code, false));
    }

    initTouchControls() {
        const joystickBase = document.getElementById('joystick-base');
        const joystickStick = document.getElementById('joystick-stick');

        if (!joystickBase || !joystickStick) return;

        let joystickTouchId = null;
        let baseRect = null;

        joystickBase.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            joystickTouchId = touch.identifier;
            baseRect = joystickBase.getBoundingClientRect();
            this.updateJoystick(touch, baseRect, joystickStick);
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];

                if (touch.identifier === joystickTouchId && baseRect) {
                    this.updateJoystick(touch, baseRect, joystickStick);
                }

                if (touch.identifier === this.touchLookId) {
                    const deltaX = touch.clientX - this.lastTouchX;
                    const deltaY = touch.clientY - this.lastTouchY;

                    const sensitivity = 0.004;
                    this.yaw -= deltaX * sensitivity;
                    this.pitch -= deltaY * sensitivity;
                    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));

                    this.camera.rotation.x = this.pitch;
                    this.camera.rotation.y = this.yaw;

                    this.lastTouchX = touch.clientX;
                    this.lastTouchY = touch.clientY;
                }
            }
        }, { passive: false });

        const resetJoystick = (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === joystickTouchId) {
                    joystickTouchId = null;
                    joystickStick.style.left = '42.5px';
                    joystickStick.style.top = '42.5px';
                    this.moveState.forward = false;
                    this.moveState.backward = false;
                    this.moveState.left = false;
                    this.moveState.right = false;
                }
                if (touch.identifier === this.touchLookId) {
                    this.touchLookId = null;
                }
            }
        };

        window.addEventListener('touchend', resetJoystick);
        window.addEventListener('touchcancel', resetJoystick);

        window.addEventListener('touchstart', (e) => {
            if (document.getElementById('shopModal').style.display === 'flex' || document.getElementById('imageModal').style.display === 'flex') return;

            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.clientX > window.innerWidth / 2 && this.touchLookId === null && !e.target.closest('#action-buttons')) {
                    this.touchLookId = touch.identifier;
                    this.lastTouchX = touch.clientX;
                    this.lastTouchY = touch.clientY;
                }
            }
        });

        const btnJump = document.getElementById('btn-touch-jump');
        if (btnJump) {
            btnJump.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.canJump) {
                    this.velocity.y = this.jumpPower;
                    this.canJump = false;
                }
            });
        }
    }

    updateJoystick(touch, baseRect, stickElement) {
        const centerX = baseRect.left + baseRect.width / 2;
        const centerY = baseRect.top + baseRect.height / 2;

        let deltaX = touch.clientX - centerX;
        let deltaY = touch.clientY - centerY;

        const maxRadius = 45;
        const distance = Math.hypot(deltaX, deltaY);

        if (distance > maxRadius) {
            deltaX = (deltaX / distance) * maxRadius;
            deltaY = (deltaY / distance) * maxRadius;
        }

        stickElement.style.left = `${42.5 + deltaX}px`;
        stickElement.style.top = `${42.5 + deltaY}px`;

        const threshold = 10;
        this.moveState.forward = deltaY < -threshold;
        this.moveState.backward = deltaY > threshold;
        this.moveState.left = deltaX < -threshold;
        this.moveState.right = deltaX > threshold;
    }

    onKey(code, pressed) {
        if (code === 'KeyW') this.moveState.forward = pressed;
        if (code === 'KeyS') this.moveState.backward = pressed;
        if (code === 'KeyA') this.moveState.left = pressed;
        if (code === 'KeyD') this.moveState.right = pressed;

        if (code === 'Space' && pressed && this.canJump && (this.isLocked || this.isTouchDevice)) {
            this.velocity.y = this.jumpPower;
            this.canJump = false;
        }
    }

    createAxe() {
        this.axeGroup = new THREE.Group();

        const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.035, 1.2, 8),
            new THREE.MeshLambertMaterial({ color: 0x5c4033 })
        );
        this.axeGroup.add(handle);

        const head = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.22, 0.15),
            new THREE.MeshLambertMaterial({ color: 0x777777 })
        );
        head.position.set(0, 0.45, -0.08);
        this.axeGroup.add(head);

        const edge = new THREE.Mesh(
            new THREE.BoxGeometry(0.02, 0.28, 0.06),
            new THREE.MeshLambertMaterial({ color: 0xcccccc })
        );
        edge.position.set(0, 0.45, -0.16);
        this.axeGroup.add(edge);

        this.axeGroup.position.set(0.4, -0.35, -0.6);
        this.axeGroup.rotation.set(0.3, -0.3, -0.2);

        this.camera.add(this.axeGroup);
        this.scene.add(this.camera);
    }

    swingAxe() {
        if (!this.isSwinging) {
            this.isSwinging = true;
            this.swingProgress = 0;
        }
    }

    update() {
        if (Math.abs(this.camera.fov - this.targetFov) > 0.01) {
            this.camera.fov += (this.targetFov - this.camera.fov) * 0.15;
            this.camera.updateProjectionMatrix();
        }

        if (this.isSwinging) {
            this.swingProgress += 0.15;
            this.axeGroup.rotation.x = -Math.sin(this.swingProgress) * 1.2;
            this.axeGroup.rotation.z = Math.sin(this.swingProgress) * 0.5;

            if (this.swingProgress >= Math.PI) {
                this.isSwinging = false;
                this.axeGroup.rotation.x = 0.3;
                this.axeGroup.rotation.z = -0.2;
            }
        }

        if (this.isLocked || this.isTouchDevice) {
            const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            forwardVector.y = 0;
            forwardVector.normalize();

            const sideVector = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
            sideVector.y = 0;
            sideVector.normalize();

            if (this.moveState.forward) this.camera.position.addScaledVector(forwardVector, this.speed);
            if (this.moveState.backward) this.camera.position.addScaledVector(forwardVector, -this.speed);
            if (this.moveState.left) this.camera.position.addScaledVector(sideVector, -this.speed);
            if (this.moveState.right) this.camera.position.addScaledVector(sideVector, this.speed);

            this.velocity.y += this.gravity;
            this.camera.position.y += this.velocity.y;

            const walkableObjects = this.scene.children.filter(obj => 
                !(obj instanceof THREE.InstancedMesh) && 
                !(obj.geometry instanceof THREE.CylinderGeometry)
            );

            const raycaster = new THREE.Raycaster(
                this.camera.position,
                new THREE.Vector3(0, -1, 0)
            );
            const intersects = raycaster.intersectObjects(walkableObjects, true);

            let groundY = this.playerHeight;
            if (intersects.length > 0) {
                const dist = intersects[0].distance;
                if (dist < this.playerHeight + 0.5) {
                    groundY = this.camera.position.y - dist + this.playerHeight;
                }
            }

            if (this.camera.position.y <= groundY) {
                this.camera.position.y = groundY;
                this.velocity.y = 0;
                this.canJump = true;
            }
        }
    }
}
