// Community tab placeholder (Ameen wall + live du'as + Islamic events). Built in a later phase.
import { View } from 'react-native';

import { Txt } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';

export default function CommunityScreen() {
  return (
    <Screen stars>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Txt variant="h1">Community</Txt>
        <Txt variant="subtitle">Coming soon</Txt>
      </View>
    </Screen>
  );
}
