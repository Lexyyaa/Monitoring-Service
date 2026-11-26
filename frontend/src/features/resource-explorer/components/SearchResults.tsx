/************************************************************
 * 검색 결과
 * 결과를 그릴 때 리소스마다 Cluster부터의 경로를 함께 보여 주고, 결과를 누를 때 트리에서 그 경로를 연다
 * 다음 페이지가 있을 때 더 보기 버튼으로 20건씩 이어 받고, 실패할 때 검색 영역에만 오류를 보여 준다
 ************************************************************/

import type { ResourceSearchState } from '../hooks/useResourceSearch';
import type { SearchItem } from '../types';

interface SearchResultsProps {
  search: ResourceSearchState;
  onSelect: (item: SearchItem) => void;
}

export default function SearchResults({ search, onSelect }: SearchResultsProps) {
  return (
    <div className="search-results" aria-live="polite">
      <div className="search-summary">“{search.query}” 검색 결과</div>
      {search.errorMessage && (
        <p role="alert" className="detail-error">
          {search.errorMessage} {search.isStale && '이전에 조회한 데이터를 보여 줍니다.'}{' '}
          <button onClick={search.retry}>다시 시도</button>
        </p>
      )}
      {search.isEmpty && <p className="empty">검색 결과가 없습니다.</p>}
      {search.items.map((item) => (
        <button
          className="search-result"
          key={`${item.resourceType}:${item.id}`}
          onClick={() => onSelect(item)}
        >
          <span className={`issue ${item.issueLevel.toLowerCase()}`}>{item.issueLevel}</span>
          <strong>{item.name}</strong>
          <small>{item.resourceType}</small>
          <small className="search-path">
            {item.path.map((segment) => segment.name).join(' › ')}
          </small>
        </button>
      ))}
      {search.isLoading && <p className="substate">검색 중…</p>}
      {!search.isLoading && search.hasNextPage && (
        <button className="load-more" onClick={search.loadMore}>
          더 보기
        </button>
      )}
    </div>
  );
}
