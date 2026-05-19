import React from 'react';
import { Tabs } from 'expo-router';
import { Home, CheckCircle2, Clock, Settings } from 'lucide-react-native';
import { Colors } from '@/ui/theme/colors';

export default function TabLayout(): React.JSX.Element {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary900 },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: { backgroundColor: Colors.primary900, borderTopColor: Colors.primary700 },
        tabBarActiveTintColor: Colors.white,
        tabBarInactiveTintColor: Colors.primary300,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tasks',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="confirmations"
        options={{
          title: 'Confirm',
          tabBarLabel: 'Confirm',
          tabBarIcon: ({ color, size }) => <CheckCircle2 color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => <Clock color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
