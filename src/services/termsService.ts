import { DEFAULT_TERMS } from "@/constants/terms";
import { apiClient, getApiBaseUrl } from "@/services/api";
import { TermsItem, TermsSelections } from "@/types/terms";

export async function fetchTerms(): Promise<TermsItem[]> {
  if (!getApiBaseUrl()) {
    return DEFAULT_TERMS;
  }

  const response = await apiClient.get<{ terms: TermsItem[] }>("/terms");
  return response.data.terms;
}

export async function saveTermsSelection(userId: string, selections: TermsSelections): Promise<void> {
  if (!getApiBaseUrl()) {
    return;
  }

  const accepted = Object.entries(selections).map(([termId, selected]) => ({
    termId,
    accepted: selected,
  }));

  await apiClient.post("/user/terms", { userId, accepted });
}
