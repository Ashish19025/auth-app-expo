import { TermsItem } from "@/types/terms";

export const DEFAULT_TERMS: TermsItem[] = [
  {
    termId: "terms-service",
    title: "Terms of Service",
    text: "I agree to the app Terms of Service and usage rules.",
    mandatory: true,
  },
  {
    termId: "privacy-policy",
    title: "Privacy Policy",
    text: "I agree to the Privacy Policy and data handling guidelines.",
    mandatory: true,
  },
  {
    termId: "marketing-updates",
    title: "Marketing Updates",
    text: "I want to receive product updates and offers.",
    mandatory: false,
  },
];
