// A single arabesque corner flourish (Openclipart "Corner flourish", CC0), tinted to the given color by
// baking it into the SVG (replacing currentColor), so it works regardless of how react-native-svg resolves
// the `color` prop. Rendered once per corner of the splash, mirrored into place by the caller.
import { useMemo } from 'react';
import { SvgXml } from 'react-native-svg';

import { CORNER_XML } from './corner-ornament-data';

export function CornerOrnament({ size, color }: { size: number; color: string }) {
  const xml = useMemo(() => CORNER_XML.replace(/currentColor/g, color), [color]);
  return <SvgXml xml={xml} width={size} height={size} />;
}
