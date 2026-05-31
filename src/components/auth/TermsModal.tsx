import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { COLORS } from "@/constants/theme";
import { TermsItem, TermsSelections } from "@/types/terms";

type TermsModalProps = {
  visible: boolean;
  terms: TermsItem[];
  loading?: boolean;
  onClose: () => void;
  onConfirm: (selections: TermsSelections) => Promise<void>;
};

export function TermsModal({ visible, terms, loading, onClose, onConfirm }: TermsModalProps) {
  const initialState = useMemo<TermsSelections>(() => {
    return terms.reduce<TermsSelections>((acc, item) => {
      acc[item.termId] = false;
      return acc;
    }, {});
  }, [terms]);

  const [selections, setSelections] = useState<TermsSelections>(initialState);
  const [error, setError] = useState<string>("");

  function handleClose() {
    setSelections(initialState);
    setError("");
    onClose();
  }

  const allMandatoryAccepted = terms
    .filter((term) => term.mandatory)
    .every((term) => selections[term.termId]);

  async function handleConfirm() {
    if (!allMandatoryAccepted) {
      setError("Please accept all mandatory terms to continue.");
      return;
    }

    setError("");
    await onConfirm(selections);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Terms & Conditions</Text>
          <Text style={styles.subtitle}>Please review and select all required terms.</Text>

          <View style={styles.list}>
            {terms.map((item) => {
              const selected = selections[item.termId];

              return (
                <Pressable
                  key={item.termId}
                  onPress={() => {
                    setSelections((prev) => ({
                      ...prev,
                      [item.termId]: !prev[item.termId],
                    }));
                  }}
                  style={styles.termRow}
                >
                  <View style={[styles.checkbox, selected ? styles.checkboxSelected : undefined]}>
                    {selected ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <View style={styles.termTextWrap}>
                    <Text style={styles.termTitle}>
                      {item.title}
                      {item.mandatory ? " *" : ""}
                    </Text>
                    <Text style={styles.termText}>{item.text}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.buttonRow}>
            <AppButton title="Cancel" variant="ghost" onPress={handleClose} disabled={loading} />
            <AppButton title="Accept & Continue" onPress={handleConfirm} loading={loading} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
  },
  list: {
    gap: 10,
  },
  termRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  termTextWrap: {
    flex: 1,
    gap: 2,
  },
  termTitle: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 14,
  },
  termText: {
    color: COLORS.muted,
    fontSize: 13,
  },
  error: {
    color: COLORS.danger,
    fontSize: 12,
  },
  buttonRow: {
    gap: 10,
    marginTop: 6,
  },
});
