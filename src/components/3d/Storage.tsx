'use client';

import React, { useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import { Text } from '@react-three/drei';
import { createRoundedBoxGeometry } from '@/lib/utils/roundedBox';
import { WhiteCeramic, BlackBase, YellowAccent } from '@/components/materials/materials';

/**
 * createRoundedBoxGeometry's `width`/`height` inputs are NOT the final XY extent —
 * internally it subtracts 2*radius then the bevel adds 2*bevel back, so the shape
 * actually renders at `input - 2*radius + 2*bevel`. This inverts that so callers can
 * pass the physical size they actually want (matches the convention documented in
 * the sibling components, e.g. AppServer's "2.0 + 2*0.36 - 2*0.01 = 2.70").
 */
function roundedBoxSize(width: number, height: number, depth: number, radius: number, bevel: number) {
    return {
        width: width + 2 * radius - 2 * bevel,
        height: height + 2 * radius - 2 * bevel,
        depth,
        radius,
        bevel,
    };
}

/**
 * Reference analysis (item-images/storage-pro.jpeg), documented before modeling.
 *
 * {
 *   width: 1.0, height: 0.82, depth: 0.78,
 *   lockerRows: 2, lockerColumns: 3,
 *   doorRadius: "large, ~8% of door width",
 *   handlePosition: "vertical pill, centered in door, slightly right of centerline",
 *   trayWidth: "~1 compartment width", trayDepth: "~cabinet depth",
 *   fileCount: 5,
 *   topLidHeight: "~22% of total height, overhangs body on all sides",
 *   baseHeight: "~10% of total height",
 *   primaryColors: { body: "#F4F1EC (warm white)", top: "#1E1E1E (matte black)", accent: "#FFD600 (bright yellow)" }
 * }
 */

export interface ConnectorPort {
    id: string;
    side: 'left' | 'right' | 'top' | 'bottom';
    position: [number, number, number];
    normal: [number, number, number];
    radius: number;
}

export interface StorageProps {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number;
    showLabel?: boolean;
    /** Static pose only — no animation. Renders locker N (1-6) hinged open with its tray extended. */
    openDoor?: 1 | 2 | 3 | 4 | 5 | 6 | null;
}

export interface StorageRef {
    getConnectorPort: (side: 'left' | 'right' | 'top' | 'bottom') => ConnectorPort;
    getConnectorPorts: () => ConnectorPort[];
}

// ---- Cabinet proportions (local units) -------------------------------------
const W = 2.4; // body width (X)
const D = 1.9; // body depth (Z)
const BASE_H = 0.22; // yellow accent strip
const BODY_H = 1.3; // white body, doors live here
const CAP_H = 0.4; // black lid
const CAP_OVER = 0.14; // lid overhang each side
const CAP_W = W + 2 * CAP_OVER;
const CAP_D = D + 2 * CAP_OVER;

// ---- Door grid ---------------------------------------------------------------
const MARGIN_X = 0.14;
const MARGIN_Y = 0.12;
const GAP_X = 0.05;
const GAP_Y = 0.06;
const DOOR_W = (W - 2 * MARGIN_X - 2 * GAP_X) / 3;
const DOOR_H = (BODY_H - 2 * MARGIN_Y - GAP_Y) / 2;
const DOOR_THICKNESS = 0.06;
const Z_OUT = D / 2;

const COL_X = [
    -W / 2 + MARGIN_X + DOOR_W / 2,
    0,
    W / 2 - MARGIN_X - DOOR_W / 2,
];
const ROW_Y = [BODY_H - MARGIN_Y - DOOR_H / 2, MARGIN_Y + DOOR_H / 2]; // [top row, bottom row]

interface DoorDef {
    n: 1 | 2 | 3 | 4 | 5 | 6;
    x: number;
    y: number;
}
const DOORS: DoorDef[] = [
    { n: 1, x: COL_X[0], y: ROW_Y[0] },
    { n: 2, x: COL_X[1], y: ROW_Y[0] },
    { n: 3, x: COL_X[2], y: ROW_Y[0] },
    { n: 4, x: COL_X[0], y: ROW_Y[1] },
    { n: 5, x: COL_X[1], y: ROW_Y[1] },
    { n: 6, x: COL_X[2], y: ROW_Y[1] },
];

function GreenLED({ position }: { position: [number, number, number] }) {
    return (
        <mesh position={position}>
            <sphereGeometry args={[0.018, 12, 12]} />
            <meshStandardMaterial
                color="#3FBF4F"
                emissive="#2ECC55"
                emissiveIntensity={0.9}
                roughness={0.4}
            />
        </mesh>
    );
}

function Vents({ doorW, doorH }: { doorW: number; doorH: number }) {
    // Plain (non-rounded) box — these are tiny embossed slot marks, rounding
    // would be imperceptible at this scale and the correction math gets noisy
    // when the desired size approaches the radius.
    return (
        <>
            {[-0.28, -0.36].map((f) => (
                <mesh key={f} position={[0, doorH * f, DOOR_THICKNESS / 2 + 0.007]}>
                    <boxGeometry args={[doorW * 0.4, 0.022, 0.012]} />
                    <meshStandardMaterial color="#B8B2A2" roughness={0.65} />
                </mesh>
            ))}
        </>
    );
}

function Handle({ doorW, doorH }: { doorW: number; doorH: number }) {
    const pillGeom = useMemo(
        () => createRoundedBoxGeometry({ ...roundedBoxSize(0.1, 0.32, 0.07, 0.05, 0.012), segments: 10 }),
        []
    );
    const hx = doorW * 0.06;
    const hy = doorH * 0.04;
    return (
        <group position={[hx, hy, DOOR_THICKNESS / 2 + 0.02]}>
            <mesh geometry={pillGeom} castShadow>
                <BlackBase />
            </mesh>
            <GreenLED position={[0, -0.1, 0.045]} />
        </group>
    );
}

function NumberBadge({ n, doorW, doorH }: { n: number; doorW: number; doorH: number }) {
    const badgeGeom = useMemo(
        () => createRoundedBoxGeometry({ ...roundedBoxSize(0.22, 0.15, 0.03, 0.035, 0.006), segments: 8 }),
        []
    );
    const bx = -doorW * 0.28;
    const by = doorH * 0.32;
    return (
        <group position={[bx, by, DOOR_THICKNESS / 2 + 0.005]}>
            <mesh geometry={badgeGeom} castShadow>
                <BlackBase />
            </mesh>
            <Text
                position={[0, 0, 0.021]}
                fontSize={0.09}
                color="#FFFFFF"
                fontWeight={700}
                anchorX="center"
                anchorY="middle"
            >
                {`0${n}`}
            </Text>
        </group>
    );
}

/** Five stylized folders — thick, rounded, staggered like a fanned file stack. */
function Folders({ trayInnerW, trayD }: { trayInnerW: number; trayD: number }) {
    const count = 5;
    const folderDepth = trayD * 0.72;
    const geom = useMemo(
        () => createRoundedBoxGeometry({ ...roundedBoxSize(0.06, 0.42, folderDepth, 0.05, 0.012), segments: 8 }),
        [folderDepth]
    );
    const step = trayInnerW / (count + 0.5);
    return (
        <>
            {Array.from({ length: count }).map((_, i) => {
                const x = -trayInnerW / 2 + step * (i + 0.75);
                const zOffset = (i % 2 === 0 ? 1 : -1) * 0.01 * i;
                const yLift = 0.16 + i * 0.006;
                return (
                    <mesh key={i} geometry={geom} position={[x, yLift, zOffset]} rotation={[0.04, 0, 0]} castShadow>
                        <YellowAccent />
                    </mesh>
                );
            })}
        </>
    );
}

/** Tray: rounded rectangular basin with raised walls, light-grey plastic. */
function Tray({ trayW, trayD }: { trayW: number; trayD: number }) {
    const floorGeom = useMemo(
        () => createRoundedBoxGeometry({ ...roundedBoxSize(trayW, trayD, 0.05, 0.06, 0.012), segments: 10 }),
        [trayW, trayD]
    );
    const wallMat = { color: '#D9D5CC', roughness: 0.6, metalness: 0 } as const;
    const wallH = 0.16;
    return (
        <group>
            <mesh geometry={floorGeom} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} castShadow receiveShadow>
                <meshStandardMaterial {...wallMat} />
            </mesh>
            {/* left/right walls */}
            {[-1, 1].map((s) => (
                <mesh key={s} position={[s * (trayW / 2 - 0.02), wallH / 2, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.04, wallH, trayD - 0.04]} />
                    <meshStandardMaterial {...wallMat} />
                </mesh>
            ))}
            {/* back wall (inside cabinet) */}
            <mesh position={[0, wallH / 2, -(trayD / 2 - 0.02)]} castShadow receiveShadow>
                <boxGeometry args={[trayW - 0.08, wallH, 0.04]} />
                <meshStandardMaterial {...wallMat} />
            </mesh>
            <Folders trayInnerW={trayW - 0.16} trayD={trayD} />
        </group>
    );
}

