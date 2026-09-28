import { Circle, Ellipse, G, Path } from 'react-native-svg';
import type { GrowthStage, PetSpeciesId } from '@/core';
import type { PetSpecies } from '@/config/pets';
import { STAGE_RANK } from './crest';

interface Props {
  speciesId: PetSpeciesId;
  palette: PetSpecies['palette'];
  stage: GrowthStage;
}

/** Body silhouette and species features. Features grow with the stage. Crests are drawn by PetCrest. */
export function PetBody({ speciesId, palette, stage }: Props) {
  const rank = STAGE_RANK[stage];
  switch (speciesId) {
    case 'cloudling':
      return <CloudlingBody palette={palette} rank={rank} />;
    case 'sproutling':
      return <SproutlingBody palette={palette} rank={rank} />;
    case 'emberling':
      return <EmberlingBody palette={palette} rank={rank} />;
  }
}

type BodyProps = { palette: PetSpecies['palette']; rank: number };

function Feet({ color }: { color: string }) {
  return (
    <G>
      <Ellipse cx={78} cy={172} rx={15} ry={9} fill={color} />
      <Ellipse cx={122} cy={172} rx={15} ry={9} fill={color} />
    </G>
  );
}

function CloudlingBody({ palette, rank }: BodyProps) {
  return (
    <G>
      {rank >= 1 && (
        // Little puff "wings" on the sides.
        <G>
          <Circle cx={36} cy={122} r={rank >= 2 ? 16 : 12} fill={palette.accent} opacity={0.9} />
          <Circle cx={164} cy={122} r={rank >= 2 ? 16 : 12} fill={palette.accent} opacity={0.9} />
        </G>
      )}
      <Feet color={palette.bodyShade} />
      <Path
        d="M100 66 C118 66 128 76 131 86 C148 84 162 98 160 116 C170 124 168 146 154 154 C148 168 128 174 100 174 C72 174 52 168 46 154 C32 146 30 124 40 116 C38 98 52 84 69 86 C72 76 82 66 100 66 Z"
        fill={palette.body}
      />
      <Path
        d="M46 150 C52 166 72 174 100 174 C128 174 148 166 154 150 C140 162 122 166 100 166 C78 166 60 162 46 150 Z"
        fill={palette.bodyShade}
        opacity={0.6}
      />
      <Ellipse cx={100} cy={150} rx={32} ry={17} fill={palette.belly} opacity={0.9} />
      {rank >= 2 && (
        // Crescent moon mark on the belly.
        <Path d="M104 142 A9 9 0 1 0 104 158 A7 7 0 1 1 104 142 Z" fill={palette.bodyShade} />
      )}
      <Circle cx={80} cy={80} r={6} fill={palette.accent} opacity={0.6} />
    </G>
  );
}

function SproutlingBody({ palette, rank }: BodyProps) {
  // The sprout is a crest (ui/pet/crest.tsx), placed by PetArt around headwear.
  return (
    <G>
      <Feet color={palette.bodyShade} />
      <Path
        d="M100 64 C136 64 158 92 158 124 C158 156 134 174 100 174 C66 174 42 156 42 124 C42 92 64 64 100 64 Z"
        fill={palette.body}
      />
      <Path
        d="M44 138 C50 160 72 174 100 174 C128 174 150 160 156 138 C146 156 126 166 100 166 C74 166 54 156 44 138 Z"
        fill={palette.bodyShade}
        opacity={0.55}
      />
      <Ellipse cx={100} cy={150} rx={30} ry={18} fill={palette.belly} opacity={0.9} />
      {rank >= 2 && (
        // Leaf freckles.
        <G fill={palette.bodyShade}>
          <Circle cx={60} cy={100} r={3} />
          <Circle cx={66} cy={92} r={2.2} />
          <Circle cx={140} cy={100} r={3} />
          <Circle cx={134} cy={92} r={2.2} />
        </G>
      )}
    </G>
  );
}

function EmberlingBody({ palette, rank }: BodyProps) {
  const flameColor = rank >= 3 ? '#FFE27A' : palette.accent;
  return (
    <G>
      {rank >= 2 && (
        // Tail wisp.
        <Path d="M150 158 C170 156 178 140 172 126 C168 140 160 146 146 148 Z" fill={flameColor} />
      )}
      <Feet color={palette.bodyShade} />
      <Path
        d="M100 58 C112 76 158 96 158 130 C158 158 134 174 100 174 C66 174 42 158 42 130 C42 96 88 76 100 58 Z"
        fill={palette.body}
      />
      {/* The flame tuft is a crest (ui/pet/crest.tsx), placed by PetArt around headwear. */}
      <Path
        d="M44 142 C52 162 72 174 100 174 C128 174 148 162 156 142 C146 158 126 166 100 166 C74 166 54 158 44 142 Z"
        fill={palette.bodyShade}
        opacity={0.55}
      />
      <Ellipse cx={100} cy={152} rx={30} ry={17} fill={palette.belly} opacity={0.9} />
      {rank >= 2 && (
        // Spark mark on the belly.
        <Path d="M100 142 L103 150 L111 152 L103 154 L100 162 L97 154 L89 152 L97 150 Z" fill={palette.accent} />
      )}
    </G>
  );
}
