import type { ResourceSearchState } from '../hooks/useResourceSearch';
import type { SearchItem } from '../types';
import SearchResults from './SearchResults';

interface ResourceSearchProps {
  search: ResourceSearchState;
  onSelectResult: (item: SearchItem) => void;
}

export default function ResourceSearch({ search, onSelectResult }: ResourceSearchProps) {
  return (
    <section className="search-panel" aria-label="리소스 검색">
      <label htmlFor="resource-search">전체 리소스 검색</label>
      <input
        id="resource-search"
        type="search"
        value={search.input}
        maxLength={200}
        placeholder="이름 일부 입력"
        onChange={(event) => search.setInput(event.target.value)}
      />
      {search.query && <SearchResults search={search} onSelect={onSelectResult} />}
    </section>
  );
}
