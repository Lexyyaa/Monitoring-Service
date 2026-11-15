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
