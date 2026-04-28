import { CaseStatus } from "@/types";

/** Valid state transitions */
const transitions: Record<CaseStatus, CaseStatus[]> = {
  [CaseStatus.NEW]: [CaseStatus.INTAKE_RECEIVED],
  [CaseStatus.INTAKE_RECEIVED]: [CaseStatus.INTERVIEW_STRUCTURED],
  [CaseStatus.INTERVIEW_STRUCTURED]: [CaseStatus.INFO_INSUFFICIENT, CaseStatus.READY_FOR_DECOMPOSITION],
  [CaseStatus.INFO_INSUFFICIENT]: [CaseStatus.INTAKE_RECEIVED],
  [CaseStatus.READY_FOR_DECOMPOSITION]: [CaseStatus.OKR_DRAFT_GENERATED],
  [CaseStatus.OKR_DRAFT_GENERATED]: [CaseStatus.UNDER_REVIEW],
  [CaseStatus.UNDER_REVIEW]: [CaseStatus.REVIEW_PASSED, CaseStatus.REVIEW_FAILED, CaseStatus.HUMAN_REVIEW_REQUIRED],
  [CaseStatus.REVIEW_FAILED]: [CaseStatus.READY_FOR_DECOMPOSITION, CaseStatus.INTAKE_RECEIVED],
  [CaseStatus.HUMAN_REVIEW_REQUIRED]: [CaseStatus.REVIEW_PASSED, CaseStatus.REVIEW_FAILED],
  [CaseStatus.REVIEW_PASSED]: [CaseStatus.FINALIZED],
  [CaseStatus.FINALIZED]: [],
};

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return transitions[from]?.includes(to) ?? false;
}

export function getValidTransitions(from: CaseStatus): CaseStatus[] {
  return transitions[from] ?? [];
}

export function transition(from: CaseStatus, to: CaseStatus): CaseStatus {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid transition: ${from} → ${to}`);
  }
  return to;
}