/** One locker: hinged door (static open/closed pose) + number badge + handle + vents. */
function Locker({ def, isOpen }: { def: DoorDef; isOpen: boolean }) {
    const doorGeom = useMemo(
        () => createRoundedBoxGeometry({ ...roundedBoxSize(DOOR_W, DOOR_H, DOOR_THICKNESS, 0.09, 0.012), segments: 10 }),
        []
    );

    // Sized to fit the interior cavity behind the door plane (local z=0) without
    // poking through the cabinet's back wall.
    const trayW = DOOR_W * 0.82;
    const trayD = 0.62;
    const closedZ = -(trayD / 2 + 0.05);
    const openZ = trayD * 0.55;

    return (
        <group position={[def.x, def.y, Z_OUT - 0.035]}>
            {/* Tray sits inside the cavity behind the door, slides out along +Z when open */}
            <group position={[0, -0.02, isOpen ? openZ : closedZ]}>
                <Tray trayW={trayW} trayD={trayD} />
            </group>

            {/* Door hinges on its left edge */}
            <group position={[-DOOR_W / 2, 0, 0]} rotation={[0, isOpen ? -Math.PI / 2.05 : 0, 0]}>
                <group position={[DOOR_W / 2, 0, 0]}>
                    <mesh geometry={doorGeom} castShadow receiveShadow>
                        <WhiteCeramic />
                    </mesh>
                    <NumberBadge n={def.n} doorW={DOOR_W} doorH={DOOR_H} />
                    <Handle doorW={DOOR_W} doorH={DOOR_H} />
                    <Vents doorW={DOOR_W} doorH={DOOR_H} />
                </group>
            </group>
        </group>
    );
}

