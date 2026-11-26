/************************************************************
 * 검색 입력
 * 사용자가 이름을 입력할 때 입력값을 검색 훅에 넘기고, 검색어가 정해지면 아래에 결과 목록을 연다
 * 검색 훅을 이 컴포넌트 안에서 부름으로써 입력할 때 검색 영역만 다시 그리게 한다
 ************************************************************/

import { useResourceSearch } from '../hooks/useResourceSearch';
import type { IssueLevel, SearchItem } from '../types';
import SearchResults from './SearchResults';

interface ResourceSearchProps {
  issueLevel?: IssueLevel;
  onSelectResult: (item: SearchItem) => void;
}

export default function ResourceSearch({ issueLevel, onSelectResult }: ResourceSearchProps) {
  const search = useResourceSearch(issueLevel);
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
