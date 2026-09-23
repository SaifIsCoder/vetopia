import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from '../../src/components/ui/Text';

describe('Text Component', () => {
  test('Renders text content properly', () => {
    const { getByText } = render(<Text>Hello Vetopia</Text>);
    expect(getByText('Hello Vetopia')).toBeTruthy();
  });

  test('Applies custom color when specified', () => {
    const { getByText } = render(<Text color="#DC2626">Emergency Alert</Text>);
    const element = getByText('Emergency Alert');
    expect(element.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#DC2626' })]),
    );
  });
});
