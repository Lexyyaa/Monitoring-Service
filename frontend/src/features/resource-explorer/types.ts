/************************************************************
 * 서버 응답과 화면 상태의 타입
 * 훅과 컴포넌트가 서버 응답을 다룰 때 이 타입을 쓴다. 서버 쪽 타입은 OpenAPI 계약과 같은 모양이다
 * 선택을 객체 전체가 아니라 종류와 ID로 둠으로써 갱신으로 응답이 바뀌어도 선택이 풀리지 않게 한다
 ************************************************************/

export type ResourceType = 'CLUSTER' | 'NODE' | 'NAMESPACE' | 'POD';
export type IssueLevel = 'NONE' | 'WARNING' | 'ERROR' | 'UNKNOWN';
export type MatchRole = 'MATCH' | 'PATH';

export const ISSUE_LEVELS: readonly IssueLevel[] = ['NONE', 'WARNING', 'ERROR', 'UNKNOWN'];

/************************************************************
 * 서버 응답
 ************************************************************/
export interface TreeItem {
  id: number;
  resourceType: ResourceType;
  name: string;
  statusCode: string;
  issueLevel: IssueLevel;
  lastUpdatedAt: string;
  /** 필터가 있을 때만 온다 */
  matchRole?: MatchRole;
}

export interface TreeResponse {
  items: TreeItem[];
  fetchedAt: string;
}

export interface PathSegment {
  resourceType: ResourceType;
  id: number;
  name: string;
}

export interface SearchItem extends TreeItem {
  path: PathSegment[];
}

export interface SearchResponse {
  items: SearchItem[];
  page: number;
  pageSize: number;
  hasNext: boolean;
  fetchedAt: string;
}

export interface ResourceDetail {
  id: number;
  resourceType: ResourceType;
  name: string;
  statusCode: string;
  issueLevel: IssueLevel;
  issueReason: string | null;
  lastUpdatedAt: string;
  path: PathSegment[];
  attributes: Record<string, string | number | boolean | null>;
}

export interface DetailResponse {
  resource: ResourceDetail;
  fetchedAt: string;
}

/************************************************************
 * 화면 상태
 * ParentRef : 하위 목록을 요청할 부모 (Namespace는 트리에서 지나온 Node가 필요)
 * Selection : 상세 패널에 띄울 리소스 (객체 전체가 아니라 종류 + ID, Namespace는 클릭한 Node 경로)
 ************************************************************/
export type ParentRef =
  | { resourceType: 'CLUSTER' | 'NODE'; id: number }
  | { resourceType: 'NAMESPACE'; id: number; nodeId: number };

export interface Selection {
  resourceType: ResourceType;
  id: number;
  nodeId?: number;
}
