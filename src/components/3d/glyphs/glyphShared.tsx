'use client';

import React, { forwardRef, useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';
import * as THREE from 'three';
import { createRoundedBoxGeometry } from '@/lib/utils/roundedBox';
import { BlackBase } from '@/components/materials/materials';
import type { ConnectorPort, ConnectorConfig } from '@/types';

/**
 * The pieces every behavioural glyph in `docs/3d-components-roadmap.md` needs, so
 * each new one isn't re-deriving the house style from scratch.
 *
 * These were extracted from `Autoscaler` and `Pipeline` after both had been built
 * and visually signed off — the constants below are the settled answers to
 * mistakes those two made first, not guesses. In particular `INSET_BODY`: accents
 * must be dark recessed inserts that IGNITE, never saturated painted faces. A
 * bright plate makes the accent permanent, which both wastes the palette's one
 * meaningful colour and leaves the concept animation nothing left to say.
 */

// ─── Props contract (matches the existing `InfrastructureNodeProps` shape) ────

export interface GlyphProps {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number;
    interactive?: boolean;
    floating?: boolean;
    showLabel?: boolean;
    defaultView?: 'front' | 'top' | 'isometric';
    connectors?: ConnectorConfig[];
    animationToggle?: boolean;
    showPorts?: boolean;
    /** Test hook for the /lab/playground harness — overrides the media query. */
    forceReducedMotion?: boolean;
}

export interface GlyphRef {
    getConnectorPort: (side: 'left' | 'right' | 'top' | 'bottom') => ConnectorPort;
    getConnectorPorts: () => ConnectorPort[];
}

// ─── Palette (§2 — accents carry meaning; never add a hue without one) ───────

export const ACCENT = {
    /** data in motion: packets, requests, live traffic. The "energy" colour. */
    blue: '#3b82f6',
    /** healthy, cached, accepted, completed. */
    green: '#3ecf8e',
    /** pending work, queued, thresholds. */
    yellow: '#FFF100',
    /** warning, retry, half-open, lock-wait timeout. */
    amber: '#f59e0b',
    /** failed, tripped, rolled back. */
    red: '#ef4444',
    /** persistence: databases, ledgers, storage. */
    tan: '#c8a06a',
} as const;

/** Unlit body colour for an accent insert — near-black, so the accent is an event. */
export const INSET_BODY = '#15181d';

/** Top of every plinth. Glyph content sits on this plane. */
export const BASE_TOP = -0.5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolves the effective reduced-motion state, honouring the lab override. */
export function useGlyphReducedMotion(force?: boolean): boolean {
    const system = useReducedMotion();
    return force ?? system ?? false;
}

/** The standard four connector ports, sized to the glyph's footprint. */
export function useGlyphPorts(halfWidth: number, halfDepth: number, y = 0): ConnectorPort[] {
    return useMemo((): ConnectorPort[] => [
        { id: 'left', side: 'left', position: [-halfWidth, y, 0], normal: [-1, 0, 0], radius: 0.02 },
        { id: 'right', side: 'right', position: [halfWidth, y, 0], normal: [1, 0, 0], radius: 0.02 },
        { id: 'top', side: 'top', position: [0, y, -halfDepth], normal: [0, 0, -1], radius: 0.02 },
        { id: 'bottom', side: 'bottom', position: [0, y, halfDepth], normal: [0, 0, 1], radius: 0.02 },
    ], [halfWidth, halfDepth, y]);
}

export function makePortLookup(ports: ConnectorPort[], name: string): GlyphRef {
    return {
        getConnectorPort: (side) => {
            const port = ports.find((p) => p.side === side);
            if (!port) throw new Error(`Port side "${side}" does not exist on ${name}`);
            return port;
        },
        getConnectorPorts: () => ports,
    };
}

export function resolveInitialRotation(
    rotation: [number, number, number] | undefined,
    defaultView: 'front' | 'top' | 'isometric',
    isoYawDeg = 24,
): [number, number, number] {
    if (rotation) return rotation;
    switch (defaultView) {
        case 'top': return [-Math.PI / 2, 0, 0];
        case 'front': return [0, 0, 0];
        default: return [0, (isoYawDeg * Math.PI) / 180, 0];
    }
}

// ─── Shared meshes ───────────────────────────────────────────────────────────

/** The near-black plinth every glyph floats on. Its top surface is `BASE_TOP`. */
export function Plinth({ width, depth }: { width: number; depth: number }) {
    const geometry = useMemo(
        () => createRoundedBoxGeometry({ width, height: depth, depth: 0.24, radius: 0.1, bevel: 0.01, segments: 12 }),
        [width, depth],
    );
    return (
        <mesh geometry={geometry} position={[0, BASE_TOP - 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <BlackBase />
        </mesh>
    );
}

/**
 * A recessed accent insert: dark at rest, lit by mutating `emissiveIntensity`
 * from the parent's frame loop. `toneMapped={false}` keeps a lit insert reading
 * as emission rather than a pale wash, and lets the hero's bloom pass find it.
 */
export const AccentInsert = forwardRef<THREE.Mesh, {
    color: string;
    args: [number, number, number];
    position?: [number, number, number];
    rotation?: [number, number, number];
    rest?: number;
}>(function AccentInsert({ color, args, position, rotation, rest = 0.12 }, ref) {
    return (
        <mesh ref={ref} position={position} rotation={rotation}>
            <boxGeometry args={args} />
            <meshStandardMaterial color={INSET_BODY} emissive={color} emissiveIntensity={rest} toneMapped={false} />
        </mesh>
    );
});

/** Sets an accent insert's brightness. No-op when the ref hasn't attached yet. */
export function setAccent(mesh: THREE.Mesh | null | undefined, intensity: number) {
    if (!mesh) return;
    (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
}

/** The float bob shared by every node. Frozen under reduced motion. */
export function applyFloat(
    group: THREE.Group | null,
    baseY: number,
    elapsed: number,
    active: boolean,
) {
    if (!group) return;
    if (active) {
        group.position.y = baseY + Math.sin(elapsed * 1.5) * 0.03;
    } else {
        group.position.y = THREE.MathUtils.lerp(group.position.y, baseY, 0.05);
    }
}
