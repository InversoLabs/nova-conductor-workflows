// One fresh review attempt for a read-only reviewer mistaking its permissions for a blocker.
export function recoverReadOnlyReview(state,role,result,output){
  if(role?.access!=='read-only'||!role.routes?.REVISE||result.outcome!=='BLOCKED'||result.next!=='NEEDS_ATTENTION')return false;
  if(!/read.only|write permissions|writable copy/i.test(output)||!/(?:cannot|can't|unable|prevent\w*).*?(?:edit|modif|updat|writ)|(?:edit|modif|updat).*?(?:cannot|prevent)/is.test(output))return false;
  state.reviewRoleRecoveries??={};if(state.reviewRoleRecoveries[role.id])return false;
  state.reviewRoleRecoveries[role.id]=1;
  state.handoff='Review role clarification: read-only access is intentional. Inspect the existing deliverable; do not edit it or request write permissions. Return REVISE with specific repairs for the writing role if changes are needed. Approve only if evidence supports approval. If evidence is unavailable, return BLOCKED. Previous response for context:\n'+output;
  return true;
}
