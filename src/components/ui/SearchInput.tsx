import React from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { Input, InputProps } from './Input';
import { IconButton } from './IconButton';

export interface SearchInputProps extends Omit<InputProps, 'leftIcon' | 'rightIcon'> {
  onClear?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onClear,
  placeholder = 'Search...',
  containerStyle,
  ...rest
}) => {
  return (
    <Input
      value={value}
      placeholder={placeholder}
      containerStyle={[styles.container, containerStyle]}
      leftIcon={<Search size={18} color={colors.muted} />}
      rightIcon={
        value && onClear ? (
          <IconButton
            icon={<X size={16} color={colors.muted} />}
            accessibilityLabel="Clear search input"
            size={32}
            onPress={onClear}
          />
        ) : undefined
      }
      {...rest}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.pill,
  },
});
