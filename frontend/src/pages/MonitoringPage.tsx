import { useState } from 'react';
import ResourceTree from '../features/resource-explorer/components/ResourceTree';
import {
  useResourceTree,
  type TreeSelection,
} from '../features/resource-explorer/hooks/useResourceTree';

export default function MonitoringPage() {
  /** 선택 상태는 여기 한 곳에만 둔다 */
  const [selected, setSelected] = useState<TreeSelection>();
  const tree = useResourceTree({ onSelect: setSelected });

  return (
    <>
      <header className="app-header">
        <h1 className="app-title">
          Infrastructure Monitoring <span>· Kubernetes</span>
        </h1>
      </header>
      <main className="explorer-layout">
        <ResourceTree tree={tree} selectedKey={selected?.key} />
      </main>
    </>
  );
}
