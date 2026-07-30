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
        <Ionicons color={dashboardColors.primary} name="add" size={16} />
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
        <Ionicons
          color={dashboardColors.primary}
          name={quantity === 1 ? 'trash-outline' : 'remove'}
          size={16}
        />
      </PressableScale>
      <Text style={styles.quantityValue}>{quantity}</Text>
      <PressableScale
        accessibilityLabel={`Increase ${productName} quantity, currently ${quantity}`}
        onPress={onIncrement}
        pressedScale={0.88}
        style={styles.stepButton}
      >
        <Ionicons color={dashboardColors.primary} name="add" size={16} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderColor: '#C9D8FE',
    borderRadius: dashboardRadii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    height: 44,
    justifyContent: 'center',
    minWidth: 76,
    paddingHorizontal: 12,
  },
  addButtonText: {
    color: dashboardColors.primary,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  control: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    height: 44,
  },
  stepButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  quantityValue: {
    color: dashboardColors.primaryDark,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    minWidth: 20,
    textAlign: 'center',
  },
});
