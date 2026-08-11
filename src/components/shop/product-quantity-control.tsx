import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { dashboardColors, dashboardRadii } from '../../dashboardTheme';
import { PressableScale } from '../PressableScale';

export function ProductQuantityControl({
  onAdd,
  onDecrement,
  onIncrement,
  productName,
  quantity,
}: {
  onAdd: () => void;
  onDecrement: () => void;
  onIncrement: () => void;
  productName: string;
  quantity: number;
}) {
  if (quantity === 0) {
    return (
      <PressableScale
        accessibilityLabel={`Add ${productName} to bag`}
        onPress={onAdd}
        pressedScale={0.95}
        style={styles.addButton}
      >
        <Ionicons color="#FFFFFF" name="add" size={19} />
        <Text style={styles.addButtonText}>Add</Text>
      </PressableScale>
    );
  }

  return (
    <View style={styles.control}>
      <PressableScale
        accessibilityLabel={
          quantity === 1
            ? `Remove ${productName} from bag`
            : `Decrease ${productName} quantity, currently ${quantity}`
        }
        onPress={onDecrement}
        pressedScale={0.88}
        style={styles.stepButton}
      >
        <Ionicons color={dashboardColors.primary} name="remove" size={18} />
      </PressableScale>
      <Text style={styles.quantityValue}>Qty {quantity}</Text>
      <PressableScale
        accessibilityLabel={`Increase ${productName} quantity, currently ${quantity}`}
        onPress={onIncrement}
        pressedScale={0.88}
        style={styles.stepButton}
      >
        <Ionicons color={dashboardColors.primary} name="add" size={18} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: 6,
    height: 48,
    justifyContent: 'center',
    minWidth: 104,
    paddingHorizontal: 18,
    shadowColor: dashboardColors.primary,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  control: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    height: 48,
    minWidth: 126,
  },
  stepButton: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 44,
  },
  quantityValue: {
    color: dashboardColors.primaryDark,
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    minWidth: 42,
    textAlign: 'center',
  },
});
