'use client';

import { useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CAMERA_PRESETS } from '@/types';
import type { CameraPreset } from '@/types';

/**
 * useCamera — imperative camera preset controller.
 * Must be called inside a Canvas (R3F context).
 */
export function useCamera() {
    const { camera } = useThree();

    /**
     * Instantly jump to a named camera preset.
     * For smooth transitions, use setCameraPresetSmooth().
     */
    const setCameraPreset = useCallback(
        (name: string) => {
            const preset: CameraPreset | undefined = CAMERA_PRESETS[name];
            if (!preset) return;
            camera.position.set(...preset.position);
            (camera as THREE.PerspectiveCamera).fov = preset.fov;
            (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
            camera.lookAt(...preset.target);
        },
        [camera]
    );

    return { setCameraPreset };
}

// ─── Parallax Rig ────────────────────────────────────────────────────────────

interface ParallaxRigProps {
    /** Lateral parallax range in world units (default 2.5) */
    strength?: number;
    /** Vertical offset for elevated angle (default 3.0) */
    elevationY?: number;
    /** Lerp smoothing factor (default 0.05) */
    smoothing?: number;
    /** Scene look-at target (default [0, 0.2, 0]) */
    lookAt?: [number, number, number];
}

/**
 * ParallaxRig — pointer-driven smooth camera parallax.
 * Drop inside any Canvas alongside your scene content.
 * When orbit controls are active, do NOT include this.
 */
export function ParallaxRig({
    strength = 2.5,
    elevationY = 3.0,
    smoothing = 0.05,
    lookAt = [0, 0.2, 0],
}: ParallaxRigProps = {}) {
    const lookAtVec = new THREE.Vector3(...lookAt);

    useFrame((state) => {
        const { x, y } = state.pointer;
        const targetX = x * strength;
        const targetY = y * 2.0 + elevationY;
        const targetZ = 5.0 - Math.abs(x) * 0.5;

        state.camera.position.x = THREE.MathUtils.lerp(
            state.camera.position.x,
            targetX,
            smoothing
        );
        state.camera.position.y = THREE.MathUtils.lerp(
            state.camera.position.y,
            targetY,
            smoothing
        );
        state.camera.position.z = THREE.MathUtils.lerp(
            state.camera.position.z,
            targetZ,
            smoothing
        );
        state.camera.lookAt(lookAtVec);
    });

    return null;
}

// ─── Turntable Rig ───────────────────────────────────────────────────────────

interface TurntableRigProps {
    /** Rotation speed in radians per second (default 0.4) */
    speed?: number;
    /** Radius from origin (default 4.5) */
    radius?: number;
    /** Camera height (default 2.2) */
    height?: number;
    enabled?: boolean;
}

/**
 * TurntableRig — auto-rotate camera around origin.
 * Ideal for CharacterViewer showcase mode.
 */
export function TurntableRig({
    speed = 0.4,
    radius = 4.5,
    height = 2.2,
    enabled = true,
}: TurntableRigProps = {}) {
    useFrame((state) => {
        if (!enabled) return;
        const t = state.clock.getElapsedTime() * speed;
        state.camera.position.x = Math.sin(t) * radius;
        state.camera.position.z = Math.cos(t) * radius;
        state.camera.position.y = height;
        state.camera.lookAt(0, 0.5, 0);
    });

    return null;
}
