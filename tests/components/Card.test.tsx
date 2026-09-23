import React from 'react';
import { render } from '@testing-library/react-native';
import { Card } from '../../src/components/ui/Card';
import { Text } from '../../src/components/ui/Text';

describe('Card Component', () => {
  test('Renders child content within styled card boundary', () => {
    const { getByText } = render(
      <Card>
        <Text>Card Content</Text>
      </Card>,
    );
    expect(getByText('Card Content')).toBeTruthy();
  });
});
