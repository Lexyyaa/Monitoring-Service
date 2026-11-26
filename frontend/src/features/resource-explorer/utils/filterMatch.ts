/************************************************************
 * 필터 일치 판단
 * 필터를 바꿨을 때 상세 패널에 띄운 리소스가 현재 필터에서 벗어났는지 판단한다
 * 지금 트리에서 PATH로 보이는 행은 경로이므로 벗어난 것으로 보지 않는다
 * 선택 당시가 아니라 현재 트리 행의 matchRole을 받음으로써 필터를 바꾼 뒤에도 맞게 판단한다
 ************************************************************/

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
