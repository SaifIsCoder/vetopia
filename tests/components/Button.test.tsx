import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../../src/components/ui/Button';

describe('Button Component', () => {
  test('Renders button title correctly', () => {
    const { getByText } = render(<Button title="Book Consultation" />);
    expect(getByText('Book Consultation')).toBeTruthy();
  });

  test('Fires onPress event when tapped', () => {
    const onPressMock = jest.fn();
    const { getByRole } = render(<Button title="Confirm" onPress={onPressMock} />);

    fireEvent.press(getByRole('button'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  test('Renders loading indicator and disables press when loading is true', () => {
    const onPressMock = jest.fn();
    const { getByTestId, queryByText } = render(
      <Button title="Submit" loading onPress={onPressMock} />,
    );

    expect(getByTestId('button-activity-indicator')).toBeTruthy();
    expect(queryByText('Submit')).toBeNull();
  });

  test('Respects disabled state', () => {
    const onPressMock = jest.fn();
    const { getByRole } = render(<Button title="Disabled Action" disabled onPress={onPressMock} />);

    fireEvent.press(getByRole('button'));
    expect(onPressMock).not.toHaveBeenCalled();
  });
});
