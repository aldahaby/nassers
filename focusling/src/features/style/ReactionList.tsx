import { Pressable, StyleSheet, Text, View } from "react-native";
import { getCollection } from "@/config/collections";
import { getReaction, PERSONALITIES, REACTIONS } from "@/config/reactions";
import { useGameStore } from "@/state";
import {
  ReactionIcon,
  TabIcon,
  colors,
  radius,
  spacing,
  typography,
} from "@/ui";

interface Props {
  /** Play a reaction on the preview pet (works for locked ones too; nothing unlocks). */
  onPreview: (reactionId: string) => void;
  columns: number;
}

/**
 * Reactions, grouped by personality family (Calm, Hype, Dreamy, Cool): tap to
 * preview on the pet; set one as the favourite the pet uses on its own. The
 * family is presentation only (copy and grouping), never a stat.
 */
export function ReactionList({ onPreview, columns }: Props) {
  const reactions = useGameStore((s) => s.save?.cosmetics.reactions);
  const { equipReaction } = useGameStore.getState();
  if (!reactions) return null;
  const favoriteFamily = getReaction(reactions.equipped ?? "")?.personality;

  return (
    <View style={styles.families}>
      {PERSONALITIES.map((family) => (
        <View key={family.id} style={styles.family}>
          <View
            style={[styles.familyHeader, { backgroundColor: family.tint }]}
            accessible
            accessibilityRole="header"
            accessibilityLabel={`${family.name}: ${family.line}${favoriteFamily === family.id ? " Your favourite is in this family." : ""}`}
          >
            <Text style={[styles.familyName, { color: family.ink }]}>
              {family.name}
            </Text>
            <Text
              style={[styles.familyLine, { color: family.ink }]}
              numberOfLines={2}
            >
              {family.line}
            </Text>
            {favoriteFamily === family.id && (
              <View style={styles.familyYou}>
                <TabIcon name="check" color={family.ink} size={12} />
                <Text style={[styles.familyYouText, { color: family.ink }]}>
                  You
                </Text>
              </View>
            )}
          </View>
          <View style={styles.grid}>
            {REACTIONS.filter((r) => r.personality === family.id).map((r) => {
              const unlocked = reactions.unlocked.includes(r.id);
              const favorite = reactions.equipped === r.id;
              const how =
                r.unlock.kind === "collection"
                  ? `Complete ${getCollection(r.unlock.collectionId)?.name ?? "its collection"}`
                  : "Everyone has this";
              return (
                <View
                  key={r.id}
                  style={{ width: `${100 / columns}%`, padding: spacing.xs }}
                >
                  <View style={[styles.card, favorite && styles.cardFav]}>
                    <Pressable
                      onPress={() => onPreview(r.id)}
                      style={styles.preview}
                      accessibilityRole="button"
                      accessibilityLabel={`Preview ${r.name}. ${r.description}${unlocked ? "" : ` Locked: ${how}.`}${favorite ? " Favourite." : ""}`}
                    >
                      <View
                        style={[styles.icon, !unlocked && styles.iconLocked]}
                      >
                        <ReactionIcon style={r.style} size={40} />
                      </View>
                      <Text style={styles.name}>{r.name}</Text>
                      <Text style={styles.desc} numberOfLines={2}>
                        {unlocked ? r.description : how}
                      </Text>
                    </Pressable>
                    {favorite ? (
                      <View style={styles.status}>
                        <TabIcon
                          name="check"
                          color={colors.success}
                          size={14}
                        />
                        <Text style={styles.favText}>Favourite</Text>
                      </View>
                    ) : unlocked ? (
                      <Pressable
                        onPress={() => equipReaction(r.id)}
                        style={styles.set}
                        accessibilityRole="button"
                        accessibilityLabel={`Make ${r.name} your favourite`}
                      >
                        <Text style={styles.setText}>Make favourite</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.status}>
                        <TabIcon
                          name="lock"
                          color={colors.textMuted}
                          size={13}
                        />
                        <Text style={styles.lockText}>Locked</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  families: { gap: spacing.lg },
  family: { gap: spacing.xs },
  familyHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  familyName: { fontSize: 16, fontWeight: "900" },
  familyLine: { fontSize: 13, fontWeight: "600", flexShrink: 1 },
  familyYou: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginLeft: "auto",
  },
  familyYouText: { fontSize: 12, fontWeight: "900" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
    gap: 6,
    minHeight: 178,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardFav: { borderColor: colors.success, backgroundColor: colors.successSoft },
  preview: { alignItems: "center", gap: 2, alignSelf: "stretch" },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.stageGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  iconLocked: { opacity: 0.55 },
  name: {
    ...typography.body,
    fontWeight: "900",
    fontSize: 14,
    textAlign: "center",
  },
  desc: { ...typography.label, fontSize: 11, textAlign: "center" },
  status: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32 },
  favText: { fontSize: 12, fontWeight: "900", color: colors.success },
  lockText: { fontSize: 12, fontWeight: "800", color: colors.textMuted },
  set: {
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
  },
  setText: { fontSize: 12, fontWeight: "800", color: colors.primaryDark },
});
