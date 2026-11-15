import type { IssueLevel, MatchRole, ResourceDetail } from '../types';

/************************************************************
 * 상세 리소스가 현재 필터에서 벗어났는지 판단한다
 * 트리에서 지금 PATH로 보이는 행이면 경로이므로 벗어난 것이 아니다
 * matchRole은 선택 당시 값이 아니라 현재 트리 행의 값을 받는다 (필터를 바꾼 뒤에도 맞게 판단)
 ************************************************************/
export function isOutsideFilter(
  issueLevel: IssueLevel | undefined,
  currentMatchRole: MatchRole | undefined,
  resource: ResourceDetail | undefined,
): boolean {
  if (issueLevel === undefined || resource === undefined) return false;
  if (currentMatchRole === 'PATH') return false;
  return resource.issueLevel !== issueLevel;
}
