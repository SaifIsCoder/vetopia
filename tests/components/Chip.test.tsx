import React from 'react';
import { View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { Chip } from '../../src/components/ui/Chip';

describe('Chip Component', () => {
  test('Renders chip label correctly', () => {
    const { getByText } = render(<Chip label="Veterinary Surgery" />);
    expect(getByText('Veterinary Surgery')).toBeTruthy();
  });

  test('Fires onPress when tapped and not disabled', () => {
    const onPressMock = jest.fn();
    const { getByRole } = render(
      <Chip label="Cardiology" onPress={onPressMock} accessibilityRole="button" />,
    );

    fireEvent.press(getByRole('button'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  test('Does not fire onPress when disabled is true', () => {
    const onPressMock = jest.fn();
    const { getByRole } = render(
      <Chip label="Dermatology" disabled onPress={onPressMock} accessibilityRole="button" />,
    );

    fireEvent.press(getByRole('button'));
    expect(onPressMock).not.toHaveBeenCalled();
  });

  test('Applies selected state correctly to accessibilityState', () => {
    const { getByRole } = render(<Chip label="Oncology" selected accessibilityRole="checkbox" />);
    const chip = getByRole('checkbox');
    expect(chip.props.accessibilityState).toEqual({ checked: true, disabled: false });
  });

  test('Renders leading icon when provided', () => {
    const { getByTestId, getByText } = render(
      <Chip label="Dentistry" icon={<View testID="test-chip-icon" />} />,
    );
    expect(getByTestId('test-chip-icon')).toBeTruthy();
    expect(getByText('Dentistry')).toBeTruthy();
  });
});
