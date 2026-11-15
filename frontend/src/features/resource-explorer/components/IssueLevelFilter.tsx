import { ISSUE_LEVELS, type IssueLevel } from '../types';

interface IssueLevelFilterProps {
  value?: IssueLevel;
  onChange: (value?: IssueLevel) => void;
}

export default function IssueLevelFilter({ value, onChange }: IssueLevelFilterProps) {
  return (
    <label className="filter-control">
      트리·검색 심각도
      <select
        value={value ?? 'ALL'}
        onChange={(event) =>
          onChange(event.target.value === 'ALL' ? undefined : (event.target.value as IssueLevel))
        }
      >
        <option value="ALL">전체</option>
        {ISSUE_LEVELS.map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </select>
    </label>
  );
}
