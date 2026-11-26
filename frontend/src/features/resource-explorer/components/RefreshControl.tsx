/************************************************************
 * 갱신 버튼
 * 새로고침 버튼을 누를 때 화면의 조회를 다시 부르고, 옆에 마지막으로 성공한 조회 시각을 보여 준다
 * 갱신 중일 때 버튼을 잠금으로써 같은 요청이 겹치지 않게 한다
 ************************************************************/

interface RefreshControlProps {
  isRefreshing: boolean;
  lastSuccessfulFetch?: string;
  onRefresh: () => void;
}

export default function RefreshControl({
  isRefreshing,
  lastSuccessfulFetch,
  onRefresh,
}: RefreshControlProps) {
  return (
    <>
      <button className="refresh-button" onClick={onRefresh} disabled={isRefreshing}>
        {isRefreshing ? '갱신 중…' : '새로고침'}
      </button>
      <small className="last-fetch">
        마지막 성공 조회:{' '}
        {lastSuccessfulFetch ? new Date(lastSuccessfulFetch).toLocaleTimeString() : '없음'}
      </small>
    </>
  );
}
