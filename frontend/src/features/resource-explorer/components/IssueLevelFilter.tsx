/************************************************************
 * 심각도 필터와 범례
 * 심각도 버튼을 누를 때 그 심각도로 트리와 검색을 거르고, 전체를 누를 때 필터를 푼다
 * 버튼마다 코드의 뜻을 함께 보여 주고, 아래 범례로 MATCH, PATH와 고유 상태의 뜻을 알림으로써 화면만 보고 표시를 읽을 수 있게 한다
 ************************************************************/

import { ISSUE_LEVELS, type IssueLevel } from '../types';

interface IssueLevelFilterProps {
  value?: IssueLevel;
  onChange: (value?: IssueLevel) => void;
}

/** 심각도 코드의 뜻 (요구사항의 코드 정의와 같다) */
export const ISSUE_LEVEL_LABELS: Record<IssueLevel, string> = {
  NONE: '이상 없음',
  WARNING: '주의',
  ERROR: '장애',
  UNKNOWN: '판단 불가',
};

/************************************************************
 * 심각도 필터와 범례
 * 버튼 하나가 필터이자 그 코드의 뜻을 보여 준다. 전체는 필터 없음이다
 * 아래 범례로 MATCH·PATH와 고유 상태의 뜻을 함께 알린다
 ************************************************************/
export default function IssueLevelFilter({ value, onChange }: IssueLevelFilterProps) {
  const options: { level?: IssueLevel; name: string; description?: string }[] = [
    { name: '전체' },
    ...ISSUE_LEVELS.map((level) => ({
      level,
      name: level,
      description: ISSUE_LEVEL_LABELS[level],
    })),
  ];

  return (
    <section className="filter-bar" aria-label="심각도 필터와 범례">
      <div className="filter-options" role="radiogroup" aria-label="트리·검색 심각도">
        {options.map(({ level, name, description }) => (
          <label key={name} className={`filter-option ${value === level ? 'checked' : ''}`}>
            <input
              type="radio"
              name="issue-level"
              aria-label={name}
              checked={value === level}
              onChange={() => onChange(level)}
            />
            {level ? (
              <span className={`issue ${level.toLowerCase()}`}>{name}</span>
            ) : (
              <span className="filter-all">{name}</span>
            )}
            {description && <span className="filter-description">{description}</span>}
          </label>
        ))}
      </div>
      <p className="filter-legend">
        <span>
          <span className="match-role match">MATCH</span> 필터와 일치
        </span>
        <span>
          <span className="match-role path">PATH</span> 아래에 일치하는 리소스가 있는 경로
        </span>
        <span>
          <span className="legend-status">Ready · Running</span> 리소스 고유 상태 (심각도와 별개)
        </span>
      </p>
    </section>
  );
}
