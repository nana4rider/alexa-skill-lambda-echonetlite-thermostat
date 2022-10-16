import { DateTime } from 'luxon';
import { v4 as uuid } from 'uuid';
import { DeviceProperties, OperationMode } from '../ApiClient';
import { getApiClient } from './common';
import { AlexaError } from './error';

/** この閾値から外れる場合、温度をデフォルト設定にする */
export const TEMPERATURE_COOL_THRESHOLD = 24;
/** デフォルトの設定温度  */
export const DEFAULT_TEMPERATURE: Partial<Record<OperationMode, number>> = {
  cooling: 26,
  heating: 20,
};

/**
 * シーン有効
 *
 * @param request
 * @returns
 */
export async function handleChildSceneActivate(request: any) {
  const endpointId = request.directive.endpoint.endpointId as string;
  const [id, childId] = endpointId.split('@');

  if (childId === 'AutoJudge') {
    await handleAutoJudgeActivate(id);
  } else {
    throw new AlexaError();
  }

  return {
    event: {
      header: {
        namespace: 'Alexa.SceneController',
        name: 'ActivationStarted',
        messageId: uuid(),
        correlationToken: request.directive.header.correlationToken,
        payloadVersion: '3',
      },
      endpoint: {
        endpointId: endpointId,
      },
      payload: {
        cause: {
          type: 'APP_INTERACTION',
        },
        timestamp: DateTime.local().toISO(),
      },
    },
    context: {},
  };
}

/**
 * シーン無効
 *
 * @param request
 * @returns
 */
export async function handleChildSceneDeactivate(request: any) {
  const endpointId = request.directive.endpoint.endpointId as string;
  const [applianceId, childId] = endpointId.split('@');

  if (true) {
    throw new Error(`Undefined childId: ${childId}`);
  }

  return {
    event: {
      header: {
        namespace: 'Alexa.SceneController',
        name: 'DeactivationStarted',
        messageId: uuid(),
        correlationToken: request.directive.header.correlationToken,
        payloadVersion: '3',
      },
      endpoint: {
        endpointId: endpointId,
      },
      payload: {
        cause: {
          type: 'APP_INTERACTION',
        },
        timestamp: DateTime.local().toISO(),
      },
    },
    context: {},
  };
}

/**
 * 室温で冷房・暖房・ONしないを自動判断
 *
 * @param endpointId
 */
export async function handleAutoJudgeActivate(endpointId: string) {
  const client = getApiClient();

  const properties = await client.getProperties(endpointId);

  if (properties.operationStatus) {
    return;
  }

  let operationMode: OperationMode | undefined = undefined;
  let changeTemperature = false;

  const now = DateTime.local();
  const coolingFrom = DateTime.local(now.year, 6, 16);
  const coolingTo = DateTime.local(now.year, 9, 15);
  const heating1From = DateTime.local(now.year, 1, 1);
  const heating1To = DateTime.local(now.year, 3, 31);
  const heating2From = DateTime.local(now.year, 11, 1);
  const heating2To = DateTime.local(now.year, 12, 31);

  if (now >= coolingFrom && now <= coolingTo) {
    if (properties.roomTemperature > 28) {
      operationMode = 'cooling';
      changeTemperature =
        properties.targetTemperature < TEMPERATURE_COOL_THRESHOLD;
    }
  } else if (
    (now >= heating1From && now <= heating1To) ||
    (now >= heating2From && now <= heating2To)
  ) {
    if (properties.roomTemperature < 20) {
      operationMode = 'heating';
      changeTemperature =
        properties.targetTemperature >= TEMPERATURE_COOL_THRESHOLD;
    }
  }

  if (!operationMode) {
    return;
  }

  const updateProperties: Partial<DeviceProperties> = {
    operationStatus: true,
  };

  updateProperties.operationMode = operationMode;

  if (changeTemperature) {
    const defaultTemperature = DEFAULT_TEMPERATURE[operationMode];
    if (defaultTemperature) {
      updateProperties.targetTemperature = defaultTemperature;
    }
  }

  await client.updateProperties(endpointId, updateProperties);
}
