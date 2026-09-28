import { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import type { GrowthStage, PetSpeciesId } from '@/core';
import type { PetSpecies } from '@/config/pets';
import { mix } from '@/ui/color';
import { useArtScope } from './artScope';
import { STAGE_RANK } from './crest';
import { SPECIES_ART, type SpeciesArt } from './speciesArt';

interface Props {
  speciesId: PetSpeciesId;
  palette: PetSpecies['palette'];
  stage: GrowthStage;
}

/**
 * Body silhouette and species features (crests are drawn by PetCrest).
 *
 * Detail hierarchy (docs/ART_DIRECTION.md): the silhouette and face carry the
 * pet at phone size; a soft body gradient, a rim light and a few species cues
 * reward a closer look. Detail grows with the stage: babies are simplest,
 * Evolved gets one signature flourish. Flat SVG only (no blur or filters).
 */
export function PetBody({ speciesId, palette, stage }: Props) {
  const rank = STAGE_RANK[stage];
  const art = SPECIES_ART[speciesId];
  const sc = useArtScope();
  switch (speciesId) {
    case 'cloudling':
      return <CloudlingBody palette={palette} rank={rank} art={art} sc={sc} />;
    case 'sproutling':
      return <SproutlingBody palette={palette} rank={rank} art={art} sc={sc} />;
    case 'emberling':
      return <EmberlingBody palette={palette} rank={rank} art={art} sc={sc} />;
  }
}

type BodyProps = { palette: PetSpecies['palette']; rank: number; art: SpeciesArt; sc: string };

/** Shared soft-volume gradient: a light top-left, the body colour, a shaded edge. */
function BodyGradient({ id, palette, art, cx = '38%', cy = '30%' }: { id: string; palette: BodyProps['palette']; art: SpeciesArt; cx?: string; cy?: string }) {
  return (
    <RadialGradient id={id} cx={cx} cy={cy} r="78%">
      <Stop offset="0" stopColor={art.highlight} />
      <Stop offset="0.45" stopColor={palette.body} />
      <Stop offset="1" stopColor={mix(palette.body, palette.bodyShade, 0.85)} />
    </RadialGradient>
  );
}

function Feet({ color, rank }: { color: string; rank: number }) {
  return (
    <G>
      {[78, 122].map((x) => (
        <G key={x}>
          <Ellipse cx={x} cy={172} rx={15} ry={9} fill={color} />
          {/* A tiny toe line and a sole highlight: paws, not blobs. */}
          {rank >= 1 && <Path d={`M${x - 3} 176 L${x - 3} 179 M${x + 3} 176 L${x + 3} 179`} stroke="#000000" strokeWidth={1.4} strokeLinecap="round" opacity={0.14} />}
          <Ellipse cx={x - 4} cy={168.5} rx={5} ry={2} fill="#FFFFFF" opacity={0.25} />
        </G>
      ))}
    </G>
  );
}

const CLOUD =
  'M100 66 C118 66 128 76 131 86 C148 84 162 98 160 116 C170 124 168 146 154 154 C148 168 128 174 100 174 C72 174 52 168 46 154 C32 146 30 124 40 116 C38 98 52 84 69 86 C72 76 82 66 100 66 Z';

function CloudlingBody({ palette, rank, art, sc }: BodyProps) {
  return (
    <G>
      <Defs>
        <BodyGradient id={`pb-cloud${sc}`} palette={palette} art={art} />
        <LinearGradient id={`pb-cloud-holo${sc}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFD1F3" />
          <Stop offset="0.5" stopColor="#BFF3FF" />
          <Stop offset="1" stopColor="#FFF2B8" />
        </LinearGradient>
      </Defs>
      {rank >= 1 && (
        // Little puff "wings" on the sides, each with its own highlight.
        <G>
          {[36, 164].map((x) => (
            <G key={x}>
              <Circle cx={x} cy={122} r={rank >= 2 ? 16 : 12} fill={palette.accent} opacity={0.92} />
              <Circle cx={x + (x < 100 ? 4 : -4)} cy={128} r={rank >= 2 ? 9 : 7} fill={art.crease} opacity={0.1} />
            </G>
          ))}
        </G>
      )}
      <Feet color={palette.bodyShade} rank={rank} />
      <Path d={CLOUD} fill={`url(#pb-cloud${sc})`} />
      {/* Lower lobes sit in soft shadow: volume differences between puffs. */}
      <Path d="M46 150 C52 166 72 174 100 174 C128 174 148 166 154 150 C140 162 122 166 100 166 C78 166 60 162 46 150 Z" fill={palette.bodyShade} opacity={0.55} />
      {/* Cool creases where one puff tucks under the next. */}
      <Path
        d="M69 86 C72 92 76 96 82 98 M131 86 C128 92 124 96 118 98 M40 116 C45 119 50 121 56 121 M160 116 C155 119 150 121 144 121"
        stroke={art.crease}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
        opacity={0.28}
      />
      {rank >= 1 && <Path d="M46 154 C51 153 55 151 58 148 M154 154 C149 153 145 151 142 148" stroke={art.crease} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.22} />}
      {/* Edge highlights: light catching the top of each puff. */}
      <Path d="M86 72 Q100 64 114 72 M50 100 Q54 91 64 89 M150 100 Q146 91 136 89" stroke={art.rim} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.6} />
      {rank >= 3 && <Path d="M72 80 Q100 58 128 80" stroke={`url(#pb-cloud-holo${sc})`} strokeWidth={3.4} strokeLinecap="round" fill="none" opacity={0.85} />}
      {/* A cloud-shaped belly (three soft bumps), not a plain oval. */}
      <Path d="M70 156 C66 146 76 138 86 141 C90 133 110 133 114 141 C124 138 134 146 130 156 C126 164 74 164 70 156 Z" fill={palette.belly} opacity={0.92} />
      <Path d="M80 143 C84 139 89 139 92 141" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.8} />
      {rank >= 2 && (
        // Crescent moon mark on the belly.
        <Path d="M104 142 A9 9 0 1 0 104 158 A7 7 0 1 1 104 142 Z" fill={palette.bodyShade} />
      )}
      {rank >= 3 && <Path d="M112 144 l1.2 2.6 2.8 .4 -2 2 .5 2.8 -2.5 -1.3 -2.5 1.3 .5 -2.8 -2 -2 2.8 -.4 Z" fill="#FFD166" />}
      <Circle cx={80} cy={80} r={6} fill={palette.accent} opacity={0.55} />
    </G>
  );
}

