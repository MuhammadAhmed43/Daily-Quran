// Explore tab placeholder (2x2 hub: Stories/Watch/Journeys/Quiz + rails). Built in a later phase.
import { View } from 'react-native';

import { Txt } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';

export default function ExploreScreen() {
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Txt variant="h1">Explore</Txt>
        <Txt variant="subtitle">Coming soon</Txt>
      </View>
    </Screen>
  );
}
