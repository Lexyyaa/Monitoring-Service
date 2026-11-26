/************************************************************
 * 트리 화면
 * 트리 영역을 스크롤할 때 보이는 행만 그리고, 그 범위를 훅에 알려 갱신이 화면 안 분기만 다시 부르게 한다
 * 검색 결과로 행을 열 때 그 행이 화면 밖이면 가운데로 스크롤한다
 ************************************************************/

import { useEffect, useRef } from 'react';
import { useVirtualWindow } from '../../../shared/lib/useVirtualWindow';
import type { ResourceTreeState } from '../hooks/useResourceTree';
import ResourceTreeRow from './ResourceTreeRow';

const ROW_HEIGHT = 38;
/** 실제 높이를 재기 전 첫 렌더에 쓰는 값 (style.css의 .tree-viewport 높이는 창 높이를 따라간다) */
const VIEWPORT_HEIGHT = 600;
const OVERSCAN_ROWS = 6;

interface ResourceTreeProps {
  tree: ResourceTreeState;
  /** 선택한 행 key (선택 상태는 페이지가 가진다) */
  selectedKey?: string;
}

export default function ResourceTree({ tree, selectedKey }: ResourceTreeProps) {
  const { rows } = tree;
  const view = useVirtualWindow({
    count: rows.length,
    rowHeight: ROW_HEIGHT,
    viewportHeight: VIEWPORT_HEIGHT,
    overscan: OVERSCAN_ROWS,
  });

  const alertMessage = tree.rootError ?? tree.navigationError;

  /** 화면에 보이는 범위를 알려 갱신이 그 분기만 다시 부르게 한다 */
  const { setVisibleRange } = tree;
  useEffect(() => {
    setVisibleRange(view.start, view.end);
  }, [setVisibleRange, view.start, view.end]);

  /************************************************************
   * 검색 결과로 연 행이 화면 밖이면 그 행이 가운데 오도록 스크롤 (요청마다 한 번)
   ************************************************************/
  const revealedId = useRef<number | undefined>(undefined);
  const { revealRequest } = tree;
  const { scrollToIndex } = view;
  useEffect(() => {
    if (!revealRequest || revealRequest.id === revealedId.current) return;
    const index = rows.findIndex((row) => row.key === revealRequest.key);
    if (index < 0) return;
    revealedId.current = revealRequest.id;
    scrollToIndex(index);
  }, [revealRequest, rows, scrollToIndex]);

  return (
    <section className="tree-panel" aria-label="리소스 트리">
      <header className="tree-header">
        <div>
          <h2>리소스 탐색</h2>
          <p>Cluster에서 하위 리소스를 단계별로 조회합니다.</p>
        </div>
        {tree.fetchedAt && <small>조회 {new Date(tree.fetchedAt).toLocaleTimeString()}</small>}
      </header>
      {alertMessage && (
        <div role="alert">
          {alertMessage} {tree.isRootStale && '이전에 조회한 데이터를 보여 줍니다.'}{' '}
          {tree.rootError && <button onClick={tree.retryRoot}>다시 시도</button>}
        </div>
      )}
      <div
        ref={view.viewportRef}
        className="tree-viewport"
        role="tree"
        aria-label="Kubernetes 리소스"
        aria-busy={tree.isFetching}
        onScroll={view.onScroll}
      >
        {/* 위아래 빈 공간으로 전체 높이를 맞추고, 그 사이에 화면 근처 행만 그린다 */}
        {/* key는 배열 순서가 아니라 종류, ID, 경로로 만든 행 key다 (스크롤해도 행이 섞이지 않음) */}
        <div style={{ height: view.spaceBefore }} />
        {rows.slice(view.start, view.end).map((row) => (
          <ResourceTreeRow
            key={row.key}
            row={tree.viewOf(row)}
            height={ROW_HEIGHT}
            isSelected={selectedKey === row.key}
            onToggle={tree.toggle}
            onSelect={tree.select}
            onRetry={tree.retry}
          />
        ))}
        {rows.length === 0 && !alertMessage && !tree.isFetching && (
          <p className="empty">표시할 Cluster가 없습니다.</p>
        )}
        {rows.length === 0 && tree.isFetching && <p className="empty">불러오는 중…</p>}
        <div style={{ height: view.spaceAfter }} />
      </div>
      <footer>{rows.length.toLocaleString()}개 표시 행</footer>
    </section>
  );
}
