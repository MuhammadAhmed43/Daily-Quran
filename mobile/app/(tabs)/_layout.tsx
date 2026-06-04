// 5-tab bottom bar (dark premium): Ask | Community | Today(center) | Qur'an | Explore.
// See UI-REDESIGN-SPEC.md §2.1. stories + prayer kept as routes but hidden from the tab bar (folded
// into Explore / Today respectively).
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { MiniPlayer } from '@/components/mini-player';
import { c, font } from '@/lib/theme';

export const unstable_settings = {
  initialRouteName: 'today',
};

function tabIcon(active: keyof typeof Ionicons.glyphMap, inactive: keyof typeof Ionicons.glyphMap) {
  const Comp = ({ color, focused, size }: { color: string; focused: boolean; size: number }) => (
    <Ionicons name={focused ? active : inactive} size={size ?? 24} color={color} />
  );
  Comp.displayName = 'TabIcon';
  return Comp;
}

export default function TabLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarActiveTintColor: c.accent,
          tabBarInactiveTintColor: c.textMuted,
          tabBarStyle: {
            backgroundColor: c.navBar,
            borderTopColor: c.hairline,
            borderTopWidth: StyleSheet.hairlineWidth,
            elevation: 0,
          },
          tabBarLabelStyle: { fontFamily: font.sansMed, fontSize: 10, marginTop: 1 },
        }}>
        <Tabs.Screen name="chat" options={{ title: 'Ask', tabBarIcon: tabIcon('sparkles', 'sparkles-outline') }} />
        <Tabs.Screen name="community" options={{ title: 'Community', tabBarIcon: tabIcon('people', 'people-outline') }} />
        <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: tabIcon('sunny', 'sunny-outline') }} />
        <Tabs.Screen name="index" options={{ title: "Qur'an", tabBarIcon: tabIcon('book', 'book-outline') }} />
        <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: tabIcon('compass', 'compass-outline') }} />
        {/* kept as routes, hidden from the bar */}
        <Tabs.Screen name="stories" options={{ href: null }} />
        <Tabs.Screen name="prayer" options={{ href: null }} />
      </Tabs>
      <MiniPlayer />
    </View>
  );
}
