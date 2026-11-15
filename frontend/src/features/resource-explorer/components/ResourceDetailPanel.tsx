import type { ResourceDetailState } from '../hooks/useResourceDetail';
import type { Selection } from '../types';

interface ResourceDetailPanelProps {
  selection?: Selection;
  state: ResourceDetailState;
  onClose: () => void;
}

/** 선택하면 오른쪽에서 열리고 ✕나 Esc로 닫는다. 상태와 심각도, 변경 시각과 조회 시각을 나눠 보여 준다 */
export default function ResourceDetailPanel({
  selection,
  state,
  onClose,
}: ResourceDetailPanelProps) {
  const isOpen = selection !== undefined;
  const { detail } = state;
  const resource = detail?.resource;

  return (
    <aside
      className={`detail-panel ${isOpen ? 'open' : ''}`}
      aria-label="리소스 상세"
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <div className="detail-header">
        <h2>상세 정보</h2>
        <button className="detail-close" onClick={onClose} aria-label="상세 패널 닫기">
          ✕
        </button>
      </div>
      {state.isLoading && <p>상세 정보를 불러오는 중…</p>}
      {state.errorMessage && (
        <p role="alert" className="detail-error">
          {state.errorMessage} <button onClick={state.retry}>다시 시도</button>
        </p>
      )}
      {resource && detail && (
        <>
          <div className="detail-title">
            <span className="resource-type">{resource.resourceType}</span>
            <strong>{resource.name}</strong>
          </div>
          <dl className="detail-common">
            <dt>상태</dt>
            <dd>{resource.statusCode}</dd>
            <dt>이상 심각도</dt>
            <dd>
              <span className={`issue ${resource.issueLevel.toLowerCase()}`}>
                {resource.issueLevel}
              </span>
            </dd>
            <dt>마지막 갱신</dt>
            <dd>{new Date(resource.lastUpdatedAt).toLocaleString()}</dd>
            <dt>조회 시각</dt>
            <dd>{new Date(detail.fetchedAt).toLocaleString()}</dd>
          </dl>
          {resource.issueReason && <p className="issue-reason">{resource.issueReason}</p>}
          <h3>탐색 경로</h3>
          <ol className="detail-path">
            {resource.path.map((segment) => (
              <li key={`${segment.resourceType}:${segment.id}`}>{segment.name}</li>
            ))}
          </ol>
          <h3>리소스 정보</h3>
          <dl className="attributes">
            {Object.entries(resource.attributes).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value === null ? '없음' : String(value)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </aside>
  );
}
