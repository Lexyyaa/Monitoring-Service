/************************************************************
 * 모니터링 화면 (필터, 검색, 트리, 상세, 갱신을 한 화면에 배치)
 * 필터를 바꾸거나 행, 검색 결과를 고를 때 그 상태를 여기서 바꾸고 각 훅과 컴포넌트에 나눠 준다
 * 선택 상태를 한 곳에만 둠으로써 트리 강조와 상세 대상이 어긋나지 않게 한다
 ************************************************************/

import { useEffect, useMemo, useState } from 'react';
import IssueLevelFilter from '../features/resource-explorer/components/IssueLevelFilter';
import RefreshControl from '../features/resource-explorer/components/RefreshControl';
import ResourceDetailPanel from '../features/resource-explorer/components/ResourceDetailPanel';
import ResourceSearch from '../features/resource-explorer/components/ResourceSearch';
import ResourceTree from '../features/resource-explorer/components/ResourceTree';
import { useRefresh } from '../features/resource-explorer/hooks/useRefresh';
import { useResourceDetail } from '../features/resource-explorer/hooks/useResourceDetail';
import { useResourceSearch } from '../features/resource-explorer/hooks/useResourceSearch';
import {
  useResourceTree,
  type TreeSelection,
} from '../features/resource-explorer/hooks/useResourceTree';
import type { IssueLevel } from '../features/resource-explorer/types';

// 필터를 바꿔도 선택과 검색어는 그대로다. 상세가 필터에서 벗어나면 패널이 알린다
// 갱신은 트리가 알려 주는 화면 안 분기만 다시 부른다 (isQueryInView)
export default function MonitoringPage() {
  // undefined는 전체(필터 없음)다. 이때는 issueLevel 파라미터를 보내지 않는다
  const [issueLevel, setIssueLevel] = useState<IssueLevel>();
  /** 선택 상태는 여기 한 곳에만 둔다 : 트리 강조(key)와 상세 대상(selection)을 함께 바꾼다 */
  const [selected, setSelected] = useState<TreeSelection>();
  const selection = selected?.selection;

  const tree = useResourceTree({ issueLevel, onSelect: setSelected });
  const refresh = useRefresh({ shouldRefetch: tree.isQueryInView });
  const search = useResourceSearch(issueLevel);
  const detail = useResourceDetail(selection);

  const isDetailOpen = selection !== undefined;
  const selectedKey = selected?.key;
  /** 행 목록이나 선택이 바뀔 때만 찾는다 (10만 행을 렌더링마다 훑지 않게) */
  const currentMatchRole = useMemo(
    () =>
      selectedKey === undefined
        ? undefined
        : tree.rows.find((row) => row.key === selectedKey)?.item?.matchRole,
    [tree.rows, selectedKey],
  );

  /************************************************************
   * Esc 키로 상세 패널 닫기 (열려 있을 때만 듣는다)
   ************************************************************/
  useEffect(() => {
    if (!isDetailOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(undefined);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDetailOpen]);

  return (
    <>
      <header className="app-header">
        <h1 className="app-title">
          Infrastructure Monitoring <span>· Kubernetes</span>
        </h1>
        <RefreshControl
          isRefreshing={refresh.isRefreshing}
          lastSuccessfulFetch={refresh.lastSuccessfulFetch}
          onRefresh={() => void refresh.refresh()}
        />
      </header>
      <main className={`explorer-layout ${isDetailOpen ? 'with-detail' : ''}`}>
        <div className="explorer-main">
          <IssueLevelFilter value={issueLevel} onChange={setIssueLevel} />
          <ResourceSearch search={search} onSelectResult={(item) => void tree.openPath(item)} />
          <ResourceTree tree={tree} selectedKey={selected?.key} />
        </div>
        <ResourceDetailPanel
          selection={selection}
          issueLevel={issueLevel}
          currentMatchRole={currentMatchRole}
          state={detail}
          onClose={() => setSelected(undefined)}
        />
      </main>
    </>
  );
}
