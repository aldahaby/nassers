import { memo } from 'react';
import { Text } from 'react-native';
import Svg from 'react-native-svg';
import { getShopItem } from '@/config/shopCatalog';
import { ACCESSORY_ART, ACCESSORY_ICON_VIEWBOX } from '@/ui/pet/accessories';
import { ANATOMY } from '@/ui/pet/anatomy';
import { DECORATION_ART, DECORATION_ICON_VIEWBOX } from '@/ui/room/decorations';
import { TOY_FOOD_ART } from './toyFoodArt';

/**
 * The icon for any shop item. Accessories and decorations are cropped from the
 * same artwork drawn on the pet and in the room; toys and food have their own.
 */
export const ItemArt = memo(function ItemArt({ itemId, size }: { itemId: string; size: number }) {
  const accessory = ACCESSORY_ART[itemId];
  if (accessory) {
    return (
      <Svg width={size} height={size} viewBox={ACCESSORY_ICON_VIEWBOX[itemId] ?? '0 0 200 200'}>
        {accessory(ANATOMY.cloudling)}
      </Svg>
    );
  }
  const decoration = DECORATION_ART[itemId];
  if (decoration) {
    return (
      <Svg width={size} height={size} viewBox={DECORATION_ICON_VIEWBOX[itemId] ?? '0 0 360 300'}>
        {decoration()}
      </Svg>
    );
  }
  const art = TOY_FOOD_ART[itemId];
  if (art) {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {art()}
      </Svg>
    );
  }
  // Fallback until an item gets vector art.
  return <Text style={{ fontSize: size * 0.6, textAlign: 'center' }}>{getShopItem(itemId)?.icon ?? '🎁'}</Text>;
});
