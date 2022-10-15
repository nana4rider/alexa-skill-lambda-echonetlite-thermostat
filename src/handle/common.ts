import { v4 as uuid } from 'uuid';
import { ApiClient } from '../ApiClient';
import { createReports } from './thermostat';

let apiClient: ApiClient | undefined = undefined;

export function getApiClient() {
  if (!apiClient) {
    if (!process.env.API_URL || !process.env.API_AUTHORIZATION) {
      throw new Error('API_URL or API_AUTHORIZATION is empty.');
    }

    apiClient = new ApiClient(
      process.env.API_URL,
      process.env.API_AUTHORIZATION,
    );
  }
  return apiClient;
}

/**
 * 認証
 *
 * @param request
 * @returns
 */
export async function handleAcceptGrant(request: any) {
  return {
    event: {
      header: {
        namespace: 'Alexa.Authorization',
        name: 'AcceptGrant.Response',
        payloadVersion: '3',
        messageId: uuid(),
      },
      payload: {},
    },
  };
}

/**
 * 状態レポート
 *
 * @param request
 * @returns
 */
export async function handleReportState(request: any) {
  const id = request.directive.endpoint.endpointId as string;

  const client = getApiClient();
  const properties = await client.getProperties(id);

  return {
    event: {
      header: {
        namespace: 'Alexa',
        name: 'StateReport',
        messageId: uuid(),
        correlationToken: request.directive.header.correlationToken,
        payloadVersion: '3',
      },
      endpoint: {
        endpointId: id,
      },
      payload: {},
    },
    context: {
      properties: createReports(properties, 0),
    },
  };
}
