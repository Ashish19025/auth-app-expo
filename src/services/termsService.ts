import { DEFAULT_TERMS } from "@/constants/terms";
import { apiClient, getApiBaseUrl } from "@/services/api";
import { getStoredSession } from "@/services/storage";
import { TermsItem, TermsSelections } from "@/types/terms";

export async function fetchTerms(): Promise<TermsItem[]> {
  // Use frontend-defined terms (DEFAULT_TERMS) as the source of truth.
  // Backend /terms is intentionally ignored — only save selections to the backend.
  return DEFAULT_TERMS;
}

export async function saveTermsSelection(
  userId: string,
  selections: TermsSelections
): Promise<void> {
  if (!getApiBaseUrl()) {
    return;
  }

  const termsSelections = Object.entries(selections).map(
    ([termId, selected]) => ({
      termId,
      accepted: selected,
    })
  );

  try {
    const session = await getStoredSession();
    const accessToken = session.tokens?.accessToken;

    await apiClient.post(
      "/user/terms/accept",
      {
        termsSelections,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
  } catch (error) {
    const status = (error as {
      response?: { status?: number };
    })?.response?.status;

    if (status === 404) {
      return;
    }

    throw error;
  }
}