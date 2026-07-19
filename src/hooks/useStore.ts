import { create } from 'zustand';
import type { CameraMode } from '@/types';

/**
 * Global app store — camera mode, active asset, debug flags, screenshot trigger.
 * All scene components subscribe to slices they need.
 */
interface AppStore {
    // Asset selection
    activeAsset: string;
    setActiveAsset: (asset: string) => void;

    // Camera
    cameraMode: CameraMode;
    setCameraMode: (mode: CameraMode) => void;

    // Debug overlay
    debugMode: boolean;
    setDebugMode: (v: boolean) => void;

    // Individual debug flags (kept in sync by DebugPanel)
    wireframe: boolean;
    setWireframe: (v: boolean) => void;

    showPorts: boolean;
    setShowPorts: (v: boolean) => void;

    turntable: boolean;
    setTurntable: (v: boolean) => void;

    shadows: boolean;
    setShadows: (v: boolean) => void;

    // Character Tools
    workerTool: 'wrench' | 'hammer' | 'sledgehammer';
    setWorkerTool: (tool: 'wrench' | 'hammer' | 'sledgehammer') => void;

    workerState: 'idle' | 'walk' | 'run' | 'stop' | 'inspect' | 'point' | 'celebrate';
    setWorkerState: (state: 'idle' | 'walk' | 'run' | 'stop' | 'inspect' | 'point' | 'celebrate') => void;

    workerPathEnabled: boolean;
    setWorkerPathEnabled: (v: boolean) => void;

    // Gesture trigger communication channel
    triggerGesture: string | null;
    setTriggerGesture: (v: string | null) => void;

    // Screenshot handshake
    screenshotRequested: boolean;
    requestScreenshot: () => void;
    clearScreenshotRequest: () => void;
}

export const useStore = create<AppStore>((set) => ({
    activeAsset: 'ConstructionWorker', // Set default to our new worker asset
    setActiveAsset: (asset) => set({ activeAsset: asset }),

    cameraMode: 'orbit',
    setCameraMode: (mode) => set({ cameraMode: mode }),

    debugMode: false,
    setDebugMode: (v) => set({ debugMode: v }),

    wireframe: false,
    setWireframe: (v) => set({ wireframe: v }),

    showPorts: false,
    setShowPorts: (v) => set({ showPorts: v }),

    turntable: false,
    setTurntable: (v) => set({ turntable: v }),

    shadows: true,
    setShadows: (v) => set({ shadows: v }),

    workerTool: 'wrench',
    setWorkerTool: (tool) => set({ workerTool: tool }),

    workerState: 'idle',
    setWorkerState: (state) => set({ workerState: state }),

    workerPathEnabled: false,
    setWorkerPathEnabled: (v) => set({ workerPathEnabled: v }),

    triggerGesture: null,
    setTriggerGesture: (v) => set({ triggerGesture: v }),

    screenshotRequested: false,
    requestScreenshot: () => set({ screenshotRequested: true }),
    clearScreenshotRequest: () => set({ screenshotRequested: false }),
}));
