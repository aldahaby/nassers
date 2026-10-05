import Constants from 'expo-constants';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { DATA_STATEMENT, LEGAL } from '@/config/legal';
import { Card, Pressable, colors, spacing, typography } from '@/ui';

/**
 * Privacy, Terms, Support and About. Links that don't exist yet say so rather
 * than pointing at a placeholder page (see config/legal.ts).
 */
export function TrustCard() {
  const version = Constants.expoConfig?.version ?? '—';
  return (
    <Card>
      <Text style={typography.heading}>Privacy & support</Text>
      <Text style={styles.body}>{DATA_STATEMENT}</Text>
      <View style={styles.links}>
        <LegalLink label="Privacy Policy" url={LEGAL.privacyPolicyUrl} />
        <LegalLink label="Terms of Use" url={LEGAL.termsUrl ?? LEGAL.appleStandardEulaUrl} />
        <LegalLink label="Support" url={LEGAL.supportUrl ?? (LEGAL.supportEmail ? `mailto:${LEGAL.supportEmail}` : null)} />
      </View>
      <Text style={styles.muted}>Focusling {version}</Text>
    </Card>
  );
}

function LegalLink({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return (
      <Text style={styles.pending} accessibilityLabel={`${label}: link added before launch`}>
        {label} · link added before launch
      </Text>
    );
  }
  return (
    <Pressable onPress={() => void Linking.openURL(url)} accessibilityRole="link" accessibilityLabel={label} style={styles.link}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { ...typography.body, fontSize: 14 },
  links: { gap: 2 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { ...typography.body, fontSize: 15, fontWeight: '800', color: colors.primaryDark, textDecorationLine: 'underline' },
  pending: { ...typography.body, fontSize: 14, color: colors.textMuted, paddingVertical: spacing.sm },
  muted: { ...typography.label },
});
