'use client'

import { Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, ToneMapping, N8AO } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

/**
 * The shared lighting + post-processing treatment for every 3D surface on the
 * site, so the hero, the project cards, and the skills columns all render the
 * same ceramic material rather than each card re-inventing a flat
 * `ambientLight + one directionalLight` pair.
 *
 * Two variants, because the surfaces sit on opposite backgrounds:
 *   'light' — the near-white page (hero, project cards)
 *   'dark'  — the pure-black skills section, where the components' own black
 *             bases would otherwise disappear into the background, so the rim
 *             light is pushed harder to hold an edge against it.
 */
export type RigVariant = 'light' | 'dark'

interface StudioLightsProps {
    variant?: RigVariant
    /**
     * Half-width of the shadow camera's frustum, in world units. Keep this snug
     * around the actual content: the shadow map has a fixed texel budget, so a
     * frustum twice as large as it needs to be throws away half the resolution
     * in each axis and the shadow edges go blocky.
     */
    shadowExtent?: number
    castShadow?: boolean
    /**
     * Shadow map resolution per axis. Size this to the CANVAS, not to taste: a
     * 160px-tall skills column cannot resolve a 2048² map, so paying for one is
     * pure waste — and unlike the hero (whose nodes are static) these objects
     * rotate, so their map is re-rendered every single frame. Six canvases each
     * re-rendering 4M shadow texels per frame is what drops the page to ~40fps.
     */
    shadowMapSize?: number
}

export function StudioLights({
    variant = 'light',
    shadowExtent = 6,
    castShadow = true,
    shadowMapSize = 2048,
}: StudioLightsProps) {
    const dark = variant === 'dark'

    return (
        <>
            {/* Low ambient only. Ambient adds the same value to every surface
                regardless of its normal, so a high value flattens form — it is a
                floor to stop shadows crushing to black, not a light source. */}
            <ambientLight intensity={dark ? 0.12 : 0.18} />

            <directionalLight
                position={[6, 12, 8]}
                intensity={dark ? 1.5 : 1.15}
                castShadow={castShadow}
                shadow-mapSize={[shadowMapSize, shadowMapSize]}
                shadow-camera-left={-shadowExtent}
                shadow-camera-right={shadowExtent}
                shadow-camera-top={shadowExtent}
                shadow-camera-bottom={-shadowExtent}
                shadow-camera-near={0.5}
                shadow-camera-far={40}
                // VSM compares depth distributions rather than running a hard depth
                // test, so it wants no negative constant bias — that only causes
                // light bleeding. normalBias still earns its place: these surfaces
                // are near-white and nearly coplanar, the worst case for acne.
                shadow-normalBias={0.02}
                shadow-radius={4}
                shadow-blurSamples={16}
            />

            {/* Fill — lifts the side turned away from the key. */}
            <directionalLight position={[-8, 6, -6]} intensity={dark ? 0.4 : 0.3} />
            {/* Rim — grazes the back edges. Much stronger on the dark variant,
                where it is the only thing separating a black base from a black
                background. */}
            <directionalLight position={[-2, 4, -10]} intensity={dark ? 1.2 : 0.35} />

            <StudioEnvironment variant={variant} />
        </>
    )
}

/**
 * Studio IBL assembled from Lightformers instead of drei's `preset`. The presets
 * stream an HDRI from a CDN — a multi-hundred-KB blocking fetch before the scene
 * can look correct. These panels are rendered on the GPU at mount: no network, no
 * bytes, and tuned to this specific palette.
 *
 * `frames={1}` bakes the cube map on the first frame and never re-renders it;
 * nothing in these scenes moves the environment, so paying for it every frame
 * would be pure waste.
 *
 * The base colour is DARK, deliberately. An environment is a full sphere of
 * incoming light, so filling it with the page's near-white applies that value to
 * every surface from every direction — a huge uniform lift that pushes the
 * near-white ceramic straight to clipped white. A dark base means the panels
 * below read as directional sheen rather than flat exposure.
 */
export function StudioEnvironment({ variant = 'light' }: { variant?: RigVariant }) {
    return (
        <Environment resolution={256} frames={1}>
            <color attach="background" args={[variant === 'dark' ? '#1a1d21' : '#2e3238']} />
            {/* broad softbox overhead — the main sheen across every top face */}
            <Lightformer
                intensity={0.85}
                form="rect"
                position={[0, 8, 2]}
                rotation={[-Math.PI / 2, 0, 0]}
                scale={[14, 14, 1]}
            />
            {/* warm side strip — gives the ceramic its slight cream cast */}
            <Lightformer
                intensity={0.5}
                form="rect"
                color="#fff4e2"
                position={[8, 3, 3]}
                rotation={[0, -Math.PI / 2, 0]}
                scale={[10, 6, 1]}
            />
            {/* cool opposite strip — subtle cool/warm cross-shading */}
            <Lightformer
                intensity={0.35}
                form="rect"
                color="#e8f0ff"
                position={[-8, 3, -2]}
                rotation={[0, Math.PI / 2, 0]}
                scale={[10, 6, 1]}
            />
        </Environment>
    )
}

interface StudioEffectsProps {
    /** Extra passes (e.g. the hero's Bloom) inserted before tone mapping. */
    children?: React.ReactNode
    aoRadius?: number
    aoIntensity?: number
    /**
     * 'hero' for the large feature canvas, 'card' for the small ones. AO and MSAA
     * both scale with pixel count, and the page can have six live canvases at
     * once, so the small surfaces run a cheaper chain — at 160–280px the
     * difference is not visible, but six of them is the difference between 40 and
     * 60fps.
     */
    tier?: 'hero' | 'card'
}

/**
 * The shared post chain: ambient occlusion, then tone mapping last.
 *
 * `multisampling` is not optional here. EffectComposer renders the scene into its
 * OWN framebuffer, which bypasses the MSAA on the canvas's default framebuffer
 * entirely — so without this, `antialias: true` on the Canvas silently does
 * nothing and every edge is aliased. This is the only place AA can happen once
 * post-processing is in the chain.
 *
 * AO is the largest single "detail" win. Direct lights cannot darken a crevice:
 * the seam where a top plate meets its body, the gap beneath a rounded edge, and
 * the joint where a pipe enters a face were all receiving full light, which is
 * what made the blocks read as untextured primitives.
 */
export function StudioEffects({
    children,
    aoRadius = 0.55,
    aoIntensity = 2.6,
    tier = 'hero',
}: StudioEffectsProps) {
    const hero = tier === 'hero'
    return (
        <EffectComposer multisampling={hero ? 4 : 2}>
            <N8AO
                aoRadius={aoRadius}
                distanceFalloff={0.6}
                intensity={aoIntensity}
                // Blue-grey occlusion rather than neutral black — warm ceramic
                // shadowed by a cool skylight goes cool, not grey.
                color="#2b3038"
                quality={hero ? 'medium' : 'performance'}
                halfRes
            />
            <>{children}</>
            {/* Khronos PBR Neutral, not ACES. ACES is a film curve that desaturates
                as it rolls off toward white, which on a scene that is mostly pale
                ceramic drifted the whole thing grey-blue and lost the cream cast.
                NEUTRAL holds hue and saturation up to the clip point — it exists
                specifically for product and material rendering. */}
            <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        </EffectComposer>
    )
}
