import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '@/ui/theme';
import { Button } from './Button';

interface Props {
  visible: boolean;
  title: string;
  children?: ReactNode;
  /** The safe, recommended choice. Rendered as the prominent button. */
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * In-app confirmation sheet (native alerts don't exist on web).
 * The cancel action is the visually primary one.
 */
export function ConfirmDialog({ visible, title, children, cancelLabel, confirmLabel, onCancel, onConfirm }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Close">
        <Pressable style={[styles.sheet, shadow]} onPress={() => undefined} accessibilityViewIsModal>
          <Text style={[typography.heading, styles.center]}>{title}</Text>
          {children}
          <View style={styles.actions}>
            <Button label={cancelLabel} onPress={onCancel} />
            <Button label={confirmLabel} onPress={onConfirm} variant="ghost" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(47, 37, 72, 0.35)', justifyContent: 'center', padding: spacing.xl },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, maxWidth: 420, width: '100%', alignSelf: 'center' },
  center: { textAlign: 'center' },
  actions: { gap: spacing.xs, marginTop: spacing.sm },
});
