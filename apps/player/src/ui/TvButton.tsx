import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

interface TvButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  tone?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
}

export function TvButton({
  label,
  tone = 'primary',
  disabled,
  style,
  onFocus,
  onBlur,
  ...props
}: TvButtonProps) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      {...props}
      disabled={disabled}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      style={({ pressed }) => [
        styles.button,
        tone === 'secondary' ? styles.secondary : null,
        tone === 'danger' ? styles.danger : null,
        focused ? styles.focused : null,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text style={[styles.label, tone === 'secondary' ? styles.secondaryLabel : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#248f88',
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 3,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 24,
  },
  secondary: {
    backgroundColor: '#1b1424',
    borderColor: '#512a70',
  },
  danger: {
    backgroundColor: '#d84a1a',
  },
  focused: {
    borderColor: '#f6aa18',
    transform: [{ scale: 1.035 }],
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  secondaryLabel: {
    color: '#f7efff',
  },
});
