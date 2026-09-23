import React from 'react';
import { Text, TextProps } from './Text';
import { TypographyVariant } from '../../theme/typography';

export type HeadingLevel = 1 | 2 | 3 | 4;

export interface HeadingProps extends Omit<TextProps, 'variant'> {
  level?: HeadingLevel;
}

const levelMap: Record<HeadingLevel, TypographyVariant> = {
  1: 'displayLg',
  2: 'displayMd',
  3: 'headingLg',
  4: 'headingMd',
};

export const Heading: React.FC<HeadingProps> = ({
  level = 2,
  accessibilityRole = 'header',
  ...rest
}) => {
  const variant = levelMap[level];
  return <Text variant={variant} accessibilityRole={accessibilityRole} {...rest} />;
};
