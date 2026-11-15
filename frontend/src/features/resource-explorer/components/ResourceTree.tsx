import type { ResourceTreeState } from '../hooks/useResourceTree';
import ResourceTreeRow from './ResourceTreeRow';

const ROW_HEIGHT = 38;

interface ResourceTreeProps {
  tree: ResourceTreeState;
  /** 선택한 행 key (선택 상태는 페이지가 가진다) */
  selectedKey?: string;
}

export default function ResourceTree({ tree, selectedKey }: ResourceTreeProps) {
  const { rows } = tree;

  return (
    <section className="tree-panel" aria-label="리소스 트리">
      <header className="tree-header">
        <div>
          <h2>리소스 탐색</h2>
          <p>Cluster에서 하위 리소스를 단계별로 조회합니다.</p>
        </div>
        {tree.fetchedAt && <small>조회 {new Date(tree.fetchedAt).toLocaleTimeString()}</small>}
      </header>
      {tree.rootError && (
        <div role="alert">
          {tree.rootError} <button onClick={tree.retryRoot}>다시 시도</button>
        </div>
      )}
      <div
        className="tree-viewport"
        role="tree"
        aria-label="Kubernetes 리소스"
        aria-busy={tree.isFetching}
      >
        {rows.map((row) => (
          <ResourceTreeRow
            key={row.key}
            row={row}
            height={ROW_HEIGHT}
            isSelected={selectedKey === row.key}
            onToggle={tree.toggle}
            onSelect={tree.select}
            onRetry={tree.retry}
          />
        ))}
        {rows.length === 0 && !tree.rootError && !tree.isFetching && (
          <p className="empty">표시할 Cluster가 없습니다.</p>
        )}
        {rows.length === 0 && tree.isFetching && <p className="empty">불러오는 중…</p>}
      </div>
      <footer>{rows.length.toLocaleString()}개 표시 행</footer>
    </section>
  );
}
