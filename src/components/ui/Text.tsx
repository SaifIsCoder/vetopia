import React from 'react';
import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography, TypographyVariant } from '../../theme/typography';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: TextStyle['textAlign'];
}

export const Text: React.FC<TextProps> = ({
  variant = 'bodyMd',
  color = colors.ink,
  align = 'left',
  maxFontSizeMultiplier = 1.3,
  style,
  children,
  ...rest
}) => {
  const typographyStyle = typography[variant] || typography.bodyMd;

  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[typographyStyle, { color, textAlign: align }, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
};