const Storage = forwardRef<StorageRef, StorageProps>(
    ({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1.0, showLabel = true, openDoor = null }, ref) => {
        const groupRef = useRef(null);

        const portsList = useMemo(
            (): ConnectorPort[] => [
                { id: 'left', side: 'left', position: [-W / 2, BASE_H / 2, 0], normal: [-1, 0, 0], radius: 0.02 },
                { id: 'right', side: 'right', position: [W / 2, BASE_H / 2, 0], normal: [1, 0, 0], radius: 0.02 },
                { id: 'top', side: 'top', position: [0, BASE_H / 2, -D / 2], normal: [0, 0, -1], radius: 0.02 },
                { id: 'bottom', side: 'bottom', position: [0, BASE_H / 2, D / 2], normal: [0, 0, 1], radius: 0.02 },
            ],
            []
        );

        useImperativeHandle(ref, () => ({
            getConnectorPort: (side) => {
                const port = portsList.find((p) => p.side === side);
                if (!port) throw new Error(`Port side "${side}" does not exist on Storage`);
                return port;
            },
            getConnectorPorts: () => portsList,
        }));

        const bodyGeom = useMemo(
            () => createRoundedBoxGeometry({ ...roundedBoxSize(W, D, BODY_H, 0.32, 0.015), segments: 16 }),
            []
        );
        const capGeom = useMemo(
            () => createRoundedBoxGeometry({ ...roundedBoxSize(CAP_W, CAP_D, CAP_H, 0.34, 0.02), segments: 16 }),
            []
        );
        const baseGeom = useMemo(
            () => createRoundedBoxGeometry({ ...roundedBoxSize(W, D, BASE_H, 0.32, 0.012), segments: 16 }),
            []
        );
        const backingGeom = useMemo(
            () =>
                createRoundedBoxGeometry({
                    ...roundedBoxSize(W - MARGIN_X * 0.6, BODY_H - MARGIN_Y * 0.6, 0.03, 0.1, 0.01),
                    segments: 12,
                }),
            []
        );

        return (
            <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
                {/* Yellow base strip */}
                <mesh geometry={baseGeom} position={[0, -BASE_H / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                    <YellowAccent />
                </mesh>

                {/* Front status LED, centered on the base strip */}
                <mesh position={[0, -BASE_H / 2, Z_OUT + 0.001]}>
                    <boxGeometry args={[0.12, 0.03, 0.01]} />
                    <meshStandardMaterial color="#3FBF4F" emissive="#2ECC55" emissiveIntensity={0.8} roughness={0.4} />
                </mesh>

                {/* Main white body */}
                <mesh geometry={bodyGeom} position={[0, BODY_H / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                    <WhiteCeramic />
                </mesh>

                {/* Recessed backing plate behind the door grid (reads as visible seams/borders) */}
                <mesh geometry={backingGeom} position={[0, BODY_H / 2, Z_OUT - 0.095]} castShadow receiveShadow>
                    <meshStandardMaterial color="#DCD7CB" roughness={0.7} />
                </mesh>

                {/* Black lid cap, overhangs the body */}
                <mesh geometry={capGeom} position={[0, BODY_H + CAP_H / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
                    <BlackBase />
                </mesh>

                {showLabel && (
                    <Text
                        position={[0, BODY_H + CAP_H + 0.001, 0]}
                        rotation={[-Math.PI / 2, 0, 0]}
                        fontSize={0.22}
                        color="#FFFFFF"
                        fontWeight={700}
                        anchorX="center"
                        anchorY="middle"
                    >
                        STORAGE
                    </Text>
                )}

                {DOORS.map((d) => (
                    <Locker key={d.n} def={d} isOpen={openDoor === d.n} />
                ))}
            </group>
        );
    }
);

Storage.displayName = 'Storage';

export default Storage;
