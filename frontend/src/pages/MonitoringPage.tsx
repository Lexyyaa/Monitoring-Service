import { useEffect, useState } from 'react';
import IssueLevelFilter from '../features/resource-explorer/components/IssueLevelFilter';
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

export default function MonitoringPage() {
  const [issueLevel, setIssueLevel] = useState<IssueLevel>();
  /** 선택 상태는 여기 한 곳에만 둔다 : 트리 강조(key)와 상세 대상(selection)을 함께 바꾼다 */
  const [selected, setSelected] = useState<TreeSelection>();
  const selection = selected?.selection;

  useRefresh();
  const tree = useResourceTree({ issueLevel, onSelect: setSelected });
  const search = useResourceSearch(issueLevel);
  const detail = useResourceDetail(selection);

  const isDetailOpen = selection !== undefined;
  const currentMatchRole = tree.rows.find((row) => row.key === selected?.key)?.item?.matchRole;

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
        <IssueLevelFilter value={issueLevel} onChange={setIssueLevel} />
      </header>
      <main className={`explorer-layout ${isDetailOpen ? 'with-detail' : ''}`}>
        <ResourceSearch search={search} onSelectResult={(item) => void tree.openPath(item)} />
        <ResourceTree tree={tree} selectedKey={selected?.key} />
      </main>
      <ResourceDetailPanel
        selection={selection}
        issueLevel={issueLevel}
        currentMatchRole={currentMatchRole}
        state={detail}
        onClose={() => setSelected(undefined)}
      />
    </>
  );
}
