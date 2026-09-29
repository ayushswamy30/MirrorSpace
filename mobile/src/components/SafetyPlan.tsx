import { useEffect, useState } from 'react';
import { Linking, StyleSheet, TextInput, View } from 'react-native';

import {
  addItem,
  dialable,
  isEmpty,
  loadPlan,
  removeItem,
  savePlan,
  SECTIONS,
  type SafetyPlan as Plan,
  type SectionDef
} from '@/lib/safetyPlan';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/typography';

import { SectionLabel } from './Blocks';
import { Button } from './Button';
import { Text } from './Text';

/**
 * The safety plan: read in a hard moment, written in a calm one. Reading is
 * the default — numbered steps, one tap to call anyone with a number — and
 * writing is one "edit" away. Every change is saved as it is made.
 */
export function SafetyPlan() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [editing, setEditing] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    loadPlan()
      .then(setPlan)
      .catch(err => {
        console.error('Safety plan unavailable:', err);
        setFailed(true);
      });
  }, []);

  const change = (next: Plan) => {
    setPlan(next);
    savePlan(next)
      .then(saved => setPlan(saved))
      .catch(err => console.error('Safety plan not saved:', err));
  };

  if (failed) {
    return <Text tone="soft">Your plan can’t be opened right now. The helplines are always one tap away under help.</Text>;
  }
  if (!plan) return null;

  if (!editing && isEmpty(plan)) {
    return (
      <View style={styles.block}>
        <Text variant="title">A plan for a hard moment, written in a calm one.</Text>
        <Text tone="soft">Seven short steps. Fill in what you can — one line anywhere already helps.</Text>
        <Button label="start" arrow onPress={() => setEditing(true)} />
      </View>
    );
  }

  return (
    <View style={styles.block}>
      {SECTIONS.map((section, i) =>
        editing ? (
          <EditSection key={section.key} number={i + 1} section={section} plan={plan} onChange={change} />
        ) : plan[section.key].length > 0 ? (
          <ReadSection key={section.key} number={i + 1} section={section} plan={plan} />
        ) : null
      )}

      {editing ? (
        <Button label="done" arrow onPress={() => setEditing(false)} />
      ) : (
        <View style={styles.row}>
          <Button kind="link" label="edit plan" onPress={() => setEditing(true)} />
          {plan.updatedAt && (
            <Text variant="mono" tone="soft">
              {`updated ${new Date(plan.updatedAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}`}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

type SectionProps = { number: number; section: SectionDef; plan: Plan };

function ReadSection({ number, section, plan }: SectionProps) {
  return (
    <View style={styles.section}>
      <SectionLabel title={`${number} · ${section.title}`} />
      {plan[section.key].map((item, i) => {
        const tel = dialable(item.phone);
        return (
          <View key={`${item.text}-${i}`} style={styles.item}>
            <Text variant="heading" style={styles.itemText}>
              {item.text}
            </Text>
            {tel && (
              <Button
                kind="outline"
                label="call"
                accessibilityLabel={`Call ${item.text}`}
                onPress={() => Linking.openURL(`tel:${tel}`)}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

function EditSection({ number, section, plan, onChange }: SectionProps & { onChange: (plan: Plan) => void }) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [phone, setPhone] = useState('');

  const add = () => {
    onChange(addItem(plan, section.key, { text, phone }));
    setText('');
    setPhone('');
  };

  const input = [styles.input, { color: colors.ink, borderBottomColor: colors.hairline }];

  return (
    <View style={styles.section}>
      <SectionLabel title={`${number} · ${section.title}`} />
      <Text variant="bodyItalic">{section.prompt}</Text>

      {plan[section.key].map((item, i) => (
        <View key={`${item.text}-${i}`} style={styles.item}>
          <Text style={styles.itemText}>{item.phone ? `${item.text} · ${item.phone}` : item.text}</Text>
          <Button
            kind="link"
            label="remove"
            accessibilityLabel={`Remove ${item.text}`}
            onPress={() => onChange(removeItem(plan, section.key, i))}
          />
        </View>
      ))}

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={section.placeholder}
        placeholderTextColor={colors.inkSoft}
        accessibilityLabel={`New line for ${section.title}`}
        maxFontSizeMultiplier={2}
        style={input}
        onSubmitEditing={section.withPhone ? undefined : add}
        returnKeyType={section.withPhone ? 'next' : 'done'}
      />
      {section.withPhone && (
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="number, if you want one tap to call"
          placeholderTextColor={colors.inkSoft}
          accessibilityLabel={`Phone number for ${section.title}`}
          keyboardType="phone-pad"
          maxFontSizeMultiplier={2}
          style={input}
          onSubmitEditing={add}
        />
      )}
      <Button kind="link" label="add" disabled={!text.trim()} onPress={add} accessibilityLabel={`Add to ${section.title}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.lg },
  section: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  itemText: { flex: 1 },
  input: {
    fontFamily: fonts.sans,
    fontSize: 15,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth
  }
});
