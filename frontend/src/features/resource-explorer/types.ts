export type ResourceType = 'CLUSTER' | 'NODE' | 'NAMESPACE' | 'POD';
export type IssueLevel = 'NONE' | 'WARNING' | 'ERROR' | 'UNKNOWN';

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
}

export interface TreeResponse {
  items: TreeItem[];
  fetchedAt: string;
}

/************************************************************
 * 화면 상태
 * ParentRef : 하위 목록을 요청할 부모 (Namespace는 트리에서 지나온 Node가 필요)
 * Selection : 선택한 리소스 (객체 전체가 아니라 종류 + ID)
 ************************************************************/
export type ParentRef =
  | { resourceType: 'CLUSTER' | 'NODE'; id: number }
  | { resourceType: 'NAMESPACE'; id: number; nodeId: number };

export interface Selection {
  resourceType: ResourceType;
  id: number;
  nodeId?: number;
}