const BEAN = 'M100 64 C136 64 158 92 158 124 C158 156 134 174 100 174 C66 174 42 156 42 124 C42 92 64 64 100 64 Z';

function SproutlingBody({ palette, rank, art, sc }: BodyProps) {
  return (
    <G>
      <Defs>
        <BodyGradient id={`pb-sprout${sc}`} palette={palette} art={art} />
      </Defs>
      <Feet color={palette.bodyShade} rank={rank} />
      <Path d={BEAN} fill={`url(#pb-sprout${sc})`} />
      <Path d="M44 138 C50 160 72 174 100 174 C128 174 150 160 156 138 C146 156 126 166 100 166 C74 166 54 156 44 138 Z" fill={palette.bodyShade} opacity={0.5} />
      {/* Seed-coat lines down the sides: a quiet plant cue. */}
      {rank >= 1 && <Path d="M56 96 C50 112 50 132 58 148 M144 96 C150 112 150 132 142 148" stroke={art.crease} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.18} />}
      {/* Rim light and a dewdrop highlight. */}
      <Path d="M66 80 Q84 66 104 66" stroke={art.rim} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.55} />
      <Ellipse cx={70} cy={92} rx={5} ry={3.4} fill="#FFFFFF" opacity={0.55} transform="rotate(-30 70 92)" />
      <Circle cx={77} cy={86} r={1.5} fill="#FFFFFF" opacity={0.7} />
      <Ellipse cx={100} cy={150} rx={30} ry={18} fill={palette.belly} opacity={0.92} />
      <Path d="M80 140 Q88 134 98 134" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.75} />
      {rank >= 2 && (
        // Leaf freckles.
        <G fill={palette.bodyShade}>
          <Circle cx={60} cy={100} r={3} />
          <Circle cx={66} cy={92} r={2.2} />
          <Circle cx={140} cy={100} r={3} />
          <Circle cx={134} cy={92} r={2.2} />
        </G>
      )}
      {rank >= 3 && (
        // Evolved: a tiny leaf mark on the belly.
        <Path d="M100 158 C96 152 98 146 104 144 C106 150 104 155 100 158 Z" fill={palette.accent} opacity={0.8} />
      )}
    </G>
  );
}

const DROP = 'M100 58 C112 76 158 96 158 130 C158 158 134 174 100 174 C66 174 42 158 42 130 C42 96 88 76 100 58 Z';

function EmberlingBody({ palette, rank, art, sc }: BodyProps) {
  const flameColor = rank >= 3 ? '#FFE27A' : palette.accent;
  return (
    <G>
      <Defs>
        {/* Warmth glows from inside: the light core sits low and central. */}
        <BodyGradient id={`pb-ember${sc}`} palette={palette} art={art} cx="45%" cy="55%" />
        <RadialGradient id={`pb-ember-core-${rank}${sc}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={rank >= 3 ? '#FFE9A8' : '#FFD9B8'} stopOpacity={0.9} />
          <Stop offset="1" stopColor={palette.body} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id={`pb-ember-tail-${rank}${sc}`} x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor="#FF8A3D" />
          <Stop offset="1" stopColor={flameColor} />
        </LinearGradient>
      </Defs>
      {rank >= 2 && (
        // Tail wisp.
        <Path d="M150 158 C170 156 178 140 172 126 C168 140 160 146 146 148 Z" fill={`url(#pb-ember-tail-${rank}${sc})`} />
      )}
      <Feet color={palette.bodyShade} rank={rank} />
      <Path d={DROP} fill={`url(#pb-ember${sc})`} />
      <Ellipse cx={100} cy={138} rx={44} ry={34} fill={`url(#pb-ember-core-${rank}${sc})`} />
      <Path d="M44 142 C52 162 72 174 100 174 C128 174 148 162 156 142 C146 158 126 166 100 166 C74 166 54 158 44 142 Z" fill={palette.bodyShade} opacity={0.5} />
      <Path d="M72 96 Q86 80 98 66" stroke={art.rim} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.55} />
      <Ellipse cx={100} cy={152} rx={30} ry={17} fill={palette.belly} opacity={0.92} />
      {rank >= 2 && (
        // Spark mark on the belly.
        <Path d="M100 142 L103 150 L111 152 L103 154 L100 162 L97 154 L89 152 L97 150 Z" fill={palette.accent} />
      )}
      {rank >= 1 && (
        // A couple of tiny embers drifting off the crest.
        <G>
          <Circle cx={80} cy={70} r={1.8} fill="#FFE27A" opacity={0.9} />
          <Circle cx={122} cy={62} r={1.4} fill="#FFE27A" opacity={0.8} />
          {rank >= 3 && <Circle cx={128} cy={78} r={1.2} fill="#FFF3C4" opacity={0.9} />}
        </G>
      )}
    </G>
  );
}
