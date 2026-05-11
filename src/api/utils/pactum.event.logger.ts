import { events } from 'pactum';
import size from 'json-size';
import { apiExecutionLogger } from './logger';

const { pactumEvents, EVENT_TYPES } = events;

const MAX_RESPONSE_BODY_SIZE = 1024 * 50; // 50KB

export class PactumEventLogger {
  listen(): void {
    this.listenForRequests();
    this.listenForResponses();
  }

  private listenForRequests(): void {
    pactumEvents.on(
      EVENT_TYPES.BEFORE_REQUEST,
      ({ request }: { request: Record<string, unknown> }) => {
        const { data: _data, ...rest } = request;
        const sanitizedRequest = this.sanitizeRequest(rest);
        apiExecutionLogger.debug(
          { request: sanitizedRequest },
          `Request - ${request?.method} ${request?.path}`,
        );
      },
    );
  }

  private listenForResponses(): void {
    pactumEvents.on(
      EVENT_TYPES.AFTER_RESPONSE,
      ({
        request: _request,
        response,
      }: {
        request: { method: string; path: string };
        response: Record<string, unknown>;
      }) => {
        if (response instanceof Error) {
          apiExecutionLogger.error({ response }, 'Error Response');
        } else {
          apiExecutionLogger.debug(
            { response: this.getRequiredResponseProperties(response) },
            `Response - ${response?.statusCode} - ${response?.responseTime}ms`,
          );
        }
      },
    );
  }

  private sanitizeRequest(request: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...request };
    if (sanitized.headers && typeof sanitized.headers === 'object') {
      const headers = { ...(sanitized.headers as Record<string, unknown>) };
      if (headers['Authorization']) headers['Authorization'] = '******';
      if (headers['Cookie']) headers['Cookie'] = '******';
      if (headers['cookie']) headers['cookie'] = '******';
      sanitized.headers = headers;
    }
    return sanitized;
  }

  private sanitizeResponse(response: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...response };
    if (sanitized.headers && typeof sanitized.headers === 'object') {
      const headers = { ...(sanitized.headers as Record<string, unknown>) };
      if (headers['set-cookie']) headers['set-cookie'] = '******';
      if (headers['authorization']) headers['authorization'] = '******';
      sanitized.headers = headers;
    }
    return sanitized;
  }

  private getRequiredResponseProperties(response: Record<string, unknown>): unknown {
    const sanitized = this.sanitizeResponse(response);
    if (sanitized.body && typeof sanitized.body === 'object') {
      const bodySize = size(sanitized.body);
      if (bodySize > MAX_RESPONSE_BODY_SIZE) {
        return {
          statusCode: sanitized.statusCode,
          responseTime: sanitized.responseTime,
          headers: sanitized.headers,
          body: 'Response body is too large to print',
          bodySize,
        };
      }
    }
    return {
      statusCode: sanitized.statusCode,
      responseTime: sanitized.responseTime,
      headers: sanitized.headers,
      body: sanitized.body,
    };
  }
}
