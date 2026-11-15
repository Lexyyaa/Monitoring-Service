import type { TreeRowView } from '../hooks/useResourceTree';

interface ResourceTreeRowProps {
  row: TreeRowView;
  height: number;
  isSelected: boolean;
  onToggle: (row: TreeRowView) => void;
  onSelect: (row: TreeRowView) => void;
  onRetry: (row: TreeRowView) => void;
}

const INDENT_PX = 22;

/** 펼침 버튼과 이름(선택) 버튼을 나눠 펼침이 선택을 바꾸지 않게 한다 */
export default function ResourceTreeRow({
  row,
  height,
  isSelected,
  onToggle,
  onSelect,
  onRetry,
}: ResourceTreeRowProps) {
  if (row.isEmpty || !row.item) {
    return (
      <div className="tree-empty" style={{ height, paddingLeft: 34 + row.depth * INDENT_PX }}>
        하위 리소스가 없습니다.
      </div>
    );
  }

  const { item } = row;
  const canExpand = row.parentRef !== undefined;

  return (
    <div
      className={`tree-row ${isSelected ? 'selected' : ''}`}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={canExpand ? row.isExpanded : undefined}
      aria-selected={isSelected}
      style={{ height, paddingLeft: 12 + row.depth * INDENT_PX }}
    >
      <button
        className="toggle"
        aria-label={`${row.isExpanded ? '접기' : '펼치기'} ${item.name}`}
        disabled={!canExpand}
        onClick={() => onToggle(row)}
      >
        {canExpand ? (row.isExpanded ? '▾' : '▸') : '·'}
      </button>
      <button className="resource-name" title={item.name} onClick={() => onSelect(row)}>
        {item.name}
      </button>
      <span className={`issue ${item.issueLevel.toLowerCase()}`}>{item.issueLevel}</span>
      <span className="status" title={item.statusCode}>
        {item.statusCode}
      </span>
      <span className="row-extra">
        {row.isLoading && <span className="substate">불러오는 중…</span>}
        {row.errorMessage && (
          <button className="retry" onClick={() => onRetry(row)}>
            오류 · 재시도
          </button>
        )}
        {item.matchRole && (
          <span className={`match-role ${item.matchRole.toLowerCase()}`}>{item.matchRole}</span>
        )}
      </span>
    </div>
  );
}
