import { isHttpsUrl, isHttpOrHttpsUrl } from './richText.js';

/** Default OrgClaim short link (instructor form placeholder + student fallback when URL omitted). */
export const DEFAULT_STUDENT_ORG_CLAIM_URL = 'http://sfdc.co/OrgClaim';

export function getEffectiveStudentOrgClaimUrl(session) {
  if (!session) return '';
  const u = String(session.studentOrgClaimUrl || '').trim();
  return u || DEFAULT_STUDENT_ORG_CLAIM_URL;
}

/** Saved OrgClaim code only (`studentOrgClaimCopyText`). */
export function getStudentOrgClaimCodeOnly(session) {
  if (!session) return '';
  return String(session.studentOrgClaimCopyText || '').trim();
}

export function sessionShowsSurveyOnStudent(session) {
  const url = String(session.studentSurveyUrl || '').trim();
  const code = String(session.studentSurveyCopyText || '').trim();
  return isHttpsUrl(url) && !!code;
}
