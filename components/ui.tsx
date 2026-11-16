import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/contexts/ThemeContext';
import { fonts, radii, shadows, spacing } from '@/lib/theme';

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  return (
    <LinearGradient
      colors={
        mode === 'dark'
          ? [colors.mist, colors.white, colors.mist]
          : ['#EAF6F4', '#F7F3EC', '#F3F8F7']
      }
      style={styles.flex}>
      <View
        style={[
          styles.screen,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md },
          style,
        ]}>
        {children}
      </View>
    </LinearGradient>
  );
}

export function BrandMark({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const { colors } = useTheme();
  return (
    <View style={styles.brandWrap}>
      <Text style={[styles.brand, { color: colors.oceanDeep }, size === 'sm' && styles.brandSm]}>
        EasyEvents
      </Text>
      <Text style={[styles.brandSub, { color: colors.inkSoft }]}>
        Shared plans for camps, parties & weekends
      </Text>
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.title, { color: colors.ink }]}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.subtitle, { color: colors.inkSoft }]}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.label, { color: colors.inkSoft }]}>{children}</Text>;
}

export function Field(props: TextInputProps) {
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.inkSoft}
      {...props}
      style={[
        styles.input,
        {
          backgroundColor: colors.white,
          borderColor: colors.line,
          color: colors.ink,
        },
        props.multiline && styles.inputMultiline,
        props.style,
      ]}
    />
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  const { colors, mode } = useTheme();
  const isDarkText = variant === 'secondary' || variant === 'ghost';
  const primaryBg = mode === 'dark' ? colors.ocean : colors.coral;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primaryBg },
        variant === 'secondary' && {
          backgroundColor: colors.white,
          borderWidth: 1,
          borderColor: colors.line,
        },
        variant === 'ghost' && { backgroundColor: 'transparent', borderWidth: 0 },
        variant === 'danger' && { backgroundColor: colors.danger },
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={isDarkText ? colors.ocean : '#FFFFFF'} />
      ) : (
        <Text style={[styles.buttonText, { color: isDarkText ? colors.oceanDeep : '#FFFFFF' }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.white, borderColor: colors.line },
        style,
      ]}>
      {children}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.ocean : colors.white,
          borderColor: active ? colors.ocean : colors.line,
        },
      ]}>
      <Text style={[styles.chipText, { color: active ? '#FFFFFF' : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.inkSoft }]}>{body}</Text>
    </View>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  const { colors } = useTheme();
  if (!children) return null;
  return <Text style={[styles.error, { color: colors.danger }]}>{children}</Text>;
}

export function Avatar({
  name,
  uri,
  size = 44,
}: {
  name: string;
  uri?: string | null;
  size?: number;
}) {
  const { colors } = useTheme();
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.aquaSoft,
        },
      ]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={[styles.avatarText, { fontSize: size * 0.34, color: colors.oceanDeep }]}>
          {initials || '?'}
        </Text>
      )}
    </View>
  );
}

export function ModalSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalCard, { backgroundColor: colors.mist }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.oceanDeep }]}>{title}</Text>
            <Pressable onPress={onClose}>
              <Text style={[styles.modalClose, { color: colors.aqua }]}>Close</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function ActionRow({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.actionRow, { backgroundColor: colors.white, borderColor: colors.line }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionTitle, { color: colors.ink }]}>{title}</Text>
        <Text style={[styles.actionSubtitle, { color: colors.inkSoft }]}>{subtitle}</Text>
      </View>
      <Text style={[styles.actionChevron, { color: colors.inkSoft }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  brandWrap: {
    marginBottom: spacing.lg,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 42,
    letterSpacing: -1,
  },
  brandSm: {
    fontSize: 28,
  },
  brandSub: {
    marginTop: spacing.xs,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  title: {
    fontFamily: fonts.displayMedium,
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  button: {
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  card: {
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  chip: {
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
  },
  error: {
    fontFamily: fonts.bodyMedium,
    marginTop: spacing.sm,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    fontFamily: fonts.bodyBold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(19, 38, 47, 0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontFamily: fonts.displayMedium,
    fontSize: 24,
  },
  modalClose: {
    fontFamily: fonts.bodyBold,
  },
  actionRow: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  actionSubtitle: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  actionChevron: {
    fontSize: 28,
    lineHeight: 28,
  },
});
