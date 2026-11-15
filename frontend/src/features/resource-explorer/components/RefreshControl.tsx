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
