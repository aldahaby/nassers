import { Text } from 'react-native';
import { MissionList } from '@/features/missions/MissionList';
import { Screen, typography } from '@/ui';

export default function ChildMissionsScreen() {
  return (
    <Screen scroll>
      <Text style={typography.title} accessibilityRole="header">
        Missions
      </Text>
      <MissionList />
    </Screen>
  );
}
