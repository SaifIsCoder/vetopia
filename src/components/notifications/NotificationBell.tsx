import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { Text } from '../ui/Text';
import { colors } from '../../theme/colors';
import { useUnreadNotificationCount } from '../../hooks/useNotifications';

interface NotificationBellProps {
  size?: number;
  color?: string;
}

export function NotificationBell({ size = 22, color = colors.ink }: NotificationBellProps) {
  const router = useRouter();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();

  const handlePress = () => {
    router.push('/notifications' as any);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={`Notifications, ${unreadCount} unread`}
    >
      <Bell size={size} color={color} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount.toString()}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 6,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#DC2626',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
});
