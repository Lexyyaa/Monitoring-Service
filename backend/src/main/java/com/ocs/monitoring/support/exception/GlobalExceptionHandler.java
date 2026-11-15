package com.ocs.monitoring.support.exception;

import com.ocs.monitoring.domain.exception.BusinessException;
import com.ocs.monitoring.domain.exception.ErrorCode;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.ServletRequestBindingException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusiness(BusinessException e) {
        log.info("업무 예외: {}", e.getErrorCode());
        return respond(e.getErrorCode());
    }

    /************************************************************
     * 입력 오류 → 400 INVALID_PARAMETER
     * Bean Validation(@Positive 등), 필수 파라미터 누락, 타입 변환 실패(숫자 자리에 문자 등)
     ************************************************************/
    @ExceptionHandler({
        MethodArgumentNotValidException.class,
        HandlerMethodValidationException.class,
        ConstraintViolationException.class,
        ServletRequestBindingException.class,
        MethodArgumentTypeMismatchException.class,
        HttpMessageNotReadableException.class
    })
    public ResponseEntity<ErrorResponse> handleInvalidRequest(Exception e) {
        log.info("요청 검증 실패: {}", e.getMessage());
        return respond(ErrorCode.INVALID_PARAMETER);
    }

    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<ErrorResponse> handleNoResource(Exception e) {
        return respond(ErrorCode.RESOURCE_NOT_FOUND);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotSupported(HttpRequestMethodNotSupportedException e) {
        return respond(ErrorCode.METHOD_NOT_ALLOWED);
    }

    /************************************************************
     * 406 : 클라이언트가 JSON을 받지 않겠다고 하면 본문 없이 상태만 돌려준다
     ************************************************************/
    @ExceptionHandler(HttpMediaTypeNotAcceptableException.class)
    public ResponseEntity<Void> handleNotAcceptable(HttpMediaTypeNotAcceptableException e) {
        return ResponseEntity.status(HttpStatus.NOT_ACCEPTABLE).build();
    }

    /************************************************************
     * DB 조회 불가 → 503 SERVICE_UNAVAILABLE
     * 쿼리 실패(DataAccessException)와 트랜잭션 시작 시 연결 실패(CannotCreateTransactionException)
     ************************************************************/
    @ExceptionHandler({DataAccessException.class, CannotCreateTransactionException.class})
    public ResponseEntity<ErrorResponse> handleDatabaseUnavailable(Exception e) {
        log.error("DB 조회 실패", e);
        return respond(ErrorCode.SERVICE_UNAVAILABLE);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
        log.error("처리되지 않은 서버 오류", e);
        return respond(ErrorCode.INTERNAL_ERROR);
    }

    private static ResponseEntity<ErrorResponse> respond(ErrorCode errorCode) {
        return ResponseEntity.status(statusOf(errorCode)).body(ErrorResponse.from(errorCode));
    }

    /************************************************************
     * 업무 오류 코드 → HTTP 상태 (Domain은 HTTP를 모르므로 여기서 대응한다)
     ************************************************************/
    static HttpStatus statusOf(ErrorCode errorCode) {
        return switch (errorCode) {
            case INVALID_PARAMETER -> HttpStatus.BAD_REQUEST;
            case RESOURCE_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case METHOD_NOT_ALLOWED -> HttpStatus.METHOD_NOT_ALLOWED;
            case INTERNAL_ERROR -> HttpStatus.INTERNAL_SERVER_ERROR;
            case SERVICE_UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
        };
    }
}
