import { create } from 'zustand';
import type { ConnectorPort } from '@/types';

/**
 * useConnectorRegistry — Zustand slice that lets any asset register
 * its ports on mount and lets any Wire query port world-positions
 * by assetId + side.
 *
 * Usage in an asset component:
 * ```ts
 * const { registerAsset, unregisterAsset } = useConnectorRegistry();
 * useEffect(() => {
 *   registerAsset('my-server', portsList);
 *   return () => unregisterAsset('my-server');
 * }, []);
 * ```
 *
 * Usage in a Wire or scene orchestrator:
 * ```ts
 * const port = useConnectorRegistry.getState().getPort('my-server', 'left');
 * ```
 */
interface ConnectorRegistryStore {
    registry: Record<string, ConnectorPort[]>;
    registerAsset: (assetId: string, ports: ConnectorPort[]) => void;
    unregisterAsset: (assetId: string) => void;
    getPort: (assetId: string, side: ConnectorPort['side']) => ConnectorPort | undefined;
    getAllPorts: (assetId: string) => ConnectorPort[];
}

export const useConnectorRegistry = create<ConnectorRegistryStore>((set, get) => ({
    registry: {},

    registerAsset: (assetId, ports) =>
        set((state) => ({
            registry: { ...state.registry, [assetId]: ports },
        })),

    unregisterAsset: (assetId) =>
        set((state) => {
            const next = { ...state.registry };
            delete next[assetId];
            return { registry: next };
        }),

    getPort: (assetId, side) => {
        const ports = get().registry[assetId];
        return ports?.find((p) => p.side === side);
    },

    getAllPorts: (assetId) => get().registry[assetId] ?? [],
}));
