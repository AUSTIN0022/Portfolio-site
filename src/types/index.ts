/**
 * Unified TypeScript contracts for the 3D asset library.
 * All assets, characters, connectors and systems import from here.
 */

// ─── Base Asset Props ───────────────────────────────────────────────────────

export interface AssetProps {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number;
    interactive?: boolean;
    floating?: boolean;
    showLabel?: boolean;
    animationToggle?: boolean;
    showPorts?: boolean;
}

// ─── Character Props ─────────────────────────────────────────────────────────

export type CharacterExpression = 'neutral' | 'happy' | 'angry' | 'focused';
export type CharacterPose = 'idle' | 'action' | 'wave' | 'reading' | 'fighting';

export interface CharacterProps extends AssetProps {
    expression?: CharacterExpression;
    pose?: CharacterPose;
}

// ─── Connector System ────────────────────────────────────────────────────────

export type ConnectorSide = 'left' | 'right' | 'top' | 'bottom' | 'front' | 'back';

export interface ConnectorPort {
    id: string;
    side: ConnectorSide;
    position: [number, number, number];
    normal: [number, number, number];
    radius: number;
}

export interface ConnectorConfig {
    id: string;
    active?: boolean;
    color?: string;
}

export interface AssetRef {
    getConnectorPort: (side: ConnectorSide) => ConnectorPort;
    getConnectorPorts: () => ConnectorPort[];
}

// ─── Camera ──────────────────────────────────────────────────────────────────

export type CameraMode = 'orbit' | 'parallax' | 'fixed';

export interface CameraPreset {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
}

/** Named camera presets covering common viewing angles */
export const CAMERA_PRESETS: Record<string, CameraPreset> = {
    front: { position: [0, 0.5, 5.5], target: [0, 0, 0], fov: 38 },
    isometric: { position: [3.2, 3.0, 3.2], target: [0, 0, 0], fov: 35 },
    top: { position: [0, 6, 0.01], target: [0, 0, 0], fov: 40 },
    character: { position: [0, 1.5, 4.5], target: [0, 0.5, 0], fov: 42 },
    close: { position: [0, 0.8, 2.5], target: [0, 0.2, 0], fov: 45 },
    wide: { position: [0, 2.2, 7], target: [0, 0, 0], fov: 33 },
};

// ─── Animation State Machine ─────────────────────────────────────────────────

export type AnimationStateKey = 'idle' | 'hover' | 'clicked' | 'exit';

export interface AnimationStateDefinition {
    key: AnimationStateKey;
    onEnter?: (target: object) => void;
    onExit?: (target: object) => void;
}

// ─── Debug ───────────────────────────────────────────────────────────────────

export interface DebugConfig {
    wireframe: boolean;
    showPorts: boolean;
    shadows: boolean;
    fps: boolean;
    turntable: boolean;
}
